const logger = require('../config/logger')('complete', process.env['LOG_LEVEL'])
const aws = require('../utils/aws')
const vulcan = require('../lib/vulcan')
const obj = require('../utils/obj')

/**
 * Module responsible for doing completing a deployment.
 * @module complete
 */

/**
 * Name of the command
 */
exports.command = 'complete [options]'

/**
 * Description of the command
 */
exports.describe =
	'Completes a deployment. Updates the primary task set of a service to the green deployment and deletes the blue task set.'

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
	'green-task-set-arn': {
		describe:
			'ARN of the blue task set of ECS cluster in the specified AWS region.',
		type: 'string',
		demandOption: true,
	},
	'is-load-balancer-present': {
		describe: 'Is Load Balancer present?',
		type: 'boolean',
		default: false,
	},
	'green-target-group-arn': {
		describe:
			'ARN of the blue task set of ECS cluster in the specified AWS region.',
		type: 'string',
		demandOption: false,
	},
	'live-listener-rule-arn': {
		describe: 'ARN of live listener rule.',
		type: 'string',
		demandOption: false,
	},
}

/**
 * Handler which executes on this command.
 * Completes the deployment by marking green deployment as primary and deleting blue deployment..
 *
 * @param {Object} argv - The parameters mentioned in {@link module:complete.builder}
 *
 */
exports.handler = async (argv) => {
	logger.debug(`Input: -\n ${JSON.stringify(argv, null, 2)}`)

	const awsDescribeService = await aws.describeService(
		argv.serviceName,
		argv.clusterName
	)
	const service = vulcan.getService(awsDescribeService)
	logger.info(`Trying to find blue task set for service ${argv.serviceName}`)
	const blueTaskSet = vulcan.findBlueTaskSet(service.taskSets)

	// Modify Listener if green target group exists
	if (argv.isLoadBalancerPresent) {
		logger.info(
			`Preparing to modify live listener rule ${argv.liveListenerRuleArn} to point to target group ${argv.greenTargetGroupArn}.`
		)
		const modifiedListener = await aws.modifyListenerRule(
			argv.liveListenerRuleArn,
			argv.greenTargetGroupArn
		)
		logger.info(
			`Live listener rule ${argv.liveListenerRuleArn} successfully modified.`
		)
		logger.debug(
			`Modified Listener Rule: - \n ${JSON.stringify(
				modifiedListener,
				null,
				2
			)}`
		)
	}

	// Update primary Task set of service to green task set
	logger.info(
		`Updating primary task set to green task set ${argv.greenTaskSetArn}.`
	)
	const updatedTaskSet = await aws.updateServicePrimaryTaskSet(
		argv.serviceName,
		argv.clusterName,
		argv.greenTaskSetArn
	)
	logger.info('Primary Task Set successfully updated.')
	logger.debug(
		`Updated Task Set: - \n ${JSON.stringify(updatedTaskSet, null, 2)}`
	)

	// Delete blue task set if it exists
	if (!obj.isStringNull(blueTaskSet)) {
		logger.info(`Deleting Blue Task Set ${blueTaskSet.taskSetArn}.`)
		const deletedTaskSet = await aws.deleteTaskSet(
			argv.serviceName,
			argv.clusterName,
			blueTaskSet.taskSetArn
		)
		logger.info(`Blue Task Set ${blueTaskSet.taskSetArn} successfully deleted.`)
		logger.debug(
			`Deleted Task Set: - \n ${JSON.stringify(deletedTaskSet, null, 2)}`
		)
	}
}
