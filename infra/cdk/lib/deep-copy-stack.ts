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
  aws_ecr as ecr,
  aws_ecr_assets as ecrAssets,
  aws_events as events,
  aws_events_targets as targets,
  CfnOutput,
} from 'aws-cdk-lib';
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
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
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
        DISABLE_SCREENSHOT: '1',
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

    // Small Lambda to submit tasks
    const submitLambda = new lambdaNode.NodejsFunction(this, 'SubmitJobLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      memorySize: 256,
      entry: path.join(__dirname, 'lambdas/submit-job.ts'),
      environment: {
        CLUSTER_ARN: cluster.clusterArn,
        TASK_DEF_ARN: taskDef.taskDefinitionArn,
        SUBNET_IDS: [...vpc.privateSubnets, ...vpc.publicSubnets].map((s) => s.subnetId).join(','),
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

    // API Gateway
    const api = new apigw.RestApi(this, 'Api', {
      restApiName: 'DeepCopy API',
      deployOptions: {
        stageName: 'prod',
      },
    });

    const jobsRes = api.root.addResource('jobs');
    jobsRes.addMethod('POST', new apigw.LambdaIntegration(submitLambda));

    const jobIdRes = jobsRes.addResource('{id}');
    jobIdRes.addMethod('GET', new apigw.LambdaIntegration(getJobLambda));

    // Optional: EventBridge to mark RUNNING when task starts and final status on stop
    // You can also have the container call DynamoDB directly at the end, which the Python already supports

    new CfnOutput(this, 'ApiUrl', { value: api.url });
    new CfnOutput(this, 'ResultsBucketName', { value: resultsBucket.bucketName });
    new CfnOutput(this, 'JobsTableName', { value: jobsTable.tableName });
  }
}


