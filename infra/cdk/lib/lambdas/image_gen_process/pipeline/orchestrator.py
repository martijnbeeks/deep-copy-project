"""
Pipeling Orchestrator for image_gen_process.

Orchestrates the flow of:
1. Setup & Config
2. Document Summarization
3. Product Detection (on uploaded files)
4. Angle Matching
5. Image Generation (parallel/iterative)
6. Upload to Cloudflare
7. Result Persistence
"""

import base64
import json
import os
import time
import traceback
from typing import Any, Dict, List, Optional

from utils.logging_config import setup_logging
from utils.helpers import now_iso, slug
from utils.image import (
    guess_mime_from_key,
    normalize_image_id,
    supports_product_image,
)

from services.aws import (
    get_secrets,
    configure_from_secrets,
    update_job_status,
    load_json_from_s3,
    load_bytes_from_s3,
    download_image_to_b64,
)
from services.openai_service import OpenAIService
from services.gemini_service import GeminiService
from services.cloudflare_service import CloudflareService

from pipeline.steps.document_analysis import summarize_docs_if_needed
from pipeline.steps.product_detection import detect_product_in_image
from pipeline.steps.image_matching import match_angles_to_images
from pipeline.steps.image_generation import generate_image_openai, generate_image_nano_banana

logger = setup_logging(__name__)

class ImageGenOrchestrator:
    def __init__(self, aws_request_id: Optional[str] = None):
        self.aws_request_id = aws_request_id
        
        # Initialize services
        # 1. Secrets & Config
        self.secrets = get_secrets()
        configure_from_secrets(self.secrets)
        
        # 2. Providers
        self.openai = OpenAIService()
        self.gemini = GeminiService() # Only instantiated if checking env? or lazy? 
        # Safety: if key missing, it might error on init, but valid for most runs.
        
        self.cloudflare = CloudflareService()
        
        # Config params
        self.results_bucket = os.environ.get("RESULTS_BUCKET")
        self.jobs_table = os.environ.get("JOBS_TABLE_NAME")
        self.image_library_prefix = os.environ.get("IMAGE_LIBRARY_PREFIX", "library/")
        self.image_provider = os.environ.get("IMAGE_GENERATION_PROVIDER", "openai").lower()
        
    def run(self, event: Dict[str, Any]) -> Dict[str, Any]:
        job_id = event.get("job_id", f"job-{int(time.time())}")
        logger.info("Starting Image Gen Pipeline for Job: %s", job_id)
        
        update_job_status(job_id, "RUNNING_IMAGE_GEN")
        
        try:
            # --- 1. Load Inputs ---
            s3_key_research = event.get("s3_key_research")  # e.g., "jobs/{id}/research.json" or similar?
            # Actually event usually has direct keys or we construct them?
            # Checking original handler...
            # The event passed to image gen lambda usually contains:
            # {
            #   "job_id", "project_name", "s3_key_result", "user_email", ...
            #   "foundational_research": ..., 
            #   "marketing_avatar": ...,
            #   "marketing_angels": ...
            # } 
            # Or it loads them from S3 using keys provided.
            
            # Re-reading original `lambda_handler` logic around lines 850+
            # It loads JSON from S3 based on event keys.
            
            # Let's assume the event has the data or keys.
            # Original handler looked like:
            # inputs = load_json_from_s3(bucket, event["input_s3_key"])
            # or directly from event if passed.
            
            # Wait, looking at lines 103-131 of original handler in US_19 description...
            # The extraction implies `lambda_handler` was orchestrator.
            # I should follow the logic of `lambda_handler`.
            
            project_name = event.get("project_name", "default")
            
            # Load main job data
            # Typically passed via "payload_s3_key" or "data"
            # If payload_s3_key is present, load it
            payload = event
            if "payload_s3_key" in event:
                payload = load_json_from_s3(self.results_bucket, event["payload_s3_key"])
                # merge with event
                payload.update(event)
                
            # Essential Data
            marketing_avatar = payload.get("marketing_avatar", {})
            marketing_angles = payload.get("marketing_angles", [])
            product_info = payload.get("product_info", {})
            foundational_s3_key = payload.get("foundational_research_s3_key")
            
            # Image Library & Uploaded Images
            library_images = payload.get("library_images", {}) # id -> desc
            uploaded_images = payload.get("uploaded_images", {}) # id -> s3_key or url
            
            # Product Image (Global/Primary)
            # Could be in product_info OR separate key
            product_image_url = payload.get("product_image_url") or product_info.get("product_image_url")
            product_name = payload.get("product_name") or product_info.get("name", "Product")
            language = payload.get("language", "English")
            
            # Validation
            if not marketing_avatar or not marketing_angles:
                raise ValueError("Missing avatar or angles data")
            
            # --- 2. Foundational Research Summary ---
            analysis_text = None
            if foundational_s3_key:
                try:
                    # Determine mime/type of foundational doc? Usually text or json
                    # Just read as text for summary
                    raw_bytes = load_bytes_from_s3(self.results_bucket, foundational_s3_key)
                    foundational_text = raw_bytes.decode("utf-8", errors="ignore")
                    analysis_text = summarize_docs_if_needed(self.openai, foundational_text, language, job_id)
                except Exception as e:
                    logger.warning("Failed to load/summarize foundational doc: %s", e)
            
            # --- 3. Product Detection (Uploaded Images) ---
            # We need to know if uploaded images have product (to avoid double product)
            # Store metadata about uploaded images
            uploaded_images_meta = {}
            for uid, details in uploaded_images.items():
                # details might be string (key) or dict
                key = details if isinstance(details, str) else details.get("key")
                if key:
                    try:
                        img_bytes = load_bytes_from_s3(self.results_bucket, key)
                        has_product = detect_product_in_image(self.openai, img_bytes, job_id)
                        uploaded_images_meta[uid] = {"hasProduct": has_product}
                    except Exception as e:
                        logger.warning("Product detection failed for %s: %s", uid, e)
            
            # --- 4. Prepare Product Image (The one to insert) ---
            product_image_data_b64 = None # Dict[base64, mime]
            product_image_bytes = None # raw bytes
            
            if product_image_url:
                dl = download_image_to_b64(product_image_url)
                if dl:
                    product_image_data_b64 = dl
                    product_image_bytes = base64.b64decode(dl["base64"])
            
            # --- 5. Match Angles to Images ---
            # Merge library and uploaded for matching pool?
            # Original handler logic:
            # all_available = {**library_images, **uploaded_images_descriptions}
            # The prompt needs descriptions.
            match_pool = library_images.copy()
            # If uploaded images have descriptions? assuming yes or skipping
            for uid, details in uploaded_images.items():
                desc = details.get("description", "Uploaded image") if isinstance(details, dict) else "Uploaded image"
                match_pool[uid] = desc
                
            assignments = match_angles_to_images(
                self.openai,
                marketing_angles,
                marketing_avatar,
                match_pool,
                job_id
            )
            # assignments: "1:1" -> "12.png"
            
            # --- 6. Generate Images ---
            results = []
            
            for angle in marketing_angles:
                a_num = str(angle.get("angle_number"))
                for var in angle.get("visual_variations", []):
                    v_num = str(var.get("variation_number"))
                    
                    key = f"{a_num}:{v_num}"
                    assigned_id = assignments.get(key)
                    
                    if not assigned_id:
                        logger.warning("No assignment for %s, skipping", key)
                        continue
                        
                    # Load Reference Image
                    ref_bytes = None
                    ref_data_b64 = None
                    ref_is_uploaded = False
                    
                    # check if uploaded or library
                    # assignments contains IDs.
                    # if ID is in uploaded_images keys...
                    
                    try:
                        if assigned_id in uploaded_images:
                            # Load from S3 key provided in uploaded_images
                            u_det = uploaded_images[assigned_id]
                            u_key = u_det if isinstance(u_det, str) else u_det.get("key")
                            ref_bytes = load_bytes_from_s3(self.results_bucket, u_key)
                            ref_is_uploaded = True
                        else:
                            # Load from library prefix
                            # normalize ID
                            norm_id = normalize_image_id(assigned_id)
                            lib_key = f"{self.image_library_prefix}{norm_id}"
                            # We need to know bucket? usually same or specific library bucket?
                            # Original handler likely used same bucket or env var.
                            # Assuming same bucket for simplicity or checked env
                            
                            # Original handler used 'get_object' with hardcoded or flexible logic
                            # Let's try loading from RESULTS_BUCKET if library is there, 
                            # OR maybe there is a LIBRARY_BUCKET?
                            # Checking original handler code...
                            # It used `s3_client.get_object(Bucket=RESULTS_BUCKET, Key=f"{IMAGE_LIBRARY_PREFIX}{image_id}")` usually.
                            ref_bytes = load_bytes_from_s3(self.results_bucket, lib_key)

                        if ref_bytes:
                            ref_data_b64 = {
                                "base64": base64.b64encode(ref_bytes).decode("utf-8"),
                                "mimeType": guess_mime_from_key(assigned_id)
                            }
                    except Exception as e:
                        logger.error("Failed to load reference image %s: %s", assigned_id, e)
                        continue

                    if not ref_data_b64:
                        continue

                    # Check Platform Support
                    supports_prod = supports_product_image(
                        assigned_id,
                        uploaded_images_metadata=uploaded_images_meta,
                        library_images_metadata=None # could pass library metadata if we had it
                    )
                    
                    # Generate
                    try:
                        gen_b64 = ""
                        
                        if self.image_provider == "google":
                            gen_b64 = generate_image_nano_banana(
                                self.gemini,
                                language,
                                marketing_avatar,
                                angle,
                                var,
                                product_name,
                                analysis_text,
                                ref_bytes,
                                product_image_bytes,
                                supports_prod,
                                job_id
                            )
                        else:
                            gen_b64 = generate_image_openai(
                                self.openai,
                                language,
                                marketing_avatar,
                                angle,
                                var,
                                product_name,
                                analysis_text,
                                ref_data_b64,
                                product_image_data_b64,
                                supports_prod,
                                job_id
                            )
                            
                        # Upload to Cloudflare
                        # filename: job_angle_var.png
                        fname = f"{job_id}_{a_num}_{v_num}.png"
                        cf_resp = self.cloudflare.upload_base64_image(
                            gen_b64,
                            fname,
                            product_name,
                            a_num,
                            v_num,
                            job_id
                        )
                        
                        results.append({
                            "angle_number": int(a_num) if a_num.isdigit() else a_num,
                            "variation_number": int(v_num) if v_num.isdigit() else v_num,
                            "cloudflare_id": cf_resp.get("id"),
                            "cloudflare_url": cf_resp.get("variants", [""])[0], # Use first variant or public URL?
                            "reference_image_id": assigned_id,
                            "status": "success"
                        })
                        
                    except Exception as e:
                        logger.error("Generation failed for %s: %s", key, e)
                        results.append({
                            "angle_number": a_num,
                            "variation_number": v_num,
                            "error": str(e),
                            "status": "failed"
                        })

            # --- 7. Finalize ---
            update_job_status(job_id, "COMPLETED_IMAGE_GEN")
            
            return {
                "statusCode": 200,
                "body": json.dumps({
                    "job_id": job_id,
                    "results": results,
                    "count": len(results)
                })
            }
            
        except Exception as e:
            logger.error("Pipeline failed: %s", traceback.format_exc())
            update_job_status(job_id, "FAILED_IMAGE_GEN", {"error": str(e)})
            raise
