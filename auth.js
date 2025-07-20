require("dotenv").config()
const nodeCrypto = require("node:crypto")
const fs = require("node:fs")
const app = require("express")()

const scheme = process.env.DROPBOX_AUTH_SCHEME
const hostname = process.env.DROPBOX_AUTH_HOSTNAME
const port = process.env.DROPBOX_AUTH_PORT
const key = process.env.DROPBOX_APP_KEY
const secret = process.env.DROPBOX_APP_SECRET

const authUri = `${scheme}://${hostname}:${port}`
const redirectUri = `${scheme}://${hostname}:${port}/auth`

// Generate PKCE parameters for security
function generatePKCE() {
  const codeVerifier = nodeCrypto.randomBytes(32).toString('base64url')
  const codeChallenge = nodeCrypto.createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

const pkce = generatePKCE()

app.get("/", (req, res) => {
  const authUrl = 'https://www.dropbox.com/oauth2/authorize?' + new URLSearchParams({
    client_id: key,
    response_type: 'code',
    redirect_uri: redirectUri,
    token_access_type: 'offline', // For refresh token
    scope: 'files.metadata.read files.content.read files.content.write',
    code_challenge: pkce.codeChallenge,
    code_challenge_method: 'S256',
    include_granted_scopes: 'user'
  }).toString()
  
  console.log('Redirecting to Dropbox authorization:', authUrl)
  res.writeHead(302, { Location: authUrl })
  res.end()
})

app.get("/auth", async (req, res) => {
  const { code } = req.query
  
  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code,
        grant_type: 'authorization_code',
        client_id: key,
        client_secret: secret,
        redirect_uri: redirectUri,
        code_verifier: pkce.codeVerifier
      })
    })
    
    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status} ${await tokenResponse.text()}`)
    }
    
    const tokenData = await tokenResponse.json()
    console.log('Token received successfully!')
    console.log('Scopes:', tokenData.scope)
    
    // Prepare credentials object
    const credentials = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      expires_at: Date.now() + tokenData.expires_in * 1000 - 10000, // Safety margin
      token_type: tokenData.token_type,
      scope: tokenData.scope,
      account_id: tokenData.account_id,
      created_at: new Date().toISOString()
    }
    
    // Save credentials to file
    fs.writeFileSync("credentials.json", JSON.stringify(credentials, null, 2))
    
    const message = "Successfully authenticated. You may now close the browser. Check credentials.json file."
    console.log(message)
    
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(`
      <html>
        <body>
          <h1>Success!</h1>
          <p>${message}</p>
          <p>Scopes: ${tokenData.scope}</p>
          <p>Token expires in: ${Math.round(tokenData.expires_in / 3600)} hours</p>
        </body>
      </html>
    `)
    
    // Exit after a short delay to allow response to be sent
    setTimeout(() => process.exit(0), 1000)
    
  } catch (error) {
    console.error('Authentication error:', error)
    res.writeHead(500, { 'Content-Type': 'text/html' })
    res.end(`
      <html>
        <body>
          <h1>Authentication Failed</h1>
          <p>Error: ${error.message}</p>
          <p>Please check the console for more details and try again.</p>
        </body>
      </html>
    `)
  }
})

app.listen(port)
console.log(`Server listening on ${authUri}, When the browser is not opened, open it manually`)
import("open").then(open => open.default(authUri))