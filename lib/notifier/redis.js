'use strict'
const redis = require('redis')
const _ = require('lodash')

const { REDIS_URL: redisUrl } = process.env

if (_.isEmpty(redisUrl)) {
  throw new Error('No redis connection is configured, please set REDIS_URL env var')
}

class RedisNotifier {
  constructor () {
    this.redisClient = redis.createClient(redisUrl)

    this.redisClient.on('error', (error) => {
      this.ui.writeLine(`[redis-notifier-service] Error: ${error}`)
    })

    this.redisClient.on('connect', () => {
      this.ui.writeLine(`[redis-notifier-service] successfully connected to redis: ${redisUrl}`)
    })

    this.redisClient.on('end', () => {
      this.ui.writeLine('[redis-notifier-service] redis connection disconnected')
    })
  }

  subscribe (notify) {
    return new Promise((resolve, reject) => {
      const channel = 'ec:index:current:changed'
      this.ui.writeLine(`[redis-notifier-service] subscribed to channel=${channel}`)

      this.redisClient.on('message', (channel, message) => {
        this.ui.writeLine(`[redis-notifier-service] channel=${channel} revisionKey=${message} deployed`)
        notify()
      })

      this.redisClient.on('subscribe', () => resolve())

      this.redisClient.subscribe(channel)
    })
  }
}

module.exports = RedisNotifier
