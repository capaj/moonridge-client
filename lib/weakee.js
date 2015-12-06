'use strict'
var cbMap = new WeakMap()
const debug = require('debug')('moonridge-client:weakee')
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

Emitter.prototype.emit = function emit(type, data) {
  let event
  let cbs = cbMap.get(this)
  debug('emitting ', type, data)
  const events = (cbs[type] || []).slice()
  if (events.length) {
    while (event = events.shift()) {
      event.call(this, data)
    }
  }
  let c = cbs.__any.length
  while (c--) {
    let cb = cbs.__any[c]
    cb.call(this, type, data)
  }
  return this
}

module.exports = Emitter
