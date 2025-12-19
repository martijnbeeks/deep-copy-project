import {
  Stack,
  StackProps,
  Duration,
  RemovalPolicy,
  aws_iam as iam,
  aws_s3 as s3,
  aws_dynamodb as dynamodb,
  aws_lambda as lambda,
  aws_apigateway as apigw,
  aws_cognito as cognito,
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

    // Secret ARN for API keys (used by multiple Lambdas)
    const secretArn = `arn:aws:secretsmanager:${Stack.of(this).region}:${Stack.of(this).account}:secret:deepcopy-secret-dev*`;

    // AI Pipeline - Processing Lambda (Docker-based)
    const processJobLambda = new lambda.DockerImageFunction(this, 'ProcessJobLambda', {
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, 'lambdas', 'process_job'),
        {
          platform: Platform.LINUX_AMD64,
        }
      ),
      timeout: Duration.seconds(900), // 15 minutes for long-running pipeline
      memorySize: 3008, // 3GB for Playwright + OpenAI + Anthropic
      architecture: lambda.Architecture.X86_64,
      environment: {
        PLAYWRIGHT_BROWSERS_PATH: '/var/task/.playwright',
        JOBS_TABLE_NAME: jobsTable.tableName,
        RESULTS_BUCKET: resultsBucket.bucketName,
        ENVIRONMENT: 'prod',
      },
    });

    // Grant access to secrets
    processJobLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [secretArn],
      }),
    );
    jobsTable.grantReadWriteData(processJobLambda);
    resultsBucket.grantPut(processJobLambda);
    resultsBucket.grantPutAcl(processJobLambda);
    resultsBucket.grantRead(processJobLambda, 'content_library/*');
    resultsBucket.grantRead(processJobLambda, 'projects/*'); // Allow reading pre-computed results
    resultsBucket.grantRead(processJobLambda, 'results/*'); // Allow reading results for dev mode

    // Small Lambda to submit jobs (Python version)
    const submitLambda = new lambda.Function(this, 'SubmitJobLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      timeout: Duration.seconds(10),
      memorySize: 256,
      handler: 'submit_job.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambdas')),
      environment: {
        PROCESS_LAMBDA_NAME: processJobLambda.functionName,
        JOBS_TABLE_NAME: jobsTable.tableName,
        RESULTS_BUCKET: resultsBucket.bucketName,
      },
    });

    // Permissions for submitter - invoke Lambda instead of ECS
    processJobLambda.grantInvoke(submitLambda);
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
      timeout: Duration.seconds(600),
      memorySize: 3008, // 3GB for Playwright + OpenAI
      architecture: lambda.Architecture.X86_64,
      environment: {
        PLAYWRIGHT_BROWSERS_PATH: '/var/task/.playwright',
        JOBS_TABLE_NAME: jobsTable.tableName,
        RESULTS_BUCKET: resultsBucket.bucketName,
      },
    });

    // Grant access to the same secret as the ECS pipeline
    processAvatarExtractionLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [secretArn],
      }),
    );
    jobsTable.grantReadWriteData(processAvatarExtractionLambda);
    resultsBucket.grantPut(processAvatarExtractionLambda);
    resultsBucket.grantRead(processAvatarExtractionLambda, 'results/*');

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

    // Swipe file generation - Processing Lambda (Docker-based)
    const processSwipeFileLambda = new lambda.DockerImageFunction(this, 'ProcessSwipeFileLambda', {
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, 'lambdas', 'write_swipe'),
        {
          platform: Platform.LINUX_AMD64,
        }
      ),
      timeout: Duration.seconds(600),
      memorySize: 3008, // 3GB for Anthropic + processing
      architecture: lambda.Architecture.X86_64,
      environment: {
        JOBS_TABLE_NAME: jobsTable.tableName,
        RESULTS_BUCKET: resultsBucket.bucketName,
      },
    });

    // Grant access to the same secret as the ECS pipeline
    processSwipeFileLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [secretArn],
      }),
    );
    jobsTable.grantReadWriteData(processSwipeFileLambda);
    resultsBucket.grantPut(processSwipeFileLambda);
    resultsBucket.grantRead(processSwipeFileLambda, 'content_library/*');
    resultsBucket.grantRead(processSwipeFileLambda, 'results/*');

    // Swipe file generation - Submit Lambda (Python)
    const submitSwipeFileLambda = new lambda.Function(this, 'SubmitSwipeFileLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      timeout: Duration.seconds(10),
      memorySize: 256,
      handler: 'submit_swipe_file.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambdas')),
      environment: {
        JOBS_TABLE_NAME: jobsTable.tableName,
        PROCESS_LAMBDA_NAME: processSwipeFileLambda.functionName,
      },
    });
    jobsTable.grantReadWriteData(submitSwipeFileLambda);
    processSwipeFileLambda.grantInvoke(submitSwipeFileLambda);

    // Swipe file generation - Get Result Lambda (Python)
    const getSwipeFileResultLambda = new lambda.Function(this, 'GetSwipeFileResultLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      timeout: Duration.seconds(10),
      memorySize: 256,
      handler: 'get_swipe_file_result.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambdas')),
      environment: {
        RESULTS_BUCKET: resultsBucket.bucketName,
      },
    });
    resultsBucket.grantRead(getSwipeFileResultLambda);

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
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: ['*'],
      },
    });

    const corsHeaders: { [header: string]: string } = {
      'Access-Control-Allow-Origin': "'*'",
      'Access-Control-Allow-Headers': "'*'",
      'Access-Control-Allow-Methods': "'*'",
    };
    api.addGatewayResponse('Default4xxWithCors', {
      type: apigw.ResponseType.DEFAULT_4XX,
      responseHeaders: corsHeaders,
    });
    api.addGatewayResponse('Default5xxWithCors', {
      type: apigw.ResponseType.DEFAULT_5XX,
      responseHeaders: corsHeaders,
    });
    api.addGatewayResponse('UnauthorizedWithCors', {
      type: apigw.ResponseType.UNAUTHORIZED,
      responseHeaders: corsHeaders,
    });
    api.addGatewayResponse('AccessDeniedWithCors', {
      type: apigw.ResponseType.ACCESS_DENIED,
      responseHeaders: corsHeaders,
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

    // Swipe file generation endpoints
    const swipeFilesRes = api.root.addResource('swipe-files');
    const generateRes = swipeFilesRes.addResource('generate');
    generateRes.addMethod('POST', new apigw.LambdaIntegration(submitSwipeFileLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/write'],
    });

    const swipeFileIdRes = swipeFilesRes.addResource('{id}');
    swipeFileIdRes.addMethod('GET', new apigw.LambdaIntegration(getJobLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/read'],
    });

    const swipeFileResultRes = swipeFileIdRes.addResource('result');
    swipeFileResultRes.addMethod('GET', new apigw.LambdaIntegration(getSwipeFileResultLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/read'],
    });

    // Dev endpoints
    const devRes = api.root.addResource('dev');

    // Dev jobs
    const devJobsRes = devRes.addResource('jobs');
    devJobsRes.addMethod('POST', new apigw.LambdaIntegration(submitLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/write'],
    });

    // Dev avatars
    const devAvatarsRes = devRes.addResource('avatars');
    const devAvatarsExtractRes = devAvatarsRes.addResource('extract');
    devAvatarsExtractRes.addMethod('POST', new apigw.LambdaIntegration(submitAvatarExtractionLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/write'],
    });

    // Dev swipe files
    const devSwipeFilesRes = devRes.addResource('swipe-files');
    const devSwipeFilesGenerateRes = devSwipeFilesRes.addResource('generate');
    devSwipeFilesGenerateRes.addMethod('POST', new apigw.LambdaIntegration(submitSwipeFileLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/write'],
    });

    // Optional: EventBridge to mark RUNNING when task starts and final status on stop
    // You can also have the container call DynamoDB directly at the end, which the Python already supports

    new CfnOutput(this, 'ApiUrl', { value: api.url });
    new CfnOutput(this, 'AvatarsSubmitEndpoint', { value: `${api.url}avatars/extract` });
    new CfnOutput(this, 'SwipeFilesSubmitEndpoint', { value: `${api.url}swipe-files/generate` });
    new CfnOutput(this, 'ResultsBucketName', { value: resultsBucket.bucketName });
    new CfnOutput(this, 'JobsTableName', { value: jobsTable.tableName });
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'M2MClientId', { value: m2mClient.userPoolClientId });
    new CfnOutput(this, 'PravahaClientId', { value: pravahaClient.userPoolClientId });
    new CfnOutput(this, 'CognitoTokenEndpoint', { value: tokenEndpoint });
    new CfnOutput(this, 'CognitoIssuer', { value: issuerUrl });
  }
}


