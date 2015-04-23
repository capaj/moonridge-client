var rpcClient = require('socket.io-rpc-client');
var Promise = require('bluebird');
var extend = require('./moonridge/extend/node-extend');

Promise.when = function(promiseOrValue) { //unfortunately angular bluebird lacks this method
  if (typeof promiseOrValue === 'object' && typeof promiseOrValue.then === 'function') {
    return promiseOrValue;
  } else {
    var dfd = Promise.defer();
    dfd.resolve(promiseOrValue);
    return dfd.promise;
  }
};

module.exports = require('./moonridge/Moonridge')(rpcClient, Promise, console, extend);
