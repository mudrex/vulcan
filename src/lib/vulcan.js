const logger = require('../config/logger')('vulcan', process.env['LOG_LEVEL'])
const aws = require('../utils/aws')
const file = require('../utils/file')

/**
 * Module containing the core functions of vulcan.
 * @module vulcan
 */

/**
 * Returns the ARN of the blue task set.
 *
 * Before returning the blue task set Arn, it runs a series of basic sanity checks on the output of ecs describe-service command.
 *
 * @param {Object} serviceDescription - Details of the service obtained from the ecs describe-service command
 * @return {Object} ARN of the blue task set
 */
const getBlueTaskSetArn = async (serviceDescription) => {
	logger.debug('Starting execution of getBlueTaskSetArn()')
	// Check if service exists or not
	if (serviceDescription.services.length == 0) {
		const errorMessage = `Error occurred while describing service with Arn ${serviceDescription.failures[0].arn}, reason is ${serviceDescription.failures[0].reason}`
		logger.error(`${errorMessage}`)
		throw Error(`${errorMessage}`)
	}

	const serviceDetails = serviceDescription.services[0]
	logger.info(
		`Found service with name ${serviceDetails.serviceName} and Arn ${serviceDetails.serviceArn} in Cluster ${serviceDetails.clusterArn}`
	)
	logger.debug(`serviceDetails: ${JSON.stringify(serviceDetails, null, 2)}`)
	// Check if deploymentController is EXTERNAL
	if (
		serviceDetails.deploymentController &&
		serviceDetails.deploymentController.type == 'EXTERNAL'
	) {
		logger.info('Deployment Controller is EXTERNAL')
	} else {
		const errorMessage = `Deployment Controller is not EXTERNAL for input service with details: ${serviceDetails}`
		logger.error(`${errorMessage}`)
		throw Error(`${errorMessage}`)
	}

	let primaryTaskSet = null
	// Check if taskSets is empty
	if (serviceDetails.taskSets.length == 0) {
		logger.info(
			'No taskSets found for service. First deployment will be initiated.'
		)
		return null
	} else {
		// Find Primary TaskSet
		logger.debug(
			`taskSets: ${JSON.stringify(serviceDetails.taskSets, null, 2)}`
		)
		for (const taskSet of serviceDetails.taskSets) {
			logger.debug(`Checking taskSet: - \n ${JSON.stringify(taskSet, null, 2)}`)
			if (taskSet.status == 'PRIMARY') {
				logger.info(`Found Blue TaskSet: ${taskSet.taskSetArn}`)
				primaryTaskSet = taskSet
				break
			}
		}

		// No primary task set found. Check if any task set can be made primary
		if (primaryTaskSet == null && serviceDetails.taskSets.length == 1) {
			logger.info('Trying to set a blue task set')
			const updateServicePrimaryTaskSet = await aws.updateServicePrimaryTaskSet(
				serviceDetails.serviceName,
				serviceDetails.clusterArn,
				serviceDetails.taskSets[0].taskSetArn
			)
			logger.info(
				`TaskSet ${updateServicePrimaryTaskSet.taskSet.taskSetArn} has been set as blue.`
			)
			primaryTaskSet = serviceDetails.taskSets[0]
		}

		// If primary task set not found
		if (primaryTaskSet == null) {
			const errorMessage =
				'No primary task set found for service. Set one taskset to PRIMARY by running aws ecs update-primary-task-set.'
			logger.error(`${errorMessage}`)
			throw Error(`${errorMessage}`)
		}
	}

	return primaryTaskSet.taskSetArn
}

/**
 * Determines whether there is an input task defintion. If there is no input task defintion,
 * gets the old task definition.
 *
 * @param {Boolean} isBluePresent - Whether a blue environment exists or not
 * @param {Object} blueTaskSet - Details of the primary task set
 * @param {String} taskDefinitionFile - Path to the task definition file
 * @return {Object} TaskDefinition
 */
const getTaskDefinition = async (
	isBluePresent,
	blueTaskSet,
	taskDefinitionFile
) => {
	logger.debug('Starting execution of getTaskDefinition')
	// Check if this is a first time deployment
	if (isBluePresent == false) {
		if (!taskDefinitionFile || taskDefinitionFile == 'null') {
			const errorMessage =
				'This is a first time deployment. You have to specify task-definition-file.'
			logger.error(`${errorMessage}`)
			throw new Error(`${errorMessage}`)
		} else {
			logger.info(
				'This is a first time deployment. Reading from input task-definition-file.'
			)
			return file.readJSON(taskDefinitionFile)
		}
	}

	// This is not a first time deployment
	// Still check if taskDefinitionFile is given. Use cases can be when environment variables/ports have to change.
	if (taskDefinitionFile) {
		logger.info('A task-definition-file is present which will take precedence.')
		return file.readJSON(taskDefinitionFile)
	}

	// If a taskDefinitionFile is not given, finally read from oldTaskDefinition
	const oldTaskDefinitionARN = blueTaskSet.taskDefinition
	if (oldTaskDefinitionARN == null) {
		const errorMessage =
			'Can\'t find taskDefinition in blueTaskSet. Is the primary-task-set-file correct?'
		logger.error(`${errorMessage}`)
		throw new Error(`${errorMessage}`)
	}

	// Call AWS for the oldTaskDefinition
	logger.info(
		'No task-definition-file has been provided in the input. Calling AWS to read last task-definition.'
	)
	const oldTaskDefinition = await aws.describeTaskDefinition(
		oldTaskDefinitionARN
	)
	const removeKeys = [
		'taskDefinitionArn',
		'revision',
		'status',
		'compatibilities',
		'registeredAt',
		'registeredBy',
	]
	removeKeys.forEach((item) => {
		delete oldTaskDefinition.taskDefinition[`${item}`]
	})
	return oldTaskDefinition.taskDefinition
}

/**
 * Takes an input task definition and replaces the image key.
 *
 * @param {Object} taskDefinition - Contains the task defintion
 * @param {String} image - The new image to deploy
 * @param {String} taskDefinitionFamily - The task definition family
 * @param {String} taskExecutionRoleArn - The task definition role Arn
 * @param {String} taskRoleArn - The task role Arn
 * @return {Object} Updated TaskDefinition
 */
const createTaskDefinition = (
	taskDefinition,
	image,
	taskDefinitionFamily,
	taskExecutionRoleArn,
	taskRoleArn
) => {
	logger.debug('Starting execution of createTaskDefinition')
	if (taskDefinition.containerDefinitions.length > 1) {
		const errorMessage =
			'More than 1 container definitions. No support for more than 1 container definitions in vulcan.'
		logger.error(`${errorMessage}`)
		throw new Error(`${errorMessage}`)
	}
	taskDefinition.family = taskDefinitionFamily
	taskDefinition.executionRoleArn =
		taskExecutionRoleArn == 'null' || !taskExecutionRoleArn
			? null
			: taskExecutionRoleArn
	taskDefinition.taskRoleArn =
		taskRoleArn == 'null' || !taskRoleArn ? null : taskRoleArn
	taskDefinition.containerDefinitions[0].image = image
	return taskDefinition
}

/**
 * Determines whether there is an input task set. If there is no input task set,
 * gets the blue task set.
 *
 * @param {Boolean} isBluePresent - Whether a blue environment exists or not
 * @param {Object} blueTaskSet - Details of the blue task set
 * @param {String} taskSetFile - Path to the task set file
 * @return {Object} TaskSet
 */
const getTaskSet = (isBluePresent, blueTaskSet, taskSetFile) => {
	logger.debug('Starting execution of getTaskSet')
	// Check if this is a first time deployment
	if (isBluePresent == false) {
		if (!taskSetFile) {
			const errorMessage =
				'This is a first time deployment. You have to specify task-set-file.'
			logger.error(`${errorMessage}`)
			throw new Error(`${errorMessage}`)
		} else {
			logger.info(
				'This is a first time deployment. Reading from input task-set-file.'
			)
			return file.readJSON(taskSetFile)
		}
	}

	// This is not a first time deployment
	// Still check if taskSetFile is given. Use cases can be when we want to change network configuration.
	if (taskSetFile) {
		logger.info('A task-set-file is present which will take precedence.')
		return file.readJSON(taskSetFile)
	}

	// We want to keep the same task set
	return transformToTaskSet(blueTaskSet)
}

/**
 * Sanitizes an input task set.
 *
 * @param {Object} awsTaskSet - Input Task Set
 * @return {Object} TaskSet
 */
const transformToTaskSet = (awsTaskSet) => {
	const taskSet = {}
	taskSet.service = awsTaskSet.serviceArn
	taskSet.cluster = awsTaskSet.clusterArn
	taskSet.taskDefinition = awsTaskSet.taskDefinition.taskDefinitionArn
	taskSet.networkConfiguration = awsTaskSet.networkConfiguration
	taskSet.loadBalancers = awsTaskSet.loadBalancers
	taskSet.serviceRegistries = awsTaskSet.serviceRegistries
	taskSet.launchType = awsTaskSet.launchType
	taskSet.scale = awsTaskSet.scale
	taskSet.capacityProviderStrategy = awsTaskSet.capacityProviderStrategy
	taskSet.tags = awsTaskSet.tags
	return taskSet
}

/**
 * Takes an input task set and replaces certain information.
 *
 * @param {Object} taskSet - Input task set
 * @param {Object} registeredTaskDefinition - Registered Task Definition
 * @param {String} targetGroup - Arn of target group
 * @param {String} serviceName - Name of service
 * @param {String} clusterName - Name of cluster
 * @return {Object} TaskSet
 */
const createTaskSet = async (
	taskSet,
	registeredTaskDefinition,
	targetGroup,
	serviceName,
	clusterName
) => {
	logger.debug('Starting execution of createTaskSet')
	taskSet.taskDefinition =
		registeredTaskDefinition.taskDefinition.taskDefinitionArn
	taskSet.service = serviceName
	taskSet.cluster = clusterName
	if (targetGroup == null) {
		// do nothing
	} else {
		if (taskSet.loadBalancers == null) {
			const errorMessage =
				'No load balancer detected in new task set. Please add load balancer to task set.'
			logger.error(`${errorMessage}`)
			throw new Error(`${errorMessage}`)
		} else {
			taskSet.loadBalancers[0].targetGroupArn = targetGroup
		}
	}

	logger.debug(
		`New Task Set to Create: - \n ${JSON.stringify(taskSet, null, 2)}`
	)

	const createdTaskSet = await aws.createTaskSet(taskSet)
	logger.info(
		`Created Task Set: - \n ${JSON.stringify(createdTaskSet, null, 2)}`
	)
	return createdTaskSet
}

/**
 * Returns green target group name.
 *
 * @param {String} targetGroupsString - The string of target groups separated by comma
 * @return {String} GreenTargetGroup
 */
const getTargetGroupWithBlueGreenDisabled = (targetGroupsString) => {
	logger.debug('Starting execution of getTargetGroupWithBlueGreenDisabled')
	if (targetGroupsString == null) {
		const errorMessage =
			'At least one target group is needed for this deployment.'
		logger.error(`${errorMessage}`)
		throw new Error(`${errorMessage}`)
	}

	const targetGroups = targetGroupsString.split(',')
	if (targetGroups.length == 0) {
		const errorMessage =
			'At least one target group is needed for this deployment.'
		logger.error(`${errorMessage}`)
		throw new Error(`${errorMessage}`)
	} else {
		logger.info(`Picking the first target group : ${targetGroups[0]}`)

		return targetGroups[0]
	}
}

/**
 * Returns an object containing green and blue target groups.
 *
 * @param {String} targetGroupsString - The string of target groups separated by comma
 * @param {Object} oldTaskSet - Blue task set details
 * @return {Object} Object containing green and blue target group
 */
const getTargetGroupsWithBlueGreenEnabled = (
	targetGroupsString,
	oldTaskSet
) => {
	logger.debug('Starting execution of getTargetGroupsWithBlueGreenEnabled')
	if (targetGroupsString == null) {
		const errorMessage =
			'At least two target group are needed for this deployment.'
		logger.error(`${errorMessage}`)
		throw new Error(`${errorMessage}`)
	}

	const targetGroups = targetGroupsString.split(',')
	let blueTargetGroup = null
	let greenTargetGroup = null
	logger.debug(`Target Groups after split: ${targetGroups}`)
	if (targetGroups.length <= 1) {
		const errorMessage =
			'At least two target groups are needed for this deployment.'
		logger.error(`${errorMessage}`)
		throw new Error(`${errorMessage}`)
	} else {
		logger.info(
			`Picking the first 2 target groups : ${targetGroups[0]} and ${targetGroups[1]}`
		)
		blueTargetGroup = oldTaskSet.loadBalancers[0].targetGroupArn.split('/')[1]
		logger.debug(
			`PRIMARY task set has target group: ${blueTargetGroup} attached to it`
		)
		greenTargetGroup = targetGroups[1]
		if (blueTargetGroup == targetGroups[1]) {
			greenTargetGroup = targetGroups[0]
		} else if (blueTargetGroup == targetGroups[0]) {
			greenTargetGroup = targetGroups[1]
		} else {
			const errorMessage = `None of the input target groups match the target group which is live. Input Target Groups: ${
				(targetGroups[0], targetGroups[1])
			}`
			logger.error(`${errorMessage}`)
			throw new Error(`${errorMessage}`)
		}
	}

	return {
		green: greenTargetGroup,
		blue: blueTargetGroup,
	}
}

/**
 * Checks whether an input task set contains a load balancer or not.
 *
 * @param {Object} taskSet - Input taskSet
 * @return {Boolean}
 */
const isLoadBalancerPresent = (taskSet) => {
	logger.debug('Starting execution of checkLoadBalancer')
	if (taskSet.loadBalancers) {
		logger.info(
			'Task set has loadBalancers key present. Does it have loadBalancers?'
		)
		// Check number of load balancers
		if (taskSet.loadBalancers.length == 0) {
			logger.info('No load balancer configuration is present')
			return false
		}
		if (taskSet.loadBalancers.length == 1) {
			logger.info('Only 1 load balancer configuration is present')
			return true
		}
		if (taskSet.loadBalancers.length > 1) {
			const errorMessage =
				'More than 1 load balancers detected. No support for more than 1 load balancers in vulcan.'
			logger.error(`${errorMessage}`)
			throw new Error(`${errorMessage}`)
		}
	}
	return false
}

/**
 * Returns Arn of a target group from name.
 *
 * @param {String} targetGroupName - Name of the target group
 * @return {String} TargetGroupArn
 */
const getTargetGroupARN = async (targetGroupName) => {
	logger.debug('Starting execution of getTargetGroupARN')
	const targetGroup = await aws.describeTargetGroup(targetGroupName)
	if (targetGroup.TargetGroups.length != 1) {
		const errorMessage = `Unable to find ARN for target group ${targetGroupName}. Does the target group exist?`
		logger.error(`${errorMessage}`)
		throw new Error(`${errorMessage}`)
	}

	return targetGroup.TargetGroups[0].TargetGroupArn
}

/**
 * Returns whether a string is null or not.
 *
 * @param {String} str - String to perform null check on
 * @returns {Boolean}
 */
const isStringNull = (str) => {
	if(str && str != 'null'){
		return false
	}

	return true
}

module.exports = {
	getBlueTaskSetArn: getBlueTaskSetArn,
	createTaskDefinition: createTaskDefinition,
	createTaskSet: createTaskSet,
	getTaskDefinition: getTaskDefinition,
	getTaskSet: getTaskSet,
	getTargetGroupARN: getTargetGroupARN,
	isLoadBalancerPresent: isLoadBalancerPresent,
	getTargetGroupsWithBlueGreenEnabled: getTargetGroupsWithBlueGreenEnabled,
	getTargetGroupWithBlueGreenDisabled: getTargetGroupWithBlueGreenDisabled,
	isStringNull: isStringNull
}
