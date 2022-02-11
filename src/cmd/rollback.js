const logger = require('../config/logger')('rollback', process.env['LOG_LEVEL'])
const aws = require('../utils/aws')

/**
 * Module responsible for rolling back to the blue deployment.
 * @module rollback
 */

/**
 * Name of the command
 */
exports.command = 'rollback [options]'

/**
 * Description of the command
 */
exports.describe = 'Delete green deployment and rollback.'

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
		describe: 'ARN of green task set',
		type: 'string',
		demandOption: false,
	},
	'green-task-definition-arn': {
		describe: 'ARN of green task definition.',
		type: 'string',
		demandOption: false,
	},
	'is-load-balancer-present': {
		describe: 'Is Load Balancer present?',
		type: 'boolean',
		default: false,
	},
	'is-initial-deployment': {
		describe: 'Is this the first deployment?',
		type: 'boolean',
		default: false,
	},
	'blue-target-group-arn': {
		describe: 'ARN of blue target group.',
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
 *
 * Deletes all green deployment resources and modifies load balancer to point to blue deployment.
 *
 * @param {Object} argv - The parameters mentioned in {@link module:wait.builder}
 *
 */
exports.handler = async (argv) => {
	logger.debug(`Input: -\n ${JSON.stringify(argv, null, 2)}`)
	// Delete Task Set
	if (argv.greenTaskSetArn && argv.greenTaskSetArn != 'null') {
		const deletedGreenTaskSet = await aws.deleteTaskSet(
			argv.serviceName,
			argv.clusterName,
			argv.greenTaskSetArn
		)
		logger.debug(
			`Deleted Green Task Set: -\n ${JSON.stringify(
				deletedGreenTaskSet,
				null,
				2
			)}`
		)
	}

	// Deregister task defintion
	if (argv.greenTaskDefinitionArn && argv.greenTaskDefinitionArn != 'null') {
		const deregisteredTaskDefinition = await aws.deregisterTaskDefinition(
			argv.greenTaskDefinitionArn
		)
		logger.debug(
			`Deregistered Green Task Definition: -\n ${JSON.stringify(
				deregisteredTaskDefinition,
				null,
				2
			)}`
		)
	}

	// Correct Load Balancer Rules
	if (argv.isLoadBalancerPresent && !argv.isInitialDeployment) {
		logger.info('Load balancer rules have to be corrected as well.')
		const modifiedListener = await aws.modifyListenerRule(
			argv.liveListenerRuleArn,
			argv.blueTargetGroupArn
		)
		logger.debug(
			`Modified Listener Rule: - \n ${JSON.stringify(
				modifiedListener,
				null,
				2
			)}`
		)
	}
}
