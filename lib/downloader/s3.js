'use strict'
const S3 = require('aws-sdk/clients/s3')
const fs = require('fs')
const path = require('path')
const exec = require('child_process').exec
const RedisCache = require('../cache/redis')

function AppNotFoundError (message) {
  const error = new Error(message)
  error.name = 'AppNotFoundError'
  return error
}

class S3Downloader {
  constructor (options) {
    const {
      zipName,
      bucket,
      accessKeyId,
      secretAccessKey,
      cache,
      zipPathS3,
      outputPath,
      region
    } = options
    this.ui = options.ui
    this.accessKeyId = accessKeyId
    this.secretAccessKey = secretAccessKey
    this.bucket = bucket
    this.zipPathS3 = zipPathS3
    this.zipName = zipName
    this.outputPath = outputPath
    this.cache = cache || new RedisCache()
    this.s3 = new S3({
      accessKeyId,
      secretAccessKey,
      region
    })
  }

  download () {
    const { bucket, zipPathS3, zipName, outputPath } = this
    if (!bucket || !zipPathS3 || !zipName) {
      return Promise.reject(new AppNotFoundError())
    }

    const deployDistPath = path.join(outputPath, 'deploy-dist')

    return this.downloadAppZip()
      .then(() => this.createOutputDir())
      .then(() => this.unzipApp())
      .then(() => this.installNPMDependencies())
      .then(() => this.expireCache())
      .then(() => deployDistPath)
  }

  createOutputDir () {
    const { outputPath } = this
    return this.exec(`mkdir -p ${outputPath}`)
  }

  installNPMDependencies () {
    const { outputPath } = this
    const currentDir = process.cwd()
    const deployDistPath = path.join(outputPath, 'deploy-dist')
    process.chdir(deployDistPath)
    return this.exec('npm install')
      .then(() => {
        this.ui.writeLine('[s3-downloader] installed npm dependencies')
        process.chdir(currentDir)
      })
      .catch((error) => {
        this.ui.writeError('[s3-downloader] unable to install npm dependencies')
        throw error
      })
  }

  downloadAppZip () {
    return new Promise((resolve, reject) => {
      const { bucket, zipPathS3, zipName } = this

      const source = zipPathS3 ? path.join(zipPathS3, zipName) : zipName

      this.ui.writeLine(`[s3-downloader] downloading current app version from bucket=${bucket} source=${source}`)

      const params = {
        Bucket: bucket,
        Key: source
      }

      const file = fs.createWriteStream(zipName)
      const request = this.s3.getObject(params)

      this.ui.writeLine(`[s3-downloader] saving S3 file from bucket=${bucket} source=${source} to path=${zipName}`)

      request.createReadStream().pipe(file)
        .on('close', resolve)
        .on('error', reject)
    })
  }

  unzipApp () {
    const { zipName, outputPath } = this
    this.ui.writeLine(`[s3-downloader] unzipping file=${zipName} into dest=${outputPath}`)
    return this.exec(`unzip -q -o ${zipName} -d ${outputPath}`)
      .then(() => {
        this.ui.writeLine(`[s3-downloader] successfully unzipped file=${this.zipName} into dest=${outputPath}`)
      })
  }

  expireCache () {
    return this.cache.expire()
  }

  exec (command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          this.ui.writeError(`error running command ${command}`)
          this.ui.writeError(stderr)
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }
}

module.exports = S3Downloader
