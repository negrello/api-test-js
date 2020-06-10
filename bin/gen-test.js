#!/usr/bin/env node

const path = require('path');

require('babel-core/register');
require('babel-polyfill');

require(path.join(__dirname, '../build/api/swagger.js'));

