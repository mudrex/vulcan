const logger = require('../config/logger')(
	'bootstrap',
	process.env['LOG_LEVEL']
)
const aws = require('../utils/aws')
const file = require('../utils/file')
const vulcan = require('../lib/vulcan')

/**
 * Module responsible for running sanity checks on the existing service and deployment.
 * @module bootstrap
 */

/**
 * Name of the command
 */
exports.command = 'bootstrap [options]'

/**
 * Description of the command
 */
exports.describe =
	'Bootstrap an ECS Service. Capture and print blue task set Arn in an output file.'

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
	'output-file': {
		describe: 'Path of the output file.',
		type: 'string',
		default: 'bootstrap.json',
		demandOption: false,
	},
}

/**
 * Handler which executes on this command.
 * The AWS ECS API is used to descibe the service and run sanity checks. It checks whether the service
 * is deployable via vulcan and outputs a file containing ARN of the blue task set.
 *
 * @param {Object} argv - The parameters mentioned in {@link module:bootstap.builder}
 *
 */
exports.handler = async (argv) => {
	logger.debug(`Input: -\n ${JSON.stringify(argv, null, 2)}`)

	const awsDescribeService = await aws.describeService(
		argv.serviceName,
		argv.clusterName
	)

	logger.debug(`Service Description: - \n ${awsDescribeService}`)

	const blueTaskSetArn = await vulcan.getBlueTaskSetArn(awsDescribeService)

	file.writeJSON(argv.outputFile, { blueTaskSetArn: blueTaskSetArn })
}
