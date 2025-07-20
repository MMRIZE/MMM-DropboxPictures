# MMM-DropboxPictures

MagicMirror module for presenting Pictures from Dropbox (Successor of MMM-DropboxWallpaper)

> This module is a direct successor of previous `MMM-DropboxWallpaper`. I need to rebuild new one, and now will be hosted by me again.

## DEMO

![MMM-DropboxPictures Example](https://img.youtube.com/vi/M7-IKi9dtKI/0.jpg)

[Click To Play](https://www.youtube.com/watch?v=M7-IKi9dtKI)

## Features and Information

This module will download images (one-by-one) from Dropbox and use it as a fullscreen wallpaper.

### This module might be good for who...

- has NOT A SUFFICIENT storage on his Raspberry Pi.
- has TONS of images already in `Dropbox` and wants to show MOST of them.
- is not familiar with using `FTP`/`SFTP`/`NETATALK`/`SAMBA`, ... So he just wants to throw his image into a dropbox folder simply.
- share the photos with others, and want to manage showing their photos on `MM` easily.

### Not so good for who...

- has a just a few images. (It would be better to save them into your PI and serve them directly.)
- wants to work in offline. (Dropbox needs internet connection)

## Installation

```sh
cd ~/MagicMirror/modules
git clone https://github.com/MMRIZE/MMM-DropboxPictures
cd MMM-DropboxPictures
npm install
```

## Preparation

### 1. Setting Dropbox App

1. Login Dropbox App Console( https://www.dropbox.com/developers/apps).
2. `Create app` or choose an existing one(See 3.).

- Choose An API - `Scoped access`
- Choose the type of access you need - `Full Dropbox` or `App folder` (Anything is OK, but if you want to access pictures already existing, select `Full Dropbox`)
- Name your app
- Then confirm the `Create App` button.

3. In the `Settings` of the app configuration (After app creation or select an existing one)

- Add **`http://localhost:3000/auth`** into `OAuth2/Redirect URIs` field.
- Remember `App key` and `App secret`. Those will be used later.

4. In the `Permissions` of the app configuration.

- Check these fields. (Some might be already checked)
  - `account_info.read`, `files.metadata.read`, `files.content.read`
- **IMPORTANT**: After changing permissions, you MUST generate a new access token by running the auth script again (see step 2 below).

### 2. Authentification

1. Open the `.env` file in this module directory after installation. The `.env` file might be created automatically, but if you cannot find it, just make one by copying `example.env`.
2. Fill the `DROPBOX_APP_KEY=` and `DROPBOX_APP_SECRET=` properties, then save.
3. now, execute `auth.js`

```sh
cd ~/MagicMirror/modules/MMM-DropboxPictures
node auth.js
```

4. It will instruct you to open a browser and navigate to `http://localhost:3000/auth`. Follow that. You may be requested to confirm auth for this module.
5. After auth, the `credentials.json` file would be created.

### 3. Get LocationIQ API Key (optional)

1. Visit http://locationiq.org and sign up.
2. You can get the key on the page or receive it via mail. Also, remember it.
3. Fill `LOCATIONIQ_TOKEN=` in `.env` file.
4. Final `.env` may look like something similar to this;

```env
DROPBOX_AUTH_SCHEME=http
DROPBOX_AUTH_HOSTNAME=localhost
DROPBOX_AUTH_PORT=3000
DROPBOX_APP_KEY=abc...a6g
DROPBOX_APP_SECRET=b6y...ij2
LOCATIONIQ_TOKEN=0ba...456
```

> **WARNING** Free LocationIQ API has a quota limit 5000 calls per day. Even though this module is caching geo information from previous call, but also the cache size is limited to 5000. To keep this limitation, the value of `imageLife` needs to be at least more than 30seconds (`1000*30`). With that lifetime, you can show almost 2880 pictures a day. I think it's sufficiently enough for normal usage. If you are using paid-plan for LocationIQ, you don't have to care this limitation.

## Configuration

### Simplest

```js
{
  module: 'MMM-DropboxPictures',
  position: 'fullscreen_below',
},
```

> This configuration will try to search all images from your Dropbox account and will serve by default config values. Images will show on fullscreen below of MM screen.
> ... Yup, even this will work.

### Real usage example.

```js
// For Full Dropbox app accessing a specific folder
{
  module: 'MMM-DropboxPictures',
  position: 'top_left', // `fullscreen_below` is more usual.
  //header: "DROPBOX",
  config: {
    verbose: true,
    imageLife: 1000 * 60 * 30, // 30 minutes
    directory: "/Photos", // For Full Dropbox: absolute path with /
    fileNames: [ "DSC", /^IMG/ ],
    width: "400px", // For fullscreen, "100%" would be fit.
    height: "400px",
    ...
  }
},

// For App-folder app (most common setup)
{
  module: 'MMM-DropboxPictures',
  position: 'fullscreen_below',
  config: {
    verbose: true,
    imageLife: 1000 * 60 * 30, // 30 minutes
    directory: "", // Empty string = scan entire app folder /Apps/YourAppName/
    // OR: directory: "photos", // Scan /Apps/YourAppName/photos/
    ...
  }
},

```

### Configuration Properties with default values

#### verbose : `false`

This module will be very talkative in the log if set as `true`.

#### width : `"100%"`

The width of the module. e.g. `"300px"`

- For the fullscreen, `"100%"` or `"100vw"` would be recommended.

#### height : `"100%"`

The height of the module. e.g. `"50dvh"`

- For the fullscreen, `"100%"` or `"100vh"` would be recommended.

#### autostart : `true`

Whether this module will start to display images after scanning.

#### imageLife : `600_000`

(ms) period of the displaying one picture. The default will be 10 minutes (600,000 ms). The minimum value is `10_000` (10s).

- If you are using free-tier `LOCATIONIQ` geocoding, more than `30_000`(30s) would be recommended due to the API usage limit. (API Quota: 5,000 times a day)

#### directory : `""`

Where to scan in Dropbox. Subfolders will be included.

- **IMPORTANT for App-folder apps**: When you select `App folder` instead of `Full Dropbox`, you can only access files within your app's folder (`/Apps/YourAppName/`). However, the API treats this app folder as the root directory, so:
  - `""` (empty string): Scans your entire app folder `/Apps/YourAppName/` - **This is what you want for most App-folder setups**
  - `"subfolder"`: Scans `/Apps/YourAppName/subfolder/`
  - `"photos/family"`: Scans `/Apps/YourAppName/photos/family/`
  - ❌ `"/Apps/YourAppName"` or `"/Apps/YourAppName/subfolder"` will NOT work (absolute paths are not allowed)
- **For Full Dropbox apps**:
  - `""`: Scans the entire Dropbox root directory
  - `"/Photos"`: Scans the `/Photos` folder (absolute paths with leading `/` are required)
  - `"/path/to/folder"`: Scans specific folders (SHOULD start from `/`)

#### fileExtensions : `[ ... ]`

You can limit the file extensions to scan.

- default: "jpg", "jpeg", "png", "gif", "bmp",
  "webp", "apng", "svg", "avif", "tiff",
  "jtif", "pjpeg", "pjp",
- For example, if you set this `['jpg', 'png']`, you will get only `XXXX.jpg` or `XXXX.png` but not `XXXX.gif`
- By default, this module will get the files categorized as `Picture` by DROPBOX, so `docx` or `mp4` would be meaningless and will be ignored.

#### fileNames: `[]`

You can filter the scanned files with its name. These values are array of **string** or **regular expression**.

```js
fileNames: ["IMG", /^DSC_/],
```

This will search files - 1) "IMG" is included in its file name or 2) the filename starts with "DSC\_".

To get all the files, just leave it as `[]`, or remove this property.

#### fileSizeMinMax: `[10_000, 10_000_000]`

(bytes) You can filter scanned files by their file size. This default value means `More than 10KB and less than 10MB`.

- But too heavy files could make the performance down or memory leak. It would be better to resize to use your pictures as background wallpaper.

#### serverModifiedTimeMinMax: `["1980-01-01", "2100-12-31"]`

#### clientModifiedTimeMinMax: `["1980-01-01", "2100-12-31"]`

You can filter scanned files by their modified time. Read [this](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format) for the available format.

Anyway, these properties are not so useful in my thought.

> By the stupidity of Dropbox API, It is hard to sort by **picture taken time**, sorry. (Possible, but it will take very long time. So I drop out that feature.)

#### sort: `"random"`

- Availables: 'relevance', 'last_modified_time', 'random', 'filenameASC', 'filenameDESC', 'serverTimeASC', 'serverTimeDESC', 'clientTimeASC', 'clientTimeDESC'

#### sort: `(a,b) => { ... }`

Or you can define your own function to sort. (For Expert)

#### maxImages: `3000`

Trimming filtered/sorted images by numbers.

#### objectFit: `"auto"`

How the picture will fit in the target area.

- Availables: 'auto' and 'cover', 'contain', ... (See [this](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit))
- Other values would not be important. Only `cover` and `contain` would have a worth to ment.
  - `cover` : will cover the whole area with the image regardless of some edges would be cut by overflowing.
  - `contain` : will show the whole image in the area regardless of screen ratio, so usually the image will be letterboxed.
- `auto` will change `cover` and `contain` dynamically by the dimension ratio of the image and the container.

#### fillBackground: `true`

It will try to fill the empty area of `contain` with the picture.

> In case of `mode:cover`, this option is meaningless. Set it `false`
> In some low-powered device, this option may give some burden to the system. In case, set it `false` also.

#### rescanLoop: `true`

Whether it restarts after the last image displayed.

- When `false` is set, the last image will be displayed permanently until reset or new scan.

#### hideOnFinish: `false`

When it set as `true`, after life of the last image, it will be hidden(blank) regardless of `rescanLoop`.

#### showInformation: `(informationObj) => { return HTMLText }` (For Expert)

- If you are not experienced, just don't set it. (Remove this property in the config, if you have set it already.)
- By default, it will show the time and location(if possible) of the picture that was taken.
- If you don't want to show this kind of information, just set `false`. For example, when you just show CG images, not real photos, in that case, you don't need this information.
- But if you have some skill to handle, you can use this to show EXIF info or anything.
- Example (current default)

```js
showInformation: ({ item, exif, location, options }) => {
  const createdAt = new Date(item?.media_info?.metadata?.time_taken ?? exif?.DateTimeOriginal ?? exif?.DateTime ?? exif?.CreateDate ?? item?.server_modified ?? item?.client_modified)
  const date = new Intl.DateTimeFormat(options.locale, options.datetimeFormat).formatToParts(createdAt).reduce((prev, cur, curIndex, arr) => {
    prev = prev + `<span class="timeParts ${cur.type} seq_${curIndex} ${cur.source}">${cur.value}</span>`
    return prev
  }, '')
  return `<div class="date">${date}</div>`
  + ((location)
    ? `<div class="address"><span class="addressParts city">${location?.city}</span> <span class="addresParts country">${location?.country}</span></div>`
    : ''
  )
},
```

#### dateTimeFormat: `{ dateStyle: "short", timeStyle: "short" }`

Used in default `showInformation` to format time of picture taken.

- Ref. [this](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#options)

#### locale: `null`

Used in default `showInformation` to format time and location information. e.g. `"ko"`, `"en-GB"`, ...

- When it is set as `null`, it will be inherited from MM's language or locale value.

#### reverseGeocoding: `true`

When you have `LOCATIONIQ_KEY` in `.env` file, you can get the near address of the picture taken. When you set it as `false`, Address information will not be shown.

#### thumbnail: `"2048x1536"`

- Availables: false, '32x32', '64x64', '128x128', '256x256', '480x320', '640x480', '960x640', '1024x768', '2048x1536'
- When you set it as `false`, The original file will be downloaded. Usually, it could be too heavy for MM.
- All sizes are fixed. You have to use only these values not custom(e.g. not to try '1920x1080'). You can regard this as a kind of quality indicator. Regardless of the original picture ratio, select the nearly expected size. The picture will be resized without distortion.

#### callback: `(eventName, payload) => { }` (For Expert)

The module will call this callback at several major events happen. (`scanned`, `served`, ...) You can use this callback function to extend the features for yourself. Usually, this option would be used for other 3rd-party module collaborations.

## Notification

### Outgoing Notifications

Nothing. Do you need?

If your other module wants to control from this module, send **`DBXP_SCAN`** with `callback` option. you can get the feedback in the callback functions.

### Incoming Notifications. (For Expert)

- `DBXP_SCAN` : payload(configObj)
  - Only this notification could have a config object as a payload. The module will start to scan with new conditions.
  - Unset values will be inherited from the module's default config value. (not from configured in config.js)
  - If you set `callback`, the module can get feedback on each important event that happens.

```js
this.sendNotification('DBXP_SCAN', {
  imageLife: 1000 * 60 * 30,
  directory: "/Photos/family",
  callback: (message, payload) => {
    if (message === 'served') console.log(payload.item)
    ...
  }
})
```

You can use this notification for images serving by conditions on fly. For example, with `MMM-Buttons` module, you can change images from the landscapes to your family pictures. (Guess how it could as a homework. :D)

- `DBXP_RESET`
  This notification makes the module will reset to original configs (If it was changed by `DBXP_SCAN` notification)

- `DBXP_PAUSE`
  Will pause the loop. Current image will be last until `DBXP_RESUME`(or new serving from `DBXP_SCAN` or `DBXP_RESET`)

- `DBXP_RESUME`
  Will resume the loop.

- `DBXP_NEXT`
  Show the next image.

- `DBXP_PREV`
  Show the previous image.

## Not a bug, but ...

- I deprecated the feature of re-orienting the picture that is wrongly oriented. I think this was somehow a burden to MM. When you discover a wrongly oriented picture, just rotate and save it on your Desktop PC.
- In some low-profile devices or with too big pictures, the heavy or wrongly composed animation effect makes the performance slow down or some memory-leaks.
  In that case, use a simpler animation. (`fillBackground: false` also be recommended)

```css
/* custom.css */
@keyframes info {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes bg-enter {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes bg-exit {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
@keyframes ani-enter {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes ani-exit {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
```

> And also in `cover` mode, you don't need `fillBackground:true`. It makes no sense.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed history of changes.

## More Info

- Discussion board: https://github.com/MMRIZE/MMM-DropboxPictures/discussions
- Bug Report: https://github.com/MMRIZE/MMM-DropboxPictures/issues

## Author

- Seongnoh Yi (eouia0819@gmail.com)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Y8Y56IFLK)
