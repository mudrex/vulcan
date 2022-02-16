/**
 * Module containing functions for interacting with the objects.
 * @module obj
 */

/**
 * Merges 2 objects in a template object with 1 object overriding values of the other object.
 *
 * @param {Object} template - The object containing the required keys
 * @param {Object} obj - The object
 * @param {Object} override - The override values for the object
 * @return {Object}
 */
const overrideObject = (template, obj, override) => {
	const finalObject = template
	for (const key in finalObject) {
		if (override != null && override[key]) {
			finalObject[key] = override[key]
		} else if (obj != null && obj[key]) {
			finalObject[key] = obj[key]
		}
	}
	return finalObject
}

/**
 * Returns whether a string is null or not.
 *
 * @param {String} str - String to perform null check on
 * @return {Boolean}
 */
const isStringNull = (str) => {
	if (str && str != 'null') {
		return false
	}

	return true
}

module.exports = {
	overrideObject: overrideObject,
	isStringNull: isStringNull,
}
