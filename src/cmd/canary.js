const logger = require('../config/logger')('canary')
const vulcan = require('../lib/vulcan')
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
exports.describe = 'Splits traffic between the blue and green target group.'

/**
 * Builder of the command
 */
exports.builder = {
	'live-listener-rule-arn': {
		describe:
			'The Amazon Resource Name (ARN) of the live rule. Traffic will be split on this rule.',
		type: 'string',
		demandOption: true,
	},
	'blue-target-group': {
		describe:
			'The name or the Amazon Resource Name (ARN) of the Elastic Load Balancing target group of the blue task set.',
		type: 'string',
		demandOption: true,
	},
	'green-target-group': {
		describe:
			'The name or the Amazon Resource Name (ARN) of the Elastic Load Balancing target group of the green task set.',
		type: 'string',
		demandOption: true,
	},
	'percent': {
		describe: 'The percentage of traffic to shift to the green target group.',
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

	// Get Blue Target Group Arn
	let blueTargetGroupArn = null
	if (argv.blueTargetGroup.startsWith('arn:')) {
		logger.info('ARN has been provided for blue target group')
		blueTargetGroupArn = argv.blueTargetGroup
	} else {
		blueTargetGroupArn = vulcan.getTargetGroupArnFromName(argv.blueTargetGroup)
	}

	// Get Green Target Group Arn
	let greenTargetGroupArn = null
	if (argv.greenTargetGroup.startsWith('arn:')) {
		logger.info('ARN has been provided for blue target group')
		greenTargetGroupArn = argv.greenTargetGroup
	} else {
		greenTargetGroupArn = vulcan.getTargetGroupArnFromName(
			argv.greenTargetGroup
		)
	}

	logger.info(
		`Preparing to shift ${argv.percent}% of traffic to green target group ${argv.greenTargetGroupArn}`
	)
	const shift = await aws.divideListenerRule(
		argv.liveListenerRuleArn,
		blueTargetGroupArn,
		greenTargetGroupArn,
		argv.percent
	)
	logger.info(
		`${argv.percent}% of traffic successfully shifted to target group ${argv.greenTargetGroupArn}`
	)
	logger.debug(`Listener Rule: - \n ${JSON.stringify(shift, null, 2)}`)
}
