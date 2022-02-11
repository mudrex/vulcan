const logger = require('../config/logger')('complete', process.env['LOG_LEVEL'])
const aws = require('../utils/aws')
const vulcan = require('../lib/vulcan')

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
	'blue-task-set-arn': {
		describe:
			'ARN of the blue task set of ECS cluster in the specified AWS region.',
		type: 'string',
		demandOption: false,
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
		demandOption: true,
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

	// Modify Listener if green target group exists
	if (argv.isLoadBalancerPresent) {
		const modifiedListener = await aws.modifyListenerRule(
			argv.liveListenerRuleArn,
			argv.greenTargetGroupArn
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
	const updatedTaskSet = await aws.updateServicePrimaryTaskSet(
		argv.serviceName,
		argv.clusterName,
		argv.greenTaskSetArn
	)
	logger.debug(
		`Updated Task Set: - \n ${JSON.stringify(updatedTaskSet, null, 2)}`
	)

	// Delete blue task set if it exists
	if (!vulcan.isStringNull(argv.blueTaskSetArn)) {
		const deletedTaskSet = await aws.deleteTaskSet(
			argv.serviceName,
			argv.clusterName,
			argv.blueTaskSetArn
		)
		logger.debug(
			`Deleted Task Set: - \n ${JSON.stringify(deletedTaskSet, null, 2)}`
		)
	}
}
