import {
  Stack,
  StackProps,
  Duration,
  RemovalPolicy,
  SecretValue,
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

    // GitHub Actions OIDC Provider
    const githubProvider = new iam.OpenIdConnectProvider(this, 'GithubProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    // IAM Role for GitHub Actions
    const githubDeployRole = new iam.Role(this, 'GitHubDeployRole', {
      assumedBy: new iam.WebIdentityPrincipal(githubProvider.openIdConnectProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub': 'repo:martijnbeeks/deep-copy-project:ref:refs/heads/main',
        },
      }),
      description: 'Role assumed by GitHub Actions to deploy the stack',
      roleName: 'DeepCopy-GitHubDeployRole',
    });

    // Grant administrative permissions for CDK deployment
    githubDeployRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));

    new CfnOutput(this, 'GitHubDeployRoleArn', { value: githubDeployRole.roleArn });
    const lambdaImageRepublishMarker = 'manifest-v2-republish-2026-02-13';

    // AI Pipeline - Processing Lambda (Docker-based)
    const processJobLambdaV2 = new lambda.DockerImageFunction(this, 'ProcessJobV2Lambda', {
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, 'lambdas', 'process_job_v2'),
        {
          platform: Platform.LINUX_AMD64,
          extraHash: lambdaImageRepublishMarker,
        }
      ),
      timeout: Duration.seconds(900), // 15 minutes for long-running pipeline
      memorySize: 3008, // 3GB for Playwright + OpenAI + Anthropic
      architecture: lambda.Architecture.X86_64,
      environment: {
        PLAYWRIGHT_BROWSERS_PATH: '/var/task/.playwright',
        JOBS_TABLE_NAME: jobsTable.tableName,
        RESULTS_BUCKET: resultsBucket.bucketName,
        LLM_USAGE_EVENTS_PREFIX: 'llm_usage_events',
        ENVIRONMENT: 'prod',
        API_VERSION: 'v2',
        SENTRY_DSN: 'https://f51ef0bfc242618e5b298aa60661e753@o4510738689425408.ingest.de.sentry.io/4510738713346128',
      },
    });

    // Grant access to secrets for V2 Lambda
    processJobLambdaV2.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [secretArn],
      }),
    );
    jobsTable.grantReadWriteData(processJobLambdaV2);
    resultsBucket.grantPut(processJobLambdaV2);
    resultsBucket.grantPutAcl(processJobLambdaV2);
    resultsBucket.grantRead(processJobLambdaV2, 'content_library/*');
    resultsBucket.grantRead(processJobLambdaV2, 'projects/*');
    resultsBucket.grantRead(processJobLambdaV2, 'results/*');
    resultsBucket.grantRead(processJobLambdaV2, 'cache/*');

    // Shared asset for Python "thin" lambdas (submit/get-result). Exclude caches and Docker-based lambda directories.
    const pythonLambdasAsset = lambda.Code.fromAsset(path.join(__dirname, 'lambdas'), {
      exclude: [
        '**/__pycache__/**',
        '**/*.pyc',
        '**/*.pyo',
        '**/.DS_Store',
        '**/node_modules/**',
        '**/dist/**',
        '**/.venv/**',
        // Exclude Docker-based lambda directories (they have their own DockerImageCode assets)
        'extract_avatars',
        'image_gen_process',
        'prelander_image_gen',
        'process_job_v2',
        'write_swipe',
      ],
    });

    // Submit Lambda with stricter validation
    const submitLambdaV2 = new lambda.Function(this, 'SubmitJobV2Lambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      timeout: Duration.seconds(10),
      memorySize: 256,
      handler: 'submit_job_v2.handler',
      code: pythonLambdasAsset,
      environment: {
        PROCESS_LAMBDA_NAME: processJobLambdaV2.functionName,
        JOBS_TABLE_NAME: jobsTable.tableName,
        RESULTS_BUCKET: resultsBucket.bucketName,
      },
    });
    processJobLambdaV2.grantInvoke(submitLambdaV2);
    jobsTable.grantReadWriteData(submitLambdaV2);

    // Lambda to get job status (reads DynamoDB) - Python version
    const getJobLambda = new lambda.Function(this, 'GetJobLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      timeout: Duration.seconds(10),
      memorySize: 256,
      handler: 'get_job.handler',
      code: pythonLambdasAsset,
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
      code: pythonLambdasAsset,
      environment: {
        RESULTS_BUCKET: resultsBucket.bucketName,
      },
    });
    resultsBucket.grantRead(getJobResultLambda);

    // Swipe file generation - Processing Lambda (Docker-based)
    const processSwipeFileLambda = new lambda.DockerImageFunction(this, 'ProcessSwipeFileLambda', {
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, 'lambdas', 'write_swipe'),
        {
          platform: Platform.LINUX_AMD64,
          extraHash: lambdaImageRepublishMarker,
        }
      ),
      timeout: Duration.seconds(600),
      memorySize: 3008, // 3GB for Anthropic + processing
      architecture: lambda.Architecture.X86_64,
      environment: {
        JOBS_TABLE_NAME: jobsTable.tableName,
        RESULTS_BUCKET: resultsBucket.bucketName,
        LLM_USAGE_EVENTS_PREFIX: 'llm_usage_events',
        SENTRY_DSN: 'https://f51ef0bfc242618e5b298aa60661e753@o4510738689425408.ingest.de.sentry.io/4510738713346128',
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
      code: pythonLambdasAsset,
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
      code: pythonLambdasAsset,
      environment: {
        RESULTS_BUCKET: resultsBucket.bucketName,
      },
    });
    resultsBucket.grantRead(getSwipeFileResultLambda);

    // Image generation - Processing Lambda (Docker-based)
    const processImageGenLambda = new lambda.DockerImageFunction(this, 'ProcessImageGenLambda', {
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, 'lambdas', 'image_gen_process'), {
        platform: Platform.LINUX_AMD64,
        extraHash: lambdaImageRepublishMarker,
      }),
      timeout: Duration.seconds(900),
      memorySize: 3008,
      architecture: lambda.Architecture.X86_64,
      environment: {
        JOBS_TABLE_NAME: jobsTable.tableName,
        RESULTS_BUCKET: resultsBucket.bucketName,
        LLM_USAGE_EVENTS_PREFIX: 'llm_usage_events',
        IMAGE_LIBRARY_PREFIX: 'image_library',
        IMAGE_DESCRIPTIONS_KEY: 'image_library/static-library-descriptions.json',
        SECRET_ID: 'deepcopy-secret-dev',
        SENTRY_DSN: 'https://f51ef0bfc242618e5b298aa60661e753@o4510738689425408.ingest.de.sentry.io/4510738713346128',
      },
    });
    processImageGenLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [secretArn],
      }),
    );
    jobsTable.grantReadWriteData(processImageGenLambda);
    resultsBucket.grantPut(processImageGenLambda);
    resultsBucket.grantPutAcl(processImageGenLambda);
    resultsBucket.grantRead(processImageGenLambda, 'image_library/*');
    resultsBucket.grantRead(processImageGenLambda, 'user-uploads/*');

    // Image generation - Submit Lambda (Python)
    const submitImageGenLambda = new lambda.Function(this, 'SubmitImageGenLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      timeout: Duration.seconds(10),
      memorySize: 256,
      handler: 'submit_image_gen.handler',
      code: pythonLambdasAsset,
      environment: {
        JOBS_TABLE_NAME: jobsTable.tableName,
        PROCESS_LAMBDA_NAME: processImageGenLambda.functionName,
      },
    });
    jobsTable.grantReadWriteData(submitImageGenLambda);
    processImageGenLambda.grantInvoke(submitImageGenLambda);

    // Image generation - Get Result Lambda (Python)
    const getImageGenResultLambda = new lambda.Function(this, 'GetImageGenResultLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      timeout: Duration.seconds(10),
      memorySize: 256,
      handler: 'get_image_gen_result.handler',
      code: pythonLambdasAsset,
      environment: {
        RESULTS_BUCKET: resultsBucket.bucketName,
      },
    });
    resultsBucket.grantRead(getImageGenResultLambda);

    // Prelander image generation - Processing Lambda (Docker-based)
    const processPrelanderImagesLambda = new lambda.DockerImageFunction(this, 'ProcessPrelanderImagesLambda', {
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, 'lambdas', 'prelander_image_gen'), {
        platform: Platform.LINUX_AMD64,
        extraHash: lambdaImageRepublishMarker,
      }),
      timeout: Duration.seconds(600),
      memorySize: 3008,
      architecture: lambda.Architecture.X86_64,
      environment: {
        JOBS_TABLE_NAME: jobsTable.tableName,
        RESULTS_BUCKET: resultsBucket.bucketName,
        LLM_USAGE_EVENTS_PREFIX: 'llm_usage_events',
        SECRET_ID: 'deepcopy-secret-dev',
        SENTRY_DSN: 'https://f51ef0bfc242618e5b298aa60661e753@o4510738689425408.ingest.de.sentry.io/4510738713346128',
      },
    });
    processPrelanderImagesLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [secretArn],
      }),
    );
    jobsTable.grantReadWriteData(processPrelanderImagesLambda);
    resultsBucket.grantPut(processPrelanderImagesLambda);
    resultsBucket.grantPutAcl(processPrelanderImagesLambda);
    resultsBucket.grantRead(processPrelanderImagesLambda);

    // Prelander image generation - Submit Lambda (Python)
    const submitPrelanderImagesLambda = new lambda.Function(this, 'SubmitPrelanderImagesLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      timeout: Duration.seconds(10),
      memorySize: 256,
      handler: 'submit_prelander_images.handler',
      code: pythonLambdasAsset,
      environment: {
        JOBS_TABLE_NAME: jobsTable.tableName,
        PROCESS_LAMBDA_NAME: processPrelanderImagesLambda.functionName,
      },
    });
    jobsTable.grantReadWriteData(submitPrelanderImagesLambda);
    processPrelanderImagesLambda.grantInvoke(submitPrelanderImagesLambda);

    // Prelander image generation - Get Result Lambda (Python)
    const getPrelanderImagesResultLambda = new lambda.Function(this, 'GetPrelanderImagesResultLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      timeout: Duration.seconds(10),
      memorySize: 256,
      handler: 'get_prelander_images_result.handler',
      code: pythonLambdasAsset,
      environment: {
        RESULTS_BUCKET: resultsBucket.bucketName,
      },
    });
    resultsBucket.grantRead(getPrelanderImagesResultLambda);

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

    // Image generation endpoints
    const imageGenRes = api.root.addResource('image-gen');
    const imageGenGenerateRes = imageGenRes.addResource('generate');
    imageGenGenerateRes.addMethod('POST', new apigw.LambdaIntegration(submitImageGenLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/write'],
    });

    const imageGenIdRes = imageGenRes.addResource('{id}');
    imageGenIdRes.addMethod('GET', new apigw.LambdaIntegration(getJobLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/read'],
    });

    const imageGenResultRes = imageGenIdRes.addResource('result');
    imageGenResultRes.addMethod('GET', new apigw.LambdaIntegration(getImageGenResultLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/read'],
    });

    // Prelander image generation endpoints
    const prelanderImagesRes = api.root.addResource('prelander-images');
    const prelanderImagesGenerateRes = prelanderImagesRes.addResource('generate');
    prelanderImagesGenerateRes.addMethod('POST', new apigw.LambdaIntegration(submitPrelanderImagesLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/write'],
    });

    const prelanderImagesIdRes = prelanderImagesRes.addResource('{id}');
    prelanderImagesIdRes.addMethod('GET', new apigw.LambdaIntegration(getJobLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/read'],
    });

    const prelanderImagesResultRes = prelanderImagesIdRes.addResource('result');
    prelanderImagesResultRes.addMethod('GET', new apigw.LambdaIntegration(getPrelanderImagesResultLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/read'],
    });

    // Dev endpoints
    const devRes = api.root.addResource('dev');

    // Dev swipe files
    const devSwipeFilesRes = devRes.addResource('swipe-files');
    const devSwipeFilesGenerateRes = devSwipeFilesRes.addResource('generate');
    devSwipeFilesGenerateRes.addMethod('POST', new apigw.LambdaIntegration(submitSwipeFileLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/write'],
    });

    // V2 API endpoints
    const v2Res = api.root.addResource('v2');

    // V2 Jobs
    const v2JobsRes = v2Res.addResource('jobs');
    v2JobsRes.addMethod('POST', new apigw.LambdaIntegration(submitLambdaV2), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/write'],
    });

    const v2JobIdRes = v2JobsRes.addResource('{id}');
    v2JobIdRes.addMethod('GET', new apigw.LambdaIntegration(getJobLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/read'],
    });

    const v2JobResultRes = v2JobIdRes.addResource('result');
    v2JobResultRes.addMethod('GET', new apigw.LambdaIntegration(getJobResultLambda), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/read'],
    });

    // Dev V2 endpoints
    const devV2Res = devRes.addResource('v2');
    const devV2JobsRes = devV2Res.addResource('jobs');
    devV2JobsRes.addMethod('POST', new apigw.LambdaIntegration(submitLambdaV2), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['https://deep-copy.api/write'],
    });

    // Optional: EventBridge to mark RUNNING when task starts and final status on stop
    // You can also have the container call DynamoDB directly at the end, which the Python already supports

    new CfnOutput(this, 'ApiUrl', { value: api.url });
    new CfnOutput(this, 'V2JobsEndpoint', { value: `${api.url}v2/jobs` });
    new CfnOutput(this, 'SwipeFilesSubmitEndpoint', { value: `${api.url}swipe-files/generate` });
    new CfnOutput(this, 'ImageGenSubmitEndpoint', { value: `${api.url}image-gen/generate` });
    new CfnOutput(this, 'PrelanderImagesSubmitEndpoint', { value: `${api.url}prelander-images/generate` });
    new CfnOutput(this, 'ResultsBucketName', { value: resultsBucket.bucketName });
    new CfnOutput(this, 'JobsTableName', { value: jobsTable.tableName });
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'M2MClientId', { value: m2mClient.userPoolClientId });
    new CfnOutput(this, 'PravahaClientId', { value: pravahaClient.userPoolClientId });
    new CfnOutput(this, 'CognitoTokenEndpoint', { value: tokenEndpoint });
    new CfnOutput(this, 'CognitoIssuer', { value: issuerUrl });

    // Developer Read-Only User with Console Access
    const developerUser = new iam.User(this, 'DeveloperUser', {
      userName: 'deep-copy-developer',
      password: SecretValue.unsafePlainText('DeepCopy2026!Temp'),
      passwordResetRequired: true,
    });

    developerUser.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'));
    developerUser.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('IAMUserChangePassword'));

    new CfnOutput(this, 'DeveloperUserName', { value: developerUser.userName });
  }
}

