const logger = require('../config/logger')('bootstrap')
const constants = require('../config/constants')
const aws = require('../utils/aws')
const file = require('../utils/file')
const vulcan = require('../lib/vulcan')
const obj = require('../utils/obj')

/**
 * Module responsible for bootstrapping a deployment.
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
	'Bootstrap an ECS deployment. This is used to create a task set and a task definition for a green deployment. Optionally, a state file is generated which can used for automation in Continuous Deployment or Continuous Delivery (CD) pipelines.'

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
	'green-image-definitions-file': {
		describe:
			'The file path containing the green image definitions (in JSON). The file follows the format [{name: "", image: ""}]. The path must be relative to the directory in which vulcan is being run.',
		type: 'string',
		demandOption: true,
	},
	'green-task-definition-file': {
		describe:
			'The file path containing the green task definition (in JSON). The file follows the format provided by `aws ecs register-task-definition --generate-cli-skeleton input`. If no green task definition file is specified, the task definition of the primary task set (if it exists, also referred to as blue task set) is used. The path must be relative to the directory in which vulcan is being run. Required for the very first deployment.',
		type: 'string',
		demandOption: false,
	},
	'override-green-task-definition-file': {
		describe:
			'The file path containing values to be overridden in the green task definition (in JSON). The file follows the format provided by `aws ecs register-task-definition --generate-cli-skeleton input`. This is used to override certain attributes specified in the green task definition. The path must be relative to the directory in which vulcan is being run.',
		type: 'string',
		demandOption: false,
	},
	'green-task-set-file': {
		describe:
			'The file path containing the green task set (in JSON). The file follows the format provided by `aws ecs create-task-set --generate-cli-skeleton input`. If no green task set file is specified, the task set of the primary task set (if it exists, also referred to as blue task set) is used. The path must be relative to the directory in which vulcan is being run. Required for the very first deployment.',
		type: 'string',
		demandOption: false,
	},
	'override-green-task-set-file': {
		describe:
			'The file path containing values to be overridden in the green task set (in JSON). The file follows the format provided by `aws ecs create-task-set --generate-cli-skeleton input`. This is used to override certain attributes specified in the green task set. The path must be relative to the directory in which vulcan is being run.',
		type: 'string',
		demandOption: false,
	},
	'is-blue-green': {
		describe:
			'Whether the deployment is blue green. If the service is not asssociated with a load balancer, this option is not required.',
		type: 'boolean',
		default: false,
		demandOption: false,
	},
	'target-group-names': {
		describe:
			'The names of the Elastic Load Balancing target group or groups associated with a service or task set. The full Amazon Resource Name (ARN) of the target groups is fetched automatically. If blue green is enabled, two (2) target groups must be specified. Of the 2 target groups, one must be attached to the primary task set (blue task set). If no target groups or less than 2 target groups are specified, an error will be thrown. If blue green is disabled, one (1) target group must be specified. If no target groups are specified, the target group of the primary task set (blue task set) is used. If the service is not asssociated with a load balancer, this option is not required.',
		type: 'string',
		demandOption: false,
	},
	'output-state-file': {
		describe:
			'The file path containing the state of the deployment (in JSON). This file can be used in CI servers for automation.',
		type: 'string',
		default: 'state.vulcan.json',
		demandOption: false,
	},
	'output-blue-file': {
		describe:
			'The file path containing the details of the blue deployment (in JSON).',
		type: 'string',
		default: 'blue.vulcan.json',
		demandOption: false,
	},
	'output-green-task-definition-file': {
		describe:
			'The file path containing the final green task definition (in JSON) to be registered. This file can be used for deployment.',
		type: 'string',
		default: 'task-definition.vulcan.json',
		demandOption: false,
	},
	'output-green-task-set-file': {
		describe:
			'The file path containing the final green task set (in JSON) to be created. This file can be used for deployment.',
		type: 'string',
		default: 'task-set.vulcan.json',
		demandOption: false,
	},
}

/**
 * Handler which executes on this command.
 * The AWS ECS API is used to descibe the service and run sanity checks. It creates a state file, a task definition and task set (in JSON) by looking at the input options and the running primary task set.
 *
 * @param {Object} argv - The parameters mentioned in {@link module:bootstap.builder}
 *
 */
exports.handler = async (argv) => {
	logger.debug(`Input: -\n ${JSON.stringify(argv, null, 2)}`)

	//
	// Step 1 - Get the service and run sanity checks
	//
	logger.info(
		`Trying to get find service ${argv.serviceName} in cluster ${argv.clusterName}`
	)
	const awsDescribeService = await aws.describeService(
		argv.serviceName,
		argv.clusterName
	)
	logger.debug(
		`Service Description: - \n ${JSON.stringify(awsDescribeService, null, 2)}`
	)

	const service = vulcan.getService(awsDescribeService)

	logger.info(`Trying to run sanity checks on service ${argv.serviceName}`)
	vulcan.runSanityChecks(service)
	logger.info(`Sanity checks succeeded for service ${argv.serviceName}`)

	//
	// Step 2 - Get the blue task set
	//
	logger.info(`Trying to find blue task set for service ${argv.serviceName}`)
	let isBlueTaskSetPresent = true
	const blueTaskSet = vulcan.findBlueTaskSet(service.taskSets)

	if (blueTaskSet == null) {
		switch (service.taskSets.length) {
			case 0: {
				logger.info(
					`This is the first deployment for service ${argv.serviceName}`
				)
				isBlueTaskSetPresent = false
				break
			}

			case 1: {
				logger.info(
					`Trying to set task set ${service.taskSets[0].taskSetArn} as blue for service ${argv.serviceName}`
				)
				const updatedServicePrimaryTaskSet =
					await aws.updateServicePrimaryTaskSet(
						argv.serviceName,
						argv.clusterName,
						service.taskSets[0].taskSetArn
					)
				logger.info(
					`Task set ${updatedServicePrimaryTaskSet.taskSet.taskSetArn} has been set as the blue task set`
				)
				break
			}

			default: {
				const errorMessage =
					'Multiple active task sets found but no blue task set found for service, please set one task set to primary'
				logger.error(`${errorMessage}`)
				throw Error(`${errorMessage}`)
			}
		}
	}

	//
	// Step 3 - Assemble the green task definition
	//

	// Get the green task definition, either from input file or from blue task set
	let greenTaskDefinition = null
	if (!obj.isStringNull(argv.greenTaskDefinitionFile)) {
		// Read from file
		logger.info(
			'A task definition file has been provided in the input which will take precedence'
		)
		greenTaskDefinition = file.readJSON(argv.greenTaskDefinitionFile)
	} else {
		logger.info(
			'No task definition file has been provided in the input, fetching the latest task definition'
		)
		// Call AWS to read task definition
		if (isBlueTaskSetPresent) {
			const blueTaskDefinition = await aws.describeTaskDefinition(
				blueTaskSet.taskDefinition
			)
			greenTaskDefinition = blueTaskDefinition.taskDefinition
		}
	}

	if (greenTaskDefinition == null) {
		const errorMessage =
			'Neither a task definition file is present nor a blue task definition exists which implies this is the first deployment, please specify a task definition file'
		logger.error(`${errorMessage}`)
		throw new Error(`${errorMessage}`)
	}

	// Override the green task definition with the override file and put the file into a template
	const taskDefinitionTemplate = Object.create(constants.taskDefinitionTemplate)
	let overrideGreenTaskDefinition = null
	if (!obj.isStringNull(argv.overrideGreenTaskDefinitionFile)) {
		overrideGreenTaskDefinition = file.readJSON(
			argv.overrideGreenTaskDefinitionFile
		)
	}
	const overriddenGreenTaskDefinition = obj.overrideObject(
		taskDefinitionTemplate,
		greenTaskDefinition,
		overrideGreenTaskDefinition
	)

	// Merge with image definitions file
	const greenImageDefinitions = file.readJSON(argv.greenImageDefinitionsFile)
	const finalGreenTaskDefinition = vulcan.assembleTaskDefinition(
		overriddenGreenTaskDefinition,
		greenImageDefinitions
	)
	logger.info(
		`Green Task Definition is ${JSON.stringify(finalGreenTaskDefinition)}`
	)

	//
	// Step 4 - Assemble the green task set (without target group)
	//
	let greenTaskSet = null
	if (!obj.isStringNull(argv.greenTaskSetFile)) {
		// Read from file
		logger.info(
			'A task set file has been provided in the input which will take precedence'
		)
		greenTaskSet = file.readJSON(argv.greenTaskSet)
	} else {
		// Use blue task set
		logger.info(
			'No task set file has been provided in the input, using blue task set'
		)
		greenTaskSet = blueTaskSet
	}
	if (greenTaskSet == null) {
		const errorMessage =
			'Neither a task set file is present nor a blue task set exists which implies this is the first deployment, please specify a task set file'
		logger.error(`${errorMessage}`)
		throw new Error(`${errorMessage}`)
	}

	// Override values in green task set
	const taskSetTemplate = Object.create(constants.taskSetTemplate)
	let overrideGreenTaskSet = null
	if (!obj.isStringNull(argv.overrideGreenTaskSetFile)) {
		overrideGreenTaskSet = file.readJSON(argv.overrideGreenTaskSetFile)
	}
	const overriddenGreenTaskSet = obj.overrideObject(
		taskSetTemplate,
		greenTaskSet,
		overrideGreenTaskSet
	)
	const finalGreenTaskSet = overriddenGreenTaskSet

	//
	// Step 5 - Get the target groups, state, blue deployment template and the final green task set
	//

	// Create state object
	const stateObj = Object.create(constants.stateTemplate)
	stateObj.isFirstDeployment = !isBlueTaskSetPresent
	stateObj.isLoadBalancerPresent = vulcan.isLoadBalancerPresent(greenTaskSet)

	// Create blue task set
	const blueObj = Object.create(constants.deploymentTemplate)
	blueObj.taskSetArn = isBlueTaskSetPresent ? blueTaskSet.taskSetArn : null
	blueObj.taskDefinitionArn = isBlueTaskSetPresent
		? blueTaskSet.taskDefinitionArn
		: null

	switch (stateObj.isLoadBalancerPresent) {
		case false: {
			logger.info(
				'Conditions match for a rolling deployment with no load balancers'
			)

			// Update state
			stateObj.isCanaryEligible = false

			// Update blue task set
			blueObj.targetGroupArn = null
			break
		}
		case true:
			if (argv.isBlueGreen && isBlueTaskSetPresent) {
				// Case for blue green deployment
				logger.info(
					'Conditions match for a blue green deployment with load balancer'
				)

				const targetGroups = vulcan.getTargetGroupsWithBlueGreenEnabled(
					argv.targetGroupNames,
					blueTaskSet
				)

				const greenTargetGroupArn = await vulcan.getTargetGroupArnFromName(
					targetGroups.green
				)
				finalGreenTaskSet.loadBalancers[0].targetGroupArn = greenTargetGroupArn

				const blueTargetGroupArn = await vulcan.getTargetGroupArnFromName(
					targetGroups.blue
				)

				// Update State
				stateObj.isCanaryEligible = true

				// Update blue task set
				blueObj.targetGroupArn = blueTargetGroupArn
			} else {
				logger.info(
					'Conditions match for a rolling deployment with load balancer'
				)

				let greenTargetGroupArn = null
				if (obj.isStringNull(argv.targetGroups)) {
					logger.info(
						'No target group has been specified, using target group of blue task set'
					)
					greenTargetGroupArn = blueTaskSet.loadBalancers[0].targetGroupArn
				} else {
					const targetGroup = vulcan.getTargetGroupWithBlueGreenDisabled(
						argv.targetGroups
					)
					greenTargetGroupArn = await vulcan.getTargetGroupArnFromName(
						targetGroup
					)
				}

				finalGreenTaskSet.loadBalancers[0].targetGroupArn = greenTargetGroupArn
				// Update State
				stateObj.isCanaryEligible = false

				// Update blue task set
				blueObj.targetGroupArn = blueTaskSet.loadBalancers[0].targetGroupArn
			}
	}

	logger.info(`Green Task Set is ${JSON.stringify(finalGreenTaskSet)}`)
	logger.info(`State is ${JSON.stringify(stateObj)}`)
	logger.info(`Blue Task set is ${JSON.stringify(blueObj)}`)
	//
	// Step 6 - Write Files
	//
	file.writeJSON(argv.outputStateFile, stateObj)
	file.writeJSON(argv.outputBlueFile, blueObj)
	file.writeJSON(argv.outputGreenTaskDefinitionFile, finalGreenTaskDefinition)
	file.writeJSON(argv.outputGreenTaskSetFile, finalGreenTaskSet)
}
