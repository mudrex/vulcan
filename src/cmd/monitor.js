const logger = require('../config/logger')('monitor')
const aws = require('../utils/aws')

/**
 * Module responsible for determining whether a deployment has become unhealthy or not.
 * @module monitor
 */

/**
 * Name of the command
 */
exports.command = 'monitor [options]'

/**
 * Description of the command
 */
exports.describe =
	'Monitors a deployment until it has becomes unhealthy. It polls ECS API at a specified interval until a specified time.'

/**
 * Builder of the command
 */
exports.builder = {
	'service-name': {
		describe:
			'The short name or full Amazon Resource Name (ARN) of the service in which the task set is in.',
		type: 'string',
		demandOption: true,
	},
	'cluster-name': {
		describe:
			'The short name or full Amazon Resource Name (ARN) of the cluster in which the task set is in.',
		type: 'string',
		demandOption: true,
	},
	'green-task-set-arn': {
		describe: 'The Amazon Resource Name (ARN) of the green task set.',
		type: 'string',
		default: 'task.json',
		demandOption: true,
	},
	'timeout': {
		describe:
			'The total time (in seconds) to monitor the deployment. The command will fail if the deployment becomes unhealthy within this time period.',
		type: 'number',
		default: '100',
		demandOption: false,
	},
	'poll-interval': {
		describe:
			'The interval (in seconds) in which ECS API is polled. The status of the deployment will be retrieved at this interval.',
		type: 'number',
		default: '10',
		demandOption: false,
	},
}

/**
 * Handler which executes on this command.
 *
 * The AWS ECS API is polled every poll-interval seconds for timeout seconds.
 * If the deployment is always healthy in that timeout period, command is successful.
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
		if (taskStatus.taskSets.length == 0) {
			const errorMessage = `Error occurred while describing task set with arn ${taskStatus.failures[0].arn}, reason is ${taskStatus.failures[0].reason}`
			logger.error(`${errorMessage}`)
			throw Error(`${errorMessage}`)
		}
		const taskSet = taskStatus.taskSets[0]
		logger.debug(`Green Task Set: ${JSON.stringify(taskSet, null, 2)}`)
		const taskSetStabilityStatus = taskSet.stabilityStatus
		logger.info(
			`Task Set ${argv.greenTaskSetArn} has stabilityStatus ${taskSetStabilityStatus}`
		)
		if (taskSetStabilityStatus != 'STEADY_STATE') {
			logger.debug('Clearing ecsTaskStatusId')
			clearInterval(ecsTaskStatusId)
			clearTimeout(globalTimeoutId)
			const errorMessage = `Deployment has become unhealthy with status ${taskSetStabilityStatus}`
			logger.error(`${errorMessage}`)
			throw new Error(`${errorMessage}`)
		}
	}, argv.pollInterval * 1000)

	const globalTimeoutId = setTimeout(() => {
		clearInterval(ecsTaskStatusId)
		logger.info(
			`Deployment has been healthy for the past ${argv.timeout} seconds.`
		)
	}, argv.timeout * 1000)
}
