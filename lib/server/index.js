'use strict'
const ExpressHTTPServer = require('fastboot-app-server/src/express-http-server')
const enforce = require('express-sslify')
const compression = require('compression')

const {
  LETS_ENCRYPT_TOKEN,
  LETS_ENCRYPT_SIGN_TOKEN,
  ENABLE_SSL,
  PORT
} = process.env

class ECServer extends ExpressHTTPServer {
  constructor (options) {
    super(options)
    this.setupCustomHandlers()
  }

  setupCustomHandlers () {
    this.setupSSL()
    this.setupLetsEncrypt()
  }

  setupSSL () {
    if (ENABLE_SSL === 'true') {
      if (!LETS_ENCRYPT_TOKEN || !LETS_ENCRYPT_SIGN_TOKEN) {
        throw new Error('LETS_ENCRYPT_TOKEN and LETS_ENCRYPT_SIGN_TOKEN not set in env')
      }

      this.app.use(enforce.HTTPS({
        trustProtoHeader: true
      }))
    }
  }

  setupLetsEncrypt () {
    this.app.get('/.well-known/acme-challenge/:token', (req, res, next) => {
      const { params: { token } } = req
      this.ui.writeLine(`Lets Encrypt Token: ${token}`)
      if (!token || token !== LETS_ENCRYPT_TOKEN) {
        return res.status(404).end()
      }
      res.send(LETS_ENCRYPT_SIGN_TOKEN)
    })
  }

  serve (middleware) {
    this.beforeMiddleware(this.app)

    this.app.use(compression())

    this.app.get('/*',
      this.serveABTesting(),
      this.buildCacheMiddleware(),
      middleware)

    this.app.use((req, res) => {
      this.ui.writeLine(`[server] Error: ${req.originalUrl} was not found`)
      res.status(404).send('Not found')
    })

    this.app.use((error, req, res, next) => {
      this.ui.writeLine(`[server] Error: ${error}`, error)
      res.status(500).send(error)
    })

    this.afterMiddleware(this.app)

    return this.startHTTP()
  }

  startHTTP () {
    return new Promise(resolve => {
      const listener = this.app.listen(PORT || 3000, () => {
        const { port, address } = listener.address()
        this.ui.writeLine('HTTP server started; url=http://%s:%s', address, port)
        resolve()
      })
    })
  }

  serveABTesting () {
    return (req, res, next) => {
      const { query: { revision } } = req

      if (!revision) {
        return next()
      }

      return this.cache.fetch(`index:${revision}`)
        .then((index) => {
          if (!index) {
            this.ui.writeLine(`[server] revision=${revision} not found`)
            return next()
          }

          this.ui.writeLine(`[server] serving index revision=${revision}`)
          res.send(index)
        })
        .catch(() => next())
    }
  }

  interceptResponseCompletion (path, res) {
    const whiteListPaths = [
      '/',
      '/checkout/gift',
      '/faq',
      '/contact-us',
      '/collections',
      /\/collections\/(\w+)/,
      '/plans',
      '/how-it-works',
      '/legal',
      '/about'
    ]

    const pathFound = whiteListPaths.find((whitePath) => {
      if (typeof whitePath === 'string') {
        return whitePath === path
      } else if (whitePath instanceof RegExp) {
        return whitePath.test(path)
      }
    })

    if (pathFound) {
      return super.interceptResponseCompletion(...arguments)
    }
  }
}

module.exports = ECServer
