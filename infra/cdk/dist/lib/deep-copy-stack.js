"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepCopyStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_ecr_assets_1 = require("aws-cdk-lib/aws-ecr-assets");
const path = __importStar(require("path"));
class DeepCopyStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // S3 bucket for results
        const resultsBucket = new aws_cdk_lib_1.aws_s3.Bucket(this, 'ResultsBucket', {
            blockPublicAccess: aws_cdk_lib_1.aws_s3.BlockPublicAccess.BLOCK_ALL,
            encryption: aws_cdk_lib_1.aws_s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.RETAIN,
            versioned: false,
        });
        // DynamoDB Jobs table
        const jobsTable = new aws_cdk_lib_1.aws_dynamodb.Table(this, 'JobsTable', {
            partitionKey: { name: 'jobId', type: aws_cdk_lib_1.aws_dynamodb.AttributeType.STRING },
            billingMode: aws_cdk_lib_1.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.RETAIN,
            tableClass: aws_cdk_lib_1.aws_dynamodb.TableClass.STANDARD,
        });
        // VPC for ECS Fargate
        // Keep NAT Gateway provisioned but use public subnets to avoid NAT charges
        const vpc = new aws_cdk_lib_1.aws_ec2.Vpc(this, 'Vpc', {
            maxAzs: 2,
            natGateways: 1, // Keep existing NAT Gateway to avoid VPC recreation
        });
        // Add FREE VPC Gateway Endpoints (no cost, reduce data transfer)
        // These keep S3 and DynamoDB traffic within AWS network at zero cost
        vpc.addGatewayEndpoint('S3Endpoint', {
            service: aws_cdk_lib_1.aws_ec2.GatewayVpcEndpointAwsService.S3,
        });
        vpc.addGatewayEndpoint('DynamoDBEndpoint', {
            service: aws_cdk_lib_1.aws_ec2.GatewayVpcEndpointAwsService.DYNAMODB,
        });
        // ECS Cluster
        const cluster = new aws_cdk_lib_1.aws_ecs.Cluster(this, 'Cluster', { vpc });
        // Build Docker image from ai_pipeline
        const dockerImage = aws_cdk_lib_1.aws_ecs.ContainerImage.fromAsset(path.join(__dirname, '../../ai_pipeline'), {
            platform: aws_cdk_lib_1.aws_ecr_assets.Platform.LINUX_ARM64,
        });
        // Task Role: permissions for the python container
        const taskRole = new aws_cdk_lib_1.aws_iam.Role(this, 'TaskRole', {
            assumedBy: new aws_cdk_lib_1.aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        });
        resultsBucket.grantPut(taskRole);
        resultsBucket.grantPutAcl(taskRole);
        // Allow task to read swipe files stored under content_library/
        resultsBucket.grantRead(taskRole, 'content_library/*');
        jobsTable.grantReadWriteData(taskRole);
        // Also allow SecretsManager read if your code pulls secrets
        taskRole.addToPolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            actions: ['secretsmanager:GetSecretValue'],
            resources: ['*'],
        }));
        // Task Definition
        const taskDef = new aws_cdk_lib_1.aws_ecs.FargateTaskDefinition(this, 'TaskDef', {
            cpu: 1024, // 1 vCPU
            memoryLimitMiB: 3072, // 3GB for 20-min workload
            runtimePlatform: {
                cpuArchitecture: aws_cdk_lib_1.aws_ecs.CpuArchitecture.ARM64,
                operatingSystemFamily: aws_cdk_lib_1.aws_ecs.OperatingSystemFamily.LINUX,
            },
            taskRole,
        });
        const logGroup = new aws_cdk_lib_1.aws_logs.LogGroup(this, 'TaskLogs', {
            retention: aws_cdk_lib_1.aws_logs.RetentionDays.ONE_WEEK,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        const container = taskDef.addContainer('AppContainer', {
            image: dockerImage,
            logging: aws_cdk_lib_1.aws_ecs.LogDrivers.awsLogs({
                logGroup,
                streamPrefix: 'deepcopy',
            }),
            environment: {
                AWS_REGION: aws_cdk_lib_1.Stack.of(this).region,
                BUCKET_NAME: resultsBucket.bucketName,
                JOBS_TABLE_NAME: jobsTable.tableName,
                ENVIRONMENT: 'prod',
                DISABLE_SCREENSHOT: '0',
                CONTENT_LIBRARY_BUCKET: resultsBucket.bucketName,
            },
        });
        container.addUlimits({
            name: aws_cdk_lib_1.aws_ecs.UlimitName.NPROC,
            softLimit: 16384,
            hardLimit: 16384,
        });
        // We don't expose ports (batch style)
        // Security group for tasks
        const taskSecurityGroup = new aws_cdk_lib_1.aws_ec2.SecurityGroup(this, 'TaskSG', {
            vpc,
            allowAllOutbound: true,
            description: 'Allow outbound internet for API calls',
        });
        // Small Lambda to submit tasks (Python version)
        const submitLambda = new aws_cdk_lib_1.aws_lambda.Function(this, 'SubmitJobLambda', {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.PYTHON_3_11,
            timeout: aws_cdk_lib_1.Duration.seconds(10),
            memorySize: 256,
            handler: 'submit_job.handler',
            code: aws_cdk_lib_1.aws_lambda.Code.fromAsset(path.join(__dirname, 'lambdas')),
            environment: {
                CLUSTER_ARN: cluster.clusterArn,
                TASK_DEF_ARN: taskDef.taskDefinitionArn,
                // Only public subnets (no NAT Gateway needed)
                SUBNET_IDS: vpc.publicSubnets.map((s) => s.subnetId).join(','),
                SECURITY_GROUP_IDS: taskSecurityGroup.securityGroupId,
                JOBS_TABLE_NAME: jobsTable.tableName,
                RESULTS_BUCKET: resultsBucket.bucketName,
            },
        });
        // Permissions for submitter
        submitLambda.addToRolePolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            actions: ['ecs:RunTask', 'ecs:DescribeTasks'],
            resources: ['*'],
        }));
        submitLambda.addToRolePolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            actions: ['iam:PassRole'],
            resources: [taskDef.taskRole.roleArn, taskDef.executionRole.roleArn],
        }));
        jobsTable.grantReadWriteData(submitLambda);
        // Lambda to get job status (reads DynamoDB) - Python version
        const getJobLambda = new aws_cdk_lib_1.aws_lambda.Function(this, 'GetJobLambda', {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.PYTHON_3_11,
            timeout: aws_cdk_lib_1.Duration.seconds(10),
            memorySize: 256,
            handler: 'get_job.handler',
            code: aws_cdk_lib_1.aws_lambda.Code.fromAsset(path.join(__dirname, 'lambdas')),
            environment: {
                JOBS_TABLE_NAME: jobsTable.tableName,
            },
        });
        jobsTable.grantReadData(getJobLambda);
        // Lambda to get job result JSON from S3
        const getJobResultLambda = new aws_cdk_lib_1.aws_lambda.Function(this, 'GetJobResultLambda', {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.PYTHON_3_11,
            timeout: aws_cdk_lib_1.Duration.seconds(10),
            memorySize: 256,
            handler: 'get_job_result.handler',
            code: aws_cdk_lib_1.aws_lambda.Code.fromAsset(path.join(__dirname, 'lambdas')),
            environment: {
                RESULTS_BUCKET: resultsBucket.bucketName,
            },
        });
        resultsBucket.grantRead(getJobResultLambda);
        // Lambda for extracting avatars from product pages (Docker-based)
        const extractAvatarsLambda = new aws_cdk_lib_1.aws_lambda.DockerImageFunction(this, 'ExtractAvatarsLambda', {
            code: aws_cdk_lib_1.aws_lambda.DockerImageCode.fromImageAsset(path.join(__dirname, 'lambdas', 'extract_avatars'), {
                platform: aws_ecr_assets_1.Platform.LINUX_AMD64, // Explicitly set platform for Lambda
            }),
            timeout: aws_cdk_lib_1.Duration.seconds(120),
            memorySize: 3008, // 3GB for Playwright + OpenAI
            architecture: aws_cdk_lib_1.aws_lambda.Architecture.X86_64, // Explicitly set architecture
            environment: {
                OPENAI_MODEL: 'gpt-5-mini',
                PLAYWRIGHT_BROWSERS_PATH: '/var/task/.playwright', // Fixed browser path for Lambda
            },
        });
        // Grant access to the same secret as the ECS pipeline
        const secretArn = `arn:aws:secretsmanager:${aws_cdk_lib_1.Stack.of(this).region}:${aws_cdk_lib_1.Stack.of(this).account}:secret:deepcopy-secret-dev*`;
        extractAvatarsLambda.addToRolePolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            actions: ['secretsmanager:GetSecretValue'],
            resources: [secretArn],
        }));
        // Cognito User Pool for API auth
        const userPool = new aws_cdk_lib_1.aws_cognito.UserPool(this, 'UserPool', {
            signInAliases: { email: true },
            selfSignUpEnabled: false,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.RETAIN,
            standardAttributes: {
                email: { required: true, mutable: false },
            },
        });
        // OAuth resource server and scopes
        const scopeRead = new aws_cdk_lib_1.aws_cognito.ResourceServerScope({ scopeName: 'read', scopeDescription: 'Read jobs' });
        const scopeWrite = new aws_cdk_lib_1.aws_cognito.ResourceServerScope({ scopeName: 'write', scopeDescription: 'Submit jobs' });
        const resourceServer = new aws_cdk_lib_1.aws_cognito.UserPoolResourceServer(this, 'ApiResourceServer', {
            userPool,
            identifier: 'https://deep-copy.api',
            userPoolResourceServerName: 'deep-copy-api',
            scopes: [scopeRead, scopeWrite],
        });
        // App client for machine-to-machine (client credentials)
        const m2mClient = userPool.addClient('M2MClient', {
            generateSecret: true,
            authFlows: { userPassword: false, userSrp: false, adminUserPassword: false },
            oAuth: {
                flows: { clientCredentials: true },
                scopes: [
                    aws_cdk_lib_1.aws_cognito.OAuthScope.resourceServer(resourceServer, scopeRead),
                    aws_cdk_lib_1.aws_cognito.OAuthScope.resourceServer(resourceServer, scopeWrite),
                ],
            },
        });
        // Additional app client for Pravaha
        const pravahaClient = userPool.addClient('PravahaClient', {
            generateSecret: true,
            authFlows: { userPassword: false, userSrp: false, adminUserPassword: false },
            oAuth: {
                flows: { clientCredentials: true },
                scopes: [
                    aws_cdk_lib_1.aws_cognito.OAuthScope.resourceServer(resourceServer, scopeRead),
                    aws_cdk_lib_1.aws_cognito.OAuthScope.resourceServer(resourceServer, scopeWrite),
                ],
            },
        });
        // Domain for token endpoint
        const domain = userPool.addDomain('CognitoDomain', {
            cognitoDomain: {
                domainPrefix: `deepcopy-${aws_cdk_lib_1.Stack.of(this).account}-${aws_cdk_lib_1.Stack.of(this).region}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 63),
            },
        });
        const tokenEndpoint = `https://${domain.domainName}.auth.${aws_cdk_lib_1.Stack.of(this).region}.amazoncognito.com/oauth2/token`;
        const issuerUrl = `https://cognito-idp.${aws_cdk_lib_1.Stack.of(this).region}.amazonaws.com/${userPool.userPoolId}`;
        // API Gateway
        const api = new aws_cdk_lib_1.aws_apigateway.RestApi(this, 'Api', {
            restApiName: 'DeepCopy API',
            deployOptions: {
                stageName: 'prod',
            },
        });
        const cognitoAuthorizer = new aws_cdk_lib_1.aws_apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
            cognitoUserPools: [userPool],
            identitySource: aws_cdk_lib_1.aws_apigateway.IdentitySource.header('Authorization'),
            resultsCacheTtl: aws_cdk_lib_1.Duration.seconds(60),
        });
        const jobsRes = api.root.addResource('jobs');
        jobsRes.addMethod('POST', new aws_cdk_lib_1.aws_apigateway.LambdaIntegration(submitLambda), {
            authorizer: cognitoAuthorizer,
            authorizationType: aws_cdk_lib_1.aws_apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['https://deep-copy.api/write'],
        });
        const jobIdRes = jobsRes.addResource('{id}');
        jobIdRes.addMethod('GET', new aws_cdk_lib_1.aws_apigateway.LambdaIntegration(getJobLambda), {
            authorizer: cognitoAuthorizer,
            authorizationType: aws_cdk_lib_1.aws_apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['https://deep-copy.api/read'],
        });
        const jobResultRes = jobIdRes.addResource('result');
        jobResultRes.addMethod('GET', new aws_cdk_lib_1.aws_apigateway.LambdaIntegration(getJobResultLambda), {
            authorizer: cognitoAuthorizer,
            authorizationType: aws_cdk_lib_1.aws_apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['https://deep-copy.api/read'],
        });
        // Avatar extraction endpoint
        const avatarsRes = api.root.addResource('avatars');
        const extractRes = avatarsRes.addResource('extract');
        extractRes.addMethod('POST', new aws_cdk_lib_1.aws_apigateway.LambdaIntegration(extractAvatarsLambda), {
            authorizer: cognitoAuthorizer,
            authorizationType: aws_cdk_lib_1.aws_apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['https://deep-copy.api/write'],
        });
        // Optional: EventBridge to mark RUNNING when task starts and final status on stop
        // You can also have the container call DynamoDB directly at the end, which the Python already supports
        new aws_cdk_lib_1.CfnOutput(this, 'ApiUrl', { value: api.url });
        new aws_cdk_lib_1.CfnOutput(this, 'AvatarsEndpoint', { value: `${api.url}avatars/extract` });
        new aws_cdk_lib_1.CfnOutput(this, 'ResultsBucketName', { value: resultsBucket.bucketName });
        new aws_cdk_lib_1.CfnOutput(this, 'JobsTableName', { value: jobsTable.tableName });
        new aws_cdk_lib_1.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
        new aws_cdk_lib_1.CfnOutput(this, 'M2MClientId', { value: m2mClient.userPoolClientId });
        new aws_cdk_lib_1.CfnOutput(this, 'PravahaClientId', { value: pravahaClient.userPoolClientId });
        new aws_cdk_lib_1.CfnOutput(this, 'CognitoTokenEndpoint', { value: tokenEndpoint });
        new aws_cdk_lib_1.CfnOutput(this, 'CognitoIssuer', { value: issuerUrl });
    }
}
exports.DeepCopyStack = DeepCopyStack;
