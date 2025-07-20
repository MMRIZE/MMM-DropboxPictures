const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '.env') })
const fs = require('fs')
const exifr = require('exifr')

const STORE = path.join(__dirname, 'cache')
const LOCATIONIQ_URL = 'https://us1.locationiq.org/v1/reverse?'
const GEO_CACHE_LIMIT = 5000
const DROPBOX_API_BASE = 'https://api.dropboxapi.com/2'
const DROPBOX_CONTENT_BASE = 'https://content.dropboxapi.com/2'

var log = () => { }

const geoCache = new Map()

const NodeHelper = require('node_helper')
module.exports = NodeHelper.create({
  start: function () {
    this.credentials = require('./credentials.json')
  },

  socketNotificationReceived: async function (noti, payload) {
    switch(noti) {
      case 'INITIALIZE':
        this.initializeAfterLoading()
        break
      case 'SCAN':
        { const r = await this.scan(payload)
        this.sendSocketNotification('SCANNED', r)
        break }
      case 'SERVE':
        await this.serve(payload)
        break
    }
  },

  initializeAfterLoading: function() {
    log('[DBXP] Configuration is initialized.')
    this.accessToken = this.credentials.access_token
    log('[DBXP] Dropbox API is initialized.')
    this.sendSocketNotification('INITIALIZED')
  },

  // Helper function to make Dropbox API calls
  dropboxRequest: async function(endpoint, body = null, useContentApi = false) {
    const baseUrl = useContentApi ? DROPBOX_CONTENT_BASE : DROPBOX_API_BASE
    const url = `${baseUrl}${endpoint}`
    
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      }
    }
    
    if (body) {
      options.body = JSON.stringify(body)
    }
    
    const response = await fetch(url, options)
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Dropbox API Error (${response.status}): ${errorText}`)
    }
    
    return response.json()
  },

  // Helper function for content downloads
  dropboxDownload: async function(endpoint, body) {
    const url = `${DROPBOX_CONTENT_BASE}${endpoint}`
    
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Dropbox-API-Arg': JSON.stringify(body),
      }
    }
    
    const response = await fetch(url, options)
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Dropbox Download Error (${response.status}): ${errorText}`)
    }
    
    return {
      result: {
        fileBinary: await response.arrayBuffer()
      },
      status: response.status
    }
  },

  scan: async function (options) {
    log = (options.verbose) ? console.log : () => { }
    const scanned = []
    
    const processItem = async (item) => {
      if (item[ '.tag' ] !== 'file') return
      if (!item.is_downloadable) return
      
      // Filter by file extension if provided
      if (options.fileExtensions && options.fileExtensions.length > 0) {
        const fileExt = item.name.split('.').pop().toLowerCase()
        if (!options.fileExtensions.includes(fileExt)) return
      }
      
      scanned.push(item)
    }

    const scanFolder = async (folderPath = '') => {
      try {
        log(`[DBXP] Scanning folder: ${folderPath || '/'}`)
        
        const listArgs = {
          path: folderPath,
          recursive: true,
          include_media_info: true,
          include_deleted: false,
          include_has_explicit_shared_members: false,
          include_mounted_folders: true,
          limit: 2000
        }
        
        const result = await this.dropboxRequest('/files/list_folder', listArgs)
        
        for (const item of result.entries) {
          await processItem(item)
        }
        
        // Handle pagination if needed
        if (result.has_more) {
          await continueListFolder(result.cursor)
        }
        
      } catch (err) {
        if (err.message.includes('path/not_found')) {
          console.error(`[DBXP] Folder not found: ${folderPath}`)
          log(`[DBXP] Let's list the root directory to see available folders...`)
          
          try {
            // List root directory to show available folders
            const rootResult = await this.dropboxRequest('/files/list_folder', { path: '' })
            log(`[DBXP] Available folders in root:`)
            rootResult.entries
              .filter(item => item['.tag'] === 'folder')
              .forEach(folder => log(`  - ${folder.name} (${folder.path_display})`))
          } catch (rootErr) {
            console.error(`[DBXP] Could not list root directory:`, rootErr)
          }
        } else {
          console.error(`[DBXP] Error scanning folder ${folderPath}:`, err)
        }
      }
    }
    
    const continueListFolder = async (cursor) => {
      try {
        const result = await this.dropboxRequest('/files/list_folder/continue', { cursor })
        
        for (const item of result.entries) {
          await processItem(item)
        }
        
        if (result.has_more) {
          await continueListFolder(result.cursor)
        }
      } catch (err) {
        console.error('[DBXP] Error continuing folder list:', err)
      }
    }

    try {
      log('[DBXP] Starting scan.')
      
      // Try different path variations
      let targetPath = options.directory || ''
      
      if (targetPath) {
        // Try common path variations
        const pathVariations = [
          targetPath,                           // Original path (e.g., "/Photos")
          targetPath.replace(/^\//, ''),        // Without leading slash (e.g., "Photos")
          `/${targetPath.replace(/^\//, '')}`,  // Ensure single leading slash
        ]
        
        let foundPath = null
        for (const pathVariant of pathVariations) {
          try {
            log(`[DBXP] Trying path variant: "${pathVariant}"`)
            const testResult = await this.dropboxRequest('/files/get_metadata', { path: pathVariant })
            if (testResult['.tag'] === 'folder') {
              foundPath = pathVariant
              log(`[DBXP] Found valid folder at: "${foundPath}"`)
              break
            }
          } catch {
            log(`[DBXP] Path "${pathVariant}" not found, trying next...`)
          }
        }
        
        if (foundPath) {
          await scanFolder(foundPath)
        } else {
          log(`[DBXP] Could not find folder with any path variation. Scanning root instead.`)
          await scanFolder('')
        }
      } else {
        await scanFolder('')
      }
    } catch (err) {
      console.error('[DBXP] Scan error:', err)
    } finally {
      log(`[DBXP] ${scanned.length} files are matched, but will be filtered on the module.`)
    }
    return { scanned }
  },

  serve: async function ({ item, options }) {
    const filePath = path.join(STORE, "temp")
    try {
      const tryThumbnail = async (item, options) => {
        try {
          if (!options.thumbnail) return false
          const availableThumbnailSizes = [ '32x32', '64x64', '128x128', '256x256', '480x320', '640x480', '960x640', '1024x768', '2048x1536' ]
          const thumbnailSize = availableThumbnailSizes.find((s) => { return s === options.thumbnail })
          if (!thumbnailSize) return false
          const size = 'w' + thumbnailSize.replace('x', 'h')
          
          const thumbnailArgs = {
            resource: { path: item.path_lower, '.tag': 'path' },
            format: { '.tag': 'jpeg' },
            size: { '.tag': size },
            mode: { '.tag': 'fitone_bestfit' },
          }
          
          const result = await this.dropboxDownload('/files/get_thumbnail_v2', thumbnailArgs)
          return result
        } catch (err) {
          log(`[DBXP] Failed to download thumbnail.`, err)
          log(`[DBXP] Trying to download original file.`)
          return false
        }
      }
      const getReverseGeocode = async function ({ latitude = null, longitude = null } = {}) {
        const useReverseGeocoding = process.env.LOCATIONIQ_TOKEN && options.reverseGeocoding
        if (!useReverseGeocoding || !(latitude && longitude)) return null

        const res = await fetch(
          LOCATIONIQ_URL
          + new URLSearchParams({
            format: 'json',
            key: process.env.LOCATIONIQ_TOKEN,
            lat: latitude,
            lon: longitude,
            normalizeaddress: 1,
            normalizecity: 1,
            "accept-language": options.locale,
          }
          ))

        if (geoCache.has(`${latitude},${longitude}`)) {
          return geoCache.get(`${latitude},${longitude}`).address
        } else {
          const data = await res.json()
          if (data?.address) {
            geoCache.set(`${latitude},${longitude}`, {
              address: data.address,
              timeStamp: Date.now(),
            })
            if (geoCache.size > GEO_CACHE_LIMIT) {
              geoCache.delete(geoCache.keys().next().value)
            }
            return data.address
          }
          return {}
        }
      }
      
      let result = await tryThumbnail(item, options)
      if (!result) {
        result = await this.dropboxDownload('/files/download', { path: item.path_lower })
      }

      if (result?.status !== 200) throw new Error(`Failed to download. (status:${result.status})`)

      const metadata = await this.dropboxRequest('/files/get_metadata', {
        path: item.path_lower,
        include_media_info: true,
      })

      if (metadata?.media_info?.metadata) {
        item.media_info = metadata.media_info
      }

      fs.writeFileSync(filePath, Buffer.from(result.result.fileBinary))

      log("[DBXP]", item.name, "is downloaded.")
      const timeStamp = Date.now()
      const url = '/modules/MMM-DropboxPictures/cache/temp?' + timeStamp
      const exif = await exifr.parse(filePath)
      const location = await getReverseGeocode(item?.media_info?.metadata?.location ?? exif)
      const serving = {
        item,
        filePath,
        url,
        exif,
        location,
        timeStamp,
      }
      this.sendSocketNotification('SERVED', { serving })
      log('[DBXP] Serving:', item.name)
    } catch (err) {
      log(`[DBXP] ${item.name} failed to serve.`, err)
      console.error(err.stack)
      this.sendSocketNotification('SERVE_FAILED', { item, err })
    }
  },
})
