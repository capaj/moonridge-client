'use strict'
var cbMap = new WeakMap()
var debug = require('debug')('moonridge-client:weakee')
function Emitter () {
  cbMap.set(this, {__any: []})
}

Emitter.prototype.on = function (type, handler) {
  debug('subscribing to event type', type, handler)
  var events = cbMap.get(this)

  if (!events[type]) {
    events[type] = []
  }

  return events[type].push(handler)
}

Emitter.prototype.onAny = function (handler) {
  var events = cbMap.get(this)
  events.__any.push(handler)

  return function () {
    events.__any.splice(events.__any.indexOf(handler), 1)
  }
}

Emitter.prototype.off = function (type, handler) {
  var events = cbMap.get(this)[type]

  if (events) {
    if (!handler) {
      events.length = 0
    } else {
      events.splice(events.indexOf(handler), 1)
    }
    return events.length  // we need length here, because in case no subscribers
    // are left we unsubscribe client from server
  }
}

Emitter.prototype.emit = function emit (type, data) {
  var ev
  var cbs = cbMap.get(this)
  debug('emitting ', type, data)
  var events = (cbs[type] || []).slice()
  if (events.length) {
    while (ev = events.shift()) {
      ev.call(this, data)
    }
  }
  var c = cbs.__any.length
  while (c--) {
    cbs.__any[c].call(this, type, data)
  }
  return this
}

module.exports = Emitter
