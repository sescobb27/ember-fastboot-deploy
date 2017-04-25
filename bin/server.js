#!/usr/bin/env node
'use strict'
const FastBootAppServer = require('fastboot-app-server')
const RedisCache = require('../lib/cache/redis')
const ECServer = require('../lib/server')
const S3Downloader = require('../lib/downloader/s3')
const RedisNotifier = require('../lib/notifier/redis')

const { S3_BUCKET, S3_ACCESS_KEY_STAGING, S3_SECRET_KEY_STAGING } = process.env

const httpServer = new ECServer({
  gzip: true
})
const notifier = new RedisNotifier()
const cache = new RedisCache()
const downloader = new S3Downloader({
  cache,
  zipPathS3: 'assets',
  bucket: S3_BUCKET,
  accessKeyId: S3_ACCESS_KEY_STAGING,
  secretAccessKey: S3_SECRET_KEY_STAGING,
  region: 'us-east-1',
  zipName: 'ec-fastboot.zip',
  outputPath: 'dist'
})

const server = new FastBootAppServer({
  workerCount: 4,
  cache: cache,
  gzip: true,
  httpServer,
  notifier,
  downloader
})

server.start()
