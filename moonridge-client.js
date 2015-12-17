'use strict'
var RPC = require('socket.io-rpc-client')

const debug = require('debug')('moonridge:client')
const QueryChainable = require('./lib/query-chainable')
const Emitter = require('./lib/weakee')
const LiveQuery = require('./lib/live-query')

/**
 * A Moonridge pseudo-constructor(don't call it with new keyword)
 * @param {Object} opts an object with following properties:
 *                                  {String} url backend address where you will connect
 *                                  {Object} hs handshake for socket.io which you can access via socket.request._query
 * @returns {Moonridge} a Moonridge backend instance
 */
function Moonridge (opts) {
  var defUser = {privilege_level: 0}
  var self = {user: defUser} // by default, users priviliges are always set to 1

  var models = Object.create(null)

  self.rpc = RPC(opts.url, opts.hs)
  self.socket = self.rpc.socket
  self.getAllModels = function () {
    self.rpc('MR.getModels')().then(function (models) {
//                    TODO call getModel for all models
    })
  }

  self.authorize = function () {
    var args = arguments
    var pr = self.rpc('MR.authorize').apply(this, args)
    return pr.then(function (user) {
      self.user = user
      self.socket.on('reconnect', function () {
        self.rpc('MR.authorize').apply(this, args)
      })
      return user
    })
  }

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
    const resubscribers = {}
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

    self.socket.on('schemaEvent', function (details) {
      if (details.modelName === name) {
        model.emit(details.evName, details.doc)
      }
    })
    this.on = function (evName, cb) {
      const subscribed = Model.prototype.on.call(model, evName, cb)

      if (subscribed === 1) {
        const subscribe = function () {
          modelRpc('subscribe')(evName)
        }
        resubscribers[evName] = subscribe
        self.socket.on('reconnect', subscribe)
        self.socket.on('authSuccess', subscribe)
        return modelRpc('subscribe')(evName)
      }
    }
    this.off = function (evName, cb) {
      const left = Model.prototype.off.call(model, evName, cb)

      if (left === 0) {
        self.socket.removeListener('reconnect', resubscribers[evName])
        self.socket.removeListener('authSuccess', resubscribers[evName])
        resubscribers[evName] = null
        return modelRpc('unsubscribe')(evName)
      }
    }
    this._LQs = {}	// holds all liveQueries on client indexed by numbers starting from 1, used for communicating with the server
    this._LQsByQuery = {}	// holds all liveQueries on client indexed query in json, used for checking if the query does not exist already

    /**
     * @param {Object} toUpdate moonridge object
     * @returns {Promise} resolved when object is saved
     */
    this.update = function (toUpdate) {
      return modelRpc('update')(toUpdate)
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
     * @param {Object|String} toRemove must have and _id if an object, othrwise we assume the string is the id
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
     * @returns {Array<String>} indicating which properties this model has defined in it's schema
     */
    this.listPaths = function () {
      return modelRpc('listPaths')()
    }

    /**
     * @returns {QueryChainable} which has same methods as mongoose.js query. When you chain all query
     *                           conditions, you use exec() to fire the query
     */
    this.query = function () {
      var query = {query: [], indexedByMethods: {}}
      return new QueryChainable(query, function () {
        var callQuery = function () {
          query.promise = modelRpc('query')(query.query).then(function (result) {
            debug('query result ', result)
            query.result = result
            return result
          })
        }

        query.exec = callQuery
        callQuery()

        return query
      }, model)
    }

    var createLQEventHandler = function (eventName) {
      return function (LQId, doc, isInResult) {
        var LQ = model._LQs[LQId]
        if (LQ) {
          var params = arguments

          return LQ.promise.then(function () {
            console.log('LQeventhandler', eventName, params)
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

    /**
     * @param {Object} previousLQ useful when we want to modify a running LQ, pass it after it is stopped
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
       * @param {Boolean} dontSubscribe when true, no events from socket will be subscribed
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

            var reExecute = function () {
              queryExecFn(true)
            }
            if (self.user.privilege_level > 0) { // if user has been authorized
              // when user is authenticated, we want to reexecute after he is reauthenticated
              self.socket.on('authSuccess', reExecute)
            } else {
              // when he is anonymous, reexecute right after reconnect
              self.socket.on('reconnect', reExecute)
            }
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
   * loads one model or returns already requested model promise
   * @param {String} name
   * @returns {Promise} which resolves with the model
   */
  self.model = function (name) {
    var model = models[name]
    if (!model) {
      model = new Model(name)
      models[name] = model

      var toExpose = {}
      toExpose[name] = model.clientRPCMethods
      self.rpc.expose({MR: toExpose})
    }

    return model
  }

  /**
   * loads more than one model
   * @param {Array<string>} models
   * @returns {Promise} which resolves with an Object where models are indexed by their names
   */
  self.getModels = function (models) {
    var promises = {}
    var index = models.length
    while (index--) {
      var modelName = models[index]
      promises[modelName] = self.getModel(modelName)
    }
    return Promise.all(promises)
  }

  return self
}

module.exports = Moonridge
