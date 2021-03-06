'use strict'
var RPC = require('socket.io-rpc-client')
var mss = require('mongoose-schema-serializer')()

var debug = require('debug')('moonridge:client')
var QueryChainable = require('./lib/query-chainable')
var Emitter = require('./lib/weakee')
var LiveQuery = require('./lib/live-query')

/**
 * A Moonridge pseudo-constructor(don't call it with new keyword)
 * @param {Object} opts an object with following properties:
 *                                  {String} url backend address where you will connect
 *                                  {Object} hs handshake for socket.io which you can access via socket.request._query
 * @returns {Moonridge} a Moonridge backend instance
 */
function Moonridge (opts) {
  var defUser = {privilege_level: 0} // by default, users priviliges are always set to 0
  var self = {user: defUser}

  var models = Object.create(null)

  self.rpc = RPC(opts.url, opts.hs)
  self.socket = self.rpc.socket
  /**
  * @returns {Promise} resolved with and array of models for all server models
  **/
  self.fetchAllModels = function () {
    return self.rpc('MR.getModels')().then(function (models) {
      return models.map(self.model)
    })
  }
  /**
  * @param {Object} auth object
  * @returns {Promise} resolved on succesful authorization
  **/
  self.authorize = function () {
    var args = arguments
    var pr = self.rpc('MR.authorize').apply(this, args)
    self.asyncAuthorization = pr
    return pr.then(function (user) {
      self.user = user
      self.socket.on('reconnect', function () {
        self.asyncAuthorization = self.rpc('MR.authorize').apply(this, args)
      })
      return user
    })
  }

  /**
  * @returns {Promise} resolved when user was removed from this socket on the server
  **/
  self.deAuthorize = function () {
    var pr = self.rpc('MR.deAuthorize').apply(this, arguments)
    return pr.then(function () {
      self.user = defUser
    })
  }

  /**
   * @param {String} name
   * @constructor
   */
  function Model (name) {
    Emitter.call(this)
    var resubscribers = {}
    var model = this
    var lastIndex = 0  // this is used for storing liveQueries in _LQs object as an index, each liveQuery has unique
    this.name = name
    /**
     * @param {String} modelMethod
     * @returns {Promise}
     */
    var modelRpc = function (modelMethod) {
      return self.rpc('MR.' + name + '.' + modelMethod)
    }
    this.modelRpc = modelRpc
    this.static = function (staticMethod) {
      return self.rpc('MR.' + name + '.statics.' + staticMethod)
    }

    self.socket.on('schemaEvent', function (details) {
      if (details.modelName === name) {
        model.emit(details.evName, details.doc)
      }
    })
    this.on = function (evName, cb) {
      var subscribed = Model.prototype.on.call(model, evName, cb)

      if (subscribed === 1) {
        var subscribe = function () {
          if (self.asyncAuthorization) {
            return Promise.resolve(self.asyncAuthorization).then(function () {
              debug('subscribing for ', evName, ' on model ', name, 'over rpc')
              return modelRpc('subscribe')(evName)
            })
          } else {
            return modelRpc('subscribe')(evName)
          }
        }
        resubscribers[evName] = subscribe
        self.socket.on('reconnect', subscribe)
        return subscribe()
      } else {
        debug('NOT subscribing for ', evName, ' on model ', name, 'over rpc because we are already subscribed')
      }
    }
    this.off = function (evName, cb) {
      var left = Model.prototype.off.call(model, evName, cb)

      if (left === 0) {
        self.socket.removeListener('reconnect', resubscribers[evName])
        resubscribers[evName] = null
        debug('UNsubscribing from ', evName, ' on model ', name, 'over rpc')
        return modelRpc('unsubscribe')(evName)
      }
    }
    this._LQs = {}	// holds all liveQueries on client indexed by numbers starting from 1, used for communicating with the server
    this._LQsByQuery = {}	// holds all liveQueries on client indexed query in json, used for checking if the query does not exist already

    /**
     * @param {Object} toUpdate moonridge object
     * @param {Boolean} resolveWhole if true, it will resolve with whole object instead of just the version
     * @returns {Promise} resolved when object is saved
     */
    this.update = function (toUpdate, resolveWhole) {
      return modelRpc('update')(toUpdate, resolveWhole)
    }
    /**
     * @param {Object} query which will be used to find one document to update
     * @param {String} path
     * @param {*} item it is highly recommended to use simple values, not objects
     * @returns {Promise} resolved when object is updated
     */
    this.addToSet = function (query, path, item) {
      return modelRpc('addToSet')(query, path, item)
    }
    /**
     * @param {Object} query which will be used to find one document to update
     * @param {String} path
     * @param {*} item it is highly recommended to use simple values, not objects
     * @returns {Promise} resolved when object is updated
     */
    this.removeFromSet = function (query, path, item) {
      return modelRpc('removeFromSet')(query, path, item)
    }

    /**
     * @param {Object} toCreate
     * @returns {Promise} resolved when object is created
     */
    this.create = function (toCreate) {
      return modelRpc('create')(toCreate)
    }

    /**
     * @param {Object|String} toRemove must have and _id if an object, otherwise we assume the string is the id
     * @returns {Promise}
     */
    this.remove = function (toRemove) {
      var id = toRemove
      if (typeof toRemove === 'object') {
        id = toRemove._id
      }
      return modelRpc('remove')(id)
    }

    /**
     * @returns {Object}
     */
    this.getSchema = function () {
      return modelRpc('getSchema')().then(function (schemaSerialized) {
        return mss.parse(schemaSerialized)
      })
    }

    /**
     * @returns {QueryChainable} which has same methods as mongoose.js query. When you chain all query
     *                           conditions, you use exec() to fire the query, Promise is returned
     */
    this.query = function () {
      var query = {query: [], indexedByMethods: {}}
      var chainable = new QueryChainable(query, function () {
        return modelRpc('query')(query.query).then(function (result) {
          debug('query result ', result)
          query.result = result
          return result
        })
      }, model)
      chainable.then = function (res, rej) {
        return chainable.exec().then(res, rej)
      }
      return chainable
    }

    var createLQEventHandler = function (eventName) {
      return function (LQId, doc, isInResult) {
        var LQ = model._LQs[LQId]
        if (LQ) {
          var params = arguments

          return LQ.promise.then(function () {
            debug('LQ eventhandler runs for ', eventName, params)
            LQ['on_' + eventName](doc, isInResult)
            LQ.emit(eventName, params)  // invoking model event
          }, function (err) {
            setTimeout(function () {
              throw err // otherwise error is not thrown
            })
          })
        } else {
          debug('Unknown liveQuery calls this clients pub method, LQ id: ' + LQId)
        }
      }
    }

    var clientRPCMethods = ['distinctSync', 'update', 'remove', 'add']
    this.clientRPCMethods = {}

    clientRPCMethods.forEach(function (name) {
      this.clientRPCMethods[name] = createLQEventHandler(name)
    }.bind(this))

    var toExpose = {}
    toExpose[name] = this.clientRPCMethods
    self.rpc.expose({MR: toExpose})

    /**
     * @param {Object} [previousLQ] useful when we want to modify a running LQ, pass it after it is stopped
     * @returns {QueryChainable} same as query, difference is that executing this QueryChainable won't return
     *                           promise, but liveQuery object itself
     */
    this.liveQuery = function (previousLQ) {
      previousLQ && previousLQ.stop()

      var LQ = new LiveQuery(model, modelRpc)
      if (typeof previousLQ === 'object') {
        LQ.query = previousLQ.query
        LQ.indexedByMethods = previousLQ.indexedByMethods
      } else {
        LQ.query = []  // serializable query object
        // utility object to which helps when we need to resolve query type and branch our code
        LQ.indexedByMethods = {}
      }

      /**
       * @param {Boolean} [dontSubscribe] when true, no events from socket will be subscribed
       * @returns {Object} live query object with docs property which contains realtime result of the query
       */
      var queryExecFn = function (dontSubscribe) {
        if (!LQ._queryStringified) {
          if (LQ.indexedByMethods.hasOwnProperty('count') && LQ.indexedByMethods.hasOwnProperty('sort')) {
            throw new Error('count and sort must NOT be used on the same query')
          }
          LQ._queryStringified = JSON.stringify(LQ.query)
          if (model._LQsByQuery[LQ._queryStringified] && model._LQsByQuery[LQ._queryStringified].stopped !== true) {
            return model._LQsByQuery[LQ._queryStringified]
          }
          // if previous check did not found an existing query
          model._LQsByQuery[LQ._queryStringified] = LQ

          lastIndex += 1

          model._LQs[lastIndex] = LQ
          LQ.index = lastIndex
        }

        LQ.promise = modelRpc('liveQuery')(LQ.query, LQ.index).then(function (res) {
          if (LQ.indexedByMethods.count) {  // this is a count query when servers sends number
            debug('Count we got back from the server is ' + res.count)

            // this is not assignment but addition on purpose-if we create/remove docs before the initial
            // count is determined we keep count of them inside count property. This way we stay in sync
            // with the real count
            LQ.result += res.count
          } else if (LQ.indexedByMethods.distinct) {
            LQ.result = res.values
          } else {
            LQ.result = []
            var i = res.docs.length

            while (i--) {
              LQ.result[i] = res.docs[i]
            }
          }
          LQ.emit('init', res)

          if (!dontSubscribe) {
            self.socket.on('disconnect', function () {
              LQ.stopped = true
            })

            var reExecute = function (evName) {
              debug('reexecuting LiveQuery ', LQ._queryStringified, ' after event ', evName)
              queryExecFn(true)
            }

            self.socket.on('reconnect', function () {
              Promise.resolve(self.asyncAuthorization).then(function () {
                reExecute('reconnect') // for synchronous authorization
              })
            })
          } else {
            LQ.stopped = false
            LQ.live = true
          }

          return LQ	//
        })

        return LQ
      }

      return new QueryChainable(LQ, queryExecFn, model)
    }
  }
  Model.prototype = Object.create(Emitter.prototype)

  /**
   * defines a model to be used with the backend
   * @param {String} name
   * @returns {Promise} which resolves with the model
   */
  self.model = function (name) {
    var model = models[name]
    if (!model) {
      model = new Model(name)
      models[name] = model
    }

    return model
  }

  return self
}

module.exports = Moonridge
