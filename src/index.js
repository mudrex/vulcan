const yargs = require('yargs')

/**
 * Initializes vulcan command line.
 * @module init
 */
const init = () => {
	yargs
		.commandDir('cmd')
		.usage('Usage: vulcan <command> [options]')
    .demandCommand()
		.version()
    .help()
		.argv
}

module.exports.init = init
