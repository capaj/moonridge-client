'use strict'
var cbMap = new WeakMap()

function Emitter () {
  cbMap.set(this, {})

}

Emitter.prototype.on = function (type, handler) {
  console.log(this.name, 'this.name')
  var events = cbMap.get(this)

  if (!events[type]) {
    events[type] = []
  }

  return events[type].push(handler)
}

Emitter.prototype.off = function (type, handler) {
  console.log(this.name, 'this....')
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

Emitter.prototype.emit = function (type, data) {
  let event
  const events = (cbMap.get(this)[type] || []).slice()

  if (events.length) {
    while (event = events.shift()) {
      event.call(this, data)
    }
  }
  return this
}

module.exports = Emitter
