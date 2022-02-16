/**
 * Module containing templates.
 * @module constants
 */

/**
 * The Task Definition template
 */
const taskDefinitionTemplate = {
	family: null,
	taskRoleArn: null,
	executionRoleArn: null,
	networkMode: null,
	containerDefinitions: null,
	volumes: null,
	placementConstraints: null,
	requiresCompatibilities: null,
	cpu: null,
	memory: null,
	tags: null,
	pidMode: null,
	ipcMode: null,
	proxyConfiguration: null,
	inferenceAccelerators: null,
	ephemeralStorage: null,
	runtimePlatform: null,
}

/**
 * The Task Set template
 */
const taskSetTemplate = {
	service: null,
	cluster: null,
	taskDefinition: null,
	networkConfiguration: null,
	loadBalancers: null,
	serviceRegistries: null,
	launchType: null,
	scale: null,
	capacityProviderStrategy: null,
	tags: null,
}

/**
 * The State template
 */
const stateTemplate = {
	isFirstDeployment: null,
	isCanaryEligible: null,
	isLoadBalancerPresent: null,
}

/**
 * The Deployment template
 */
const deploymentTemplate = {
	taskSetArn: null,
	targetGroupArn: null,
	taskDefinitionArn: null,
}

module.exports = {
	taskDefinitionTemplate: taskDefinitionTemplate,
	taskSetTemplate: taskSetTemplate,
	stateTemplate: stateTemplate,
	deploymentTemplate: deploymentTemplate,
}
