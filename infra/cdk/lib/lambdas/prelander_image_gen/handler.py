"""
AWS Lambda handler for prelander image generation.

Simplified pipeline: receive prompts → generate images → upload to Cloudflare → return URLs.
"""

import json
import os
import uuid
from typing import Any, Dict, List, Optional

import sentry_sdk
from sentry_sdk.integrations.aws_lambda import AwsLambdaIntegration

from utils.logging_config import setup_logging
from services.aws import get_secrets, configure_from_secrets, update_job_status, save_json_to_s3, download_image_to_b64
from services.gemini_service import GeminiService
from services.cloudflare_service import CloudflareService
from services.klaviyo_service import KlaviyoEmailService

sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN", ""),
    integrations=[AwsLambdaIntegration()],
    traces_sample_rate=0.1,
    environment=os.environ.get("ENVIRONMENT", "prod"),
)

logger = setup_logging(__name__)


def lambda_handler(event: dict, context) -> dict:
    """
    Lambda entry point for prelander image generation.
    
    Expected event:
    {
        "job_id": "uuid",
        "templateId": "A00005",
        "type": "realistic",
        "prompts": [
            {"role": "hero", "prompt": "..."},
            {"role": "section", "index": 0, "prompt": "..."},
            {"role": "product", "prompt": "..."}
        ],
        "productImageUrl": "https://..."
    }
    
    Returns:
        Response dict with statusCode and body.
    """
    logger.info("Received event: %s", json.dumps(event)[:1000])
    
    # Get AWS request ID
    aws_request_id = getattr(context, "aws_request_id", None) if context else str(uuid.uuid4())
    
    # Initialize services
    secrets = get_secrets()
    configure_from_secrets(secrets)
    
    gemini_service = GeminiService()
    cloudflare_service = CloudflareService()

    # Initialize Klaviyo service (non-fatal if key missing)
    klaviyo_service = None
    try:
        klaviyo_key = secrets.get("KLAVIYO_API_KEY", "").strip()
        if klaviyo_key:
            klaviyo_service = KlaviyoEmailService(klaviyo_key)
        else:
            logger.warning("KLAVIYO_API_KEY missing; email notifications disabled")
    except Exception as e:
        logger.warning("Failed to initialize KlaviyoEmailService: %s", e)
    
    # Get config
    results_bucket = os.environ.get("RESULTS_BUCKET")
    jobs_table = os.environ.get("JOBS_TABLE_NAME")
    
    # Extract event data
    job_id = event.get("job_id", f"job-{int(uuid.uuid4().int % 1e10)}")
    prompts = event.get("prompts", [])
    product_image_url = event.get("productImageUrl")
    
    # Validate
    if not prompts or not isinstance(prompts, list):
        error_msg = "prompts is required and must be a list"
        logger.error(error_msg)
        update_job_status(job_id, "FAILED_PRELANDER_IMAGE_GEN", {"error": error_msg})
        return {
            "statusCode": 400,
            "body": json.dumps({"error": error_msg})
        }
    
    update_job_status(job_id, "RUNNING_PRELANDER_IMAGE_GEN")
    
    try:
        # Download product image if provided
        product_image_bytes: Optional[bytes] = None
        if product_image_url:
            logger.info("Downloading product image from: %s", product_image_url)
            product_image_data = download_image_to_b64(product_image_url)
            if product_image_data:
                import base64
                product_image_bytes = base64.b64decode(product_image_data["base64"])
                logger.info("Product image downloaded successfully")
            else:
                logger.warning("Failed to download product image, continuing without it")
        
        # Process each prompt
        images: List[Dict[str, Any]] = []
        
        for prompt_item in prompts:
            role = prompt_item.get("role")
            prompt_text = prompt_item.get("prompt")
            index = prompt_item.get("index")  # Optional, for section roles
            
            if not role or not prompt_text:
                logger.warning("Skipping invalid prompt item: %s", prompt_item)
                continue
            
            try:
                logger.info("Generating image for role: %s (index: %s)", role, index)
                
                # Generate image using Gemini
                gen_b64 = gemini_service.generate_image(
                    prompt=prompt_text,
                    product_image_bytes=product_image_bytes,
                    job_id=job_id,
                )
                
                # Upload to Cloudflare
                filename = f"{job_id}_{role}"
                if index is not None:
                    filename += f"_{index}"
                filename += ".png"
                
                cf_response = cloudflare_service.upload_base64_image(
                    base64_data=gen_b64,
                    filename=filename,
                    role=role,
                    job_id=job_id,
                )
                
                # Get URL from variants
                variants = cf_response.get("variants", [])
                image_url = variants[0] if variants else ""
                
                if not image_url:
                    logger.warning("No URL in Cloudflare response for role %s", role)
                    continue
                
                # Build response item
                image_result = {
                    "role": role,
                    "url": image_url,
                }
                if index is not None:
                    image_result["index"] = index
                
                images.append(image_result)
                logger.info("Successfully generated and uploaded image for role: %s", role)
                
            except Exception as e:
                logger.error("Failed to generate image for role %s: %s", role, e)
                sentry_sdk.capture_exception(e)
                # Continue with other images even if one fails
                continue
        
        # Prepare results
        results = {
            "success": True,
            "images": images,
        }
        
        # Save results to S3
        result_key = f"results/prelander-images/{job_id}/results.json"
        save_json_to_s3(results_bucket, result_key, results)
        logger.info("Saved results to S3: %s", result_key)
        
        # Update job status
        update_job_status(job_id, "COMPLETED_PRELANDER_IMAGE_GEN", {
            "resultKey": result_key,
            "imageCount": len(images),
        })

        # Send email notification if requested
        notification_email = event.get("notification_email")
        if notification_email and klaviyo_service:
            try:
                klaviyo_service.send_prelander_images_completed_email(notification_email, job_id)
            except Exception as e:
                logger.warning("Email notification failed: %s", e)

        return {
            "statusCode": 200,
            "body": json.dumps(results)
        }
        
    except Exception as e:
        logger.error("Pipeline failed: %s", str(e), exc_info=True)
        sentry_sdk.capture_exception(e)
        error_msg = str(e)
        update_job_status(job_id, "FAILED_PRELANDER_IMAGE_GEN", {"error": error_msg})
        
        # Save failure result to S3
        failure_result = {
            "success": False,
            "error": error_msg,
        }
        result_key = f"results/prelander-images/{job_id}/results.json"
        try:
            save_json_to_s3(results_bucket, result_key, failure_result)
        except Exception as s3_error:
            logger.error("Failed to save failure result to S3: %s", s3_error)
        
        return {
            "statusCode": 500,
            "body": json.dumps(failure_result)
        }

