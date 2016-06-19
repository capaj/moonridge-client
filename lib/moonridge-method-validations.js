function isInt (n) {
  return typeof n === 'number' && n % 1 === 0
}

var noop = function () {}

var singleIntegerValidation = function (args) {
  if (args.length === 1) {
    if (isInt(args[0])) {
      return true
    }
    throw new TypeError('Argument must be an integer')
  }
  throw new Error('Method must be called with exactly one Number argument')
}

var upToTwoArgs = function (args) {
  if (args.length === 0) {
    throw new Error('requires at least one argument')
  }
  if (args.length > 2) {
    throw new Error('takes up to two arguments')
  }
  return true
}

/**
 * query methods which modifies the collection are not included, those have to be called via RPC methods
 * @type {Object.<string, Function>} name of the method and validation function
 */
var qMethodsEnum = {
  all: noop,
  and: function (args) {
    if (args.length === 1 && Array.isArray(args[0])) {
    } else {
      throw new Error('requires at least one argument of type Array')
    }
  },
  box: upToTwoArgs,
  circle: upToTwoArgs,
  comment: function (args) {
    return args.length === 1
  },
  count: function (args) {
    return args.length <= 1
  },    // available on client, but done in server memory, not sent to DB queries
  distinct: upToTwoArgs,
  elemMatch: noop,
  equals: noop,
  exists: noop,
  find: noop,
  findOne: function (args) {
    if (args.length === 0) {
      return true
    } else {
      if (args.length > 1) {
        throw new Error('findOne does not take more than one argument')
      }
      if (typeof args[0] !== 'object') {
        throw new TypeError('findOne takes just one Object as argument')
      }
      return true
    }
  },
  geometry: noop,
  gt: upToTwoArgs,
  gte: upToTwoArgs,
  hint: noop,
  in: noop,
  intersects: noop,
//		lean: noop, //always enabled
  limit: singleIntegerValidation,
  lt: upToTwoArgs,
  lte: upToTwoArgs,
  maxDistance: noop,
  maxScan: singleIntegerValidation,
  mod: noop,
  ne: noop,
  near: function (args) {
    if (args.length === 0) {
      throw new Error('near requires at least one argument')
    } else {
      if (args.length > 2) {
        throw new Error('near does not take more than two argument')
      }
      if (typeof args[0] !== 'object') {
        throw new TypeError('near takes just one Object as argument')
      }
    }
  },
  nin: noop,
  nor: noop,
  or: noop,
  polygon: noop,
  populate: noop,
  read: upToTwoArgs,
  regex: noop,
  select: noop,
  size: noop,
  skip: singleIntegerValidation,	// is not sent to the DB, skipping and limiting is done in memory because it would be a problem for liveQueries
  slice: noop,
  sort: function (args) {
    if (args.length === 0) {
      throw new Error('sort requires one argument')
    } else {
      if (args.length > 1) {
        throw new Error('sort does not take more than two argument')
      }
      if (typeof args[0] !== 'string') {
        throw new TypeError('sort takes a string as an argument')
      }
    }
  },
  where: function (args) {
    if (args.length > 0 && args.length <= 2) {
       // TODO check types here
    }
    throw new Error('Method was called with wrong number of arguments')
  },
  within: noop
}

module.exports = qMethodsEnum
