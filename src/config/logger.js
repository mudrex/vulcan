const winston = require('winston')
const chalk = require('chalk')

/**
 * Module responsible for creating a winston logger.
 * @module logger
 */

/**
 * Returns a winston logger
 *
 * @param {String} moduleName - The name of the module
 * @param {String} logLevel - The log level
 * @return {Object}  WinstonLogger
 */
module.exports = (moduleName, logLevel) => {
	const format = winston.format.printf(
		({ level, message, label, timestamp }) => {
			const levelUpper = level.toUpperCase()
			switch (levelUpper) {
				case 'INFO':
					message = chalk.green(message)
					level = chalk.green.bold(levelUpper)
					break

				case 'WARN':
					message = chalk.yellow(message)
					level = chalk.yellow.bold(levelUpper)
					break

				case 'ERROR':
					message = chalk.red(message)
					level = chalk.red.bold(levelUpper)
					break

				case 'DEBUG':
					message = chalk.blue(message)
					level = chalk.blue.bold(levelUpper)
					break

				default:
					break
			}
			return `[${chalk.magenta(timestamp)}] (${chalk.magenta(
				label
			)}) ${level} : ${message}`
		}
	)
	const logger = winston.createLogger({
		level: `${logLevel}`,
		transports: [new winston.transports.Console()],
		format: winston.format.combine(
			winston.format.label({ label: `${moduleName}` }),
			winston.format.timestamp({ format: new Date().toLocaleString('en-GB') }),
			format
		),
	})
	return logger
}
