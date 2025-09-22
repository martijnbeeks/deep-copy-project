import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError


_ecs = boto3.client("ecs")
_ddb = boto3.client("dynamodb")


def _required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing env {name}")
    return value


CLUSTER_ARN = _required_env("CLUSTER_ARN")
TASK_DEF_ARN = _required_env("TASK_DEF_ARN")
SUBNET_IDS = _required_env("SUBNET_IDS").split(",")
SECURITY_GROUP_IDS = _required_env("SECURITY_GROUP_IDS").split(",")
JOBS_TABLE_NAME = _required_env("JOBS_TABLE_NAME")


def handler(event, _context):
    body = event.get("body")
    if isinstance(body, str):
        try:
            body = json.loads(body) if body else {}
        except json.JSONDecodeError:
            return {
                "statusCode": 400,
                "headers": {"content-type": "application/json"},
                "body": json.dumps({"error": "Invalid JSON body"}),
            }
    elif not isinstance(body, dict) or body is None:
        body = {}

    job_id = str(uuid.uuid4())
    result_prefix = f"results/{job_id}"

    # Persist initial job record
    try:
        _ddb.put_item(
            TableName=JOBS_TABLE_NAME,
            Item={
                "jobId": {"S": job_id},
                "status": {"S": "SUBMITTED"},
                "createdAt": {"S": datetime.now(timezone.utc).isoformat()},
                "input": {"S": json.dumps(body)},
                "resultPrefix": {"S": result_prefix},
            },
        )
    except ClientError as e:
        return {
            "statusCode": 500,
            "headers": {"content-type": "application/json"},
            "body": json.dumps({"error": f"DynamoDB error: {e.response['Error'].get('Message', str(e))}"}),
        }

    # Extract and forward specific fields as individual env vars for convenience
    sales_page_url = body.get("sales_page_url")
    project_name = body.get("project_name")
    swipe_file_id = body.get("swipe_file_id")
    advertorial_type = body.get("advertorial_type")
    swipe_file_id = body.get("swipe_file_id")

    env_overrides = [
        {"name": "JOB_ID", "value": job_id},
        {
            "name": "JOB_EVENT_JSON",
            "value": json.dumps({**body, "job_id": job_id, "result_prefix": result_prefix}),
        },
    ]
    if sales_page_url is not None:
        env_overrides.append({"name": "SALES_PAGE_URL", "value": str(sales_page_url)})
    if project_name is not None:
        env_overrides.append({"name": "PROJECT_NAME", "value": str(project_name)})
    if swipe_file_id is not None:
        env_overrides.append({"name": "SWIPE_FILE_ID", "value": str(swipe_file_id)})
    if advertorial_type is not None:
        env_overrides.append({"name": "ADVERTORIAL_TYPE", "value": str(advertorial_type)})

    try:
        run_resp = _ecs.run_task(
            cluster=CLUSTER_ARN,
            taskDefinition=TASK_DEF_ARN,
            launchType="FARGATE",
            count=1,
            networkConfiguration={
                "awsvpcConfiguration": {
                    "subnets": SUBNET_IDS,
                    "securityGroups": SECURITY_GROUP_IDS,
                    "assignPublicIp": "ENABLED",
                }
            },
            overrides={
                "containerOverrides": [
                    {"name": "AppContainer", "environment": env_overrides}
                ]
            },
        )
    except ClientError as e:
        return {
            "statusCode": 500,
            "headers": {"content-type": "application/json"},
            "body": json.dumps({"error": f"ECS error: {e.response['Error'].get('Message', str(e))}"}),
        }

    task_arn = None
    tasks = run_resp.get("tasks") or []
    if tasks:
        task_arn = tasks[0].get("taskArn")

    return {
        "statusCode": 202,
        "headers": {"content-type": "application/json"},
        "body": json.dumps({"jobId": job_id, "taskArn": task_arn, "status": "SUBMITTED"}),
    }


