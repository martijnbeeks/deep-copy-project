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

import requests

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
    save_json_to_s3,
)
from services.openai_service import OpenAIService
from services.gemini_service import GeminiService
from services.cloudflare_service import CloudflareService

from pipeline.steps.document_analysis import summarize_docs_if_needed
from pipeline.steps.product_detection import detect_product_in_image
from pipeline.steps.image_matching import match_angles_to_images
from pipeline.steps.image_generation import generate_image_openai, generate_image_nano_banana
from services.prompt_service import PromptService

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

        # Initialize prompt service (DATABASE_URL is required)
        db_url = self.secrets.get("DATABASE_URL")
        if not db_url:
            raise RuntimeError("DATABASE_URL not found in secrets. Cannot load prompts from DB.")
        self.prompt_service = PromptService(db_url, "image_gen_process")

        # Config params
        self.results_bucket = os.environ.get("RESULTS_BUCKET")
        self.jobs_table = os.environ.get("JOBS_TABLE_NAME")
        self.image_library_prefix = os.environ.get("IMAGE_LIBRARY_PREFIX", "image_library").rstrip("/") + "/"
        self.image_provider = os.environ.get("IMAGE_GENERATION_PROVIDER", "google").lower()
        
    def _normalize_input(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Detect flat (OpenAPI-spec) vs rich payloads and transform flat inputs
        into the rich format that downstream pipeline steps expect.
        Idempotent: already-rich payloads pass through unchanged.
        """
        # --- selectedAvatar: string -> {"description": string} ---
        avatar = payload.get("selectedAvatar")
        if isinstance(avatar, str):
            payload["selectedAvatar"] = {"description": avatar}
            logger.info("Normalized selectedAvatar from string to dict")

        # --- selectedAngles: ["text"] -> [{angle_number, angle_name, visual_variations}] ---
        angles = payload.get("selectedAngles")
        if isinstance(angles, list) and angles and isinstance(angles[0], str):
            normalized_angles = []
            for i, angle_text in enumerate(angles, start=1):
                normalized_angles.append({
                    "angle_number": i,
                    "angle_name": angle_text,
                    "visual_variations": [
                        {"variation_number": 1, "description": ""}
                    ],
                })
            payload["selectedAngles"] = normalized_angles
            logger.info("Normalized selectedAngles from %d strings to rich format", len(normalized_angles))

        # --- productImageUrls: ["url"] -> "url" (first item) ---
        product_urls = payload.get("productImageUrls")
        if isinstance(product_urls, list):
            payload["productImageUrls"] = product_urls[0] if product_urls else None
            logger.info("Normalized productImageUrls from list to single URL")

        # --- foundationalDocText: inline text when no S3 key ---
        if payload.get("foundationalDocText") and not payload.get("foundational_research_s3_key"):
            payload["_foundational_text_inline"] = payload["foundationalDocText"]
            logger.info("Stored foundationalDocText as inline text")

        # --- uploadedReferenceImageUrls: ["url"] -> uploaded_images dict ---
        ref_urls = payload.get("uploadedReferenceImageUrls")
        if isinstance(ref_urls, list) and ref_urls and "uploaded_images" not in payload:
            uploaded = {}
            for i, url in enumerate(ref_urls, start=1):
                uploaded[f"uploaded_{i}"] = {"url": url}
            payload["uploaded_images"] = uploaded
            logger.info("Normalized uploadedReferenceImageUrls to uploaded_images (%d entries)", len(uploaded))

        # --- imageGenerationProvider: map API value to internal provider ---
        if "imageGenerationProvider" in payload:
            provider_map = {"nano_banana": "google"}
            raw_provider = payload["imageGenerationProvider"]
            payload["_image_provider_override"] = provider_map.get(raw_provider, raw_provider).lower()
            logger.info("Set image provider override to '%s' (from '%s')", payload["_image_provider_override"], raw_provider)

        return payload

    @staticmethod
    def _download_image_bytes_from_url(url: str, timeout_s: int = 30) -> Optional[bytes]:
        """Download raw bytes from a URL. Returns None on failure."""
        try:
            resp = requests.get(url, timeout=timeout_s)
            resp.raise_for_status()
            return resp.content
        except Exception as e:
            logger.warning("Failed to download image from URL %s: %s", url, e)
            return None

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

            # Normalize flat API inputs to rich format
            payload = self._normalize_input(payload)

            # Resolve image provider (override from payload or default)
            image_provider = payload.get("_image_provider_override", self.image_provider)

            # Essential Data
            marketing_avatar = payload.get("selectedAvatar", {})
            marketing_angles = payload.get("selectedAngles", [])
            product_info = payload.get("productInfo", {})
            foundational_s3_key = payload.get("foundational_research_s3_key")
            
            # Image Library & Uploaded Images
            library_images = payload.get("library_images", {}) # id -> desc
            uploaded_images = payload.get("uploaded_images", {}) # id -> s3_key or url
            
            # Product Image (Global/Primary)
            # Could be in product_info OR separate key
            product_image_url = payload.get("productImageUrls") or product_info.get("product_image_url")
            product_name = payload.get("productName") or product_info.get("name", "Product")
            language = payload.get("language", "English")
            
            # Validation
            if not marketing_avatar or not marketing_angles:
                raise ValueError("Missing avatar or angles data")
            
            # --- 2. Foundational Research Summary ---
            analysis_text = None
            inline_text = payload.get("_foundational_text_inline")
            if inline_text:
                try:
                    analysis_text = summarize_docs_if_needed(self.openai, inline_text, language, job_id, prompt_service=self.prompt_service)
                except Exception as e:
                    logger.warning("Failed to summarize inline foundational text: %s", e)
            elif foundational_s3_key:
                try:
                    raw_bytes = load_bytes_from_s3(self.results_bucket, foundational_s3_key)
                    foundational_text = raw_bytes.decode("utf-8", errors="ignore")
                    analysis_text = summarize_docs_if_needed(self.openai, foundational_text, language, job_id, prompt_service=self.prompt_service)
                except Exception as e:
                    logger.warning("Failed to load/summarize foundational doc: %s", e)
            
            # --- 3. Product Detection (Uploaded Images) ---
            # We need to know if uploaded images have product (to avoid double product)
            # Store metadata about uploaded images
            uploaded_images_meta = {}
            uploaded_image_bytes_cache: Dict[str, bytes] = {}
            for uid, details in uploaded_images.items():
                # details might be string (key), or dict with "key" or "url"
                img_bytes = None
                if isinstance(details, str):
                    try:
                        img_bytes = load_bytes_from_s3(self.results_bucket, details)
                    except Exception as e:
                        logger.warning("Failed to load uploaded image %s from S3 key: %s", uid, e)
                elif isinstance(details, dict):
                    if details.get("key"):
                        try:
                            img_bytes = load_bytes_from_s3(self.results_bucket, details["key"])
                        except Exception as e:
                            logger.warning("Failed to load uploaded image %s from S3 key: %s", uid, e)
                    elif details.get("url"):
                        img_bytes = self._download_image_bytes_from_url(details["url"])

                if img_bytes:
                    uploaded_image_bytes_cache[uid] = img_bytes
                    try:
                        has_product = detect_product_in_image(self.openai, img_bytes, job_id, prompt_service=self.prompt_service)
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
                
            # Handle forcedReferenceImageIds: round-robin assign forced IDs to slots
            forced_ids = payload.get("forcedReferenceImageIds")
            if forced_ids and isinstance(forced_ids, list):
                assignments = {}
                all_slots = []
                for angle in marketing_angles:
                    a_num = str(angle.get("angle_number"))
                    for var in angle.get("visual_variations", []):
                        v_num = str(var.get("variation_number"))
                        all_slots.append(f"{a_num}:{v_num}")
                for idx, slot in enumerate(all_slots):
                    assignments[slot] = forced_ids[idx % len(forced_ids)]
                logger.info("Applied %d forced reference image assignments (skipped AI matching)", len(assignments))
            else:
                assignments = match_angles_to_images(
                    self.openai,
                    marketing_angles,
                    marketing_avatar,
                    match_pool,
                    job_id,
                    prompt_service=self.prompt_service
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
                        # Check byte cache first (populated during product detection)
                        if assigned_id in uploaded_image_bytes_cache:
                            ref_bytes = uploaded_image_bytes_cache[assigned_id]
                            ref_is_uploaded = True
                        elif assigned_id in uploaded_images:
                            # Load from uploaded_images (S3 key or URL)
                            u_det = uploaded_images[assigned_id]
                            if isinstance(u_det, str):
                                ref_bytes = load_bytes_from_s3(self.results_bucket, u_det)
                            elif isinstance(u_det, dict) and u_det.get("key"):
                                ref_bytes = load_bytes_from_s3(self.results_bucket, u_det["key"])
                            elif isinstance(u_det, dict) and u_det.get("url"):
                                ref_bytes = self._download_image_bytes_from_url(u_det["url"])
                            ref_is_uploaded = True
                        else:
                            # Load from library prefix
                            norm_id = normalize_image_id(assigned_id)
                            lib_key = f"{self.image_library_prefix}{norm_id}"
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
                        
                        if image_provider == "google":
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
                                job_id,
                                prompt_service=self.prompt_service
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
                                job_id,
                                prompt_service=self.prompt_service
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
            result_payload = {
                "job_id": job_id,
                "results": results,
                "count": len(results),
            }

            result_key = f"results/image-gen/{job_id}/image_gen_results.json"
            save_json_to_s3(self.results_bucket, result_key, result_payload)

            update_job_status(job_id, "COMPLETED_IMAGE_GEN")

            return {
                "statusCode": 200,
                "body": json.dumps(result_payload),
            }
            
        except Exception as e:
            logger.error("Pipeline failed: %s", traceback.format_exc())
            update_job_status(job_id, "FAILED_IMAGE_GEN", {"error": str(e)})
            raise
