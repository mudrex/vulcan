const logger = require('../config/logger')('deploy', process.env['LOG_LEVEL'])
const aws = require('../utils/aws')
const file = require('../utils/file')
const vulcan = require('../lib/vulcan')
const obj = require('../utils/obj')
const constants = require('../config/constants')

/**
 * Module responsible for creating a new task definition, a new task set and modifying load balancer listener rule (if applicable).
 * @module deploy
 */

/**
 * Name of the command
 */
exports.command = 'deploy [options]'

/**
 * Description of the command
 */
exports.describe =
	'Deploys a task set with a task definition. It also modifies load balancer listener rules if applicable.'

/**
 * Builder of the command
 */
exports.builder = {
	'service-name': {
		describe:
			'The short name or full Amazon Resource Name (ARN) of the service to create the task set in.',
		type: 'string',
		demandOption: true,
	},
	'cluster-name': {
		describe:
			'The short name or full Amazon Resource Name (ARN) of the cluster to create the task set in.',
		type: 'string',
		demandOption: true,
	},
	'green-task-definition-file': {
		describe:
			'The file path containing the green task definition (in JSON). The file follows the format provided by `aws ecs register-task-definition --generate-cli-skeleton input`. If no green task definition file is specified, the task definition of the primary task set (if it exists, also referred to as blue task set) is used. The path must be relative to the directory in which vulcan is being run.',
		type: 'string',
		default: 'task-definition.json',
		demandOption: true,
	},
	'green-task-set-file': {
		describe:
			'The file path containing the green task set (in JSON). The file follows the format provided by `aws ecs create-task-set --generate-cli-skeleton input`. If no green task set file is specified, the task set of the primary task set (if it exists, also referred to as blue task set) is used. The path must be relative to the directory in which vulcan is being run. Required for the very first deployment.',
		type: 'string',
		default: 'task-set.json',
		demandOption: true,
	},
	'green-listener-rule-arn': {
		describe:
			'The Amazon Resource Name (ARN) of the rule. This rule will be modified to serve 100% traffic from the green deployment.',
		type: 'string',
		demandOption: false,
	},
	'output-green-file': {
		describe:
			'The file path containing the details of the green deployment (in JSON).',
		type: 'string',
		default: 'green.vulcan.json',
		demandOption: false,
	},
}

/**
 * Handler which executes on this command.
 *
 * Deploys a green task set based on a green task definition and modifies listener rules if applicable.
 *
 * @param {*} argv - The parameters mentioned in {@link module:deploy.builder}
 *
 */
exports.handler = async (argv) => {
	logger.debug(`Input: -\n ${JSON.stringify(argv, null, 2)}`)

	logger.info(
		`Reading green task definition file from ${argv.greenTaskDefinitionFile}`
	)
	const greenTaskDefinition = file.readJSON(argv.greenTaskDefinitionFile)

	logger.info(
		`Reading green task definition file from ${argv.greenTaskSetFile}`
	)
	const greenTaskSet = file.readJSON(argv.greenTaskSetFile)

	const greenObj = Object.create(constants.deploymentTemplate)

	try {
		//
		// Step 1 - Register Green Task Definition
		//
		logger.info('Trying to register green task definition')
		const registeredTaskDefinition = await aws.registerTaskDefinition(
			greenTaskDefinition
		)
		logger.debug(
			`Green Task Definition - \n ${JSON.stringify(
				registeredTaskDefinition,
				null,
				2
			)}`
		)
		const registeredGreenTaskDefinitionArn =
			registeredTaskDefinition.taskDefinition.taskDefinitionArn
		logger.info(
			`Green Task Definition ${registeredGreenTaskDefinitionArn} successfully registered.`
		)
		greenObj.taskDefinitionArn = registeredGreenTaskDefinitionArn

		//
		// Step 2 - Assemble Green Task Set
		//
		logger.info('Trying to assemble green task set')
		const assembledGreenTaskSet = vulcan.assembleTaskSet(
			argv.serviceName,
			argv.clusterName,
			registeredGreenTaskDefinitionArn,
			greenTaskSet
		)
		logger.info('Green task set successfully assembled')

		//
		// Step 3 - Create Task Set (Actually deploy)
		//
		logger.info('Trying to create green task set')
		const createdTaskSet = await aws.createTaskSet(assembledGreenTaskSet)
		logger.debug(
			`Green Task Set - \n ${JSON.stringify(createdTaskSet, null, 2)}`
		)
		const createdTaskSetArn = createdTaskSet.taskSet.taskSetArn
		logger.info(`Green Task Set ${createdTaskSetArn} successfully created.`)
		greenObj.taskSetArn = createdTaskSetArn

		//
		// Step 4 - Modify listener rule (if applicable)
		//
		const isLoadBalancerPresent = vulcan.isLoadBalancerPresent(
			createdTaskSet.taskSet
		)
		if (isLoadBalancerPresent) {
			if (obj.isStringNull(argv.greenListenerRuleArn)) {
				const errorMessage =
					'The deployment contains a load balancer, please specify a listener rule arn'
				logger.error(`${errorMessage}`)
				throw new Error(`${errorMessage}`)
			}
			const greenTargetGroupArn =
				createdTaskSet.taskSet.loadBalancers[0].targetGroupArn
			logger.info(
				`Preparing to modify listener rule ${argv.greenListenerRuleArn} to point to target group ${greenTargetGroupArn}.`
			)
			const modifiedListener = await aws.modifyListenerRule(
				argv.greenListenerRuleArn,
				greenTargetGroupArn
			)
			logger.debug(`Modified Listener: - \n ${modifiedListener}`)
			logger.info('Listener Rule successfully modified.')
		}
		file.writeJSON(argv.outputGreenFile, greenObj)
	} catch (error) {
		logger.info(
			`Deploy command has failed, a rollback file has been generated at path ${argv.outputGreenFile}`
		)
		file.writeJSON(argv.outputGreenFile, greenObj)
		throw error
	}
}
