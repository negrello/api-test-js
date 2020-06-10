#!/usr/bin/env node

const path = require('path');
var argv = require('process').argv;
const { spawn } = require('child_process');
const fs = require('fs');

let mocha = path.join(__dirname, '../node_modules/.bin/mocha');

if (!fs.existsSync(mocha)) {
    mocha = path.join(__dirname, '../../.bin/mocha');
    if (!fs.existsSync(mocha)) {
        console.error(`Mocha not found: ${mocha}`);
        process.exit(1);
    }
}

const proc = spawn(mocha, [
    path.join(__dirname, '../build/api/scanner.js'),
    '--require', 'babel-polyfill',
    '--reporter', 'mochawesome',
    '--reporter-options', 'reportDir=api-report,reportFilename=report',
    ...argv.slice(2)],
    {
        env: Object.assign(
            { NODE_ENV: 'test', NODE_PATH: path.join(__dirname, '../build'), FORCE_COLOR: 1 },
            process.env),
        stdio: 'inherit'
    });

proc.on('close', (code) => {
    process.exit(code);
});
