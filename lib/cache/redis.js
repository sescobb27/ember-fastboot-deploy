'use strict'
const redis = require('redis')
const Promise = require('bluebird')
Promise.promisifyAll(redis.RedisClient.prototype)
Promise.promisifyAll(redis.Multi.prototype)
const _ = require('lodash')

const { REDIS_URL: redisUrl } = process.env

if (_.isEmpty(redisUrl)) {
  throw new Error('No redis connection is configured, please set REDIS_URL env var')
}

const FIVE_MINUTES = 5 * 60

function RedisCache () {
  this.redisClient = redis.createClient(redisUrl)

  this.redisClient.on('error', (error) => {
    this.ui.writeLine(`[redis-cache] Error: ${error}`)
  })

  this.redisClient.on('connect', () => {
    this.ui.writeLine(`[redis-cache] successfully connected to redis: ${redisUrl}`)
  })

  this.redisClient.on('end', () => {
    this.ui.writeLine('[redis-cache] redis connection disconnected')
  })

  this.expiration = FIVE_MINUTES
}

RedisCache.prototype.expire = function () {
  const keys = `ec:fastboot:*`
  return this.redisClient.keysAsync(keys)
    .then((rows) => Promise.map(rows, (key) => this.redisClient.del(key)))
}

RedisCache.prototype.fetch = function (path) {
  const key = `ec:fastboot:${path}`
  return this.redisClient.getAsync(key)
}

RedisCache.prototype.put = function (path, value) {
  const key = `ec:fastboot:${path}`
  return this.redisClient
    .multi()
    .set(key, value)
    .expire(key, this.expiration)
    .execAsync()
}

module.exports = RedisCache
