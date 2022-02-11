const yargs = require('yargs')
const logger = require('./config/logger')('init', 'info')
const dotenv = require('dotenv')

/**
 * Module responsible for initializing scaffolding of the application.
 * @module init
 */

/**
 * Initializes vulcan command line.
 */
const init = () => {
	// Set default environment variables
	setEnv()
	yargs
		.commandDir('cmd')
		.usage('Usage: vulcan <command> [options]')
		.demandCommand()
		.version()
		.help()
		.fail(fail).argv
}

/**
 * Sets all environment variables. If a variable is not present, a default value is used.
 */
const setEnv = () => {
	dotenv.config()
	process.env['LOG_LEVEL'] = process.env['LOG_LEVEL'] ?? 'info'
	process.env['AWS_REGION'] = process.env['AWS_REGION'] ?? 'us-east-1'
	process.env['AWS_PROFILE'] = process.env['AWS_PROFILE'] ?? 'default'
}

/**
 * Handles failure in vulcan.
 *
 * If it's an error from the program, exit from the program without displaying help. If it's an error from yargs, print the message and exit from the progrram.
 *
 * @param {String} msg - The error message given by yargs
 * @param {Object} err - The error stack
 * @param {Object} yargs - The state of yargs at the time of error
 */
const fail = (msg, err, yargs) => {
	if (err) {
		throw err
	}
	logger.error(msg)
	yargs.showHelp()
	process.exit(1)
}

module.exports.init = init
