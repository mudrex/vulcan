const logger = require('../config/logger')('vulcan')
const aws = require('../utils/aws')
const obj = require('../utils/obj')

/**
 * Module containing the core functions of vulcan.
 * @module vulcan
 */

/**
 * Gets a service from the the output of aws ecs describe-service command.
 *
 * @param {Object} awsDescribeServiceOutput - Details of the service obtained from the ecs describe-service command
 * @return {Object} Service
 */
const getService = (awsDescribeServiceOutput) => {
	logger.debug('Starting execution of getService()')
	// Check if service exists or not
	if (awsDescribeServiceOutput.services.length == 0) {
		const errorMessage = `Error occurred while describing service with arn ${awsDescribeServiceOutput.failures[0].arn}, reason is ${awsDescribeServiceOutput.failures[0].reason}`
		logger.error(`${errorMessage}`)
		throw Error(`${errorMessage}`)
	}
	const serviceDetails = awsDescribeServiceOutput.services[0]
	logger.info(
		`Found service with name ${serviceDetails.serviceName} and arn ${serviceDetails.serviceArn} in cluster ${serviceDetails.clusterArn}`
	)
	return serviceDetails
}

/**
 * Runs basic sanity checks on a service.
 *
 * @param {Object} service - Details of the service
 */
const runSanityChecks = (service) => {
	// Check if deploymentController is EXTERNAL
	if (
		service.deploymentController &&
		service.deploymentController.type == 'EXTERNAL'
	) {
		logger.info('Deployment Controller is EXTERNAL')
	} else {
		const errorMessage = `Deployment Controller is not EXTERNAL for service ${service.serviceName}`
		logger.error(`${errorMessage}`)
		throw Error(`${errorMessage}`)
	}
}

/**
 * Find and returns blue task set.
 *
 * @param {Object} taskSets - List of tasksets of a service
 * @return {Object} Blue task set
 */
const findBlueTaskSet = (taskSets) => {
	if (taskSets.length == 0) {
		logger.info('No task sets found for service')
		return null
	}

	let blueTaskSet = null
	// Find Primary TaskSet
	logger.debug(`Task sets : ${JSON.stringify(taskSets, null, 2)}`)
	for (const taskSet of taskSets) {
		logger.debug(`Checking taskSet: - \n ${JSON.stringify(taskSet, null, 2)}`)
		if (taskSet.status == 'PRIMARY') {
			logger.info(`Found blue task set ${taskSet.taskSetArn}`)
			blueTaskSet = taskSet
			break
		}
	}

	return blueTaskSet
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
			'Task set has loadBalancers key present, checking for number of loadbalancers'
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
				'More than 1 load balancers detected, there is no support for more than 1 load balancers in vulcan'
			logger.error(`${errorMessage}`)
			throw new Error(`${errorMessage}`)
		}
	}
	return false
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
			'At least two target group are needed for this deployment'
		logger.error(`${errorMessage}`)
		throw new Error(`${errorMessage}`)
	}

	const targetGroups = targetGroupsString.split(',')
	let blueTargetGroup = null
	let greenTargetGroup = null
	logger.debug(`Target Groups after split: ${targetGroups}`)
	if (targetGroups.length <= 1) {
		const errorMessage =
			'At least two target groups are needed for this deployment'
		logger.error(`${errorMessage}`)
		throw new Error(`${errorMessage}`)
	} else {
		logger.info(
			`Picking the first 2 target groups ${targetGroups[0]} and ${targetGroups[1]}`
		)
		blueTargetGroup = oldTaskSet.loadBalancers[0].targetGroupArn.split('/')[1]
		logger.debug(
			`Blue task set has target group: ${blueTargetGroup} attached to it`
		)
		greenTargetGroup = targetGroups[1]
		if (blueTargetGroup == targetGroups[1]) {
			greenTargetGroup = targetGroups[0]
		} else if (blueTargetGroup == targetGroups[0]) {
			greenTargetGroup = targetGroups[1]
		} else {
			const errorMessage = `None of the input target groups out of ${
				(targetGroups[0], targetGroups[1])
			} match the target group of the blue task set`
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
 * Returns green target group name.
 *
 * @param {String} targetGroupsString - The string of target groups separated by comma
 * @return {String} GreenTargetGroup
 */
const getTargetGroupWithBlueGreenDisabled = (targetGroupsString) => {
	logger.debug('Starting execution of getTargetGroupWithBlueGreenDisabled()')
	if (obj.isStringNull(targetGroupsString)) {
		const errorMessage =
			'At least one target group is needed for this deployment'
		logger.error(`${errorMessage}`)
		throw new Error(`${errorMessage}`)
	}

	const targetGroups = targetGroupsString.split(',')
	if (targetGroups.length == 0) {
		const errorMessage =
			'At least one target group is needed for this deployment'
		logger.error(`${errorMessage}`)
		throw new Error(`${errorMessage}`)
	} else {
		logger.info(`Picking the first target group ${targetGroups[0]}`)

		return targetGroups[0]
	}
}

/**
 * Returns an input task definition with new image definitions.
 *
 * @param {Object} taskDefinition - The task defintion
 * @param {Object} imageDefinitions - The image definitions to be deployed
 * @return {Object} TaskDefinition
 */
const assembleTaskDefinition = (taskDefinition, imageDefinitions) => {
	logger.debug('Starting execution of assembleTaskDefinition()')
	const containerDefinitions = taskDefinition.containerDefinitions

	const finalContainerDefinitions = containerDefinitions.map((element) => {
		logger.debug(`${element}`)
		const index = imageDefinitions.findIndex(
			(imageDefinition) => imageDefinition.name === element.name
		)
		if (index === -1) {
			const errorMessage = `Container name ${element.name} in task definition not found in image definitions.`
			logger.error(`${errorMessage}`)
			throw new Error(`${errorMessage}`)
		}

		const newImage = imageDefinitions[index].image
		if (obj.isStringNull(newImage)) {
			const errorMessage = `Image is undefined for container name ${element.name} in image definitions.`
			logger.error(`${errorMessage}`)
			throw new Error(`${errorMessage}`)
		}

		logger.info(
			`Found container ${element.name}, replacing image with ${newImage}`
		)
		element.image = newImage
		return element
	})

	taskDefinition.containerDefinitions = finalContainerDefinitions
	return taskDefinition
}

/**
 * Returns Arn of a target group from name of the target group.
 *
 * @param {String} targetGroupName - Details of the target group
 * @return {String} TargetGroupArn
 */
const getTargetGroupArnFromName = async (targetGroupName) => {
	logger.debug('Starting execution of getTargetGroupArnFromName()')

	const targetGroup = await aws.describeTargetGroup(targetGroupName)
	if (targetGroup.TargetGroups.length != 1) {
		const errorMessage = `Unable to find ARN for target group ${targetGroupName}, check if the target group exists and the name is correct`
		logger.error(`${errorMessage}`)
		throw new Error(`${errorMessage}`)
	}

	return targetGroup.TargetGroups[0].TargetGroupArn
}

/**
 * Takes an input task set and replaces certain information.
 *
 * @param {String} serviceName - Name of service
 * @param {String} clusterName - Name of cluster
 * @param {Object} registeredTaskDefinitionArn - Arn of the Task Definition
 * @param {Object} taskSet - Input task set
 * @return {Object} TaskSet
 */
const assembleTaskSet = (
	serviceName,
	clusterName,
	registeredTaskDefinitionArn,
	taskSet
) => {
	logger.debug('Starting execution of assembleTaskSet()')
	taskSet.taskDefinition = registeredTaskDefinitionArn
	taskSet.service = serviceName
	taskSet.cluster = clusterName
	return taskSet
}

/**
 * Returns a list of active task set Arns.
 *
 * @param {Object} serviceDescription - Details of the service obtained from the ecs describe-service command
 * @return {Object} List of active task set Arns
 */
const getActiveTaskSetArns = (serviceDescription) => {
	logger.debug('Starting execution of getActiveTaskSetArns()')
	// Check if service exists or not
	if (serviceDescription.services.length == 0) {
		const errorMessage = `Error occurred while describing service with Arn ${serviceDescription.failures[0].arn}, reason is ${serviceDescription.failures[0].reason}`
		logger.error(`${errorMessage}`)
		throw Error(`${errorMessage}`)
	}

	const serviceDetails = serviceDescription.services[0]
	if (serviceDetails.taskSets.length == 0) {
		logger.info('No Task Sets found for service. There is nothing to clean.')
		return null
	}

	const activeTaskSetArns = []
	for (const taskSet of serviceDetails.taskSets) {
		logger.debug(`Checking taskSet: - \n ${JSON.stringify(taskSet, null, 2)}`)
		if (taskSet.status == 'ACTIVE') {
			logger.info(`Found Active Task Set ${taskSet.taskSetArn}`)
			activeTaskSetArns.push(taskSet.taskSetArn)
		}
	}

	return activeTaskSetArns
}

module.exports = {
	getService: getService,
	runSanityChecks: runSanityChecks,
	findBlueTaskSet: findBlueTaskSet,
	isLoadBalancerPresent: isLoadBalancerPresent,
	getTargetGroupsWithBlueGreenEnabled: getTargetGroupsWithBlueGreenEnabled,
	getTargetGroupWithBlueGreenDisabled: getTargetGroupWithBlueGreenDisabled,
	assembleTaskDefinition: assembleTaskDefinition,
	getTargetGroupArnFromName: getTargetGroupArnFromName,
	assembleTaskSet: assembleTaskSet,
	getActiveTaskSetArns: getActiveTaskSetArns,
}
