"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const client_ecs_1 = require("@aws-sdk/client-ecs");
const uuid_1 = require("uuid");
const ecs = new client_ecs_1.ECSClient({});
const ddb = new client_dynamodb_1.DynamoDBClient({});
const requiredEnv = (name) => {
    const v = process.env[name];
    if (!v)
        throw new Error(`Missing env ${name}`);
    return v;
};
const CLUSTER_ARN = requiredEnv('CLUSTER_ARN');
const TASK_DEF_ARN = requiredEnv('TASK_DEF_ARN');
const SUBNET_IDS = requiredEnv('SUBNET_IDS').split(',');
const SECURITY_GROUP_IDS = requiredEnv('SECURITY_GROUP_IDS').split(',');
const JOBS_TABLE_NAME = requiredEnv('JOBS_TABLE_NAME');
const handler = async (event) => {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {});
    const jobId = (0, uuid_1.v4)();
    const resultPrefix = `results/${jobId}`;
    // Persist initial job record
    await ddb.send(new client_dynamodb_1.PutItemCommand({
        TableName: JOBS_TABLE_NAME,
        Item: {
            jobId: { S: jobId },
            status: { S: 'SUBMITTED' },
            createdAt: { S: new Date().toISOString() },
            input: { S: JSON.stringify(body) },
            resultPrefix: { S: resultPrefix },
        },
    }));
    // Prepare container overrides (env vars expected by python)
    const envOverrides = [
        { name: 'JOB_ID', value: jobId },
        { name: 'JOB_EVENT_JSON', value: JSON.stringify({ ...body, job_id: jobId, result_prefix: resultPrefix }) },
    ];
    const runResp = await ecs.send(new client_ecs_1.RunTaskCommand({
        cluster: CLUSTER_ARN,
        taskDefinition: TASK_DEF_ARN,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                subnets: SUBNET_IDS,
                securityGroups: SECURITY_GROUP_IDS,
                assignPublicIp: 'ENABLED',
            },
        },
        overrides: {
            containerOverrides: [
                {
                    name: 'AppContainer',
                    environment: envOverrides,
                },
            ],
        },
    }));
    const taskArn = runResp.tasks?.[0]?.taskArn;
    return {
        statusCode: 202,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jobId, taskArn, status: 'SUBMITTED' }),
    };
};
exports.handler = handler;
