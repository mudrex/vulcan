const logger = require('../config/logger')('canary', process.env['LOG_LEVEL'])
const aws = require('../utils/aws')

/**
 * Module responsible for doing a canary deployment.
 * @module canary
 */

/**
 * Name of the command
 */
exports.command = 'canary [options]'

/**
 * Description of the command
 */
exports.describe =
	'Do a canary deployment. Shift a percentage a traffic from blue to green deployment.'

/**
 * Builder of the command
 */
exports.builder = {
	'live-listener-rule-arn': {
		describe: 'ARN of the live listener rule.',
		type: 'string',
		demandOption: true,
	},
	'blue-target-group-arn': {
		describe: 'ARN of the blue target group.',
		type: 'string',
		demandOption: true,
	},
	'green-target-group-arn': {
		describe: 'ARN of the green target group.',
		type: 'string',
		demandOption: true,
	},
	'percent': {
		describe: 'Percentage of traffic to shift to the new green deployment.',
		type: 'number',
		demandOption: true,
	},
}

/**
 * Handler which executes on this command.
 * Shifts a percentage of traffic on the load balancer rule from blue to green deployment.
 *
 * @param {Object} argv - The parameters mentioned in {@link module:canary.builder}
 *
 */
exports.handler = async (argv) => {
	logger.debug(`Input: -\n ${JSON.stringify(argv, null, 2)}`)
	logger.info(
		`Preparing to shift ${argv.percent}% of traffic to green deployment.`
	)
	const shift = await aws.divideListenerRule(
		argv.liveListenerRuleArn,
		argv.blueTargetGroupArn,
		argv.greenTargetGroupArn,
		argv.percent
	)
	logger.debug(`Listener Rule: - \n ${JSON.stringify(shift, null, 2)}`)
}
