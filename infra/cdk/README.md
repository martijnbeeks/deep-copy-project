# Deep Copy Infra - CDK

Commands:

```bash
cd cdk
npm install
npm run build
npx cdk bootstrap
npx cdk deploy
```

API:
- POST /jobs → starts a Fargate task with your container. Body forwarded to the container via `JOB_EVENT_JSON`. Returns `{ jobId }`.
- GET /jobs/{id} → returns job status and result prefix.

Container expectations:
- Reads `JOB_EVENT_JSON` and `JOB_ID` envs.
- Writes all outputs to `s3://<bucket>/${result_prefix}/...`.
- Optionally updates DynamoDB status via `JOBS_TABLE_NAME`.



