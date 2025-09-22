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
- GET /jobs/{id}/result → returns the JSON from `s3://<bucket>/results/{id}/comprehensive_results.json` if present. 404 if missing.

Auth (Cognito):
- The API is protected by an API Gateway Cognito User Pools authorizer.
- CDK deploys a User Pool, OAuth resource server, and a machine-to-machine app client (client credentials).

Obtain a token (client credentials):
```bash
STACK_OUTPUT=$(npx cdk --json output)
TOKEN_ENDPOINT=$(echo "$STACK_OUTPUT" | jq -r '.DeepCopyStack.CognitoTokenEndpoint')
CLIENT_ID=$(echo "$STACK_OUTPUT" | jq -r '.DeepCopyStack.M2MClientId')
CLIENT_SECRET=REPLACE_WITH_SECRET # retrieve from AWS Console > Cognito > App clients > Show client secret

SCOPE="https://deep-copy.api/write"
ACCESS_TOKEN=$(curl -s -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d "grant_type=client_credentials&scope=${SCOPE}" \
  "$TOKEN_ENDPOINT" | jq -r .access_token)

echo "$ACCESS_TOKEN" | jq -R 'split(".") | .[1] | @base64d | fromjson' # inspect claims
```

Call the API:
```bash
API_URL=$(echo "$STACK_OUTPUT" | jq -r '.DeepCopyStack.ApiUrl')
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H 'content-type: application/json' \
     -d '{"example":"value"}' \
     "${API_URL}jobs"

# Get job status
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
     "${API_URL}jobs/<jobId>"

# Get job result JSON (404 until available)
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
     "${API_URL}jobs/<jobId>/result"
```

Container expectations:
- Reads `JOB_EVENT_JSON` and `JOB_ID` envs.
- Writes all outputs to `s3://<bucket>/${result_prefix}/...`.
- Optionally updates DynamoDB status via `JOBS_TABLE_NAME`.

## Quickstart: Auth token and API calls

Use the concrete values from your last deploy (from `commands.txt`).

```bash
# Set concrete values from stack outputs
API_URL="https://o5egokjpsl.execute-api.eu-west-1.amazonaws.com/prod/"
TOKEN_ENDPOINT="https://deepcopy-613663743323-eu-west-1.auth.eu-west-1.amazoncognito.com/oauth2/token"
CLIENT_ID="<paste-your-client-id>"
CLIENT_SECRET="<paste-your-client-secret>"

# Request access token with both scopes
ACCESS_TOKEN=$(curl -s -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d "grant_type=client_credentials&scope=https://deep-copy.api/read https://deep-copy.api/write" \
  "$TOKEN_ENDPOINT" | jq -r .access_token)

echo "Token acquired: ${#ACCESS_TOKEN} chars"

# Submit a job
curl -sS -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "sales_page_url": "https://try.meritrelief.com/",
    "project_name": "meritrelief",
    "swipe_file_id": "L00005",
    "advertorial_type": "Listicle"
  }' \
  "${API_URL}jobs"

# Get job status (replace with real jobId)
curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "${API_URL}jobs/YOUR_JOB_ID"

# Get job result JSON (404 until available)
curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "${API_URL}jobs/YOUR_JOB_ID/result"
```

Tip: To derive these programmatically from CDK outputs:

```bash
STACK_OUTPUT=$(npx cdk --json output)
API_URL=$(echo "$STACK_OUTPUT" | jq -r '.DeepCopyStack.ApiUrl')
TOKEN_ENDPOINT=$(echo "$STACK_OUTPUT" | jq -r '.DeepCopyStack.CognitoTokenEndpoint')
CLIENT_ID=$(echo "$STACK_OUTPUT" | jq -r '.DeepCopyStack.M2MClientId')
```



