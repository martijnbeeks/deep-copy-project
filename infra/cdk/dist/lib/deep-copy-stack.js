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
        // Secret ARN for API keys (used by multiple Lambdas)
        const secretArn = `arn:aws:secretsmanager:${aws_cdk_lib_1.Stack.of(this).region}:${aws_cdk_lib_1.Stack.of(this).account}:secret:deepcopy-secret-dev*`;
        // GitHub Actions OIDC Provider
        const githubProvider = new aws_cdk_lib_1.aws_iam.OpenIdConnectProvider(this, 'GithubProvider', {
            url: 'https://token.actions.githubusercontent.com',
            clientIds: ['sts.amazonaws.com'],
        });
        // IAM Role for GitHub Actions
        const githubDeployRole = new aws_cdk_lib_1.aws_iam.Role(this, 'GitHubDeployRole', {
            assumedBy: new aws_cdk_lib_1.aws_iam.WebIdentityPrincipal(githubProvider.openIdConnectProviderArn, {
                StringEquals: {
                    'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                    'token.actions.githubusercontent.com:sub': 'repo:martijnbeeks/deep-copy-project:ref:refs/heads/main',
                },
            }),
            description: 'Role assumed by GitHub Actions to deploy the stack',
            roleName: 'DeepCopy-GitHubDeployRole',
        });
        // Grant administrative permissions for CDK deployment
        githubDeployRole.addManagedPolicy(aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));
        new aws_cdk_lib_1.CfnOutput(this, 'GitHubDeployRoleArn', { value: githubDeployRole.roleArn });
        const lambdaImageRepublishMarker = 'manifest-v2-republish-2026-02-13';
        // AI Pipeline - Processing Lambda (Docker-based)
        const processJobLambda = new aws_cdk_lib_1.aws_lambda.DockerImageFunction(this, 'ProcessJobLambda', {
            code: aws_cdk_lib_1.aws_lambda.DockerImageCode.fromImageAsset(path.join(__dirname, 'lambdas', 'process_job'), {
                platform: aws_ecr_assets_1.Platform.LINUX_AMD64,
                extraHash: lambdaImageRepublishMarker,
            }),
            timeout: aws_cdk_lib_1.Duration.seconds(900), // 15 minutes for long-running pipeline
            memorySize: 3008, // 3GB for Playwright + OpenAI + Anthropic
            architecture: aws_cdk_lib_1.aws_lambda.Architecture.X86_64,
            environment: {
                PLAYWRIGHT_BROWSERS_PATH: '/var/task/.playwright',
                JOBS_TABLE_NAME: jobsTable.tableName,
                RESULTS_BUCKET: resultsBucket.bucketName,
                LLM_USAGE_EVENTS_PREFIX: 'llm_usage_events',
                ENVIRONMENT: 'prod',
            },
        });
        // Grant access to secrets
        processJobLambda.addToRolePolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            actions: ['secretsmanager:GetSecretValue'],
            resources: [secretArn],
        }));
        jobsTable.grantReadWriteData(processJobLambda);
        resultsBucket.grantPut(processJobLambda);
        resultsBucket.grantPutAcl(processJobLambda);
        resultsBucket.grantRead(processJobLambda, 'content_library/*');
        resultsBucket.grantRead(processJobLambda, 'projects/*'); // Allow reading pre-computed results
        resultsBucket.grantRead(processJobLambda, 'results/*'); // Allow reading results for dev mode
        // V2 AI Pipeline - Processing Lambda (Docker-based, separate from v1)
        const processJobLambdaV2 = new aws_cdk_lib_1.aws_lambda.DockerImageFunction(this, 'ProcessJobV2Lambda', {
            code: aws_cdk_lib_1.aws_lambda.DockerImageCode.fromImageAsset(path.join(__dirname, 'lambdas', 'process_job_v2'), {
                platform: aws_ecr_assets_1.Platform.LINUX_AMD64,
                extraHash: lambdaImageRepublishMarker,
            }),
            timeout: aws_cdk_lib_1.Duration.seconds(900), // 15 minutes for long-running pipeline
            memorySize: 3008, // 3GB for Playwright + OpenAI + Anthropic
            architecture: aws_cdk_lib_1.aws_lambda.Architecture.X86_64,
            environment: {
                PLAYWRIGHT_BROWSERS_PATH: '/var/task/.playwright',
                JOBS_TABLE_NAME: jobsTable.tableName,
                RESULTS_BUCKET: resultsBucket.bucketName,
                LLM_USAGE_EVENTS_PREFIX: 'llm_usage_events',
                ENVIRONMENT: 'prod',
                API_VERSION: 'v2',
            },
        });
        // Grant access to secrets for V2 Lambda
        processJobLambdaV2.addToRolePolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            actions: ['secretsmanager:GetSecretValue'],
            resources: [secretArn],
        }));
        jobsTable.grantReadWriteData(processJobLambdaV2);
        resultsBucket.grantPut(processJobLambdaV2);
        resultsBucket.grantPutAcl(processJobLambdaV2);
        resultsBucket.grantRead(processJobLambdaV2, 'content_library/*');
        resultsBucket.grantRead(processJobLambdaV2, 'projects/*');
        resultsBucket.grantRead(processJobLambdaV2, 'results/*');
        resultsBucket.grantRead(processJobLambdaV2, 'cache/*');
        // Shared asset for Python "thin" lambdas (submit/get-result). Exclude caches and Docker-based lambda directories.
        const pythonLambdasAsset = aws_cdk_lib_1.aws_lambda.Code.fromAsset(path.join(__dirname, 'lambdas'), {
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
                'process_job',
                'process_job_v2',
                'write_swipe',
            ],
        });
        // Small Lambda to submit jobs (Python version)
        const submitLambda = new aws_cdk_lib_1.aws_lambda.Function(this, 'SubmitJobLambda', {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.PYTHON_3_11,
            timeout: aws_cdk_lib_1.Duration.seconds(10),
            memorySize: 256,
            handler: 'submit_job.handler',
            code: pythonLambdasAsset,
            environment: {
                PROCESS_LAMBDA_NAME: processJobLambda.functionName,
                JOBS_TABLE_NAME: jobsTable.tableName,
                RESULTS_BUCKET: resultsBucket.bucketName,
            },
        });
        // Permissions for submitter - invoke Lambda instead of ECS
        processJobLambda.grantInvoke(submitLambda);
        jobsTable.grantReadWriteData(submitLambda);
        // V2 Submit Lambda with stricter validation (invokes V2 process lambda)
        const submitLambdaV2 = new aws_cdk_lib_1.aws_lambda.Function(this, 'SubmitJobV2Lambda', {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.PYTHON_3_11,
            timeout: aws_cdk_lib_1.Duration.seconds(10),
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
        const getJobLambda = new aws_cdk_lib_1.aws_lambda.Function(this, 'GetJobLambda', {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.PYTHON_3_11,
            timeout: aws_cdk_lib_1.Duration.seconds(10),
            memorySize: 256,
            handler: 'get_job.handler',
            code: pythonLambdasAsset,
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
            code: pythonLambdasAsset,
            environment: {
                RESULTS_BUCKET: resultsBucket.bucketName,
            },
        });
        resultsBucket.grantRead(getJobResultLambda);
        // Swipe file generation - Processing Lambda (Docker-based)
        const processSwipeFileLambda = new aws_cdk_lib_1.aws_lambda.DockerImageFunction(this, 'ProcessSwipeFileLambda', {
            code: aws_cdk_lib_1.aws_lambda.DockerImageCode.fromImageAsset(path.join(__dirname, 'lambdas', 'write_swipe'), {
                platform: aws_ecr_assets_1.Platform.LINUX_AMD64,
                extraHash: lambdaImageRepublishMarker,
            }),
            timeout: aws_cdk_lib_1.Duration.seconds(600),
            memorySize: 3008, // 3GB for Anthropic + processing
            architecture: aws_cdk_lib_1.aws_lambda.Architecture.X86_64,
            environment: {
                JOBS_TABLE_NAME: jobsTable.tableName,
                RESULTS_BUCKET: resultsBucket.bucketName,
                LLM_USAGE_EVENTS_PREFIX: 'llm_usage_events',
            },
        });
        // Grant access to the same secret as the ECS pipeline
        processSwipeFileLambda.addToRolePolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            actions: ['secretsmanager:GetSecretValue'],
            resources: [secretArn],
        }));
        jobsTable.grantReadWriteData(processSwipeFileLambda);
        resultsBucket.grantPut(processSwipeFileLambda);
        resultsBucket.grantRead(processSwipeFileLambda, 'content_library/*');
        resultsBucket.grantRead(processSwipeFileLambda, 'results/*');
        // Swipe file generation - Submit Lambda (Python)
        const submitSwipeFileLambda = new aws_cdk_lib_1.aws_lambda.Function(this, 'SubmitSwipeFileLambda', {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.PYTHON_3_11,
            timeout: aws_cdk_lib_1.Duration.seconds(10),
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
        const getSwipeFileResultLambda = new aws_cdk_lib_1.aws_lambda.Function(this, 'GetSwipeFileResultLambda', {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.PYTHON_3_11,
            timeout: aws_cdk_lib_1.Duration.seconds(10),
            memorySize: 256,
            handler: 'get_swipe_file_result.handler',
            code: pythonLambdasAsset,
            environment: {
                RESULTS_BUCKET: resultsBucket.bucketName,
            },
        });
        resultsBucket.grantRead(getSwipeFileResultLambda);
        // Image generation - Processing Lambda (Docker-based)
        const processImageGenLambda = new aws_cdk_lib_1.aws_lambda.DockerImageFunction(this, 'ProcessImageGenLambda', {
            code: aws_cdk_lib_1.aws_lambda.DockerImageCode.fromImageAsset(path.join(__dirname, 'lambdas', 'image_gen_process'), {
                platform: aws_ecr_assets_1.Platform.LINUX_AMD64,
                extraHash: lambdaImageRepublishMarker,
            }),
            timeout: aws_cdk_lib_1.Duration.seconds(900),
            memorySize: 3008,
            architecture: aws_cdk_lib_1.aws_lambda.Architecture.X86_64,
            environment: {
                JOBS_TABLE_NAME: jobsTable.tableName,
                RESULTS_BUCKET: resultsBucket.bucketName,
                LLM_USAGE_EVENTS_PREFIX: 'llm_usage_events',
                IMAGE_LIBRARY_PREFIX: 'image_library',
                IMAGE_DESCRIPTIONS_KEY: 'image_library/static-library-descriptions.json',
                SECRET_ID: 'deepcopy-secret-dev',
            },
        });
        processImageGenLambda.addToRolePolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            actions: ['secretsmanager:GetSecretValue'],
            resources: [secretArn],
        }));
        jobsTable.grantReadWriteData(processImageGenLambda);
        resultsBucket.grantPut(processImageGenLambda);
        resultsBucket.grantPutAcl(processImageGenLambda);
        resultsBucket.grantRead(processImageGenLambda, 'image_library/*');
        resultsBucket.grantRead(processImageGenLambda, 'user-uploads/*');
        // Image generation - Submit Lambda (Python)
        const submitImageGenLambda = new aws_cdk_lib_1.aws_lambda.Function(this, 'SubmitImageGenLambda', {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.PYTHON_3_11,
            timeout: aws_cdk_lib_1.Duration.seconds(10),
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
        const getImageGenResultLambda = new aws_cdk_lib_1.aws_lambda.Function(this, 'GetImageGenResultLambda', {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.PYTHON_3_11,
            timeout: aws_cdk_lib_1.Duration.seconds(10),
            memorySize: 256,
            handler: 'get_image_gen_result.handler',
            code: pythonLambdasAsset,
            environment: {
                RESULTS_BUCKET: resultsBucket.bucketName,
            },
        });
        resultsBucket.grantRead(getImageGenResultLambda);
        // Prelander image generation - Processing Lambda (Docker-based)
        const processPrelanderImagesLambda = new aws_cdk_lib_1.aws_lambda.DockerImageFunction(this, 'ProcessPrelanderImagesLambda', {
            code: aws_cdk_lib_1.aws_lambda.DockerImageCode.fromImageAsset(path.join(__dirname, 'lambdas', 'prelander_image_gen'), {
                platform: aws_ecr_assets_1.Platform.LINUX_AMD64,
                extraHash: lambdaImageRepublishMarker,
            }),
            timeout: aws_cdk_lib_1.Duration.seconds(600),
            memorySize: 3008,
            architecture: aws_cdk_lib_1.aws_lambda.Architecture.X86_64,
            environment: {
                JOBS_TABLE_NAME: jobsTable.tableName,
                RESULTS_BUCKET: resultsBucket.bucketName,
                LLM_USAGE_EVENTS_PREFIX: 'llm_usage_events',
                SECRET_ID: 'deepcopy-secret-dev',
            },
        });
        processPrelanderImagesLambda.addToRolePolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            actions: ['secretsmanager:GetSecretValue'],
            resources: [secretArn],
        }));
        jobsTable.grantReadWriteData(processPrelanderImagesLambda);
        resultsBucket.grantPut(processPrelanderImagesLambda);
        resultsBucket.grantPutAcl(processPrelanderImagesLambda);
        resultsBucket.grantRead(processPrelanderImagesLambda);
        // Prelander image generation - Submit Lambda (Python)
        const submitPrelanderImagesLambda = new aws_cdk_lib_1.aws_lambda.Function(this, 'SubmitPrelanderImagesLambda', {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.PYTHON_3_11,
            timeout: aws_cdk_lib_1.Duration.seconds(10),
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
        const getPrelanderImagesResultLambda = new aws_cdk_lib_1.aws_lambda.Function(this, 'GetPrelanderImagesResultLambda', {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.PYTHON_3_11,
            timeout: aws_cdk_lib_1.Duration.seconds(10),
            memorySize: 256,
            handler: 'get_prelander_images_result.handler',
            code: pythonLambdasAsset,
            environment: {
                RESULTS_BUCKET: resultsBucket.bucketName,
            },
        });
        resultsBucket.grantRead(getPrelanderImagesResultLambda);
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
            defaultCorsPreflightOptions: {
                allowOrigins: aws_cdk_lib_1.aws_apigateway.Cors.ALL_ORIGINS,
                allowMethods: aws_cdk_lib_1.aws_apigateway.Cors.ALL_METHODS,
                allowHeaders: ['*'],
            },
        });
        const corsHeaders = {
            'Access-Control-Allow-Origin': "'*'",
            'Access-Control-Allow-Headers': "'*'",
            'Access-Control-Allow-Methods': "'*'",
        };
        api.addGatewayResponse('Default4xxWithCors', {
            type: aws_cdk_lib_1.aws_apigateway.ResponseType.DEFAULT_4XX,
            responseHeaders: corsHeaders,
        });
        api.addGatewayResponse('Default5xxWithCors', {
            type: aws_cdk_lib_1.aws_apigateway.ResponseType.DEFAULT_5XX,
            responseHeaders: corsHeaders,
        });
        api.addGatewayResponse('UnauthorizedWithCors', {
            type: aws_cdk_lib_1.aws_apigateway.ResponseType.UNAUTHORIZED,
            responseHeaders: corsHeaders,
        });
        api.addGatewayResponse('AccessDeniedWithCors', {
            type: aws_cdk_lib_1.aws_apigateway.ResponseType.ACCESS_DENIED,
            responseHeaders: corsHeaders,
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
        // Swipe file generation endpoints
        const swipeFilesRes = api.root.addResource('swipe-files');
        const generateRes = swipeFilesRes.addResource('generate');
        generateRes.addMethod('POST', new aws_cdk_lib_1.aws_apigateway.LambdaIntegration(submitSwipeFileLambda), {
            authorizer: cognitoAuthorizer,
            authorizationType: aws_cdk_lib_1.aws_apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['https://deep-copy.api/write'],
        });
        const swipeFileIdRes = swipeFilesRes.addResource('{id}');
        swipeFileIdRes.addMethod('GET', new aws_cdk_lib_1.aws_apigateway.LambdaIntegration(getJobLambda), {
            authorizer: cognitoAuthorizer,
            authorizationType: aws_cdk_lib_1.aws_apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['https://deep-copy.api/read'],
        });
        const swipeFileResultRes = swipeFileIdRes.addResource('result');
        swipeFileResultRes.addMethod('GET', new aws_cdk_lib_1.aws_apigateway.LambdaIntegration(getSwipeFileResultLambda), {
            authorizer: cognitoAuthorizer,
            authorizationType: aws_cdk_lib_1.aws_apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['https://deep-copy.api/read'],
        });
        // Image generation endpoints
        const imageGenRes = api.root.addResource('image-gen');
        const imageGenGenerateRes = imageGenRes.addResource('generate');
        imageGenGenerateRes.addMethod('POST', new aws_cdk_lib_1.aws_apigateway.LambdaIntegration(submitImageGenLambda), {
            authorizer: cognitoAuthorizer,
            authorizationType: aws_cdk_lib_1.aws_apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['https://deep-copy.api/write'],
        });
        const imageGenIdRes = imageGenRes.addResource('{id}');
        imageGenIdRes.addMethod('GET', new aws_cdk_lib_1.aws_apigateway.LambdaIntegration(getJobLambda), {
            authorizer: cognitoAuthorizer,
            authorizationType: aws_cdk_lib_1.aws_apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['https://deep-copy.api/read'],
        });
        const imageGenResultRes = imageGenIdRes.addResource('result');
        imageGenResultRes.addMethod('GET', new aws_cdk_lib_1.aws_apigateway.LambdaIntegration(getImageGenResultLambda), {
            authorizer: cognitoAuthorizer,
            authorizationType: aws_cdk_lib_1.aws_apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['https://deep-copy.api/read'],
        });
        // Prelander image generation endpoints
        const prelanderImagesRes = api.root.addResource('prelander-images');
        const prelanderImagesGenerateRes = prelanderImagesRes.addResource('generate');
        prelanderImagesGenerateRes.addMethod('POST', new aws_cdk_lib_1.aws_apigateway.LambdaIntegration(submitPrelanderImagesLambda), {
            authorizer: cognitoAuthorizer,
            authorizationType: aws_cdk_lib_1.aws_apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['https://deep-copy.api/write'],
        });
        const prelanderImagesIdRes = prelanderImagesRes.addResource('{id}');
        prelanderImagesIdRes.addMethod('GET', new aws_cdk_lib_1.aws_apigateway.LambdaIntegration(getJobLambda), {
            authorizer: cognitoAuthorizer,
            authorizationType: aws_cdk_lib_1.aws_apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['https://deep-copy.api/read'],
        });
        const prelanderImagesResultRes = prelanderImagesIdRes.addResource('result');
        prelanderImagesResultRes.addMethod('GET', new aws_cdk_lib_1.aws_apigateway.LambdaIntegration(getPrelanderImagesResultLambda), {
            authorizer: cognitoAuthorizer,
            authorizationType: aws_cdk_lib_1.aws_apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['https://deep-copy.api/read'],
        });
        // Dev endpoints
        const devRes = api.root.addResource('dev');
        // Dev jobs
        const devJobsRes = devRes.addResource('jobs');
        devJobsRes.addMethod('POST', new aws_cdk_lib_1.aws_apigateway.LambdaIntegration(submitLambda), {
            authorizer: cognitoAuthorizer,
            authorizationType: aws_cdk_lib_1.aws_apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['https://deep-copy.api/write'],
        });
        // Dev swipe files
        const devSwipeFilesRes = devRes.addResource('swipe-files');
        const devSwipeFilesGenerateRes = devSwipeFilesRes.addResource('generate');
        devSwipeFilesGenerateRes.addMethod('POST', new aws_cdk_lib_1.aws_apigateway.LambdaIntegration(submitSwipeFileLambda), {
            authorizer: cognitoAuthorizer,
            authorizationType: aws_cdk_lib_1.aws_apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['https://deep-copy.api/write'],
        });
        // V2 API endpoints
        const v2Res = api.root.addResource('v2');
        // V2 Jobs
        const v2JobsRes = v2Res.addResource('jobs');
        v2JobsRes.addMethod('POST', new aws_cdk_lib_1.aws_apigateway.LambdaIntegration(submitLambdaV2), {
            authorizer: cognitoAuthorizer,
            authorizationType: aws_cdk_lib_1.aws_apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['https://deep-copy.api/write'],
        });
        const v2JobIdRes = v2JobsRes.addResource('{id}');
        v2JobIdRes.addMethod('GET', new aws_cdk_lib_1.aws_apigateway.LambdaIntegration(getJobLambda), {
            authorizer: cognitoAuthorizer,
            authorizationType: aws_cdk_lib_1.aws_apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['https://deep-copy.api/read'],
        });
        const v2JobResultRes = v2JobIdRes.addResource('result');
        v2JobResultRes.addMethod('GET', new aws_cdk_lib_1.aws_apigateway.LambdaIntegration(getJobResultLambda), {
            authorizer: cognitoAuthorizer,
            authorizationType: aws_cdk_lib_1.aws_apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['https://deep-copy.api/read'],
        });
        // Dev V2 endpoints
        const devV2Res = devRes.addResource('v2');
        const devV2JobsRes = devV2Res.addResource('jobs');
        devV2JobsRes.addMethod('POST', new aws_cdk_lib_1.aws_apigateway.LambdaIntegration(submitLambdaV2), {
            authorizer: cognitoAuthorizer,
            authorizationType: aws_cdk_lib_1.aws_apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['https://deep-copy.api/write'],
        });
        // Optional: EventBridge to mark RUNNING when task starts and final status on stop
        // You can also have the container call DynamoDB directly at the end, which the Python already supports
        new aws_cdk_lib_1.CfnOutput(this, 'ApiUrl', { value: api.url });
        new aws_cdk_lib_1.CfnOutput(this, 'V2JobsEndpoint', { value: `${api.url}v2/jobs` });
        new aws_cdk_lib_1.CfnOutput(this, 'SwipeFilesSubmitEndpoint', { value: `${api.url}swipe-files/generate` });
        new aws_cdk_lib_1.CfnOutput(this, 'ImageGenSubmitEndpoint', { value: `${api.url}image-gen/generate` });
        new aws_cdk_lib_1.CfnOutput(this, 'PrelanderImagesSubmitEndpoint', { value: `${api.url}prelander-images/generate` });
        new aws_cdk_lib_1.CfnOutput(this, 'ResultsBucketName', { value: resultsBucket.bucketName });
        new aws_cdk_lib_1.CfnOutput(this, 'JobsTableName', { value: jobsTable.tableName });
        new aws_cdk_lib_1.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
        new aws_cdk_lib_1.CfnOutput(this, 'M2MClientId', { value: m2mClient.userPoolClientId });
        new aws_cdk_lib_1.CfnOutput(this, 'PravahaClientId', { value: pravahaClient.userPoolClientId });
        new aws_cdk_lib_1.CfnOutput(this, 'CognitoTokenEndpoint', { value: tokenEndpoint });
        new aws_cdk_lib_1.CfnOutput(this, 'CognitoIssuer', { value: issuerUrl });
        // Developer Read-Only User with Console Access
        const developerUser = new aws_cdk_lib_1.aws_iam.User(this, 'DeveloperUser', {
            userName: 'deep-copy-developer',
            password: aws_cdk_lib_1.SecretValue.unsafePlainText('DeepCopy2026!Temp'),
            passwordResetRequired: true,
        });
        developerUser.addManagedPolicy(aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'));
        developerUser.addManagedPolicy(aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('IAMUserChangePassword'));
        new aws_cdk_lib_1.CfnOutput(this, 'DeveloperUserName', { value: developerUser.userName });
    }
}
exports.DeepCopyStack = DeepCopyStack;
