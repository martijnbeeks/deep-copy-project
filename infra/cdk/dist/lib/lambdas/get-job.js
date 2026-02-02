"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const ddb = new client_dynamodb_1.DynamoDBClient({});
const JOBS_TABLE_NAME = process.env.JOBS_TABLE_NAME;
const handler = async (event) => {
    const jobId = event.pathParameters?.id;
    if (!jobId) {
        return { statusCode: 400, body: 'Missing id' };
    }
    const resp = await ddb.send(new client_dynamodb_1.GetItemCommand({
        TableName: JOBS_TABLE_NAME,
        Key: { jobId: { S: jobId } },
    }));
    if (!resp.Item)
        return { statusCode: 404, body: 'Not found' };
    const status = resp.Item.status?.S;
    const resultPrefix = resp.Item.resultPrefix?.S;
    const results = resp.Item.results?.S;
    return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jobId, status, resultPrefix, results: results ? JSON.parse(results) : undefined }),
    };
};
exports.handler = handler;
