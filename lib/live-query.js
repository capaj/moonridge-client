const Emitter = require('./weakee')
const extend = Object.copyOwnProperties	// this is defined in o.extend dependency to socket.io-rpc
const debug = require('debug')('moonridge:LiveQuery')
const difference = require('lodash.difference')
const isNumber = function (val) {
  return typeof val === 'number'
}

function LiveQuery (model, rpc) {
  this._model = model
  Emitter.call(this)
  this.modelRpc = rpc
}
LiveQuery.prototype = Object.create(Emitter.prototype)

Object.assign(LiveQuery.prototype, {
  getDocById: function (id) {
    var i = this.result.length
    while (i--) {
      if (this.result[i]._id === id) {
        return this.result[i]
      }
    }
    return null
  },
  on_add: function (doc, index) {
    if (this.indexedByMethods.findOne) {
      return this.result.splice(index, 1, doc)
    }
    if (this.indexedByMethods.count) {
      this.result += 1 // when this is a count query, just increment and call it a day
      return
    }

    if (this.result[index]) {
      this.result.splice(index, 0, doc)
    } else {
      this.result.push(doc)
    }
    if (this.indexedByMethods.limit < this.result.length) {
      this.result.splice(this.result.length - 1, 1)  // this needs to occur after push of the new doc
    }
  },
  /**
   * @param {Object} doc
   * @param {Number} resultIndex for count it indicates whether to increment, decrement or leave as is,
   *                   for normal queries can be a numerical index also
   */
  on_update: function (doc, resultIndex) {
    debug('this.on_update ', doc, resultIndex)

    if (this.indexedByMethods.count) {	// when this is a count query
      if (resultIndex === -1) {
        this.result -= 1
      } else {
        this.result += 1
      }
      return// just increment/decrement and call it a day
    }

    var i = this.result.length
    while (i--) {
      var updated
      if (this.result[i]._id === doc._id) {
        if (resultIndex === false) {
          this.result.splice(i, 1)  // removing from docs
          return
        } else {
          // if a number, then doc should be moved

          if (resultIndex !== i) {
            this.result.splice(i, 1)
            if (i < resultIndex) {
              this.result.splice(resultIndex - 1, 0, doc)
            } else {
              this.result.splice(resultIndex, 0, doc)
            }
          } else {
            updated = this.result[i]
            extend(updated, doc)
          }
        }

        return
      }
    }
    // when not found
    if (resultIndex !== -1) {
      if (this.result[resultIndex]) {
        this.result.splice(resultIndex, 0, doc)
      } else {
        this.result.push(doc) // pushing into docs if it was not found by loop
      }
      return
    }
    debug('Failed to find updated document _id ' + doc._id)
  },
  /**
   * @param {String} id
   * @returns {boolean} true when it removes an element
   */
  on_remove: function (id) {
    if (this.indexedByMethods.count) {
      this.result -= 1	// when this is a count query, just decrement and call it a day
      return true
    }
    var i = this.result.length
    while (i--) {
      if (this.result[i]._id === id) {
        this.result.splice(i, 1)
        return true
      }
    }
    debug('Failed to find deleted document.')

    return false
  },
  on_distinctSync: function (syncObj) {
    this.result = this.result.concat(syncObj.add)
    this.result = difference(this.result, syncObj.remove)

    debug('distinctSync has run, values now ', this.result)
  },
  /**
   * notify the server we don't want to receive any more updates on this query
   * @returns {Promise}
   */
  stop: function () {
    debug('stopping live query: ', this.index)
    if (isNumber(this.index) && this._model._LQs[this.index]) {
      this.stopped = true
      return this.modelRpc('unsubLQ')(this.index).then(function () {
        delete this._model._LQs[this.index]
        delete this._model._LQsByQuery[this._queryStringified]
      })
    } else {
      throw new Error('There must be a valid index property, when stop is called')
    }
  }
})

module.exports = LiveQuery
