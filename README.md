# Ember Fastboot Deploy Workflow

## Ember App

recomended ember-cli-deploy setup:

you will need these plugins in you ember app:

ember-cli-deploy-build
ember-cli-deploy-revision-data
ember-cli-deploy-manifest
ember-cli-deploy-redis
ember-cli-deploy-redis-publish-revision
ember-cli-deploy-s3
ember-cli-deploy-s3-zip

```js
// config/depoy.js
ENV.build.environment = 'production'
ENV.redis = {
  host: process.env['REDIS_HOST_PRODUCTION'],
  port: process.env['REDIS_PORT_PRODUCTION'],
  password: process.env['REDIS_SECRET_PRODUCTION']
}
ENV['redis-publish-revision'] = {
  host: process.env['REDIS_HOST_PRODUCTION'],
  port: process.env['REDIS_PORT_PRODUCTION'],
  password: process.env['REDIS_SECRET_PRODUCTION']
}
ENV.s3 = {
  accessKeyId: process.env['S3_ACCESS_KEY'],
  secretAccessKey: process.env['S3_SECRET_KEY'],
  bucket: process.env['S3_BUCKET'],
  region: 'us-east-1'
}
ENV['s3-zip'] = {
  accessKeyId: process.env['S3_ACCESS_KEY'],
  secretAccessKey: process.env['S3_SECRET_KEY'],
  bucket: process.env['S3_BUCKET'],
  region: 'us-east-1',
  zipPathS3: 'assets', // PATH to place the zipped fastboot app
  name: 'ec-fastboot.zip' // fastboot app zip name
}
ENV.pipeline = {
  runOrder: {
    'redis-publish-revision': { after: ['redis'] }
  }
}
```

## FastBoot Server

to boot the FastBoot App Server you just need to run the following command

`yarn start`

it is going to start the FastBoot App Server with a S3 Downloader, Redis Notifier, Redis Cache and a Custom Express Server

### S3Downloader
It is in charge of

- downloading the zipped FastBoot App
- placing it in the current directory
- unzip it into a given directory
- installing the fastboot app dependencies (e.g node-fetch)
- expire the cache so users get the most recent version of the app


### RedisNotifier
It is in charge of

- ember-cli-deploy-redis-publish-revision is going to PUBLISH an event to a redis channel when a deployment revision was activated
- this notifier is in charge of listening on that channel for those events and trigger a download action so we always have the most recent (activated) version of the app

### RedisCache
It is in charge of

- It's a copy of tomdale's RedisCache but with an expiration feature

### Server
It is in charge of

- ember-cli-deploy-redis is going to create revision keys with the deployed index.html to be served directly from there; each time we activate a revision it is going to place that revision key into the redis key `$APP:index:current` that key is going to have a revision value e.g `c3af0274b7815fceb1e0b7d1728698c6` which point to another redis key which contains the index.html for that deployment `$APP:index:c3af0274b7815fceb1e0b7d1728698c6`
- with that already made we add A/B testing support to our server, so it will see if that revision key exist and if so it will return it immediately (this approach it's not related to fastboot but will help you to not have to compile many versions of your app to do A/B testing)
- It is going to cache some paths of the application (a whitelist of paths we gave to it, this is because if something goes wrong and the app throws an exception, that exception is going to be cached, and everyone is going to see that, which is not what we want)
- Also, the server has support for let's encrypt and forse SSL on production environment


## TODO
- [ ] Add Tests
- [ ] Add Better Documentation
- [ ] Add Felixibility/Configuration so it can be used by other people
