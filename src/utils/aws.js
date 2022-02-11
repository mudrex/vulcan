const logger = require('../config/logger')('aws', process.env['LOG_LEVEL'])
const aws = require('aws-sdk')

/**
 * Module containing functions for interacting with AWS.
 * @module aws
 */

/**
 * [AWS] Return JSON object of a AWS service.
 *
 * @param {String} serviceName - The name of the AWS Service
 * @param {String} clusterName - The name of the AWS Cluster which contains #{serviceName}
 * @return {Object} The result of a ECS().describeServices(params) call
 */
const describeService = async (serviceName, clusterName) => {
	logger.debug('Inside describeService')
	const params = {
		services: [serviceName],
		cluster: clusterName,
	}
	logger.debug(`Parameters: -\n ${JSON.stringify(params, null, 2)}`)

	const ecs = new aws.ECS()

	try {
		const data = await ecs.describeServices(params).promise()
		return data
	} catch (error) {
		const errorMessage = `Unable to describe service with error: ${error}`
		logger.error(`${errorMessage}`)
		throw error
	}
}

/**
 * [AWS] Registers a task definition and returns a JSON object of the task definition.
 *
 * @param {Object} taskDefinition - The JSON object of a task definition
 * @return {Object} The result of a ECS().registerTaskDefinition(params) call
 */
const registerTaskDefinition = async (taskDefinition) => {
	logger.debug('Inside registerTaskDefinition')
	const params = taskDefinition
	logger.debug(`Parameters: -\n ${JSON.stringify(params, null, 2)}`)

	const ecs = new aws.ECS()
	try {
		const data = await ecs.registerTaskDefinition(params).promise()
		return data
	} catch (error) {
		const errorMessage = `Unable to register task definition with error: ${error}`
		logger.error(`${errorMessage}`)
		throw error
	}
}

/**
 * [AWS] Creates a task set and returns JSON object of created task set.
 *
 * @param {Object} taskSet - The JSON object of a task set
 * @return {Object} The result of a ECS().createTaskSet(params) call
 */
const createTaskSet = async (taskSet) => {
	logger.debug('Inside createTaskSet')
	const params = taskSet
	logger.debug(`Parameters: -\n ${JSON.stringify(params, null, 2)}`)

	const ecs = new aws.ECS()
	try {
		const data = await ecs.createTaskSet(params).promise()
		return data
	} catch (error) {
		const errorMessage = `Unable to create task set with error: ${error}`
		logger.error(`${errorMessage}`)
		throw error
	}
}

/**
 * [AWS] Returns details of a task set.
 *
 * @param {String} serviceName - The name of the AWS Service
 * @param {String} clusterName - The name of the AWS Cluster which contains #{serviceName}
 * @param {Object} taskSet - The JSON object of a task set
 * @return {Object} The result of a ECS().describeTaskSets(params) call
 */
const describeTaskSet = async (serviceName, clusterName, taskSet) => {
	logger.debug('Inside describeTaskSet')
	const params = {
		cluster: clusterName,
		service: serviceName,
		taskSets: [taskSet],
	}
	logger.debug(`Parameters: -\n ${JSON.stringify(params, null, 2)}`)

	const ecs = new aws.ECS()
	try {
		const data = await ecs.describeTaskSets(params).promise()
		return data
	} catch (error) {
		const errorMessage = `Unable to describe task set with error: ${error}`
		logger.error(`${errorMessage}`)
		throw error
	}
}

/**
 * [AWS] Updates a service and sets the specified task set as PRIMARY.
 *
 * @param {String} serviceName - The name of the AWS Service
 * @param {String} clusterName - The name of the AWS Cluster which contains #{serviceName}
 * @param {String} taskSetArn - The ARN of the task set
 * @return {Object} The result of a ECS().updateServicePrimaryTaskSet(params) call
 */
const updateServicePrimaryTaskSet = async (
	serviceName,
	clusterName,
	taskSetArn
) => {
	logger.debug('Inside updateServicePrimaryTaskSet')
	const params = {
		cluster: clusterName,
		service: serviceName,
		primaryTaskSet: taskSetArn,
	}
	logger.debug(`Parameters: -\n ${JSON.stringify(params, null, 2)}`)

	const ecs = new aws.ECS()
	try {
		const data = await ecs.updateServicePrimaryTaskSet(params).promise()
		return data
	} catch (error) {
		const errorMessage = `Unable to update primary task set: ${error}`
		logger.error(`${errorMessage}`)
		throw error
	}
}

/**
 * [AWS] Deletes a task set as per specified taskSetArn.
 *
 * @param {String} serviceName - The name of the AWS Service
 * @param {String} clusterName - The name of the AWS Cluster which contains #{serviceName}
 * @param {String} taskSetArn - The ARN of the task set
 * @return {Object} The result of a ECS().deleteTaskSet(params) call
 */
const deleteTaskSet = async (serviceName, clusterName, taskSetArn) => {
	logger.debug('Inside deleteTaskSet')
	const params = {
		cluster: clusterName,
		service: serviceName,
		taskSet: taskSetArn,
	}
	logger.debug(`Parameters: -\n ${JSON.stringify(params, null, 2)}`)

	const ecs = new aws.ECS()
	try {
		const data = await ecs.deleteTaskSet(params).promise()
		return data
	} catch (error) {
		const errorMessage = `Unable to delete task set: ${error}`
		logger.error(`${errorMessage}`)
		throw error
	}
}

/**
 * [AWS] Describes a task definition as per specified taskDefinitionArn.
 *
 * @param {String} taskDefinitionArn - The ARN of the task definition.
 * @return {Object} The result of a ECS().describeTaskDefinition(params) call
 */
const describeTaskDefinition = async (taskDefinitionArn) => {
	logger.debug('Inside describeTaskDefinition')
	const params = {
		taskDefinition: taskDefinitionArn,
	}
	logger.debug(`Parameters: -\n ${JSON.stringify(params, null, 2)}`)

	const ecs = new aws.ECS()
	try {
		const data = await ecs.describeTaskDefinition(params).promise()
		return data
	} catch (error) {
		const errorMessage = `Unable to describe task definition: ${error}`
		logger.error(`${errorMessage}`)
		throw error
	}
}

/**
 * [AWS] Describes a target group as per specified targetGroupName.
 *
 * @param {String} targetGroupName - The name of the target group
 * @return {Object} The result of a ELBv2().describeTargetGroups(params) call
 */
const describeTargetGroup = async (targetGroupName) => {
	logger.debug('Inside describeTargetGroup')
	const params = {
		Names: [targetGroupName],
	}
	logger.debug(`Parameters: -\n ${JSON.stringify(params, null, 2)}`)

	const elbv2 = new aws.ELBv2()
	try {
		const data = await elbv2.describeTargetGroups(params).promise()
		return data
	} catch (error) {
		const errorMessage = `Unable to describe target group: ${error}`
		logger.error(`${errorMessage}`)
		throw error
	}
}

/**
 * [AWS] Completely modify a listener rule with a new targetGroup.
 *
 * @param {String} listenerRuleArn - The ARN of the listener rule.
 * @param {string} targetGroupArn - The ARN of a target group.
 * @return {Object} The result of a ELBv2().modifyRule(params) call
 */
const modifyListenerRule = async (listenerRuleArn, targetGroupArn) => {
	logger.debug('Inside modifyListenerRule')
	const params = {
		Actions: [
			{
				TargetGroupArn: targetGroupArn,
				Type: 'forward',
			},
		],
		RuleArn: listenerRuleArn,
	}
	logger.debug(`Parameters: -\n ${JSON.stringify(params, null, 2)}`)

	const elbv2 = new aws.ELBv2()
	try {
		const data = await elbv2.modifyRule(params).promise()
		return data
	} catch (error) {
		const errorMessage = `Unable to modify listener rule: ${error}`
		logger.error(`${errorMessage}`)
		throw error
	}
}

/**
 * [AWS] Shift traffic based on target groups.
 *
 * @param {String} listenerRuleARN - The ARN of the listener rule.
 * @param {String} blueTargetGroupARN - The ARN of the blue target group.
 * @param {String} greenTargetGroupARN - The ARN of the green target group.
 * @param {Number} percent - The percentage of traffic to shift to the #{greenTargetGroupARN}
 * @return {Object} The result of a ELBv2().modifyRule(params) call
 */
const divideListenerRule = async (
	listenerRuleARN,
	blueTargetGroupARN,
	greenTargetGroupARN,
	percent
) => {
	logger.debug('Inside divideListenerRule')
	const params = {
		Actions: [
			{
				Type: 'forward',
				ForwardConfig: {
					TargetGroups: [
						{
							TargetGroupArn: greenTargetGroupARN,
							Weight: percent,
						},
						{
							TargetGroupArn: blueTargetGroupARN,
							Weight: 100 - percent,
						},
					],
				},
			},
		],
		RuleArn: listenerRuleARN,
	}
	logger.debug(`Parameters: -\n ${JSON.stringify(params, null, 2)}`)

	const elbv2 = new aws.ELBv2()
	try {
		const data = await elbv2.modifyRule(params).promise()
		return data
	} catch (error) {
		const errorMessage = `Unable to divide listener rule: ${error}`
		logger.error(`${errorMessage}`)
		throw error
	}
}

const deregisterTaskDefinition = async (taskDefinitionArn) => {
	logger.debug('Inside deregisterTaskDefinition')
	const params = {
		taskDefinition: taskDefinitionArn,
	}
	logger.debug(`Parameters: -\n ${JSON.stringify(params, null, 2)}`)

	const ecs = new aws.ECS()
	try {
		const data = await ecs.deregisterTaskDefinition(params).promise()
		return data
	} catch (error) {
		const errorMessage = `Unable to de register task definition: ${error}`
		logger.error(`${errorMessage}`)
		throw error
	}
}

module.exports = {
	describeService: describeService,
	registerTaskDefinition: registerTaskDefinition,
	createTaskSet: createTaskSet,
	describeTaskSet: describeTaskSet,
	updateServicePrimaryTaskSet: updateServicePrimaryTaskSet,
	deleteTaskSet: deleteTaskSet,
	describeTaskDefinition: describeTaskDefinition,
	describeTargetGroup: describeTargetGroup,
	modifyListenerRule: modifyListenerRule,
	divideListenerRule: divideListenerRule,
	deregisterTaskDefinition: deregisterTaskDefinition,
}
