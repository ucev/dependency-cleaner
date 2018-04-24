#! /usr/bin/env node
const minimist = require('minimist')
const path = require('path')
const { clean } = require('../index.js')

const argv = process.argv
const params = minimist(argv.slice(2))

const isRemove = params.y
const rootDir = params.d ? path.resolve(process.cwd(), params.d) : process.cwd()

clean(rootDir, isRemove)
