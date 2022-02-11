const logger = require('../config/logger')('wait', process.env['LOG_LEVEL'])
const aws = require('../utils/aws')

/**
 * Module responsible for determining whether a deployment is successful.
 * @module wait
 */

/**
 * Name of the command
 */
exports.command = 'wait [options]'

/**
 * Description of the command
 */
exports.describe = 'Wait till the deployment is in STEADY_STATE.'

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
		describe: 'ARN of the task set.',
		type: 'string',
		default: 'task.json',
		demandOption: true,
	},
	'timeout': {
		describe: 'Timeout (in seconds) for the new task to become healthy',
		type: 'number',
		default: '100',
		demandOption: false,
	},
	'poll-interval': {
		describe:
			'Interval (in seconds) in which ECS will be polled to get the task status.',
		type: 'number',
		default: '10',
		demandOption: false,
	},
	'check': {
		describe: 'Check whether deployment is still in steady state.',
		type: 'boolean',
		default: false,
		demandOption: false,
	},
}

/**
 * Handler which executes on this command.
 *
 * The AWS ECS API is polled every poll-interval seconds for timeout seconds.
 * If the green-task-set-arn is in STEADY_STATE, command is successful.
 *
 * @param {Object} argv - The parameters mentioned in {@link module:wait.builder}
 *
 */
exports.handler = async (argv) => {
	logger.debug(`Input: -\n ${JSON.stringify(argv, null, 2)}`)
	const ecsTaskStatusId = setInterval(async () => {
		const taskStatus = await aws.describeTaskSet(
			argv.serviceName,
			argv.clusterName,
			argv.greenTaskSetArn
		)
		const taskSet = taskStatus.taskSets[0]
		logger.debug(`Green Task Set: ${JSON.stringify(taskSet, null, 2)}`)
		const taskSetStabilityStatus = taskSet.stabilityStatus
		logger.info(
			`Task Set : ${argv.greenTaskSetArn} has stabilityStatus: ${taskSetStabilityStatus}`
		)
		if (argv.check == false && taskSetStabilityStatus == 'STEADY_STATE') {
			logger.debug('Clearing ecsTaskStatusId')
			logger.info(`Deployment has reached status : ${taskSetStabilityStatus}`)
			clearInterval(ecsTaskStatusId)
			clearTimeout(globalTimeoutId)
		}

		if (argv.check == true && taskSetStabilityStatus != 'STEADY_STATE') {
			logger.debug('Clearing ecsTaskStatusId')
			clearInterval(ecsTaskStatusId)
			clearTimeout(globalTimeoutId)
			const errorMessage = `Deployment has become unhealthy with status : ${taskSetStabilityStatus}.`
			logger.error(`${errorMessage}`)
			throw new Error(`${errorMessage}`)
		}
	}, argv.pollInterval * 1000)

	const globalTimeoutId = setTimeout(() => {
		clearInterval(ecsTaskStatusId)
		if (argv.check == false) {
			const errorMessage = `Deployment failed to reach steady state within ${argv.timeout} seconds.`
			logger.error(`${errorMessage}`)
			throw new Error(`${errorMessage}`)
		}

		if (argv.check == true) {
			logger.info(
				`Deployment has been steady for the past ${argv.timeout} seconds.`
			)
		}
	}, argv.timeout * 1000)
}
