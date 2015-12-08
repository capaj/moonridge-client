# Moonridge-client 
client library for Mongo remote ORM framework [Moonridge](https://github.com/capaj/Moonridge).

Install with jspm(for browser) or npm(for node):

```
npm install moonridge-client

jspm install moonridge-client
``` 
###Do I really need JSPM?

Moonridge is written in commonJS format(client works in node and browser without much hassle), so you need globally installed [jspm](https://github.com/jspm/jspm-cli) to be able to install it with one command. For running, you need [systemJS](https://github.com/systemjs/systemjs)(which JSPM installs for you).
If you don't have jspm, install it with this command:

    npm i jspm -g
    
As it works in node, it should be possible to run in browserify as well, but I don't guarantee it.

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)
