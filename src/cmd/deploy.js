const logger = require('../config/logger')('deploy', process.env['LOG_LEVEL'])
const aws = require('../utils/aws')
const file = require('../utils/file')
const vulcan = require('../lib/vulcan')

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
	'Deploy green task set with a new task definition. Modify load balancer listener rules if applicable.'

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
	'image': {
		describe: 'Name of docker image with tag to deploy.',
		type: 'string',
		demandOption: true,
	},
	'task-definition-family': {
		describe: 'Name of family of the task definition.',
		type: 'string',
		demandOption: true,
	},
	'task-execution-role-arn': {
		describe: 'Arn of the task execution role.',
		type: 'string',
		demandOption: true,
	},
	'task-role-arn': {
		describe: 'Arn of the task role.',
		type: 'string',
		demandOption: true,
	},
	'target-groups': {
		describe: 'Comma separated list of target groups.',
		type: 'string',
		demandOption: false,
	},
	'live-listener-rule-arn': {
		describe: 'Arn of the live listener rule.',
		type: 'string',
		demandOption: false,
	},
	'test-listener-rule-arn': {
		describe: 'Arn of the test listener rule.',
		type: 'string',
		demandOption: false,
	},
	'blue-task-set-arn': {
		describe: 'Arn of blue task set.',
		type: 'string',
		demandOption: false,
	},
	'task-definition-file': {
		describe: 'Path of the file containing the green task definition.',
		type: 'string',
		demandOption: false,
	},
	'task-set-file': {
		describe: 'Path of the file containing the green task set.',
		type: 'string',
		demandOption: false,
	},
	'is-blue-green': {
		describe: 'Flag to enable blue green deployment.',
		type: 'boolean',
		default: false,
		demandOption: false,
	},
	'output-file': {
		describe: 'Path of the output file.',
		type: 'string',
		default: 'state.json',
		demandOption: false,
	},
}

/**
 * Handler which executes on this command.
 *
 * If no input task definition is given, the old task definiton is used with the new image.
 * If no input task set is given, the primary task set is used with green target group.
 * If blue green is not enabled, the live listener rule is modified to serve 100% traffic from green.
 * If blue green is enabled, the test listener rule is modified to serve 100% traffic from green.
 *
 * @param {*} argv - The parameters mentioned in {@link module:deploy.builder}
 *
 */
exports.handler = async (argv) => {
	logger.debug(`Input: -\n ${JSON.stringify(argv, null, 2)}`)

	// State Object of vulcan
	const state = {
		isInitialDeployment: false,
		isCanaryEligible: false,
		isLoadBalancerPresent: false,
		blueTargetGroupArn: null,
		greenTargetGroupArn: null,
		blueTaskSetArn: null,
		greenTaskSetArn: null,
		greenTaskDefinitionArn: null,
	}

	try {
		let blueTaskSet = null
		// Perform null check on blueTaskSetArn
		if (!vulcan.isStringNull(argv.blueTaskSetArn)) {
			const blueTaskSetDescription = await aws.describeTaskSet(
				argv.serviceName,
				argv.clusterName,
				argv.blueTaskSetArn
			)
			blueTaskSet = blueTaskSetDescription.taskSets[0]
			logger.info(`Blue Task Set is ${blueTaskSet.taskSetArn}`)
			logger.debug(`Blue Task Set: -\n ${JSON.stringify(blueTaskSet, null, 2)}`)
		} else {
			logger.info('Blue Task Set not found. This is the first deployment.')
		}

		const isBluePresent = blueTaskSet == null ? false : true
		state.isInitialDeployment = !isBluePresent
		state.blueTaskSetArn = argv.blueTaskSetArn

		const taskDefinition = await vulcan.getTaskDefinition(
			isBluePresent,
			blueTaskSet,
			argv.taskDefinitionFile
		)
		logger.debug(
			`Input Green Task Definition -\n${JSON.stringify(
				taskDefinition,
				null,
				2
			)}`
		)

		const greenTaskDefinition = vulcan.createTaskDefinition(
			taskDefinition,
			argv.image,
			argv.taskDefinitionFamily,
			argv.taskExecutionRoleArn,
			argv.taskRoleArn
		)
		logger.debug(
			`Green Task Definition to Register -\n ${JSON.stringify(
				greenTaskDefinition,
				null,
				2
			)}`
		)

		const registeredTaskDefinition = await aws.registerTaskDefinition(
			greenTaskDefinition
		)
		logger.info(
			`Green Task Definition ${registeredTaskDefinition.taskDefinition.taskDefinitionArn} successfully registered.`
		)
		logger.debug(
			`Green Task Definition - \n ${JSON.stringify(
				registeredTaskDefinition,
				null,
				2
			)}`
		)

		// Update state
		state.greenTaskDefinitionArn =
			registeredTaskDefinition.taskDefinition.taskDefinitionArn

		const greenTaskSet = vulcan.getTaskSet(
			isBluePresent,
			blueTaskSet,
			argv.taskSetFile
		)
		logger.debug(
			`Input Green Task Set - \n ${JSON.stringify(greenTaskSet, null, 2)}`
		)

		const flags = {
			isBluePresent: isBluePresent,
			isLoadBalancer: isBluePresent
				? vulcan.isLoadBalancerPresent(blueTaskSet)
				: vulcan.isLoadBalancerPresent(greenTaskSet),
			isBlueGreen: argv.isBlueGreen,
		}
		logger.debug(`Flags: -\n${JSON.stringify(flags, null, 2)}`)

		switch (flags.isLoadBalancer) {
			case false: {
				// Only create Task Set
				logger.info(
					'Conditions match for a rolling deployment with no load balancers.'
				)
				const createdTaskSet = await vulcan.createTaskSet(
					greenTaskSet,
					registeredTaskDefinition,
					null,
					argv.serviceName,
					argv.clusterName
				)
				logger.info(
					`Green Task Set ${createdTaskSet.taskSet.taskSetArn} successfully created.`
				)
				// Update state
				state.isCanaryEligible = false
				state.isLoadBalancerPresent = false
				state.greenTaskSetArn = createdTaskSet.taskSet.taskSetArn
				break
			}
			case true:
				if (flags.isBlueGreen && flags.isBluePresent) {
					// Case for blue green deployment
					logger.info('Conditions match for a blue green deployment.')

					const targetGroups = vulcan.getTargetGroupsWithBlueGreenEnabled(
						argv.targetGroups,
						blueTaskSet
					)

					const greenTargetGroupArn = await vulcan.getTargetGroupARN(
						targetGroups.green
					)
					const blueTargetGroupArn = await vulcan.getTargetGroupARN(
						targetGroups.blue
					)

					const createdTaskSet = await vulcan.createTaskSet(
						greenTaskSet,
						registeredTaskDefinition,
						greenTargetGroupArn,
						argv.serviceName,
						argv.clusterName
					)
					logger.info(
						`Green Task Set ${createdTaskSet.taskSet.taskSetArn} successfully created.`
					)

					logger.info(
						`Preparing to modify test listener rule ${argv.testListenerRuleArn} to point to target group ${greenTargetGroupArn}.`
					)
					const modifiedListener = await aws.modifyListenerRule(
						argv.testListenerRuleArn,
						greenTargetGroupArn
					)
					logger.info('Test Listener Rule successfully modified.')
					logger.debug(`Modified Listener: - \n ${modifiedListener}`)

					// Update State
					state.isCanaryEligible = true
					state.isLoadBalancerPresent = true
					state.greenTaskSetArn = createdTaskSet.taskSet.taskSetArn
					state.greenTargetGroupArn = greenTargetGroupArn
					state.blueTargetGroupArn = blueTargetGroupArn
				} else {
					// Just modify green directly and do a rolling deploy.
					logger.info(
						'Conditions match for a rolling deployment with load balancer.'
					)
					const greenTargetGroup = vulcan.getTargetGroupWithBlueGreenDisabled(
						argv.targetGroups
					)

					const greenTargetGroupArn = await vulcan.getTargetGroupARN(
						greenTargetGroup
					)
					const createdTaskSet = await vulcan.createTaskSet(
						greenTaskSet,
						registeredTaskDefinition,
						greenTargetGroupArn,
						argv.serviceName,
						argv.clusterName
					)
					logger.info(
						`Green Task Set ${createdTaskSet.taskSet.taskSetArn} successfully created.`
					)

					logger.info('Preparing to shift 100% of traffic to green deployment.')
					const modifiedListener = await aws.modifyListenerRule(
						argv.liveListenerRuleArn,
						greenTargetGroupArn
					)
					logger.info('Traffic shift successfully completed.')
					logger.debug(`Modified Listener: - \n ${modifiedListener}`)
					// Update State
					state.isCanaryEligible = false
					state.isLoadBalancerPresent = true
					state.greenTaskSetArn = createdTaskSet.taskSet.taskSetArn
					state.greenTargetGroupArn = greenTargetGroupArn
				}
		}

		logger.debug(`Vulcan State: - \n ${JSON.stringify(state, null, 2)}`)
		file.writeJSON(argv.outputFile, state)
	} catch (error) {
		logger.info(
			`Deploy command has failed. A rollback file has been generated at path : ${argv.outputFile}. Please run vulcan rollback.`
		)
		file.writeJSON(argv.outputFile, state)
		throw error
	}
}
