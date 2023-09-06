/**
* Copyright © 2019 contains code contributed by Orange SA, authors: Denis Barbaron - Licensed under the Apache license 2.0
**/

var http = require('http')

var express = require('express')
var validator = require('express-validator')
var cookieSession = require('cookie-session')
var bodyParser = require('body-parser')
var serveStatic = require('serve-static')
var csrf = require('csurf')
var Promise = require('bluebird')
var basicAuth = require('basic-auth')

var logger = require('../../util/logger')
var requtil = require('../../util/requtil')
var jwtutil = require('../../util/jwtutil')
var pathutil = require('../../util/pathutil')
var urlutil = require('../../util/urlutil')
var lifecycle = require('../../util/lifecycle')

const dbapi = require('../../db/api')

const cp = require('child_process')

module.exports = function(options) {
  var log = logger.createLogger('auth-mock')
  var app = express()
  var server = Promise.promisifyAll(http.createServer(app))

  var procTmp = null
  var pid= null;

  lifecycle.observe(function() {
    log.info('Waiting for client connections to end')
    return server.closeAsync()
      .catch(function() {
        // Okay
      })
  })

  // BasicAuth Middleware
  var basicAuthMiddleware = function(req, res, next) {
    function unauthorized(res) {
      res.set('WWW-Authenticate', 'Basic realm=Authorization Required')
      return res.send(401)
    }

    var user = basicAuth(req)

    if (!user || !user.name || !user.pass) {
      return unauthorized(res)
    }

    if (user.name === options.mock.basicAuth.username &&
        user.pass === options.mock.basicAuth.password) {
      return next()
    }
    else {
      return unauthorized(res)
    }
  }

  app.set('view engine', 'pug')
  app.set('views', pathutil.resource('auth/mock/views'))
  app.set('strict routing', true)
  app.set('case sensitive routing', true)

  app.use(cookieSession({
    name: options.ssid
  , keys: [options.secret]
  }))
  app.use(bodyParser.json())
  app.use(csrf())
  app.use(validator())
  app.use('/static/bower_components',
    serveStatic(pathutil.resource('bower_components')))
  app.use('/static/auth/mock', serveStatic(pathutil.resource('auth/mock')))

  app.use(function(req, res, next) {
    res.cookie('XSRF-TOKEN', req.csrfToken())
    next()
  })

  if (options.mock.useBasicAuth) {
    app.use(basicAuthMiddleware)
  }

  app.get('/', function(req, res) {
    res.redirect('/auth/mock/')
  })

  app.get('/auth/contact', function(req, res) {
    dbapi.getRootGroup().then(function(group) {
      res.status(200)
        .json({
          success: true
        , contact: group.owner
        })
    })
    .catch(function(err) {
      log.error('Unexpected error', err.stack)
      res.status(500)
        .json({
          success: false
        , error: 'ServerError'
        })
      })
  })

  app.get('/auth/mock/', function(req, res) {
    res.render('index')
  })

  app.post('/auth/api/v1/mock', function(req, res) {
    var log = logger.createLogger('auth-mock')
    log.setLocalIdentifier(req.ip)
    switch (req.accepts(['json'])) {
      case 'json':
        requtil.validate(req, function() {
            req.checkBody('name').notEmpty()
            req.checkBody('email').isEmail()
          })
          .then(function() {
            log.info('Authenticated "%s"', req.body.email)
            var token = jwtutil.encode({
              payload: {
                email: req.body.email
              , name: req.body.name
              }
            , secret: options.secret
            , header: {
                exp: Date.now() + 24 * 3600
              }
            })
            res.status(200)
              .json({
                success: true
              , redirect: urlutil.addParams(options.appUrl, {
                  jwt: token
                })
              })
          })
          .catch(requtil.ValidationError, function(err) {
            res.status(400)
              .json({
                success: false
              , error: 'ValidationError'
              , validationErrors: err.errors
              })
          })
          .catch(function(err) {
            log.error('Unexpected error', err.stack)
            res.status(500)
              .json({
                success: false
              , error: 'ServerError'
              })
          })
        break
      default:
        res.send(406)
        break
    }
  })

  app.post('/auth/api/v1/bot/stop', function(req, res){
    var log = logger.createLogger('auth-mock')
    log.info('/auth/api/v1/bot/stop')

    switch(req.accepts(['json'])){
      case 'json':
        requtil.validate(req, function() {
          req.checkBody('username').notEmpty()
        })
        .then(function() {
          log.info('username "%s"', req.body.username)
          if(procTmp){
            log.info('procTmp not null')
            procTmp.kill()
          } else {
            log.info('procTmp null')
          }

          if(pid){
            process.kill(pid, 'SIGKILL');
            log.info('pid not null : %s', pid)
          } else {
            log.info('pid null')
          }


          res.status(200)
              .json({
                success: true
              })
        })
        .catch(requtil.ValidationError, function(err) {
          res.status(400)
            .json({
              success: false
            , error: 'ValidationError'
            , validationErrors: err.errors
            })
        })
        .catch(function(err) {
          log.error('Unexpected error', err.stack)
          res.status(500)
            .json({
              success: false
            , error: 'ServerError'
            })
        })
        break
      default:
        res.send(406)
        break
    }
  })

  app.post('/auth/api/v1/bot', function(req, res) {
    //var log = logger.createLogger('auth-mock')
    log.info("/auth/api/v1/bot")

    switch(req.accepts(['json'])){
      case 'json':
        requtil.validate(req, function() {
          req.checkBody('username').notEmpty()
        })
        .then(function() {
          log.info('username "%s"', req.body.username)
          
          // var yourscript = cp.exec('/home/meilin/Dev/bot-dev/venv/bot/bot.sh',
          //   (error, stdout, stderr) => {
          //       console.log(stdout);
          //       log.info(stdout)
          //       log.info(stderr)
          //       console.log(stderr);
          //       if (error !== null) {
          //           console.log(`exec error: ${error}`);
          //           log.info(`exec error: ${error}`)
          //       }
          //   });

          // cp.exec('/home/meilin/Dev/bot-dev/venv/bot/bot.sh', (error, stdout, stderr) => {
          //   // catch err, stdout, stderr
          //     if(err) {
          //       console.log(err);
          //       return;
          //   }
          //   console.log(`stdout: ${stdout}`);
          //   console.log(`stderr: ${stderr}`);
          // });
          // var proc = cp.spawn('/home/meilin/Dev/bot-dev/venv/bot/bot.sh', [], {})
          // var stdout = []

          // proc.stdout.on('data', function(data) {
          //   stdout.push(data)
          //   log.info(data)
          // })

          // proc.on('error', function)

          // proc.on('close', function(code, signal) {
            
          // })

          // const controller = new AbortController();
          // const { signal } = controller;

          

          var args = ['/home/meilin/Dev/bot-dev/venv/bot/run.py', '--config', '/home/meilin/Dev/bot-dev/venv/bot/accounts/tracy_meilin/config.yml']
          var proc = cp.spawn('/home/meilin/Dev/bot-dev/venv/.venv/bin/python3', args);
          //var args = [req.body.username]
          //var proc = cp.spawn('/home/meilin/Dev/bot-dev/venv/bot/bot.sh', args)
          
          pid = proc.pid;
          procTmp = proc

          proc.stdout.on("data", data => {
            var stdoutData = []
            stdoutData.push(data)
            log.info(Buffer.concat(stdoutData).toString())
          });
          
          proc.stderr.on("data", data => {
            var stderrData = []
            stderrData.push(data)
            log.info(Buffer.concat(stderrData).toString())
          });

          log.info('spawn end')

          res.status(200)
              .json({
                success: true
              })
        })
        .catch(requtil.ValidationError, function(err) {
          res.status(400)
            .json({
              success: false
            , error: 'ValidationError'
            , validationErrors: err.errors
            })
        })
        .catch(function(err) {
          log.error('Unexpected error', err.stack)
          res.status(500)
            .json({
              success: false
            , error: 'ServerError'
            })
        })
        break
      default:
        res.send(406)
        break
    }
  })

  server.listen(options.port)
  log.info('Listening on port %d', options.port)
}
