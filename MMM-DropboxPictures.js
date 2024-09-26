/* eslint-disable no-unused-vars */
/* global Module Log config */


/* MagicMirror² Module: MMM-DropboxPictures
* By eouia
*/

Module.register("MMM-DropboxPictures", {
  defaults: {
    width: "100%",
    height: "100%",
    verbose: false,
    autostart: true,
    imageLife: 1000 * 60,
    directory: "", // root of directories to be scanned.
    fileExtensions: [
      "jpg", "jpeg", "png", "gif", "bmp",
      "webp", "apng", "svg", "avif", "tiff",
      "jtif", "pjpeg", "pjp",
    ],
    fileNames: [],
    fileSizeMinMax: [ 10_000, 10_000_000 ], // [min, max] (bytes)
    serverModifiedTimeMinMax: [ "1980-01-01", "2100-12-31" ],
    clientModifiedTimeMinMax: [ "1980-01-01", "2100-12-31" ],
    sort: 'random', // 'relevance', 'last_modified_time', 'random', 'filenameASC', 'filenameDESC', 'serverTimeASC', 'serverTimeDESC', 'clientTimeASC', 'clientTimeDESC'
    // sort: () => {}, // custom sort function

    objectFit: 'auto', // 'cover', 'contain', 'auto',
    fillBackground: true, // true or false
    rescanLoop: true, // true or false

    hideOnFinish: false,
    maxImages: 3000,

    datetimeFormat: { dateStyle: "short", timeStyle: "short" }, //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#options
    locale: null, // null, 'en-US'
    reverseGeocoding: true,
    showInformation: ({ location, item, exif, options }) => {
      const createdAt = new Date(item?.media_info?.metadata?.time_taken ?? exif?.DateTimeOriginal ?? exif?.DateTime ?? exif?.CreateDate ?? item?.server_modified ?? item?.client_modified)
      const date = new Intl.DateTimeFormat(options.locale, options.datetimeFormat).formatToParts(createdAt).reduce((prev, cur, curIndex, arr) => {
        prev = prev + `<span class="timeParts ${cur.type} seq_${curIndex} ${cur.source}">${cur.value}</span>`
        return prev
      }, '')
      return `<div class="date">${date}</div>`
      + ((location?.city)
        ? `<div class="address"><span class="addressParts city">${location?.city}</span> <span class="addresParts country">${location?.country}</span></div>`
        : ''
      )
    },
    callback: () => { },
    thumbnail: '2048x1536', //false, '32x32', '64x64', '128x128', '256x256', '480x320', '640x480', '960x640', '1024x768', '2048x1536'
  },

  getStyles: function () {
    return [ "MMM-DropboxPictures.css" ]
  },

  start: async function () {
    this.modules = await import('./library.mjs')
    this.images = null
    this.index = 0
    this.originalConfig = { ...this.regularizeConfig(this.config) }
    this.activeConfig = { ...this.originalConfig }
    this.sendSocketNotification('INITIALIZE')
    this.running = this.activeConfig.autostart
    this.timer = new this.modules.Timer()
    this.log = (this.activeConfig.verbose) ? console.log : () => { }
  },

  regularizeConfig: function (options) {
    options = { ...this.defaults, ...options }
    options.imageLife = Math.max(options.imageLife, 1000 * 30)
    if (typeof options.fileNames === 'string') options.fileNames = [ options.fileNames ]
    if (Array.isArray(options.fileNames)) {
      options.fileNames = options.fileNames.map((f) => {
        const r = (f instanceof RegExp) ? f : new RegExp(f)
        return {
          source: r.source,
          flags: r.flags,
        }
      })
    }
    options.fileSizeMinMax = (Array.isArray(options.fileSizeMinMax) && options.fileSizeMinMax.length == 2 && options.fileSizeMinMax.every((v) => !isNaN(v)))
    ? options.fileSizeMinMax : this.defaults.fileSizeMinMax
    const isValidTime = (v) => {
      return v && isNaN(v)
    }
    options.clientModifiedTimeMinMax = (Array.isArray(options.clientModifiedTimeMinMax) && options.clientModifiedTimeMinMax.length == 2 && options.clientModifiedTimeMinMax.every((v) => isValidTime(v)))
      ? options.clientModifiedTimeMinMax : this.defaults.clientModifiedTimeMinMax
    options.serverModifiedTimeMinMax = (Array.isArray(options.serverModifiedTimeMinMax) && options.serverModifiedTimeMinMax.length == 2 && options.serverModifiedTimeMinMax.every((v) => isValidTime(v))) ?
      options.serverModifiedTimeMinMax : this.defaults.serverModifiedTimeMinMax

    options.locale = Intl.getCanonicalLocales(options.locale ?? config.language ?? config.locale)?.[ 0 ] ?? ''
    options.callback = (typeof options.callback === 'function') ? options.callback : () => { }
    return options
  },



  prepare: function (config = null) {
    if (typeof config === 'object') this.activeConfig = { ...config }
    const { ImageList } = this.modules
    this.images = new ImageList(this.activeConfig)
    this.log('[DBXP] Prepare to scan.')
    this.errors = 0
    this.sendSocketNotification('SCAN', this.images.getOptions())
  },

  notificationReceived: function(noti, payload, sender) {
    switch (noti) {
      case 'DBXP_SCAN':
        this.log(`[DBXP] External request to scan. Current serving is finished.`)
        this.prepare(this.regularizeConfig(payload))
        break
      case 'DBXP_RESET':
        this.log(`[DBXP] External request to reset. Current serving is finished.`)
        this.images.callback('reset')
        this.prepare(this.originalConfig)
        break
      case 'DBXP_PAUSE':
        this.log(`[DBXP] External request to stop. Current serving will pause.`)
        this.timer.pause()
        this.images.callback('paused', {...this.images.getServing()})
        break
      case 'DBXP_RESUME':
        this.log(`[DBXP] External request to resume. Current serving will resume.`)
        if (!this.timer.resume()) {
          this.log(`[DBXP] Wrong request to resume. This request will be ignored.`)
        } else {
          this.images.callback('resumed', {...this.images.getServing()})
        }
        break
      case 'DBXP_NEXT':
        this.log(`[DBXP] External request to next.`)
        if (this.images.servable()) {
          this.sendSocketNotification('SERVE', {
            item: this.images.activate(1),
            options: this.images.getOptions()
          })
        }
        break
      case 'DBXP_PREV':
        this.log(`[DBXP] External request to prev.`)
        if (this.images.servable()) {
          this.sendSocketNotification('SERVE', {
            item: this.images.activate(-1),
            options: this.images.getOptions()
          })
        }
        break
    }
  },

  socketNotificationReceived: function (noti, payload) {
    switch (noti) {
      case 'SCANNED':
        this.images.loadScanned(payload?.scanned ?? [])
        if (this.images.servable()) {
          if (this.images.autostart()) {
            this.sendSocketNotification('SERVE', {
              item: this.images.activate(0),
              options: this.images.getOptions()
            })
          }
        } else {
          this.log('[DBXP] Scanned images are not servable.')
        }
        this.images.callback('scanned', this.images.getList())
        break
      case 'SERVE_FAILED':
        this.onServeFailed(payload.item, payload.error)
        break
      case 'SERVED':
        this.images.serve(payload?.serving).then(() => {
          this.updateView()
        }).catch((e) => {
          console.error(e.stack)
          this.errors++
          if (this.errors > 5) {
            this.log('[DBXP] Too many errors. It will stop.')
            return
          }
          if (this.images.getLength() > 0) {
            this.log('[DBXP] Image is not loaded. It will request the next.')
            this.sendSocketNotification('SERVE', {
              item: this.images.activate(1),
              options: this.images.getOptions()
            })
          } else {
            this.log('[DBXP] No image to serve anymore.')
          }
        })
        break
      case 'INITIALIZED':
        this.log('[DBXP] MMM-DropboxPictures is ready.')
        this.prepare(this.originalConfig)
        break
    }
  },

  resetView: function () {
    this.timer.stop()
    this.updateDom()
  },

  updateView: function () {
    if (!this.images.servable()) return
    if (this.hidden) this.show('DBXP', () => { 
      this.log('[DBXP] Revealed.')
    }, { lockstring: 'DBXP_' + this.identifier })
    const options = this.images.getOptions()
    this.timer.stop()
    const r = this.replaceImage()
    if (this.images.getLength() <= 1) {
      this.log('[DBXP] No image to request the next.')
      return
    }
    if (this.images.isFinal()) {
      this.log('[DBXP] Reached the end of images.')
    }
    this.timer.start(() => {
      //TODO : how to handle the final image? (hide or rescan)
      if (this.images.isFinal() && this.images.hideOnFinish()) {
        this.hide('DBXP', () => {
          this.log('[DBXP] Hidden.')
        }, { lockstring: 'DBXP_' + this.identifier })
        return
      } else if (this.images.isFinal() && !this.images.rescanLoop()) {
        this.log('[DBXP] No more request.(rescanLoop:false)')
        return
      } else if (this.images.isFinal() && this.images.rescanLoop()) {
        this.log('[DBXP] Request the next after rescan.')
        this.sendSocketNotification('SCAN', this.images.getOptions())
      } else {
        this.log('[DBXP] Request the next.')
        this.sendSocketNotification('SERVE', {
          item: this.images.activate(1),
          options: this.images.getOptions()
        })
      }
    }, options.imageLife)
  },

  onServeFailed: function (item, error) {
    this.log(`[DBXP] ${item?.name} serve failed:`, error)
    this.errors++
    if (this.errors > 5) {
      this.log('[DBXP] Too many errors. It will stop.')
      //this.sendSocketNotification('SCAN', this.images.getOptions())
      return
    }
    this.images.callback('serveFailed', { item, error })
    this.sendSocketNotification('SERVE', {
      item: this.images.activate(1),
      options: this.images.getOptions()
    })
  },

  replaceImage: function () {
    const container = document.getElementById("DBXP_CONTAINER_" + this.identifier)
    const { img } = this.images?.getServing() ?? { img: null }
    if (img) {
      const previous = container.getElementsByClassName("picture")?.[ 0 ] || null
      if (previous) {
        previous.onanimationend = () => {
          previous.onanimationend = null
          container.removeChild(previous)
        }
        previous.classList.add("exit")
      }
      img.classList.add('picture')
      img.style.setProperty('--object-fit', this.images.getObjectFit(container))
      img.onanimationend = () => {
        img.ontransitionend = null
        img.classList.remove("enter")
      }
      container.append(img)
      img.classList.add("enter")
      this.images.fillBackground(container)
      this.images.showInformation(container)
      this.images.callback('served', {...this.images.getServing()})
    } else {
      this.log('[DBXP] No image to draw.')
      return false
    }
  },

  getDom: function () {
    const wrapper = document.createElement("div")
    wrapper.classList.add("DBXP")
    wrapper.id = "DBXP_" + this.identifier
    wrapper.style.setProperty('--width', this.activeConfig.width)
    wrapper.style.setProperty('--height', this.activeConfig.height)
    const container = document.createElement("figure")
    container.classList.add("container")
    container.id = "DBXP_CONTAINER_" + this.identifier
    wrapper.appendChild(container)
    return wrapper
  },
})
