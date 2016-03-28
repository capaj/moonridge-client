# Moonridge-client
client library for Mongo remote ORM framework [Moonridge](https://github.com/capaj/Moonridge).

Install with jspm(for browser) or npm(for node):

```
npm install moonridge-client

jspm install moonridge-client
```
### Is JSPM really needed?

Moonridge is written in commonJS format(client works in node and browser without much hassle), so you need globally installed [jspm](https://github.com/jspm/jspm-cli) to be able to install it with one command. For loading in the browser, you need [systemJS](https://github.com/systemjs/systemjs)(which JSPM installs for you).
If you don't have jspm, install it with this command:

    npm i jspm -g

As it works in node, it should be possible to run in browserify/webpack as well, but I don't guarantee it. JSPM might also be able to make you a bundle of all scripts needed. This bundle can then be used as regular script file with a script tag. Theoretically.

## Basic usage

```javascript
// ES6 import
import MR from 'moonridge-client'
/// cjs
const MR = require('moonridge-client')

// then just connect to your backend
const backend = MR({url: 'http://localhost:9000'})
// connecting with sync authorization
const backend = MR({url: 'http://localhost:9000', hs: { //hs stands for handshake(is passed to socket.io's connect method)
  query: 'email=john@mail.com&password=' + encodeURIComponent(password)
}})

// finally declare which model are you going to use(models are defined with schemas on the backend)
const bookModel = backend.model('book')
```

### Backend instance API
#### model(string)
synchronously defines a model to be used with the backend
```
@param {String} name
@returns {Model}
```
#### fetchAllModels()
asynchronously gets a list of all models on the backend and then synchronously defines them
```
@param {String} name
@returns {Model}
```
#### authorize(object)
async authorization-use when user connects as anonymous and then gains some priviliges while session is opened
```
@param {Object} auth object
@returns {Promise} resolved on succesful authorization
```
#### deAuthorize()
user logged out/lost priviliges
```
@returns {Promise} resolved when user was removed from this socket on the server
```

### Model instance API
#### query()
```
@returns {QueryChainable} which has same methods as mongoose.js query. When you chain all query
                          conditions, you use exec() to fire the query, Promise is returned
```
#### liveQuery([previousLiveQuery])
```
@param {Object} [previousLQ] useful when we want to modify a running LQ, pass it after it is stopped
@returns {QueryChainable} same as query, difference is that executing this QueryChainable won't return
                          promise, but liveQuery object itself
```
#### create(object)
```
@param {Object} toCreate
@returns {Promise} resolved when object is created in the database
```
#### update(object)
```
@param {Object} toUpdate moonridge object
@param {Boolean} resolveWhole if true, it will resolve with whole object instead of just the version
@returns {Promise} resolved when object is saved
```
#### remove(toRemove)
```
@param {Object|String} toRemove must have and _id if an object, otherwise we assume the string is the id
@returns {Promise}
```
#### addToSet(query, path, item)
```
@param {Object} query which will be used to find one document to update
@param {String} path
@param {*} item it is highly recommended to use simple values, not objects
@returns {Promise} resolved when object is updated
```
#### removeFromSet(query, path, item)
```
@param {Object} query which will be used to find one document to update
@param {String} path
@param {*} item it is highly recommended to use simple values, not objects
@returns {Promise} resolved when object is updated
```
#### on()
```
@returns {Promise} resolved when subscription is created on the server
```
#### off()
```
@returns {Promise} resolved when subscription is unsubscribed on the server
```
#### getSchema()
```
@returns {Promise} resolved with serialized and deserialized mongoose schema using mongoose-schema-serializer
```

### QueryChainable instance API
Mimics mongoose query api, with some methods dropped. Implemented methods are:

[all](http://mongoosejs.com/docs/api.html#query_Query-all)
[and](http://mongoosejs.com/docs/api.html#query_Query-and)
[box](http://mongoosejs.com/docs/api.html#query_Query-box)
[circle](http://mongoosejs.com/docs/api.html#query_Query-circle)
[comment](http://mongoosejs.com/docs/api.html#query_Query-comment)
[count](http://mongoosejs.com/docs/api.html#query_Query-count)
[distinct](http://mongoosejs.com/docs/api.html#query_Query-distinct)
[elemMatch](http://mongoosejs.com/docs/api.html#query_Query-elemMatch)
[equals](http://mongoosejs.com/docs/api.html#query_Query-equals)
[exists](http://mongoosejs.com/docs/api.html#query_Query-exists)
[find](http://mongoosejs.com/docs/api.html#query_Query-find)
[findOne](http://mongoosejs.com/docs/api.html#query_Query-findOne)
[geometry](http://mongoosejs.com/docs/api.html#query_Query-geometry)
[gt](http://mongoosejs.com/docs/api.html#query_Query-gt)
[gte](http://mongoosejs.com/docs/api.html#query_Query-gte)
[hint](http://mongoosejs.com/docs/api.html#query_Query-hint)
[in](http://mongoosejs.com/docs/api.html#query_Query-in)
[intersects](http://mongoosejs.com/docs/api.html#query_Query-intersects)
[limit](http://mongoosejs.com/docs/api.html#query_Query-limit)
[lt](http://mongoosejs.com/docs/api.html#query_Query-lt)
[lte](http://mongoosejs.com/docs/api.html#query_Query-lte)
[maxDistance](http://mongoosejs.com/docs/api.html#query_Query-maxDistance)
[maxScan](http://mongoosejs.com/docs/api.html#query_Query-maxScan)
[mod](http://mongoosejs.com/docs/api.html#query_Query-mod)
[ne](http://mongoosejs.com/docs/api.html#query_Query-ne)
[near](http://mongoosejs.com/docs/api.html#query_Query-near)
[nin](http://mongoosejs.com/docs/api.html#query_Query-nin)
[nor](http://mongoosejs.com/docs/api.html#query_Query-nor)
[or](http://mongoosejs.com/docs/api.html#query_Query-or)
[ne](http://mongoosejs.com/docs/api.html#query_Query-ne)
[polygon](http://mongoosejs.com/docs/api.html#query_Query-polygon)
[populate](http://mongoosejs.com/docs/api.html#query_Query-populate)
[read](http://mongoosejs.com/docs/api.html#query_Query-read)
[regex](http://mongoosejs.com/docs/api.html#query_Query-regex)
[select](http://mongoosejs.com/docs/api.html#query_Query-select)
[size](http://mongoosejs.com/docs/api.html#query_Query-size)
[skip](http://mongoosejs.com/docs/api.html#query_Query-skip)
[slice](http://mongoosejs.com/docs/api.html#query_Query-slice)
[sort](http://mongoosejs.com/docs/api.html#query_Query-sort)
[where](http://mongoosejs.com/docs/api.html#query_Query-where)
[within](http://mongoosejs.com/docs/api.html#query_Query-within)

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)
