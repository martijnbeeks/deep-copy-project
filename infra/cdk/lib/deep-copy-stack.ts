import {
  Stack,
  StackProps,
  Duration,
  RemovalPolicy,
  aws_iam as iam,
  aws_s3 as s3,
  aws_dynamodb as dynamodb,
  aws_ecs as ecs,
  aws_ecs_patterns as ecs_patterns,
  aws_ec2 as ec2,
  aws_logs as logs,
  aws_lambda as lambda,
  aws_lambda_nodejs as lambdaNode,
  aws_apigateway as apigw,
  aws_cognito as cognito,
  aws_ecr as ecr,
  aws_ecr_assets as ecrAssets,
  aws_events as events,
  aws_events_targets as targets,
  CfnOutput,
} from 'aws-cdk-lib';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { Construct } from 'constructs';
import * as path from 'path';

export class DeepCopyStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // S3 bucket for results
    const resultsBucket = new s3.Bucket(this, 'ResultsBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: false,
    });

    // DynamoDB Jobs table
    const jobsTable = new dynamodb.Table(this, 'JobsTable', {
      partitionKey: { name: 'jobId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
      tableClass: dynamodb.TableClass.STANDARD,
    });

    // VPC for ECS Fargate
    // Keep NAT Gateway provisioned but use public subnets to avoid NAT charges
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1, // Keep existing NAT Gateway to avoid VPC recreation
    });

    // Add FREE VPC Gateway Endpoints (no cost, reduce data transfer)
    // These keep S3 and DynamoDB traffic within AWS network at zero cost
    vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });
    vpc.addGatewayEndpoint('DynamoDBEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

    // Build Docker image from ai_pipeline
    const dockerImage = ecs.ContainerImage.fromAsset(
      path.join(__dirname, '../../ai_pipeline'),
      {
        platform: ecrAssets.Platform.LINUX_ARM64,
      },
    );

    // Task Role: permissions for the python container
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    resultsBucket.grantPut(taskRole);
    resultsBucket.grantPutAcl(taskRole);
    // Allow task to read swipe files stored under content_library/
    resultsBucket.grantRead(taskRole, 'content_library/*');
    jobsTable.grantReadWriteData(taskRole);

    // Also allow SecretsManager read if your code pulls secrets
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: ['*'],
      }),
    );

    // Task Definition
    const taskDef = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      cpu: 1024, // 1 vCPU
      memoryLimitMiB: 3072, // 3GB for 20-min workload
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
      taskRole,
    });

    const logGroup = new logs.LogGroup(this, 'TaskLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const container = taskDef.addContainer('AppContainer', {
      image: dockerImage,
      logging: ecs.LogDrivers.awsLogs({
        logGroup,
        streamPrefix: 'deepcopy',
      }),
      environment: {
        AWS_REGION: Stack.of(this).region,
        BUCKET_NAME: resultsBucket.bucketName,
        JOBS_TABLE_NAME: jobsTable.tableName,
        ENVIRONMENT: 'prod',
        DISABLE_SCREENSHOT: '0',
        CONTENT_LIBRARY_BUCKET: resultsBucket.bucketName,
      },
    });

    container.addUlimits({
      name: ecs.UlimitName.NPROC,
      softLimit: 16384,
      hardLimit: 16384,
    });

    // We don't expose ports (batch style)

    // Security group for tasks
    const taskSecurityGroup = new ec2.SecurityGroup(this, 'TaskSG', {
      vpc,
      allowAllOutbound: true,
      description: 'Allow outbound internet for API calls',
    });

    // Small Lambda to submit tasks (Python version)
    const submitLambda = new lambda.Function(this, 'SubmitJobLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      timeout: Duration.seconds(10),
      memorySize: 256,
      handler: 'submit_job.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambdas')),
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
    submitLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ecs:RunTask', 'ecs:DescribeTasks'],
        resources: ['*'],
      }),
    );
    submitLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [taskDef.taskRole.roleArn, taskDef.executionRole!.roleArn],
      }),
    );
    jobsTable.grantReadWriteData(submitLambda);

    // Lambda to get job status (reads DynamoDB) - Python version
    const getJobLambda = new lambda.Function(this, 'GetJobLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      timeout: Duration.seconds(10),
      memorySize: 256,
      handler: 'get_job.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambdas')),
      environment: {
        JOBS_TABLE_NAME: jobsTable.tableName,
      },
    });
    jobsTable.grantReadData(getJobLambda);

    // Lambda to get job result JSON from S3
    const getJobResultLambda = new lambda.Function(this, 'GetJobResultLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      timeout: Duration.seconds(10),
      memorySize: 256,
      handler: 'get_job_result.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambdas')),
      environment: {
        RESULTS_BUCKET: resultsBucket.bucketName,
      },
    });
    resultsBucket.grantRead(getJobResultLambda);

    // Avatar extraction - Processing Lambda (Docker-based)
    const processAvatarExtractionLambda = new lambda.DockerImageFunction(this, 'ProcessAvatarExtractionLambda', {
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, 'lambdas', 'extract_avatars'),
        {
          platform: Platform.LINUX_AMD64,
        }
      ),
      timeout: Duration.seconds(120),
      memorySize: 3008, // 3GB for Playwright + OpenAI
      architecture: lambda.Architecture.X86_64,
      environment: {
        PLAYWRIGHT_BROWSERS_PATH: '/var/task/.playwright',
        JOBS_TABLE_NAME: jobsTable.tableName,
        RESULTS_BUCKET: resultsBucket.bucketName,
      },
    });

    // Grant access to the same secret as the ECS pipeline
    const secretArn = `arn:aws:secretsmanager:${Stack.of(this).region}:${Stack.of(this).account}:secret:deepcopy-secret-dev*`;
    processAvatarExtractionLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [secretArn],
      }),
    );
    jobsTable.grantReadWriteData(processAvatarExtractionLambda);
    resultsBucket.grantPut(processAvatarExtractionLambda);

    // Avatar extraction - Submit Lambda (Python)
    const submitAvatarExtractionLambda = new lambda.Function(this, 'SubmitAvatarExtractionLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      timeout: Duration.seconds(10),
      memorySize: 256,
      handler: 'submit_avatar_extraction.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambdas')),
      environment: {
        JOBS_TABLE_NAME: jobsTable.tableName,
        PROCESS_LAMBDA_NAME: processAvatarExtractionLambda.functionName,
      },
    });
    jobsTable.grantReadWriteData(submitAvatarExtractionLambda);
    processAvatarExtractionLambda.grantInvoke(submitAvatarExtractionLambda);

    // Avatar extraction - Get Result Lambda (Python)
    const getAvatarResultLambda = new lambda.Function(this, 'GetAvatarResultLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      timeout: Duration.seconds(10),
      memorySize: 256,
      handler: 'get_avatar_result.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambdas')),
      environment: {
        RESULTS_BUCKET: resultsBucket.bucketName,
      },
    });
    resultsBucket.grantRead(getAvatarResultLambda);

    // Cognito User Pool for API auth
    const userPool = new cognito.UserPool(this, 'UserPool', {
      signInAliases: { email: true },
      selfSignUpEnabled: false,
      removalPolicy: RemovalPolicy.RETAIN,
      standardAttributes: {
        email: { required: true, mutable: false },
      },
    });

    // OAuth resource server and scopes
    const scopeRead = new cognito.ResourceServerScope({ scopeName: 'read', scopeDescription: 'Read jobs' });
    const scopeWrite = new cognito.ResourceServerScope({ scopeName: 'write', scopeDescription: 'Submit jobs' });
    const resourceServer = new cognito.UserPoolResourceServer(this, 'ApiResourceServer', {
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
          cognito.OAuthScope.resourceServer(resourceServer, scopeRead),
          cognito.OAuthScope.resourceServer(resourceServer, scopeWrite),
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
          cognito.OAuthScope.resourceServer(resourceServer, scopeRead),
          cognito.OAuthScope.resourceServer(resourceServer, scopeWrite),
        ],
      },
    });

    // Domain for token endpoint
    const domain = userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: `deepcopy-${Stack.of(this).account}-${Stack.of(this).region}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 63),
      },
    });

    const tokenEndpoint = `https://${domain.domainName}.auth.${Stack.of(this).region}.amazoncognito.com/oauth2/token`;
    const issuerUrl = `https://cognito-idp.${Stack.of(this).region}.amazonaws.com/${userPool.userPoolId}`;

    // API Gateway
    const api = new apigw.RestApi(this, 'Api', {
      restApiName: 'DeepCopy API',
      deployOptions: {
        stageName: 'prod',
      },
    });

    const cognitoAuthorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      identitySource: apigw.IdentitySource.header('Authorization'),
      resultsCacheTtl: Duration.seconds(60),
    });

    const jobsRes = api.root.addResource('jobs');
    jobsRes.addMethod('POST', new apigw.LambdaIntegration(submitLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/write'],
    });

    const jobIdRes = jobsRes.addResource('{id}');
    jobIdRes.addMethod('GET', new apigw.LambdaIntegration(getJobLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/read'],
    });

    const jobResultRes = jobIdRes.addResource('result');
    jobResultRes.addMethod('GET', new apigw.LambdaIntegration(getJobResultLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/read'],
    });

    // Avatar extraction endpoints
    const avatarsRes = api.root.addResource('avatars');
    const extractRes = avatarsRes.addResource('extract');
    extractRes.addMethod('POST', new apigw.LambdaIntegration(submitAvatarExtractionLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/write'],
    });

    const avatarIdRes = avatarsRes.addResource('{id}');
    avatarIdRes.addMethod('GET', new apigw.LambdaIntegration(getJobLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/read'],
    });

    const avatarResultRes = avatarIdRes.addResource('result');
    avatarResultRes.addMethod('GET', new apigw.LambdaIntegration(getAvatarResultLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/read'],
    });

    // Optional: EventBridge to mark RUNNING when task starts and final status on stop
    // You can also have the container call DynamoDB directly at the end, which the Python already supports

    new CfnOutput(this, 'ApiUrl', { value: api.url });
    new CfnOutput(this, 'AvatarsSubmitEndpoint', { value: `${api.url}avatars/extract` });
    new CfnOutput(this, 'ResultsBucketName', { value: resultsBucket.bucketName });
    new CfnOutput(this, 'JobsTableName', { value: jobsTable.tableName });
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'M2MClientId', { value: m2mClient.userPoolClientId });
    new CfnOutput(this, 'PravahaClientId', { value: pravahaClient.userPoolClientId });
    new CfnOutput(this, 'CognitoTokenEndpoint', { value: tokenEndpoint });
    new CfnOutput(this, 'CognitoIssuer', { value: issuerUrl });
  }
}


