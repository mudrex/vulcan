const winston = require('winston')

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
			return `[${timestamp}] (${label}) ${levelUpper} : ${message}`
		}
	)
	const logger = winston.createLogger({
		level: process.env['LOG_LEVEL'],
		transports: [new winston.transports.Console()],
		format: winston.format.combine(
			winston.format.label({ label: `${moduleName}` }),
			winston.format.timestamp({ format: new Date().toLocaleString('en-GB') }),
			format
		),
	})
	return logger
}
