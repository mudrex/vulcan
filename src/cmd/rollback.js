const logger = require('../config/logger')('rollback', process.env['LOG_LEVEL'])
const vulcan = require('../lib/vulcan')
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
 * Deletes all green deployment resources and modifies load balancer to point to blue deployment if applicable.
 *
 * @param {Object} argv - The parameters mentioned in {@link module:wait.builder}
 *
 */
exports.handler = async (argv) => {
	logger.debug(`Input: -\n ${JSON.stringify(argv, null, 2)}`)

	// Delete Task Set
	if (!vulcan.isStringNull(argv.greenTaskSetArn)) {
		logger.info(`Deleting Green Task Set ${argv.greenTaskSetArn}`)
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
		logger.info(`Green Task Set ${argv.greenTaskSetArn} successfully deleted.`)
	}

	// Deregister task defintion
	if (!vulcan.isStringNull(argv.greenTaskDefinitionArn)) {
		logger.info(`Deregistering Green Task Definition ${argv.greenTaskDefinitionArn}`)
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
		logger.info(`Green Task Definition ${argv.greenTaskDefinitionArn} successfully deregistered.`)
	}

	// Correct Load Balancer Rules
	// Dont rely on blueTargetGroupArn presence. There might be a load balancer and blue target group Arn was missed out.
	if (argv.isLoadBalancerPresent && !argv.isInitialDeployment) {
		//Perform null check
		const isBlueTargetGroupArnNull = vulcan.isStringNull(argv.blueTargetGroupArn)
		if(isBlueTargetGroupArnNull){
			const errorMessage = `Load Balancer Listener Rule could not be changed as no blue-target-group-arn was specified. Please correct the rules manually on Listener Rule ${argv.liveListenerRuleArn}`
			logger.error(`${errorMessage}`)
			throw Error(`${errorMessage}`)
		}

		logger.info(`Modifying Load Balancer Listener Rule ${argv.liveListenerRuleArn}.`)
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
		logger.info(`Load Balancer Listener Rule ${argv.liveListenerRuleArn} successfully modified.`)
	}
}
