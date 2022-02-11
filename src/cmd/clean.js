const logger = require('../config/logger')('clean', process.env['LOG_LEVEL'])
const vulcan = require('../lib/vulcan')
const aws = require('../utils/aws')

/**
 * Module responsible for cleaning any ACTIVE deployments.
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
	'Deletes all active deployments (these deployments do not serve production traffic).'

/**
 * Builder of the command
 */
exports.builder = {
	'service-name': {
		describe: 'Name of ECS service in the specified AWS region.',
		type: 'string',
		demandOption: true,
	},
	'cluster-name': {
		describe: 'Name of ECS cluster in the specified AWS region.',
		type: 'string',
		demandOption: true,
	},
}

/**
 * Handler which executes on this command.
 *
 * Deletes all ACTIVE deployments.
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
		logger.info(
			'There are no Active Task Sets present. There is nothing to clean.'
		)
	} else {
		for (const activeTaskSet of activeTaskSetArns) {
			logger.info(`Deleting Active Task Set ${activeTaskSet}`)
			const deletedActiveTaskSet = await aws.deleteTaskSet(
				argv.serviceName,
				argv.clusterName,
				activeTaskSet
			)
			logger.debug(
				`Deleted Active Task Set: -\n ${JSON.stringify(
					deletedActiveTaskSet,
					null,
					2
				)}`
			)
			logger.info(`Active Task Set ${activeTaskSet} successfully deleted.`)
		}
	}
}
