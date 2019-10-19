'use strict'

const newrelic = require('newrelic')
require('@newrelic/aws-sdk')

let wrappedHandler

function getHandler() {
  const { MAINLAND_HANDLER, LAMBDA_TASK_ROOT = '.' } = process.env

  if (!MAINLAND_HANDLER) {
    throw new Error('No MAINLAND_HANDLER environment variable set.')
  }

  const parts = MAINLAND_HANDLER.split('.')

  if (parts.length !== 2) {
    throw new Error(
      `Improperly formatted MAINLAND_HANDLER environment variable: ${MAINLAND_HANDLER}`
    )
  }

  const [moduleToImport, handlerToWrap] = parts

  let importedModule

  try {
    /* eslint-disable import/no-dynamic-require*/
    importedModule = require(`${LAMBDA_TASK_ROOT}/${moduleToImport}`)
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      throw new Error(`Unable to import module '${moduleToImport}'`)
    }

    throw e
  }

  const userHandler = importedModule[handlerToWrap]

  if (typeof userHandler === 'undefined') {
    throw new Error(
      `Handler '${handlerToWrap}' missing on module '${moduleToImport}'`
    )
  }

  if (typeof userHandler !== 'function') {
    throw new Error(
      `Handler '${handlerToWrap}' from '${moduleToImport}' is not a function`
    )
  }

  return userHandler
}

function wrapHandler() {
  const ctx = this
  const args = Array.prototype.slice.call(arguments)

  if (!wrappedHandler) {
    const userHandler = getHandler()
    wrappedHandler = newrelic.setLambdaHandler(
      (...wrapperArgs) => userHandler.apply(ctx, wrapperArgs)
    )
  }

  return wrappedHandler.apply(ctx, args)
}

module.exports.handler = wrapHandler