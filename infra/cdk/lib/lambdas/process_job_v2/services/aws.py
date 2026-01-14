"""
AWS service wrappers for process_job_v2 Lambda.

Provides centralized access to AWS services (Secrets Manager, S3, DynamoDB).
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import boto3


logger = logging.getLogger(__name__)


class AWSServices:
    """
    Centralized AWS service client manager.
    
    Handles initialization and caching of AWS service clients,
    as well as common operations like secret retrieval, S3 storage,
    and DynamoDB job status updates.
    """
    
    def __init__(self, secret_id: str = "deepcopy-secret-dev"):
        """
        Initialize AWS service clients.
        
        Args:
            secret_id: The Secrets Manager secret ID to retrieve API keys from.
        """
        self.aws_region = (
            os.environ.get('AWS_REGION') or 
            os.environ.get('AWS_DEFAULT_REGION') or 
            'eu-west-1'
        )
        
        # Initialize clients
        self._secrets_client = boto3.client('secretsmanager', region_name=self.aws_region)
        self.s3_client = boto3.client('s3', region_name=self.aws_region)
        self.ddb_client = boto3.client('dynamodb', region_name=self.aws_region)
        
        # Configuration
        self.s3_bucket = os.environ.get(
            'RESULTS_BUCKET', 
            "deepcopystack-resultsbucketa95a2103-zhwjflrlpfih"
        )
        self.jobs_table_name = os.environ.get(
            'JOBS_TABLE_NAME', 
            "DeepCopyStack-JobsTable1970BC16-1BVYVOHK8WXTU"
        )
        
        # Load secrets
        self.secrets = self._get_secrets(secret_id)
    
    def _get_secrets(self, secret_id: str) -> Dict[str, str]:
        """
        Get secrets from AWS Secrets Manager.
        
        Args:
            secret_id: The secret ID or ARN to retrieve.
            
        Returns:
            Dictionary of secret key-value pairs.
            
        Raises:
            Exception: If secret retrieval fails.
        """
        try:
            response = self._secrets_client.get_secret_value(SecretId=secret_id)
            return json.loads(response['SecretString'])
        except Exception as e:
            logger.error(f"Error getting secrets: {e}")
            raise
    
    def save_results_to_s3(
        self, 
        results: Dict[str, Any], 
        s3_bucket: str, 
        project_name: str, 
        job_id: str
    ) -> None:
        """
        Save all results to S3.
        
        Saves results in two locations:
        1. projects/{project_name}/{timestamp}/comprehensive_results.json
        2. results/{job_id}/comprehensive_results.json
        
        Args:
            results: The results dictionary to save.
            s3_bucket: S3 bucket name.
            project_name: Project identifier for organization.
            job_id: Unique job identifier.
            
        Raises:
            Exception: If S3 upload fails.
        """
        try:
            # Build comprehensive results
            comprehensive_results = {
                "project_name": project_name,
                "timestamp_iso": datetime.now(timezone.utc).isoformat(),
                "results": results,
                "job_id": job_id
            }
            
            body = json.dumps(comprehensive_results, ensure_ascii=False, indent=4)
            
            # Save by project with timestamp
            datetime_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            project_key = f'projects/{project_name}/{datetime_str}/comprehensive_results.json'
            self.s3_client.put_object(
                Bucket=s3_bucket,
                Key=project_key,
                Body=body,
                ContentType='application/json'
            )
            
            # Save by job ID
            job_key = f'results/{job_id}/comprehensive_results.json'
            self.s3_client.put_object(
                Bucket=s3_bucket,
                Key=job_key,
                Body=body,
                ContentType='application/json'
            )
            
            logger.info(f"Saved comprehensive results to S3: {job_key}")
            
        except Exception as e:
            logger.error(f"Error saving results to S3: {e}")
            raise
    
    def update_job_status(
        self, 
        job_id: Optional[str], 
        status: str, 
        extra_attrs: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Update job status in DynamoDB if configured.
        
        Args:
            job_id: The job identifier.
            status: One of SUBMITTED, RUNNING, SUCCEEDED, FAILED.
            extra_attrs: Optional additional attributes to store
                        (strings only or will be JSON-serialized).
        """
        try:
            if not self.jobs_table_name or not job_id:
                return
            
            item = {
                'jobId': {'S': str(job_id)},
                'status': {'S': status},
                'updatedAt': {'S': datetime.now(timezone.utc).isoformat()},
            }
            
            if extra_attrs:
                for key, value in extra_attrs.items():
                    # Store as string; JSON-serialize complex values
                    if isinstance(value, (str, int, float)):
                        item[key] = {'S': str(value)}
                    else:
                        item[key] = {'S': json.dumps(value, ensure_ascii=False)}
            
            self.ddb_client.put_item(TableName=self.jobs_table_name, Item=item)
            
        except Exception as e:
            logger.error(f"Failed to update job status for {job_id}: {e}")
    
    def get_object_from_s3(self, bucket: str, key: str) -> Dict[str, Any]:
        """
        Get and parse a JSON object from S3.
        
        Args:
            bucket: S3 bucket name.
            key: S3 object key.
            
        Returns:
            Parsed JSON content as dictionary.
        """
        response = self.s3_client.get_object(Bucket=bucket, Key=key)
        return json.loads(response['Body'].read().decode('utf-8'))
