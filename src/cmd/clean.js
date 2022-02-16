const logger = require('../config/logger')('clean', process.env['LOG_LEVEL'])
const vulcan = require('../lib/vulcan')
const aws = require('../utils/aws')

/**
 * Module responsible for cleaning any active task sets.
 * @module clean
 */

/**
 * Name of the command
 */
exports.command = 'clean [options]'

/**
 * Description of the command
 */
exports.describe =
	'Deletes all active deployments, deployments which do not serve production traffic.'

/**
 * Builder of the command
 */
exports.builder = {
	'service-name': {
		describe:
			'The short name or full Amazon Resource Name (ARN) of the service to create the task set in.',
		type: 'string',
		demandOption: true,
	},
	'cluster-name': {
		describe:
			'The short name or full Amazon Resource Name (ARN) of the cluster to create the task set in.',
		type: 'string',
		demandOption: true,
	},
}

/**
 * Handler which executes on this command.
 *
 * Deletes all active task sets.
 *
 * @param {Object} argv - The parameters mentioned in {@link module:clean.builder}
 *
 */
exports.handler = async (argv) => {
	logger.debug(`Input: -\n ${JSON.stringify(argv, null, 2)}`)

	const awsDescribeService = await aws.describeService(
		argv.serviceName,
		argv.clusterName
	)

	logger.debug(`Service Description: - \n ${awsDescribeService}`)

	const activeTaskSetArns = await vulcan.getActiveTaskSetArns(
		awsDescribeService
	)
	if (activeTaskSetArns.length == 0) {
		logger.info('There are no active task sets present, nothing to clean')
	} else {
		for (const activeTaskSet of activeTaskSetArns) {
			logger.info(`Deleting active task set ${activeTaskSet}`)
			const deletedActiveTaskSet = await aws.deleteTaskSet(
				argv.serviceName,
				argv.clusterName,
				activeTaskSet
			)
			logger.debug(
				`Deleted active task set: -\n ${JSON.stringify(
					deletedActiveTaskSet,
					null,
					2
				)}`
			)
			logger.info(`active task Set ${activeTaskSet} successfully deleted`)
		}
	}
}
