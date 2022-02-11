const logger = require('../config/logger')('file', process.env['LOG_LEVEL'])
const fs = require('fs')
const path = require('path')

/**
 * Module containing functions for interacting with the file system.
 * @module aws
 */

/**
 * Writes a JSON Object to a file.
 *
 * @param {String} filePath - The path of the file (relative to the directory vulcan is being run in, i.e. process.cwd) to write to. Eg: - output/example.json
 * @param {Object} content - The JSON content to write to the file
 */
const writeJSON = (filePath, content) => {
	const fullFilePath = path.resolve(`${process.cwd()}`, filePath)
	logger.info(`Writing output to file: ${fullFilePath}`)

	try {
		fs.writeFileSync(fullFilePath, JSON.stringify(content, null, 2))
	} catch (error) {
		const errorMessage = `Unable to write to file: ${fullFilePath} with error: ${error}`
		logger.error(`${errorMessage}`)
		throw error
	}
}
/**
 *  Read a JSON Object from a file.
 *
 * @param {String} filePath - The path of the file (relative to the directory vulcan is being run in, i.e. process.cwd) to read from. Eg: - output/example.json
 * @return {Object} The contents of the json file.
 */
const readJSON = (filePath) => {
	const fullFilePath = path.resolve(`${process.cwd()}`, filePath)
	logger.info(`Reading from file: ${fullFilePath}`)

	try {
		const contents = JSON.parse(fs.readFileSync(fullFilePath))
		return contents
	} catch (error) {
		const errorMessage = `Unable to read from file: ${fullFilePath} with error: ${error}`
		logger.error(`${errorMessage}`)
		throw error
	}
}

module.exports = {
	writeJSON: writeJSON,
	readJSON: readJSON,
}
