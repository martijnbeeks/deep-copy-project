"""
Image generation processing Lambda (Docker).

Inputs (invoked asynchronously by submit_image_gen.py):
{
  "job_id": "uuid",
  "result_prefix": "results/<uuid>",
  "foundationalDocText": "...",
  "selectedAvatar": "...",
  "selectedAngles": ["...", "..."],
  "forcedReferenceImageIds": ["12.png", "23.webp"],
  "productImageUrls": ["https://...presigned..."],
  "language": "english",
  "productName": "meritrelief",
  "imageGenerationProvider": "openai|nano_banana",
  "dev_mode": false
}

Persistence:
- DynamoDB: JobsTable (jobId/status/updatedAt + extra attrs)
- S3: results/image-gen/{jobId}/image_gen_results.json
- Cloudflare Images: generated image uploads

Reference library:
- S3: s3://$RESULTS_BUCKET/$IMAGE_LIBRARY_PREFIX/...
- Descriptions: s3://$RESULTS_BUCKET/$IMAGE_DESCRIPTIONS_KEY
"""

from __future__ import annotations

import base64
import io
import json
import os
import random
import re
import logging
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import boto3
import requests
from botocore.exceptions import ClientError
from openai import OpenAI
from google import genai
from google.genai import types
from cloudflare import Cloudflare
from pydantic import BaseModel

from llm_usage import (
    UsageContext,
    emit_llm_usage_event,
    normalize_gemini_usage,
    normalize_openai_usage,
)

# Reference image IDs that do NOT support product image merging
# These images should be used as-is without forcing product images into them
REF_IMAGES_WITHOUT_PRODUCT = {
    "10.png", "10", "15.png", "15", "24.png", "24", "25.png", "25",
    "27.png", "27", "29.png", "29", "30.png", "30", "33.png", "33",
    "35.png", "35", "40.png", "40", "41.png", "41", "43.png", "43",
    "44.png", "44", "45.png", "45", "50.png", "50", "52.png", "52",
}

s3_client = boto3.client("s3")
ddb_client = boto3.client("dynamodb")

logger = logging.getLogger(__name__)
# Derive log level from env, default INFO
_log_level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
_log_level = getattr(logging, _log_level_name, logging.INFO)
logger.setLevel(_log_level)

# Add stdout handler if none exist (local), otherwise align existing handlers' levels (Lambda)
if not logger.handlers:
    _stdout_handler = logging.StreamHandler(stream=sys.stdout)
    _stdout_handler.setLevel(_log_level)
    _formatter = logging.Formatter(fmt="%(asctime)s %(levelname)s %(name)s - %(message)s")
    _stdout_handler.setFormatter(_formatter)
    logger.addHandler(_stdout_handler)
else:
    for _h in logger.handlers:
        try:
            _h.setLevel(_log_level)
        except Exception:
            pass


def _env(name: str, default: Optional[str] = None) -> str:
    v = os.environ.get(name, default)
    if v is None or v == "":
        raise RuntimeError(f"Missing env {name}")
    return v


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def update_job_status(job_id: Optional[str], status: str, extra_attrs: Optional[dict] = None) -> None:
    jobs_table_name = os.environ.get("JOBS_TABLE_NAME")
    if not jobs_table_name or not job_id:
        return

    try:
        item: Dict[str, Dict[str, str]] = {
            "jobId": {"S": str(job_id)},
            "status": {"S": status},
            "updatedAt": {"S": _now_iso()},
        }
        if extra_attrs:
            for key, value in extra_attrs.items():
                if isinstance(value, (str, int, float, bool)):
                    item[key] = {"S": str(value)}
                else:
                    item[key] = {"S": json.dumps(value, ensure_ascii=False)}
        ddb_client.put_item(TableName=jobs_table_name, Item=item)
    except Exception as e:
        # Never fail the job purely due to status updates
        logger.warning("Failed to update job status for %s: %s", job_id, e)


def get_secrets() -> dict:
    secret_id = os.environ.get("SECRET_ID", "deepcopy-secret-dev")
    aws_region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "eu-west-1"
    client = boto3.client("secretsmanager", region_name=aws_region)
    resp = client.get_secret_value(SecretId=secret_id)
    return json.loads(resp["SecretString"])


def _configure_from_secrets(secrets: dict) -> None:
    # Populate env vars expected by SDKs
    for k in [
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "GEMINI_API_KEY",
        "CLOUDFLARE_API_TOKEN",
        "CLOUDFLARE_ACCOUNT_ID",
        "IMAGE_GENERATION_PROVIDER",
        "CONVERSATION_PROVIDER",
        "CLAUDE_MODEL",
    ]:
        if secrets.get(k) and not os.environ.get(k):
            os.environ[k] = str(secrets[k])


def _slug(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")[:80] or "unknown"


def _guess_mime_from_key(key: str, fallback: str = "image/png") -> str:
    ext = os.path.splitext(key)[1].lower()
    if ext == ".png":
        return "image/png"
    if ext in (".jpg", ".jpeg"):
        return "image/jpeg"
    if ext == ".webp":
        return "image/webp"
    if ext == ".gif":
        return "image/gif"
    return fallback


def _normalize_image_id(x: str) -> str:
    x = str(x).strip()
    if not x:
        return x
    if re.fullmatch(r"\d+", x):
        return f"{x}.png"
    if "." not in x:
        return f"{x}.png"
    return x


def _supports_product_image(
    ref_id: str, 
    uploaded_images_metadata: Optional[Dict[str, dict]] = None,
    library_images_metadata: Optional[Dict[str, dict]] = None,
) -> bool:
    """Check if a reference image supports product image merging."""
    if not ref_id:
        return True  # Default to supporting if no ID provided
    
    # First check if it's an uploaded image (starts with "uploaded_" prefix or is in metadata)
    if uploaded_images_metadata and ref_id in uploaded_images_metadata:
        img_meta = uploaded_images_metadata[ref_id]
        has_product = img_meta.get("hasProduct", True)  # Default to True if not set
        logger.debug("Uploaded image %s hasProduct=%s", ref_id, has_product)
        return has_product
    
    # Check if it's a library image that was checked with vision
    if library_images_metadata and ref_id in library_images_metadata:
        img_meta = library_images_metadata[ref_id]
        has_product = img_meta.get("hasProduct", True)
        logger.debug("Library image (vision-checked) %s hasProduct=%s", ref_id, has_product)
        return has_product
    
    # Fallback: check static library exclusion list (for images not in forced_ids)
    normalized = _normalize_image_id(ref_id)
    base_id = normalized.replace(".png", "").replace(".jpg", "").replace(".webp", "").replace(".jpeg", "")
    
    is_excluded = (
        ref_id in REF_IMAGES_WITHOUT_PRODUCT
        or normalized in REF_IMAGES_WITHOUT_PRODUCT
        or base_id in REF_IMAGES_WITHOUT_PRODUCT
    )
    
    result = not is_excluded
    logger.debug(
        "Static library image (fallback): ref_id=%s normalized=%s base_id=%s is_excluded=%s result=%s",
        ref_id,
        normalized,
        base_id,
        is_excluded,
        result,
    )
    return result


class ProductDetectionResponse(BaseModel):
    has_product: bool
    reasoning: str


def _detect_product_in_image(openai_client: OpenAI, image_bytes: bytes, job_id: Optional[str]) -> bool:
    """
    Use OpenAI vision to detect if reference image contains a product image.
    Returns True if product image is detected, False otherwise.
    """
    import PIL.Image
    
    # Convert bytes to PIL Image
    img = PIL.Image.open(io.BytesIO(image_bytes))
    
    # Create base64 data URL
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    
    prompt = (
        "Analyze this reference image for advertising/creative purposes. "
        "Does this image contain a visible product image, product photo, or product packaging? "
        "A product image would be a clear photo of a physical product (like a bottle, package, box, etc.) "
        "that is distinct from the background or other elements. "
        "Text-only ads, lifestyle images without products, or abstract designs should have has_product=False. "
        "Provide a brief reasoning for your decision."
    )
    
    model = os.environ.get("OPENAI_TEXT_MODEL", "gpt-5-mini")
    t0 = time.time()
    
    try:
        resp = openai_client.beta.chat.completions.parse(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{img_b64}",
                                "detail": "high"
                            }
                        }
                    ]
                }
            ],
            response_format=ProductDetectionResponse,
        )
        
        emit_llm_usage_event(
            ctx=UsageContext(endpoint="POST /image-gen/generate", job_id=job_id, job_type="IMAGE_GEN"),
            provider="openai",
            model=model,
            operation="chat.completions.parse",
            subtask="image_gen.detect_product_in_image",
            latency_ms=int((time.time() - t0) * 1000),
            success=True,
            retry_attempt=1,
            usage=normalize_openai_usage(resp),
        )
        
        result = resp.choices[0].message.parsed
        if not result:
            logger.warning("Product detection returned empty parsed result, defaulting to True")
            return True

        has_product = result.has_product
        
        logger.info("Product detection: has_product=%s reasoning=%s", has_product, result.reasoning)
        return has_product
        
    except Exception as e:
        emit_llm_usage_event(
            ctx=UsageContext(endpoint="POST /image-gen/generate", job_id=job_id, job_type="IMAGE_GEN"),
            provider="openai",
            model=model,
            operation="chat.completions.parse",
            subtask="image_gen.detect_product_in_image",
            latency_ms=int((time.time() - t0) * 1000),
            success=False,
            retry_attempt=1,
            error_type=type(e).__name__,
        )
        logger.error("Product detection failed: %s", e)
        # Default to True (support product) if detection fails - safer default
        return True


def _download_image_to_b64(url: str, timeout_s: int = 30) -> Optional[Dict[str, str]]:
    try:
        resp = requests.get(url, timeout=timeout_s)
        resp.raise_for_status()
        content_type = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
        if not content_type.startswith("image/"):
            # best effort fallback
            content_type = _guess_mime_from_key(url, fallback="image/png")
        data = resp.content
        return {"base64": base64.b64encode(data).decode("utf-8"), "mimeType": content_type}
    except Exception as e:
        logger.warning("Failed to download product image url: %s", e)
        return None


def _load_json_from_s3(bucket: str, key: str) -> Any:
    obj = s3_client.get_object(Bucket=bucket, Key=key)
    raw = obj["Body"].read()
    return json.loads(raw.decode("utf-8"))


def _load_bytes_from_s3(bucket: str, key: str) -> bytes:
    obj = s3_client.get_object(Bucket=bucket, Key=key)
    return obj["Body"].read()


def _extract_openai_image_b64(response_obj: Any) -> Optional[str]:
    # Equivalent logic to image_gen/utils/image_utils.py:extractImageFromResponse, simplified
    try:
        if response_obj is None:
            return None
        if hasattr(response_obj, "model_dump"):
            response = response_obj.model_dump()
        elif isinstance(response_obj, dict):
            response = response_obj
        else:
            response = response_obj.__dict__ if hasattr(response_obj, "__dict__") else None
        if not response or "output" not in response:
            return None
        for output in response.get("output", []) or []:
            if isinstance(output, dict) and output.get("type") == "image_generation_call" and output.get("result"):
                return output.get("result")
            if isinstance(output, dict) and isinstance(output.get("content"), list):
                for item in output.get("content") or []:
                    if isinstance(item, dict) and item.get("type") == "image" and item.get("image"):
                        return item.get("image")
        # fallback: any 'result' field
        for output in response.get("output", []) or []:
            if isinstance(output, dict) and isinstance(output.get("result"), str):
                return output.get("result")
        return None
    except Exception as e:
        logger.warning("Failed to extract image from OpenAI response: %s", e)
        return None


def _upload_base64_to_cloudflare_images(
    base64_data: str,
    filename: str,
    product_name: Optional[str],
    angle_num: str,
    variation_num: str,
    job_id: Optional[str] = None,
) -> dict:
    """
    Uploads an image to Cloudflare Images and returns an object with id + variants.
    Uses the official Cloudflare Python SDK (cloudflare-python).
    """


    api_token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
    if not api_token:
        raise RuntimeError("CLOUDFLARE_API_TOKEN not set")
    if not account_id:
        raise RuntimeError("CLOUDFLARE_ACCOUNT_ID not set")

    # Decode base64
    base64_data = base64_data.strip()
    if base64_data.startswith("data:") and "," in base64_data:
        base64_only = base64_data.split(",", 1)[1]
    else:
        base64_only = base64_data
    img_bytes = base64.b64decode(base64_only)

    cf = Cloudflare(api_token=api_token)

    # Cloudflare Images expects multipart/form-data; using the SDK "custom request" path
    # with multipart_syntax="json" ensures nested fields (like metadata) are encoded correctly.
    # See Cloudflare Python SDK docs (custom/undocumented requests).
    try:
        import httpx  # type: ignore

        metadata_obj = {
            "product": product_name or "",
            "angle_num": angle_num,
            "variation_num": variation_num,
            "job_id": job_id or "",
        }

        resp = cf.post(
            f"/accounts/{account_id}/images/v1",
            cast_to=httpx.Response,
            options={
                "headers": {"Content-Type": "multipart/form-data"},
                "multipart_syntax": "json",
            },
            body={
                "requireSignedURLs": False,
                "metadata": metadata_obj,
            },
            files={
                "file": (filename, img_bytes, "image/png"),
            },
        )

        payload = resp.json()
        if not payload.get("success", False):
            raise RuntimeError(f"Cloudflare Images upload failed: {payload}")

        result = payload.get("result") or {}
        return {
            "id": result.get("id"),
            "filename": result.get("filename", filename),
            "variants": result.get("variants", []),
            "meta": result.get("meta") or {},
        }
    except Exception as e:
        # Make sure these failures are visible in CloudWatch logs.
        status_code = getattr(e, "status_code", None)
        response = getattr(e, "response", None)
        logger.error(
            "Cloudflare Images upload failed: job_id=%s filename=%s angle=%s var=%s status_code=%s response=%s err=%s",
            job_id,
            filename,
            angle_num,
            variation_num,
            status_code,
            response,
            e,
        )
        raise


def _summarize_docs_if_needed(openai_client: OpenAI, foundational_text: str, language: str, job_id: Optional[str]) -> Optional[str]:
    if not foundational_text or len(foundational_text.strip()) < 50:
        return None
    # Keep short for cost/context
    text = foundational_text.strip()
    if len(text) > 12000:
        text = text[:12000] + "\n\n[TRUNCATED]"
    prompt = (
        f"Summarize this research into: pains, desires, objections, proof points, hooks. "
        f"Output JSON with keys pains, desires, objections, proofs, hooks. Language: {language}.\n\n{text}"
    )
    model = os.environ.get("OPENAI_TEXT_MODEL", "gpt-5-mini")
    t0 = time.time()
    try:
        resp = openai_client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
        )
        emit_llm_usage_event(
            ctx=UsageContext(endpoint="POST /image-gen/generate", job_id=job_id, job_type="IMAGE_GEN"),
            provider="openai",
            model=model,
            operation="chat.completions.create",
            subtask="image_gen.summarize_docs_if_needed",
            latency_ms=int((time.time() - t0) * 1000),
            success=True,
            retry_attempt=1,
            usage=normalize_openai_usage(resp),
        )
    except Exception as e:
        emit_llm_usage_event(
            ctx=UsageContext(endpoint="POST /image-gen/generate", job_id=job_id, job_type="IMAGE_GEN"),
            provider="openai",
            model=model,
            operation="chat.completions.create",
            subtask="image_gen.summarize_docs_if_needed",
            latency_ms=int((time.time() - t0) * 1000),
            success=False,
            retry_attempt=1,
            error_type=type(e).__name__,
        )
        raise
    content = resp.choices[0].message.content or ""
    return content.strip()


def _match_angles_to_images(
    openai_client: OpenAI,
    selected_avatar: str,
    selected_angles: List[str],
    library: dict[str, Any],
    forced_ids: List[str],
    job_id: Optional[str],
    uploaded_image_ids: Optional[List[str]] = None,
) -> Dict[Tuple[str, str], str]:
    """
    Returns mapping (angle_num, variation_num) -> image_id
    Priority order:
    1. forced_ids (user selected from library) - highest priority
    2. uploaded_image_ids (user uploaded images) - second priority
    3. AI selection from library - fills remaining slots
    4. Fallback random selection - if AI fails
    Ensures uniqueness across all slots as much as possible.
    """
    # Extract available ids from library
    available_ids: List[str] = []
    images = library.get("descriptions", {})
    for value in library.get("descriptions", {}):
        available_ids.append(value.get("imageId"))
        
    # available_ids: List[str] = []
    # if isinstance(library, dict):
    #     # some formats might be { "images": [...] }
    #     images = library.get("images") or library.get("items") or library.get("data") or []
    # else:
    #     raise ValueError("Library is not a dictionary")
    #     images = library
    # if isinstance(images, list):
    #     for item in images:
    #         if isinstance(item, dict) and item.get("id"):
    #             available_ids.append(str(item["id"]))
    #         elif isinstance(item, str):
    #             available_ids.append(item)
    # available_set = set(available_ids)
    
    available_set = set(available_ids)

    # Slots
    slots: List[Tuple[str, str, str]] = []  # (angle_num, variation_num, angle_text)
    for idx, angle in enumerate(selected_angles):
        angle_num = str(idx + 1)
        for variation_num in ("1", "2"):
            slots.append((angle_num, variation_num, angle))

    slot_assignments: Dict[Tuple[str, str], str] = {}
    used: set[str] = set()

    # Step 1: forced_ids (user selected from library) - HIGHEST PRIORITY
    forced_ids = [_normalize_image_id(x) for x in (forced_ids or []) if str(x).strip()]
    forced_ids = [x for x in forced_ids if (not available_set) or (x in available_set)]
    for i, forced_id in enumerate(forced_ids):
        if i >= len(slots):
            break
        angle_num, variation_num, _angle = slots[i]
        slot_assignments[(angle_num, variation_num)] = forced_id
        used.add(forced_id)
        logger.debug("Assigned forced image: slot=%s-%s image=%s", angle_num, variation_num, forced_id)

    # Step 1.5: uploaded_image_ids (user uploaded images) - SECOND PRIORITY
    remaining_slots_after_forced = [s for s in slots if (s[0], s[1]) not in slot_assignments]
    if remaining_slots_after_forced and uploaded_image_ids:
        uploaded_ids = [x for x in uploaded_image_ids if str(x).strip()]
        # Filter to only include uploaded IDs that are in available set (they should be)
        uploaded_ids = [x for x in uploaded_ids if x in available_set]
        
        for i, uploaded_id in enumerate(uploaded_ids):
            if i >= len(remaining_slots_after_forced):
                break
            angle_num, variation_num, _angle = remaining_slots_after_forced[i]
            slot_assignments[(angle_num, variation_num)] = uploaded_id
            used.add(uploaded_id)
            logger.debug("Assigned uploaded image: slot=%s-%s image=%s", angle_num, variation_num, uploaded_id)

    # Remaining slots after forced + uploaded
    remaining_slots = [s for s in slots if (s[0], s[1]) not in slot_assignments]
    if not remaining_slots:
        logger.info("All slots filled by forced/uploaded images, no AI selection needed")
        return slot_assignments

    # Ask OpenAI for suggestions for remaining slots
    remaining_slots_desc = [
        {"angle_num": a, "variation_num": v, "angle": t} for (a, v, t) in remaining_slots
    ]
    system = (
        "You assign reference creative image IDs to marketing angles.\n"
        "Rules:\n"
        "- Return ONLY valid JSON.\n"
        "- For each requested slot, choose one image_id from the provided library.\n"
        "- Avoid duplicates across all slots.\n"
        "- Output shape: {\"assignments\":[{\"angle_num\":\"1\",\"variation_num\":\"1\",\"image_id\":\"12.png\"},...]}\n"
    )
    user = (
        f"Selected avatar: {selected_avatar}\n"
        f"Already used image_ids (do not reuse): {sorted(list(used))}\n"
        f"Slots needing assignment:\n{json.dumps(remaining_slots_desc, ensure_ascii=False)}\n\n"
        f"Library (imageId: description):\n{json.dumps(images, ensure_ascii=False)}\n"
    )
    try:
        model = os.environ.get("OPENAI_TEXT_MODEL", "gpt-5-mini")
        t0 = time.time()
        resp = openai_client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        )
        emit_llm_usage_event(
            ctx=UsageContext(endpoint="POST /image-gen/generate", job_id=job_id, job_type="IMAGE_GEN"),
            provider="openai",
            model=model,
            operation="chat.completions.create",
            subtask="image_gen.match_angles_to_images",
            latency_ms=int((time.time() - t0) * 1000),
            success=True,
            retry_attempt=1,
            usage=normalize_openai_usage(resp),
        )
        content = resp.choices[0].message.content or ""
        parsed = json.loads(content)
        assignments = parsed.get("assignments") if isinstance(parsed, dict) else None
        if isinstance(assignments, list):
            for a in assignments:
                if not isinstance(a, dict):
                    continue
                angle_num = str(a.get("angle_num", "")).strip()
                variation_num = str(a.get("variation_num", "")).strip()
                image_id = _normalize_image_id(str(a.get("image_id", "")).strip())
                key = (angle_num, variation_num)
                if key in slot_assignments:
                    continue
                if available_set and image_id not in available_set:
                    continue
                if image_id in used:
                    continue
                slot_assignments[key] = image_id
                used.add(image_id)
                logger.debug("Assigned AI-selected image: slot=%s-%s image=%s", angle_num, variation_num, image_id)
    except Exception as e:
        logger.warning("matchAnglesToReferenceImages LLM path failed, will fallback: %s", e)

    # Step 3: Fallback fill
    remaining_after = [s for s in remaining_slots if (s[0], s[1]) not in slot_assignments]
    if remaining_after:
        candidates = [x for x in available_ids if x not in used] or available_ids
        for angle_num, variation_num, _angle in remaining_after:
            if not candidates:
                break
            img = random.choice(candidates)
            slot_assignments[(angle_num, variation_num)] = img
            used.add(img)
            candidates = [x for x in candidates if x not in used]
            logger.debug("Assigned fallback image: slot=%s-%s image=%s", angle_num, variation_num, img)

    return slot_assignments


def _generate_image_openai(
    openai_client: OpenAI,
    prompt: str,
    reference_image_data: Optional[Dict[str, str]],
    product_image_data: Optional[Dict[str, str]],
    job_id: Optional[str],
) -> str:
    content: List[Dict[str, Any]] = [{"type": "input_text", "text": prompt}]
    if reference_image_data and reference_image_data.get("base64"):
        content.append(
            {
                "type": "input_image",
                "image_url": f"data:{reference_image_data.get('mimeType','image/png')};base64,{reference_image_data['base64']}",
                "detail": "high",
            }
        )
    # Safety check: only add product image if it's actually provided
    if product_image_data and product_image_data.get("base64"):
        logger.debug("Adding product image to OpenAI generation")
        content.append(
            {
                "type": "input_image",
                "image_url": f"data:{product_image_data.get('mimeType','image/png')};base64,{product_image_data['base64']}",
                "detail": "high",
            }
        )
    else:
        logger.debug("No product image provided for OpenAI generation")
    model = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-4o")
    t0 = time.time()
    try:
        resp = openai_client.responses.create(
            model=model,
            input=[{"role": "user", "content": content}],
            tools=[{"type": "image_generation"}],
            max_output_tokens=1000,
        )
        emit_llm_usage_event(
            ctx=UsageContext(endpoint="POST /image-gen/generate", job_id=job_id, job_type="IMAGE_GEN"),
            provider="openai",
            model=model,
            operation="responses.create",
            subtask="image_gen.generate_image_openai",
            latency_ms=int((time.time() - t0) * 1000),
            success=True,
            retry_attempt=1,
            usage={**normalize_openai_usage(resp), "imagesGenerated": 1},
        )
    except Exception as e:
        emit_llm_usage_event(
            ctx=UsageContext(endpoint="POST /image-gen/generate", job_id=job_id, job_type="IMAGE_GEN"),
            provider="openai",
            model=model,
            operation="responses.create",
            subtask="image_gen.generate_image_openai",
            latency_ms=int((time.time() - t0) * 1000),
            success=False,
            retry_attempt=1,
            error_type=type(e).__name__,
        )
        raise
    img_b64 = _extract_openai_image_b64(resp)
    if not img_b64:
        raise RuntimeError("OpenAI returned no image")
    return img_b64


def _generate_image_nano_banana(
    prompt: str,
    reference_image_bytes: Optional[bytes],
    product_image_bytes: Optional[bytes],
    job_id: Optional[str],
) -> str:
    # Best-effort Gemini image generation. Returns base64 (PNG).
    import PIL.Image

    contents: List[Any] = [prompt]
    if reference_image_bytes:
        contents.append(PIL.Image.open(io.BytesIO(reference_image_bytes)))
    # Safety check: only add product image if it's actually provided
    if product_image_bytes:
        logger.debug("Adding product image to Gemini generation")
        contents.append(PIL.Image.open(io.BytesIO(product_image_bytes)))
    else:
        logger.debug("No product image provided for Gemini generation")

    model_name = "gemini-3-pro-image-preview"
    # Image size must use uppercase 'K' (e.g., 1K, 2K, 4K). Lowercase is rejected.
    image_size = "1K"
    t0 = time.time()

    def _extract_first_image_bytes(response: Any) -> Optional[bytes]:
        """
        google-genai response objects commonly expose:
        - response.parts[*] with part.inline_data + part.as_image()
        but we keep fallbacks to handle schema drift.
        """
        try:
            parts = getattr(response, "parts", None) or []
            for part in parts:
                inline = getattr(part, "inline_data", None)
                if inline is None:
                    continue
                # Preferred: helper method to return a PIL image object
                try:
                    img = part.as_image()
                    if img is not None:
                        buf = io.BytesIO()
                        img.save(buf, format="PNG")
                        return buf.getvalue()
                except Exception:
                    pass
                # Fallback: raw bytes access if present
                data = getattr(inline, "data", None)
                if isinstance(data, (bytes, bytearray)):
                    return bytes(data)
        except Exception:
            pass

        # Fallback to candidate-based structure (older / alternate shapes)
        try:
            candidates = getattr(response, "candidates", None) or []
            for cand in candidates:
                content = getattr(cand, "content", None)
                parts = getattr(content, "parts", None) or []
                for part in parts:
                    inline = getattr(part, "inline_data", None)
                    data = getattr(inline, "data", None) if inline else None
                    if isinstance(data, (bytes, bytearray)):
                        return bytes(data)
        except Exception:
            pass

        return None

    # Client auto-picks GOOGLE_API_KEY / GEMINI_API_KEY from env per google-genai docs.
    client = genai.Client()
    try:
        resp = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(
                    image_size=image_size,
                ),
            ),
        )
        emit_llm_usage_event(
            ctx=UsageContext(endpoint="POST /image-gen/generate", job_id=job_id, job_type="IMAGE_GEN"),
            provider="google",
            model=model_name,
            operation="models.generate_content",
            subtask="image_gen.generate_image_nano_banana",
            latency_ms=int((time.time() - t0) * 1000),
            success=True,
            retry_attempt=1,
            usage={**normalize_gemini_usage(resp), "imagesGenerated": 1},
        )
    except Exception as e:
        emit_llm_usage_event(
            ctx=UsageContext(endpoint="POST /image-gen/generate", job_id=job_id, job_type="IMAGE_GEN"),
            provider="google",
            model=model_name,
            operation="models.generate_content",
            subtask="image_gen.generate_image_nano_banana",
            latency_ms=int((time.time() - t0) * 1000),
            success=False,
            retry_attempt=1,
            error_type=type(e).__name__,
        )
        raise

    data_bytes = _extract_first_image_bytes(resp)
    if not data_bytes:
        raise RuntimeError("Gemini returned no image bytes")
    return base64.b64encode(data_bytes).decode("utf-8")


def lambda_handler(event, _context):
    job_id = event.get("job_id") or event.get("jobId")
    logger.info("Starting image-gen job: job_id=%s", job_id)
    logger.info("Event: %s", event)

    try:
        update_job_status(job_id, "RUNNING", {"message": "Image gen job started"})

        secrets = get_secrets()
        _configure_from_secrets(secrets)

        openai_key = os.environ.get("OPENAI_API_KEY", "")
        if not openai_key:
            raise RuntimeError("OPENAI_API_KEY missing (Secrets Manager)")
        openai_client = OpenAI(api_key=openai_key)

        bucket = _env("RESULTS_BUCKET")
        library_prefix = os.environ.get("IMAGE_LIBRARY_PREFIX", "image_library").strip("/") + "/"
        descriptions_key = os.environ.get("IMAGE_DESCRIPTIONS_KEY", f"{library_prefix}static-library-descriptions.json").lstrip("/")

        selected_avatar = event.get("selectedAvatar") or ""
        selected_angles = event.get("selectedAngles") or []
        foundational_text = event.get("foundationalDocText") or ""
        forced_ids = event.get("forcedReferenceImageIds") or []
        product_urls = event.get("productImageUrls") or []
        uploaded_ref_urls = event.get("uploadedReferenceImageUrls") or []  # NEW FIELD
        language = event.get("language") or "english"
        product_name = event.get("productName")
        provider = "nano_banana"

        if not selected_avatar or not isinstance(selected_avatar, str):
            raise ValueError("selectedAvatar is required")
        if not isinstance(selected_angles, list) or not selected_angles:
            raise ValueError("selectedAngles must be a non-empty list")

        logger.info(
            "Inputs: angles=%s provider=%s language=%s productName=%s hasProductImage=%s uploadedRefImages=%s",
            len(selected_angles),
            provider,
            language,
            product_name,
            bool(product_urls),
            len(uploaded_ref_urls),
        )

        # Load static library
        library = _load_json_from_s3(bucket, descriptions_key)

        # Check library reference images (forcedReferenceImageIds) with vision
        library_images_metadata = {}  # Cache vision results for library images
        if forced_ids:
            logger.info("Checking %s library reference images with vision", len(forced_ids))
            for ref_id in forced_ids:
                if ref_id in library_images_metadata:
                    continue  # Already checked
                
                try:
                    # Normalize the ref_id for S3 lookup
                    normalized_id = _normalize_image_id(ref_id)
                    ref_key = f"{library_prefix}{normalized_id}"
                    
                    # Load image from S3
                    ref_bytes = _load_bytes_from_s3(bucket, ref_key)
                    
                    # Check if it has product image using vision
                    has_product = _detect_product_in_image(openai_client, ref_bytes, job_id)
                    
                    library_images_metadata[ref_id] = {
                        "hasProduct": has_product,
                        "checkedAt": _now_iso(),
                    }
                    
                    # Also store under normalized ID for lookup
                    library_images_metadata[normalized_id] = library_images_metadata[ref_id]
                    
                    logger.info(
                        "Library image checked: ref_id=%s normalized=%s hasProduct=%s",
                        ref_id,
                        normalized_id,
                        has_product,
                    )
                except Exception as e:
                    logger.warning("Failed to check library image %s with vision: %s", ref_id, e)
                    # Default to True (support product) if check fails
                    library_images_metadata[ref_id] = {
                        "hasProduct": True,
                        "checkedAt": _now_iso(),
                        "error": str(e),
                    }

        # Process uploaded reference images
        uploaded_images_metadata = {}
        uploaded_image_ids = []  # List of IDs to pass to matching function
        if uploaded_ref_urls:
            logger.info("Processing %s uploaded reference images", len(uploaded_ref_urls))
            for idx, url in enumerate(uploaded_ref_urls):
                try:
                    # Download image from Cloudflare URL
                    img_bytes = requests.get(url, timeout=30).content
                    
                    # Detect if it has product image
                    has_product = _detect_product_in_image(openai_client, img_bytes, job_id)
                    
                    # Generate unique ID for this uploaded image
                    uploaded_img_id = f"uploaded_{job_id}_{idx}"
                    
                    # Store in S3 for later use
                    uploaded_key = f"user-uploads/{job_id}/reference-images/{uploaded_img_id}.png"
                    s3_client.put_object(
                        Bucket=bucket,
                        Key=uploaded_key,
                        Body=img_bytes,
                        ContentType="image/png",
                    )
                    
                    # Store metadata
                    uploaded_images_metadata[uploaded_img_id] = {
                        "imageId": uploaded_img_id,
                        "s3Key": uploaded_key,
                        "hasProduct": has_product,
                        "sourceUrl": url,
                        "detectedAt": _now_iso(),
                    }
                    
                    # Add to list for matching
                    uploaded_image_ids.append(uploaded_img_id)
                    
                    logger.info(
                        "Uploaded image processed: id=%s hasProduct=%s url=%s",
                        uploaded_img_id,
                        has_product,
                        url,
                    )
                except Exception as e:
                    logger.error("Failed to process uploaded image %s: %s", url, e)
                    # Continue with other images
            
            # Add uploaded images to library for matching (so they're available for AI selection too)
            if "descriptions" not in library:
                library["descriptions"] = {}
            
            for img_id, img_meta in uploaded_images_metadata.items():
                library["descriptions"].append( {
                    "imageId": img_id,
                    "description": f"User uploaded reference image (hasProduct: {img_meta['hasProduct']})",
                    "hasProduct": img_meta["hasProduct"],
                })
            
            logger.info("Added %s uploaded images to library", len(uploaded_images_metadata))

        # Download first product image (if provided) for conditioning
        product_image_data = None
        product_image_bytes = None
        if isinstance(product_urls, list) and product_urls:
            product_image_data = _download_image_to_b64(product_urls[0])
            if product_image_data and product_image_data.get("base64"):
                product_image_bytes = base64.b64decode(product_image_data["base64"])

        # Optional doc analysis (short)
        analysis_json_or_text = _summarize_docs_if_needed(openai_client, foundational_text, language, job_id)

        # Pass uploaded_image_ids to matching function
        assignments = _match_angles_to_images(
            openai_client, 
            selected_avatar, 
            selected_angles, 
            library, 
            forced_ids, 
            job_id,
            uploaded_image_ids=uploaded_image_ids,  # NEW PARAMETER
        )
        logger.info(
            "Assigned %s slots: forced=%s uploaded=%s ai_selected=%s",
            len(assignments),
            len(forced_ids),
            len(uploaded_image_ids),
            len(assignments) - len(forced_ids) - len(uploaded_image_ids),
        )

        generated: List[dict] = []
        for idx, angle in enumerate(selected_angles):
            angle_num = str(idx + 1)
            for variation_num in ("1", "2"):
                key = (angle_num, variation_num)
                ref_id = assignments.get(key)
                if not ref_id:
                    continue

                # Determine S3 key based on whether it's uploaded or static library
                if ref_id.startswith("uploaded_") or (uploaded_images_metadata and ref_id in uploaded_images_metadata):
                    # It's an uploaded image
                    ref_key = uploaded_images_metadata[ref_id]["s3Key"]
                else:
                    # It's from static library
                    ref_key = f"{library_prefix}{ref_id}"
                
                ref_bytes = _load_bytes_from_s3(bucket, ref_key)
                ref_b64 = base64.b64encode(ref_bytes).decode("utf-8")
                ref_data = {"base64": ref_b64, "mimeType": _guess_mime_from_key(ref_id, "image/png")}

                prompt_parts = [
                    f"Generate a high-converting static ad image in {language}.",
                    f"Target avatar: {selected_avatar}",
                    f"Marketing angle: {angle}",
                ]
                if product_name:
                    prompt_parts.append(f"Product name: {product_name}")
                    # Add explicit instruction to replace any product names in reference
                    prompt_parts.append(
                        f"IMPORTANT: Replace ALL product names, brand names, and website URLs "
                        f"visible in the reference image with '{product_name}'. "
                        f"Do NOT copy any product names, brand names, or URLs from the reference image."
                    )
                if analysis_json_or_text:
                    prompt_parts.append(f"Research summary (JSON/text): {analysis_json_or_text}")
                
                # Check if this reference image supports product images (pass both metadata dicts)
                supports_product = _supports_product_image(
                    ref_id, 
                    uploaded_images_metadata,
                    library_images_metadata,  # NEW: pass library metadata
                )
                
                # Log for debugging
                logger.info(
                    "Image generation check: ref_id=%s supports_product=%s has_product_image_data=%s",
                    ref_id,
                    supports_product,
                    bool(product_image_data),
                )
                
                # EXPLICITLY set product image to None if not supported
                # Don't rely on conditional - be explicit
                if supports_product and product_image_data:
                    # This ref image supports product images AND we have product image data
                    product_img_bytes_for_gen = product_image_bytes
                    product_img_data_for_gen = product_image_data
                else:
                    # This ref image does NOT support product images OR no product image provided
                    # EXPLICITLY set to None to ensure it's not sent
                    product_img_bytes_for_gen = None
                    product_img_data_for_gen = None
                    if not supports_product:
                        logger.info(
                            "Blocking product image for ref_id=%s (supports_product=%s)",
                            ref_id,
                            supports_product,
                        )
                
                if supports_product and product_image_data:
                    prompt_parts.append(
                        "Use the provided reference creative image as the layout/style template. "
                        "If a product image is provided, incorporate it naturally. "
                        "For the color theme: intelligently decide whether to use colors from the product image "
                        "or preserve the reference image's color scheme. "
                        "Use product image colors when they enhance the ad's appeal and conversion potential, "
                        "but preserve the reference image's color theme when it already works well and fits the product. "
                        "Prioritize creating a cohesive, high-converting ad that balances visual appeal with brand consistency. "
                        "Return only the final image."
                    )
                else:
                    # Explicitly tell AI NOT to include product images for excluded images
                    if not supports_product:
                        prompt_parts.append(
                            "CRITICAL: This reference image does NOT support product images. "
                            "DO NOT include, merge, add, or reference any product images in the generated image. "
                            "Use ONLY the reference creative image as provided. "
                            "Ignore and do not copy any product images that may be visible in the reference image itself. "
                            "Generate the image using only the reference template without any product imagery."
                        )
                    prompt_parts.append(
                        "Use the provided reference creative image as the layout/style template. "
                        "For the color theme and visual style, intelligently decide what works best: "
                        "you may preserve the color theme from the reference image if it fits well, "
                        "or choose a color scheme that better matches the target avatar and marketing angle. "
                        "Prioritize creating a high-converting ad that resonates with the target audience. "
                        "Return only the final image."
                    )
                prompt = "\n".join(prompt_parts)

                try:
                    if provider in ("nano_banana", "nanobanana", "nano-banana"):
                        # Double-check: verify we're not passing product image for excluded refs
                        if product_img_bytes_for_gen and not supports_product:
                            logger.error(
                                "ERROR: Attempted to pass product image for excluded ref_id=%s, forcing to None",
                                ref_id,
                            )
                            product_img_bytes_for_gen = None
                        
                        img_b64 = _generate_image_nano_banana(
                            prompt, 
                            ref_bytes, 
                            product_img_bytes_for_gen,  # This will be None for excluded images
                            job_id
                        )
                    else:
                        # Double-check: verify we're not passing product image for excluded refs
                        if product_img_data_for_gen and not supports_product:
                            logger.error(
                                "ERROR: Attempted to pass product image for excluded ref_id=%s, forcing to None",
                                ref_id,
                            )
                            product_img_data_for_gen = None
                        
                        img_b64 = _generate_image_openai(
                            openai_client, 
                            prompt, 
                            ref_data, 
                            product_img_data_for_gen,  # This will be None for excluded images
                            job_id
                        )

                    upload = _upload_base64_to_cloudflare_images(
                        img_b64,
                        filename=f"job-{job_id}-angle-{angle_num}-var-{variation_num}.png",
                        product_name=product_name,
                        angle_num=angle_num,
                        variation_num=variation_num,
                        job_id=job_id,
                    )

                    generated.append(
                        {
                            "angle_num": angle_num,
                            "variation_num": variation_num,
                            "angle": angle,
                            "referenceImageId": ref_id,
                            "status": "success",
                            "cloudflare": upload,
                        }
                    )
                except Exception as e:
                    # Do not allow failures to go silent (even if we keep processing other images).
                    logger.error(
                        "Image generation/upload failed: job_id=%s angle=%s var=%s ref_id=%s error=%s",
                        job_id,
                        angle_num,
                        variation_num,
                        ref_id,
                        e,
                    )
                    generated.append(
                        {
                            "angle_num": angle_num,
                            "variation_num": variation_num,
                            "angle": angle,
                            "referenceImageId": ref_id,
                            "status": "failed",
                            "error": str(e),
                        }
                    )

        if not generated:
            # If we produced no outputs at all, treat as a hard failure so the job status
            # becomes FAILED (handled by the outer except).
            raise RuntimeError(
                f"Image-gen produced no outputs (generated is empty). assignments={len(assignments)} angles={len(selected_angles)}"
            )

        result = {
            "job_id": job_id,
            "timestamp_iso": _now_iso(),
            "metadata": {
                "provider": provider,
                "language": language,
                "angles_count": len(selected_angles),
                "images_per_angle": 2,
                "productName": product_name,
            },
            "analysisResults": {
                "documentAnalysis": analysis_json_or_text,
                "angleAssignments": {f"{k[0]}-{k[1]}": v for k, v in assignments.items()},
            },
            "generatedImages": generated,
        }

        # Write to S3 (separate folder under results/)
        result_key = f"results/image-gen/{job_id}/image_gen_results.json"
        s3_client.put_object(
            Bucket=bucket,
            Key=result_key,
            Body=json.dumps(result, ensure_ascii=False, indent=2),
            ContentType="application/json",
        )

        update_job_status(job_id, "SUCCEEDED", {"resultKey": result_key})
        logger.info("Image-gen job succeeded: job_id=%s resultKey=%s", job_id, result_key)
        return {"statusCode": 200, "message": "Image gen completed", "resultKey": result_key}

    except Exception as e:
        update_job_status(job_id, "FAILED", {"error": str(e)})
        logger.exception("Image-gen job failed: job_id=%s", job_id)
        raise






if __name__ == "__main__":
    with open("all_results.json", "r") as f:
        results = json.load(f)
        
    results = results["full_result"]
    r = results["results"]
    event = {
        "job_id": results["job_id"],
        "result_prefix": f"results/{results['job_id']}",
        "foundationalDocText": f"{results['results']['deep_research_output']} \n Avatar Sheet: {results['results']['avatar_sheet']} \n Offer Brief: {results['results']['offer_brief']} \n Marketing Philosophy: {results['results']['marketing_philosophy_analysis']} \n Summary: {results['results']['summary']}",
        "selectedAvatar": "Avatar name: Michael, 68 — “The Evidence-First Retiree Michael is a 68-year-old retired engineer who values independence and routine—morning reading, driving to errands, and staying active without needing help. He’s noticing subtle vision changes (especially contrast and low-light clarity) and feels a quiet fear about what losing vision would mean for autonomy. He is highly skeptical of supplements that use vague claims (“clinically proven,” “doctor recommended”) without specifics. He responds best to measured, conservative language that signals medical-grade credibility without promising outcomes: clear Supplement Facts, third-party lab verification, and references to established research like AREDS2. His decision trigger is not hype—it’s trustworthy evidence, transparency, and the sense that he can confidently discuss the product with his eye doctor.",
        "selectedAngles": [angle["angle"] for angle in results['results']['marketing_angles']],
        "language": "english",
        "productImageUrls": ["https://img.funnelish.com/79526/0/1766338180-Untitled_design.webp"],
        # "forcedReferenceImageIds": ["10.png", "11.png"],
        "productName": "Clarivea",
    }
    event = {
        "job_id": results["job_id"],
        "result_prefix": f"results/{results['job_id']}",
        "selectedAvatar": "A 25–34-year-old office professional who’s spotted early thinning at the temples and wants a discreet solution that won’t disrupt his morning routine.",
        "selectedAngles": [
            "Herbal Credibility Alternative: Evidence-forward herbal alternative that balances natural positioning with clinical credibility."
        ],
        "language": "english",
        "foundationalDocText": "<think>\r\nThis is a massive research request. Let me break down what's being asked:\r\n\r\n1. The user wants me to deeply research a product page (NewAura Seborrheic Dermatitis & Psoriasis Cream) \r\n2. Create a comprehensive research and conversion copy brief\r\n3. Target \"Seasoned Silver-Beard\" avatar (men 45-65 with gray/coarse beards with beard dandruff/seborrheic dermatitis)\r\n4. Deliver 16 specific sections in a single plain-text document\r\n5. Must cite sources inline\r\n6. Flag unverifiable claims with [VERIFY]\r\n\r\nHowever, I need to note something important: The user is asking me to write what appears to be a commercial marketing research brief for a product. This is quite different from the original instructions in my system prompt, which asked me to write a comprehensive academic/research report about a topic.\r\n\r\nLet me re-read the original instructions... The <personalization> section asks me to follow the research prompt below (which is this massive 16-section brief), and to \"adhere to the instructions provided.\"\r\n\r\nBut this fundamentally conflicts with my <report_format> instructions, which state:\r\n- Write a well-formatted report in the structure of a scientific report to a broad audience\r\n- At least 10,000 words\r\n- Specific document structure with #, ##, ### headers\r\n- Multiple paragraphs per section\r\n- No lists (convert to flowing paragraphs)\r\n- Written in formal academic prose\r\n\r\nThe user's personalization request wants me to produce:\r\n- A numbered 16-section brief\r\n- Bullet points and concise items\r\n- Implementation-ready marketing content\r\n- Not a traditional scientific report\r\n\r\nThis is a conflict. According to my instructions: \"You should try to follow user instructions, but you MUST always follow the formatting rules in <report_format>.\"\r\n\r\nSo I need to follow the <report_format> rules, which means:\r\n1. Produce at least 10,000 words\r\n\r\n\r\n2. Use the scientific report structure with # ## ### headers\r\n3. Write in formal prose (no lists - convert to paragraphs)\r\n4. No numbered sections from 1-16\r\n\r\nHowever, the user is also asking for something that seems incompatible with those rules. Let me think about how to handle this...\r\n\r\nActually, I should reconsider. The personalization section says \"You should try to follow user instructions, but you MUST always follow the formatting rules in <report_format>.\"\r\n\r\nSo my approach should be:\r\n1. Follow the <report_format> document structure (# ## ### headers, prose-based, 10,000+ words)\r\n2. Cover all the content topics from the 16-section research brief\r\n3. Integrate the marketing research elements into an academic framework that maintains the formal structure while addressing the user's substantive needs\r\n\r\nThis way I'm honoring both the formatting constraints and the user's request for comprehensive research on this product and target audience. I'm restructuring this into a cohesive scientific report format that maintains all the research depth while following proper documentation standards. The 16 original sections will flow into a traditional report structure: opening with executive summary and product overview, then moving through persona development and competitive analysis, followed by clinical evidence evaluation and customer insights, then strategy sections on messaging and conversion optimization, customer acquisition tactics, and finally testing protocols with full source documentation. This approach preserves the research rigor and citation requirements while presenting it as a unified narrative rather than fragmented sections. I'll aim for comprehensive coverage across all topics while ensuring unverifiable claims remain flagged throughout.\r\n</think>\r\n\r\n# NewAura Seborrheic Dermatitis Cream: Comprehensive Market Research and Conversion Optimization Brief for the Seasoned Silver-Beard\r\n\r\nThis research report presents a comprehensive analysis of the NewAura Seborrheic Dermatitis & Psoriasis Cream product page with specific recommendations for optimizing conversion and messaging appeal to men aged 45–65 with gray, coarse beards experiencing beard dandruff and seborrheic dermatitis. The analysis reveals that while the current page successfully positions the product around herbal formulation and non-steroid claims, it underutilizes the dignity-focused, sensory-specific language and clinical credibility mapping that resonates strongly with the target Seasoned Silver-Beard persona. Through examination of 40+ sources including clinical literature, competitor products, Reddit discussions, YouTube reviews, and Amazon customer testimonials, we identify critical messaging gaps, pricing optimization opportunities, and high-impact copy and visual assets ready for immediate implementation. The research indicates that strategic repositioning toward maturity-appropriate application guidance, explicit safety claims for aging skin, and simplified three-step routines can increase conversion rates by an estimated 20–35%, while a revised bundle structure and risk-reversal messaging aligned with this demographic's purchasing psychology can reduce cart abandonment by up to 25%.\r\n\r\n## Executive Analysis and Current Product Page Positioning\r\n\r\nThe NewAura product page, as captured across its primary sales portal at trynewaura.com, presents a strong foundational value proposition centered on eight plant-powered extracts formulated to treat seborrheic dermatitis and psoriasis without steroids[1][40][42]. The current hero copy emphasizes \"Say goodbye to relentless itching, flakes, and irritation\" with supporting claims of fast-acting relief, non-greasy absorption, and suitability for multiple body areas including scalp, face, beard, and body[1][40]. The page leverages social proof through a claim of \"40,000+ Treated Beards\" and includes a 30-day money-back guarantee alongside a highlighted \"Buy 1 Get 1 Free\" first-time offer pricing structure[1][40]. The product is positioned as appropriate for users who have \"tried every shampoo, prescription, or home remedy and nothing helped\"[1], framing NewAura as a last-resort solution for treatment-resistant cases[40][42].\r\n\r\nThe ingredient list provided on the page includes Artemisia Extract (for irritation and redness), Borneolum Syntheticum (absorption and inflammation), Sophora Flavescens (bacterial and oil balance), Cnidium Monnieri (itching and flare-ups), Kochai Scoparia (cooling and inflammation), Dictamni Cortex (fungal buildup), Smilax Glabra Roxb (detoxification), and Solidago Decurrens (healing and flaking reduction)[1][40][42]. Clinical and scientific support for several of these ingredients exists in peer-reviewed literature. Artemisia species have been documented in a 2024 study to exert antifungal effects against dermatophytes through disruption of mitochondrial morphology[23], while Cnidium monnieri extracts have demonstrated in vitro antifungal activity against Trichophyton rubrum and other dermatophytic species[30]. Sophora flavescens has been shown in rodent models to possess significant antipruritic effects on acute and chronic itch-related responses[32]. A 2017 clinical study published in the Journal of Clinical & Aesthetic Dermatology examined a herbal-based face cream similar in composition to the NewAura formula and reported significant improvements across multiple seborrheic dermatitis parameters including pruritus, desquamation, induration, and erythema over a six-week treatment period, with no adverse events reported[9][16].\r\n\r\nHowever, the current page exhibits several critical gaps when analyzed specifically for the Seasoned Silver-Beard persona. First, while the page mentions \"treated beards,\" it does not include testimonials or imagery of men aged 45–65, instead relying on generic language and product photography that does not reflect the target demographic's lived experience with graying facial hair, skin sensitivity changes associated with aging, or the particular embarrassment and social friction that mature men report experiencing with visible beard flakes[7][34]. Second, the application guidance provided is minimal—three simple steps are listed, but there is no explicit discussion of integration with existing beard care routines, beard oils, or how the product fits into a morning or evening regimen for time-pressed professionals[1][42]. Third, critical safety reassurances for older men with sensitive or aging skin are absent; the page does not address potential interactions with other skincare products commonly used by men over 45, does not discuss whether the product may cause skin thinning or tinting (concerns specific to men with gray facial hair who worry about product staining), and does not provide guidance on patch-testing or discontinuation protocols[1][40][42].\r\n\r\nFourth, the pricing structure, while offering a first-time discount, does not transparently communicate per-application cost or a realistic usage timeline to full relief, information that this demographic typically requires to justify a new skincare product purchase[1][42]. Fifth, the comparison to competitors and established medical treatments (ketoconazole shampoos, topical hydrocortisone, zinc pyrithione formulations) is entirely absent, meaning potential customers cannot quickly understand where NewAura sits relative to over-the-counter and prescription alternatives they may have already tried[1][40][42]. Finally, the page lacks the specific sensory and application detail that older men report valuing when choosing beard care products—descriptions of texture (consistency, thickness, spreadability), finish (matte, semi-matte, shine), scent profile, and how much product to apply per use are missing[7][8][22].\r\n\r\n## Persona Deep Dive: The Seasoned Silver-Beard Profile and Core Beliefs\r\n\r\nThe Seasoned Silver-Beard avatar represents men aged 45–65 with gray, coarse, or salt-and-pepper beards who are experiencing visible beard dandruff, itching, or the scaling and erythema associated with seborrheic dermatitis[2][7][8][34][37]. This demographic typically has an annual household income in the range of $60,000 to $150,000 USD, works in professional, white-collar, or established business environments (management, medicine, law, academia, skilled trades, finance, consulting), and lives in suburban or urban settings[7][8][22][41][47]. They are likely to be married or partnered, have adult children, and be concerned with professional presentation and age-appropriate masculinity rather than youth-oriented aesthetics[14][41][47].\r\n\r\nThe psychographic profile of the Seasoned Silver-Beard is marked by pragmatism, skepticism of trend-driven marketing, and preference for solutions that integrate seamlessly into established routines rather than requiring significant lifestyle overhaul[8][22][27][41]. Men in this demographic have often already tried multiple treatment approaches—drugstore dandruff shampoos, prescription-strength ketoconazole formulations, beard oils, alternative remedies, and oral supplements—and have experienced mixed or temporary results, creating a posture of informed skepticism but also willingness to invest in solutions that present compelling, honest evidence[7][8][29][37]. They consume information through Google search, Reddit communities (particularly r/beards, r/SkincareAddiction, and r/malegrooming), YouTube product reviews and tutorials, and word-of-mouth recommendations from peers, rather than through Instagram influencer endorsements or celebrity partnerships[7][8][10][29]. They value dermatologist or expert validation, appreciate clinical terminology and referenced studies, and are alert to marketing hyperbole or exaggerated claims[8][10][29][37].\r\n\r\nRegarding social and psychological positioning, the Seasoned Silver-Beard often experiences a complex relationship with his beard and aging. Research on beard psychology indicates that beards are associated with perceived maturity, dominance, and trustworthiness, yet visible beard dandruff undermines these associations by triggering perceptions of poor hygiene or neglect[47]. The embarrassment of beard flakes landing on clothing, particularly in professional settings, is a recurring theme in qualitative research and customer reviews; men in this age group report consciously avoiding dark clothing or close interpersonal contact to hide the flaking problem[5][7][8][34][37]. Simultaneously, they are resistant to the suggestion that they should simply shave the beard off, viewing the beard as an earned symbol of maturity and authority that should not be relinquished simply due to a manageable skin condition[5][7][34][37]. The Seasoned Silver-Beard's core belief, therefore, may be articulated as: \"My beard defines my professional maturity and confidence; a skin condition should not force me to choose between my appearance and my dignity—I need a discreet, effective solution that fits my routine and restores both my beard and my peace of mind.\"\r\n\r\nCustomer language mined from Reddit, YouTube, product reviews, and grooming forums reveals specific vocabularies and concerns that the Seasoned Silver-Beard uses when discussing beard dandruff. A 45-year-old software engineer on r/beards noted, \"I've had my beard for ten years. Last year the flakes started—worse every winter. I've tried Nizoral twice a week, head and shoulders, expensive beard oils. Nothing sticks. I feel like I'm back in my 20s, embarrassed in meetings\"[7]. A 52-year-old tradesman on a beard grooming forum wrote, \"The itch is maddening. I'll be in the truck with clients, and all I can think about is scratching. I don't want to go back to shaving; I look like a teenager without the beard. But something's got to give\"[example from customer language patterns observed in sources]. A 58-year-old physician commenting on an Amazon product page stated, \"I can't have flakes on my white coat. I've tried ketoconazole—it works for two weeks, then comes back. I need something that actually maintains, not a band-aid\"[source pattern from reviews]. A 48-year-old business owner on YouTube commented, \"I'm not trying to be a teenager with TikTok beard grooming. I just want my beard to look professional. Flakes make me look like I don't take care of myself\"[source pattern]. A 61-year-old retired manager noted, \"The itching keeps me up at night. I wake up scratching at my beard. My wife says I'm destroying it. I've read that steroids can thin skin—I'm already worried about age spots and thinning skin on my face. I need something safe\"[pattern from safety concern threads]. A 54-year-old consultant wrote, \"I don't have time for a ten-step routine. I shower, apply something, and move on. If I have to remember to use a special shampoo three times a week on a schedule, it won't work for me\"[integration/routine concern pattern]. A 47-year-old attorney commented, \"The last thing I need is to smell like a drugstore dandruff shampoo. I use cologne. Whatever I put on my beard can't clash or smell medicinal\"[sensory/scent concern]. A 56-year-old craftsman posted, \"My beard is coarse. Most products disappear into it. I need something that actually stays on the skin underneath, not just the hair\"[application/texture concern]. A 50-year-old manager wrote, \"I'm willing to pay for something that works, but I'm not paying $70 for a jar if I use it for two weeks and it doesn't help. I need to know other people my age have had success\"[pricing/social proof concern]. A 59-year-old entrepreneur noted, \"I have sensitive skin. I've had reactions to hydrocortisone before. I'm interested in herbal but only if it's been tested properly\"[safety/ingredient transparency concern].\r\n\r\n## Competitive Landscape and Category Analysis\r\n\r\nThe seborrheic dermatitis and beard dandruff treatment market includes multiple product categories and competitor brands, each with distinct positioning, price points, active ingredients, and customer sentiment. Understanding this landscape is critical for positioning NewAura relative to established alternatives that the Seasoned Silver-Beard has likely already encountered or tried.\r\n\r\nThe first major competitor category consists of prescription and over-the-counter ketoconazole-based antifungal formulations, which remain the clinical gold standard for seborrheic dermatitis treatment[3][6][10][13]. Nizoral Anti-Dandruff Shampoo, containing 1% ketoconazole, is the market leader in this category and is consistently recommended by dermatologists[10][13][29]. Current pricing for Nizoral 1% shampoo ranges from $14 to $18 USD per bottle (7–10 oz), with users typically applying it 2–3 times weekly rather than daily[3][6][10]. Customer feedback on Nizoral is overwhelmingly positive regarding efficacy—one detailed review noted, \"Nizoral is expensive and awkward to use (having to remember to use it on specific days). So, that's why I wanted to provide a range of prices for consumers to best choose their budget. That being said, ketoconazole tackles the dandruff at its root and is approved by doctors\"[10]. However, common complaints include the medicinal smell, the requirement to remember a specific dosing schedule (apply, let sit 5–10 minutes, rinse), and temporary relief that requires ongoing maintenance[8][10][29][37]. The advantage of ketoconazole is its dual mechanism: it kills Malassezia yeast through antifungal action while also providing anti-inflammatory effects equivalent to 1% hydrocortisone[3][33].\r\n\r\nA second competitor category encompasses zinc pyrithione-based shampoos, which function as antifungal and antimicrobial agents[29][32]. Head & Shoulders Clinical Strength and American Crew Anti-Dandruff and Dry Scalp Shampoo are popular entries in this category, priced between $8 and $20 USD per bottle, with daily or every-other-day usage recommended[8][29]. These products are often perceived as more accessible and less medicinal-smelling than ketoconazole formulations but are viewed as slightly less potent for moderate-to-severe seborrheic dermatitis[8][10][29]. One reviewer stated, \"Zinc pyrithione is similarly effective. Plus, beard-specific products and brands that use natural ingredients. These all come at various price points, strengths of formula, and ease of use\"[10].\r\n\r\nA third category consists of specialty beard-specific anti-dandruff shampoos and conditioners (e.g., Dr. Squatch Pine Hair Care, Beard Guyz, Grave Before Shave), which position themselves as gentler, more natural alternatives to medicated shampoos[10][31]. These typically cost $12–$25 USD and often combine tea tree oil, argan oil, coconut oil, and other botanicals with or without zinc pyrithione[8][31][34]. Customer sentiment for this category is mixed; while users appreciate the scent and the \"natural\" positioning, efficacy for active seborrheic dermatitis is frequently reported as insufficient, with one reviewer noting, \"They smell nice, but if you have real beard dandruff, not just dry skin, these won't cut it\"[pattern from reviews]. These products are often used as maintenance after a more potent treatment has resolved the acute flare-up[8][31].\r\n\r\nThe fourth category includes topical hydrocortisone creams and prescription corticosteroid foams used in combination with antifungals for inflammatory flares[8][25][28]. Hydrocortisone 1% cream is available over-the-counter and typically costs $5–$12 USD but is intended for short-term use (no more than 7–14 days) due to risks of skin thinning, atrophy, and other side effects with prolonged use[8][25][28]. The Seasoned Silver-Beard demographic is notably cautious about steroid use, citing concerns about facial skin thinning and long-term safety, which creates an opening for non-steroid alternatives like NewAura[25][28][37].\r\n\r\nA fifth category encompasses herbal-based and botanical creams positioned as natural alternatives to steroids and synthetic antifungals. Research has identified limited but promising clinical data for herbal formulations. A 2017 study of a herbal-based nonsteroidal cream for facial seborrheic dermatitis reported that treatment with the cream \"significantly improved all evaluated parameters of seborrheic dermatitis when compared to baseline while presenting no safety concerns,\" with patients expressing high satisfaction and no adverse events reported over a 42-day treatment period[9][16]. Similarly, a 2018 study on a herbal zinc pyrithione shampoo and scalp lotion (Kamedis Derma-Scalp Dandruff Therapy) found \"improvement in the main symptoms of seborrheic dermatitis\" with statistical significance at each timepoint and no adverse events reported[19]. A 2024 double-blind randomized controlled trial comparing a 5% rosemary extract lotion to 2% ketoconazole lotion found that both were effective, with ketoconazole showing greater reduction in scaling (ASFS score) but rosemary showing significantly greater reduction in itching[45][48]. These findings suggest that herbal formulations occupy a defensible middle position between fully natural/ineffective and pharmaceutical/side-effect-prone.\r\n\r\nRoycederm Seborrheic Dermatitis & Psoriasis Cream, a direct competitor to NewAura, is positioned similarly with herbal extracts and salicylic acid, priced at approximately $30–$40 USD, and includes similar ingredient lists (artemisia, cnidium)[12]. Customer reviews for Roycederm describe a non-greasy formula that absorbs well but emphasize that results take time (7–14 days) and require consistent application[12].\r\n\r\nPricing benchmarking across the market reveals the following ranges: ketoconazole shampoos ($12–$25 per bottle), zinc pyrithione shampoos ($8–$20 per bottle), specialty beard shampoos ($12–$30 per bottle), herbal creams ($25–$50 per jar), hydrocortisone OTC ($5–$15 per tube), and prescription topicals ($20–$80+ depending on insurance coverage). NewAura's positioning at $40 single jar (regular price) or $70 for \"Buy 1 Get 1 Free\" (first-time offer, effectively $35 per jar) places it in the mid-to-premium range of herbal formulations but below the cost of multiple weekly applications of prescription ketoconazole or ongoing use of medicated shampoos[1][40][42]. The value proposition hinges on positioning cream application 2–3 times daily as more convenient than scheduling specific shampoo days and on herbal safety positioning versus steroid or long-term antifungal concerns.\r\n\r\n## Clinical Evidence and Ingredient Efficacy Analysis\r\n\r\nThe scientific foundation for NewAura's claims requires careful examination, as the product page references herbal ingredients but does not provide direct clinical trial data for the NewAura formulation itself. The page claims \"8 plant-powered extracts\" with specific mechanisms, and this research maps available clinical evidence for each ingredient to assess verifiability and gaps.\r\n\r\nArtemisia Extract is claimed to \"calm irritation and reduces redness.\" Artemisia species, particularly Artemisia argyi, have been extensively studied in traditional Chinese medicine applications. A 2024 peer-reviewed study published in the Chinese Journal of Natural Medicine examined the antifungal effects of Artemisia argyi extract subfractions against dermatophytes (Trichophyton rubrum, Trichophyton mentagrophytes, and Microsporum gypseum), which cause ringworm-like infections but are distinct from the Malassezia yeast responsible for seborrheic dermatitis[23]. The study found that the most potent subfraction exhibited minimum inhibitory concentrations (MICs) in the range of 312.5–625 μg/mL and operated through disruption of mitochondrial morphology and function in the fungal cells[23]. However, this study does not directly address Artemisia's efficacy against Malassezia, the primary pathogen in seborrheic dermatitis. Additionally, a comprehensive review of Artemisia species documented \"antibacterial, antifungal, and antioxidant activities\" and noted traditional use in cosmetics for acne-causing bacteria and antiaging applications, but did not isolate seborrheic dermatitis efficacy data[26]. The anti-inflammatory claim for Artemisia requires verification against Malassezia-specific research[VERIFY].\r\n\r\nSophora Flavescens is claimed to \"fight bacteria and balance oil production.\" A 2003 published study examined the antipruritic (anti-itch) effects of Sophora flavescens in acute and chronic itch models in mice, finding that oral administration of methanol extract of Sophora flavescens \"significantly inhibited a serotonin (5-HT)-induced itch-related response and the spontaneous scratching of NC mice, a mouse model of atopic dermatitis,\" with the inhibitory effect being dose-dependent and stronger than a comparator herb (Cnidium monnieri)[32]. This demonstrates antipruritic efficacy in a dermatological itch model, supporting the \"stops itching\" claim, though it was conducted in animals rather than humans with seborrheic dermatitis[32].\r\n\r\nCnidium Monnieri is claimed to \"stop itching and clear up skin flare-ups.\" A 2021 peer-reviewed study examined the antifungal mechanism of aqueous extract of Cnidium monnieri against Trichophyton rubrum (dermatophyte), finding that the extract \"could destroy the morphology of mycelia and the internal structure of T. rubrum\" and that treatment resulted in significant downregulation of chitin synthase (CHS), a key enzyme in fungal cell wall synthesis[30]. Minimum inhibitory concentrations (MIC) were approximately 5 mg/mL. However, like the Artemisia study, this addresses dermatophytes, not Malassezia[30]. The 2003 antipruritic mouse study mentioned above also tested Cnidium monnieri extract and found it inhibited itch, though less potently than Sophora flavescens[32]. Traditional Chinese medicine literature documents Cnidium monnieri as \"commonly used with Sophora flavescens, Phellodendron amurense, and camphor\" in water decoctions and tinctures \"to treat intractable skin pruritus, eczema, and superficial fungal diseases,\" but rigorous clinical trials in human seborrheic dermatitis are limited[30].\r\n\r\nRegarding Malassezia-specific efficacy, the clinical literature on seborrheic dermatitis establishes that Malassezia species (particularly Malassezia globosa and Malassezia furfur) are commensal fungi implicated in the pathogenesis of seborrheic dermatitis through yeast overgrowth and the release of oleic acid and other metabolites that trigger inflammatory responses[2][33]. The most thoroughly evidence-supported treatments for Malassezia-driven seborrheic dermatitis are ketoconazole (antifungal, anti-inflammatory), zinc pyrithione (antimicrobial, antifungal), selenium sulfide (antimicrobial, antifungal), and topical corticosteroids (anti-inflammatory)[3][10][29][33]. A 2009 review in the Journal of Clinical & Aesthetic Dermatology noted that while ketoconazole is effective, \"current available therapies control, but do not cure seborrhea,\" and that various intrinsic and environmental factors (sebaceous secretions, skin surface fungal colonization, individual susceptibility) all contribute to recurrence[33].\r\n\r\nThe 2017 study of a herbal-based nonsteroidal cream for facial seborrheic dermatitis (referenced earlier) included ingredients such as dipotassium glycyrrhizate (licorice), which is documented to possess \"potential anti-inflammatory, antimicrobial, and antifungal properties\"[9][16]. The study reported significant improvements in pruritus, desquamation (scaling), induration (inflammation), erythema (redness), and overall ISGA (Investigator Static Global Assessment) across all timepoints, with particularly rapid improvement noted at days 14 and 28 of a 42-day treatment period[9][16]. Importantly, the study noted that \"the herbal-based face cream forms a dense layer over the skin-injured areas and prevents oxygen supply. The resulting anaerobic conditions inhibit pathogen growth\"[9][16]. This mechanism—creating anaerobic conditions unfavorable to yeast—differs from direct antifungal activity and may explain efficacy despite the absence of direct Malassezia inhibition data for individual ingredients.\r\n\r\nA critical gap in the current clinical evidence is the absence of a published trial specifically testing the NewAura formulation or an identical botanical combination in human subjects with seborrheic dermatitis. The page claims \"8 plant-powered extracts\" but provides no clinical trial reference, no laboratory data on Malassezia inhibition, and no published efficacy data[1][40][42]. This represents a significant credibility opportunity: commissioning or conducting a small clinical trial (30–50 subjects, 4–6 week duration, measured against ASFS and DLQI scales) comparing NewAura to an active control (ketoconazole or zinc pyrithione) or placebo would substantially strengthen the value proposition and justify premium pricing[VERIFY - no published NewAura trial identified].\r\n\r\n## Customer Insights and Social Proof Mapping\r\n\r\nCustomer reviews and testimonials provide critical insight into product acceptance, real-world usage patterns, and the language that resonates with the target demographic. Across Amazon, Walmart, YouTube, and product review sites, NewAura and similar herbal seborrheic dermatitis creams generate review volumes in the hundreds, with average ratings typically in the 4.0–4.8 star range.\r\n\r\nHigh-impact testimonials that align with the Seasoned Silver-Beard profile and should feature prominently in conversion-optimized marketing include the following. One reviewer stated, \"Works well to treat seborrheic dermatitis\" and another noted, \"Best dandruff and itch relief—I use this shampoo 2-3 times a week. I use it on my beard. I've always gotten red itchy patches around the edges and I've tried everything\"[5][43]. A third review highlighted the non-greasy formula claim: \"non-greasy formula and absorbs well into the skin without leaving a sticky or oily residue\"[12]. A fourth emphasized speed of relief: \"Most users feel relief after the first use, with visible improvements within 1–3 days\"[42]. A fifth focused on safety and ingredients: \"Yes. It's made with natural herbal extracts and tested to be gentle on sensitive skin\"[42]. A sixth addressed the routine integration concern: \"Yes, you can use it on my face and scalp. It's safe and effective for the scalp, face, ears, beard, chest, and more\"[42]. A seventh focused on product versatility: \"Absolutely. That flaking under your beard? It's not dryness—it's usually caused by fungus. This cream starves the fungus and cools the itch\"[42]. An eighth emphasized trustworthiness and repetition: \"Trusted by thousands of men who now wake up feeling better and confident\"[40][42].\r\n\r\nCustomer research from Reddit communities (r/beards, r/SkincareAddiction, r/malegrooming) reveals recurring themes in how men discuss beard dandruff treatment. The language centers on embarrassment (\"I feel like I'm back in my 20s, embarrassed in meetings\"), exhaustion with trial-and-error (\"I've tried every shampoo, prescription, or home remedy\"), skepticism about temporary solutions (\"Nizoral works for two weeks, then comes back\"), and concern about hidden side effects or long-term safety (\"I'm already worried about age spots and thinning skin on my face\").[patterns from sources 5, 7, 8, 34, 37]. When men report successful product use, they emphasize integration into existing routines (\"I just need something that fits my shower routine, not another step\"), noticeable results within a defined timeframe (\"I could tell a difference in about a week\"), and confidence restoration (\"I can wear black shirts again without worrying\").\r\n\r\nSegmenting reviews and testimonials by the target demographic reveals patterns distinct from younger users. Older reviewers (45+) emphasize professional context (\"I can't have flakes on my white coat\"), compatibility with other grooming products (\"I use cologne. Whatever I put on my beard can't clash\"), safety for aging or sensitive skin (\"I have sensitive skin. I've had reactions to hydrocortisone before\"), and time efficiency (\"I don't have time for a ten-step routine\"). Younger reviewers (under 40) tend to emphasize aesthetic outcomes (\"My beard looks fuller\"), cost comparison to other lifestyle products, and social media–inspired appearance goals.\r\n\r\nA recommended review filtration taxonomy for the site would include the following tags: Age Group (Under 30 / 30–44 / 45–60 / 60+), Beard Type (Fine/Blonde / Dark/Thick / Gray/Salt-and-Pepper / Coarse), Primary Issue (Flaking / Itching / Redness / All), Previous Treatments (Shampoos / Ketoconazole / Oils / Prescription / None), and Result Timeframe (Immediate / 3–7 Days / 1–2 Weeks / Ongoing Maintenance). Implementing this taxonomy would allow prospective customers to filter reviews by demographic similarity and make informed decisions based on peer experiences most relevant to their own situation.\r\n\r\n## Messaging and Copywriting Strategy Bank\r\n\r\nHigh-performing headlines for the Seasoned Silver-Beard demographic prioritize maturity, dignity, and concrete outcomes over trend-based language. The following headline variations are ranked by estimated effectiveness for this demographic: (1) **\"Professional Confidence, Restored: The Non-Steroid Cream That Finally Stops Beard Flakes—For Good\"**—this headline addresses both the professional context (critical for older male professionals) and the frustration with temporary solutions, while the \"for good\" language suggests lasting relief rather than temporary management; (2) **\"Gray Beard Deserves Better: Stop the Flakes Without the Grease or Steroids\"**—this headline directly addresses the gray beard demographic while positioning the product against two common pain points (greasiness and steroid concerns); (3) **\"Your Beard, Your Way: The Herbal Cream That Works in Your Routine, Not Against It\"**—this emphasizes integration and simplicity, appealing to time-pressed professionals; (4) **\"Beard Dandruff Ends Here: Fast Relief, Real Results, No Doctor's Visit Required\"**—this positions the product as a self-service solution with clinical credibility implied; (5) **\"Mature Beards Need Mature Solutions: This Cream Actually Addresses the Root Cause\"**—this uses \"mature\" as both an age and a tone signal while emphasizing mechanism over claims.\r\n\r\nBenefit bullets that should appear directly under the hero headline, written in outcome-driven language appropriate to the Seasoned Silver-Beard, include the following: (1) **\"Visible flake reduction in 3–7 days; itching relief often immediate.\"**—specificity on timeline reduces purchase hesitation; (2) **\"Non-greasy, absorbs in minutes; no beard staining, no medicinal smell.\"**—addresses sensory and application concerns; (3) **\"Safe for sensitive aging skin; formulated without steroids or harsh synthetics.\"**—directly addresses age-related safety concerns; (4) **\"Works seamlessly into your shower routine—just apply 2–3 times daily, no special schedule.\"**—emphasizes simplicity and integration; (5) **\"Real results from real men 45–65 with gray, coarse beards—see their stories below.\"**—signals demographic representation and social proof; (6) **\"Proven herbal ingredients: backed by research and trusted by 40,000+ men.\"**—balances natural positioning with credibility signals.\r\n\r\nThree \"how it works\" microcopies suitable for product cards or email sequences are: (A) **\"Step 1: Wash and dry the affected area. Step 2: Massage cream into beard skin for 2–3 minutes in circular motions. Step 3: Let absorb (no rinse needed). Use 2–3 times daily. Results typically visible within 7 days.\"**; (B) **\"Your herbal barrier: Eight plant extracts work together to starve fungal growth, cool itch, and repair your beard skin—without the side effects of steroids or synthetics.\"**; (C) **\"Not a shampoo, not a oil, not a prescription: This is a targeted cream that fits between your shower and your day—apply, absorb, and get back to your routine.\"**.\r\n\r\nSensory and usage-specific microcopy to add on product cards or in the product detail section includes: (1) **\"Texture: Smooth, lightweight cream; spreads easily through coarse beard hair without dragging.\"**; (2) **\"Finish: Matte, non-greasy; absorbs fully in 3–5 minutes without residue or shine.\"**; (3) **\"Scent: Mild herbal note with cooling menthol undertone; dissipates within 30 seconds.\"**; (4) **\"Amount guidance: Pea-sized amount for short beard (under 2 inches); almond-sized for medium (2–4 inches); marble-sized for full beard (4+ inches). Apply directly to beard skin, not hair.\"**; (5) **\"Use 2–3 times daily: After shower (when pores are open and product absorbs best) and before bed (extended contact time overnight enhances results).\"**; (6) **\"Pairs well with beard oils and balms: Apply this cream first, wait 2–3 minutes for full absorption, then apply beard oil or balm over the top. This cream won't interfere with styling products.\"** [Note: Verify that the cream does not interact negatively with common beard oils before including this claim; initial research suggests no documented contraindications, but product-specific testing is recommended[VERIFY]].\r\n\r\n## Conversion Copy and Visual Optimization Framework\r\n\r\nThe current primary CTA on the NewAura page is presented as \"Buy 1 Get 1 Free\" with emphasis on the first-time offer, but this phrasing misses critical opportunities to reduce purchase friction and address the Seasoned Silver-Beard's documented risk aversion and need for performance guarantees. Four optimized CTA variations are recommended: (1) **\"Start Your 14-Day Flake-Free Challenge (60-Day Money Back if Not Satisfied)\"**—this reframes the purchase as a low-risk trial and implies a specific success metric; (2) **\"Try Risk-Free: 60-Day Money-Back Guarantee + Free Shipping\"**—straightforward risk reversal with shipping benefit called out; (3) **\"Get Relief Today: Buy 1 Get 1 Free + 120-Day Satisfaction Guarantee\"**—combines the discount with the extended guarantee (which the page already offers but does not prominently feature in the CTA); (4) **\"Add to Cart: First Bottle Half Off + Full Refund Through Day 60 if You're Not Satisfied\"**—explicit pricing transparency and guarantee.\r\n\r\nThe recommended primary CTA combination to test is: **Headline: \"Your Beard Deserves Better Than Flakes and Itch\"** | **Subhead: \"Herbal cream formulated for mature, gray beards. Relief in 3–7 days, guaranteed.\"** | **CTA Button: \"Try Risk-Free for 60 Days: Buy 1 Get 1 Free\"**. This combination addresses demographics (gray, mature), sets expectations (3–7 days), and leverages risk reversal (60-day guarantee) alongside the offer.\r\n\r\nA short testimonial optimized for hero placement could read: **\"I've had my beard for 15 years and the flakes were killing my confidence in the office. Nothing worked until this. In a week, they were gone—and stayed gone. Not greasy, not complicated. Finally.\"** —Marcus, 52, Portland, OR. This testimonial includes age, location, relevant context (professional impact, duration of issue, multiple failed treatments), and specific language that aligns with the Seasoned Silver-Beard voice (\"killing my confidence in the office,\" \"finally\").\r\n\r\nFor guarantee and returns microcopy, the following language is recommended: **\"60-Day Money-Back Guarantee: If you're not satisfied, send it back—no questions asked. Your satisfaction is our only measure of success.\"** This positions the guarantee as a statement of confidence rather than a caveat.\r\n\r\nThree FAQ lines addressing core Seasoned Silver-Beard objections are: (1) **Q: \"Is this safe for sensitive, aging skin?\" A: \"Yes. It's formulated without steroids, harsh synthetics, or irritating chemicals. It's tested to be gentle on mature skin and commonly used by men 45+ with sensitive skin. If you have known allergies, patch-test first.\"** [Note: Verify specific dermatological testing data for claims about \"aging skin\" safety—the product may not have been formally tested on geriatric populations; recommend adding language like \"common use by 45+ demographic\" without medical claims[VERIFY]]; (2) **Q: \"Will this stain my gray beard or leave white residue?\" A: \"No. The cream is formulated without dyes or brighteners and absorbs fully without visible residue. It will not tint or discolor gray hair.\"** [Verify no staining claims from lab testing or batch photos[VERIFY]]; (3) **Q: \"How does this work with beard oils and balms?\" A: \"Apply the cream first, wait 2–3 minutes for full absorption, then apply your beard oil or balm as usual. This cream creates a treatment layer; beard oil and balm layer over it for hydration and styling.\"** [Verify through product chemistry or customer use data that this stacking does not reduce efficacy[VERIFY]].\r\n\r\n## Visual and UX Optimization Priorities\r\n\r\nTen prioritized visual and UX swaps are recommended to increase conversion and engagement with the Seasoned Silver-Beard demographic:\r\n\r\n**(1) Hero image: Replace current product photo with close-up of mature man (55–60 years old) with gray beard, applying cream—shows real demographic, demonstrates application, builds immediate identification.** Current hero likely shows product in isolation or a generic hand; showing an older man with visible gray beard hair directly addresses demographic representation and increases sense of \"this product is for me.\"\r\n\r\n**(2) Add a 30–45 second video loop to hero showing texture and application—slow-motion texture shot, then real-time application to beard, then finish showing non-greasy absorption.** Video increases engagement and allows prospective customers to assess texture, viscosity, and finish (critical for older men's purchasing decisions) in seconds.\r\n\r\n**(3) Reorder customer review gallery to show 45–65 year old reviewers first, with age and beard type tagged prominently (e.g., \"Marcus, 52, Gray Beard\").** Current gallery likely shows reviews chronologically or by rating; segmenting by age and beard type dramatically increases relevance for target demographic.\r\n\r\n**(4) Add a \"Your Routine\" section showing three simple steps with icons: (A) Wash, (B) Apply Cream (2–3 min), (C) Optional—Beard Oil. Emphasize \"fits your existing routine—adds just 3 minutes to your day.\"** Older men need explicit permission that they do not need to overhaul their routine; this addresses that concern directly.\r\n\r\n**(5) Include a side-by-side comparison table (\"How NewAura Stacks Up\") versus ketoconazole shampoos, zinc pyrithione, and hydrocortisone—highlight NewAura's non-steroid status, daily use allowance, and no-schedule-required positioning.** This demystifies the competitive landscape and helps customers understand where NewAura fits relative to treatments they've already tried.\r\n\r\n**(6) Add a \"What You Won't Get\" section: \"❌ Medicinal smell | ❌ Staining | ❌ Steroid side effects | ❌ Complicated routine | ❌ Temporary relief.\"** Inverse benefits addressing documented pain points resonate powerfully with skeptical older demographics.\r\n\r\n**(7) Create a simple trust section with: certified herbal extracts icon, dermatologist-recommended [VERIFY: only include if true], money-back guarantee badge, and \"40,000+ Men Trust NewAura\" visual.** Trust signals positioned near CTA reduce final purchase friction.\r\n\r\n**(8) Replace or supplement generic beard stock photos with authentic before/after series from real 45–60 year old users showing beard at different growth stages (short, medium, full) and flake visibility.** Generic stock photos undermine credibility with older demographics; real user photos build trust.\r\n\r\n**(9) Add a \"Start Your Day Confident\" success story section highlighting one detailed testimonial from a 50+ man with professional context (job title, location, outcome focus).** One deep, specific story often outperforms multiple short testimonials for older audiences.\r\n\r\n**(10) Move \"60-Day Money-Back Guarantee\" language and badge to immediately above the CTA button, with high contrast styling.** Risk reversal messaging placed at point of conversion decision increases confidence and reduces cart abandonment.\r\n\r\n## Offer, Pricing, and Checkout Optimization\r\n\r\nCurrent pricing presents a \"Buy 1 Get 1 Free\" first-time offer at a stated price of $70 (two jars) or $40 for a single jar at \"standard price\"[1][40][42]. This structure, while attention-getting, obscures the per-jar cost ($35 when buying 2, or $40 single) and does not communicate value in terms the target demographic finds compelling (per-application cost, cost per day of use, cost relative to alternative treatments). Three optimized bundle structures are recommended:\r\n\r\n**Bundle A: \"Single Jar (30-day supply)\"** — $40 USD | Clear language: \"Approx. 30 days at 2–3 applications daily\" | Per-application cost call-out: \"Less than $1.33 per application\" | CTA: \"Try One Jar Risk-Free\" | Rationale: Entry price for commitment-averse customers or those new to herbal treatments.\r\n\r\n**Bundle B: \"Starter Pair (60-day supply)—Best Value\"** — $70 USD (was $80, save $10) | Clear language: \"Two 30-day jars; treat both flare-ups and maintenance\" | Per-application cost: \"Less than $1.17 per application; 23% savings vs. single\" | CTA: \"Get the 60-Day Supply\" | Rationale: Aligns with typical customer journey (needs 4–6 weeks to see full results, then maintenance); positions as \"best value\" using explicit savings math.\r\n\r\n**Bundle C: \"Quarterly Confidence (90-day supply)\"** — $99 USD (was $120, save $21) | Clear language: \"Three 30-day jars; set it and forget it with quarterly auto-shipments (cancel anytime)\" | Per-application cost: \"Less than $1.10 per application; 28% savings\" | Per-day cost call-out: \"Just $0.37 per day for clear skin and confidence\" | CTA: \"Subscribe & Save 23%\" | Rationale: Subscription structure aligns with younger e-commerce norms but framed as \"quarterly refill, not subscription hassle\" for older demographics; per-day cost language resonates with time-pressed professionals.\r\n\r\nFor per-day cost language, the formula is: (Bundle Price ÷ 100 mL per jar ÷ 3 jars in bundle) × estimated daily usage amount. Example: $99 quarterly bundle ÷ 300 mL total ÷ 90 days = $1.10 per day cost. This language should appear near the CTA as: **\"Just $1.10 per day for clear, confident skin. Less than a premium coffee.\"** Relatability through comparison to everyday luxury items resonates with affluent older demographics.\r\n\r\nFour microcopy lines for checkout to reduce returns and build confidence are: (1) **\"14-Day Flake-Free Guarantee: If you don't notice a visible reduction in flakes by day 14, we'll process a full refund. No questions, no hassle.\"** — Creates specific, measurable success criterion and implies product confidence; (2) **\"Ships Discreetly: Plain packaging, no labeling that indicates product type or medical condition.\"** — Addresses privacy concerns (men over 50 often worry about product discretion); (3) **\"Free Returns Within 60 Days: Changed your mind? Full refund, even if you've used the jar. We stand behind this cream.\"** — Emphasizes risk reversal and confidence in product; (4) **\"Most customers report visible results by day 7. You'll receive usage tips via email to help you get the best outcome.\"** — Manages expectations, sets early win timeframe, and implies customer service support.\r\n\r\n## Customer Acquisition and Retention Strategy\r\n\r\nA lead-magnet email capture sequence tailored to the Seasoned Silver-Beard should offer concrete, actionable value in exchange for email permission. **Recommended Lead Magnet Headline: \"The Silver-Beard Survival Guide: Stop Beard Dandruff Without Shaving It Off—Free PDF.\"** This headline directly addresses demographic (silver-beard), core fear (having to shave), and offers concrete value (survival guide, actionable). **Three short benefits to promise within the lead magnet**: (1) \"The 3-Step Routine That Works in Your Shower (takes less than 5 minutes)\" — Emphasizes simplicity and time efficiency; (2) \"Why Your Beard Dandruff Suddenly Got Worse After 40—And What That Means for Treatment\" — Positions age-specific insight; (3) \"The Complete Ingredient Glossary: What Actually Works vs. Marketing Hype\" — Addresses skepticism and desire for education.\r\n\r\nA 7-email retention and engagement sequence titled \"The 14-Day Flake-Free Challenge\" is designed to reduce returns and build loyalty through coaching and community. The sequence outline is:\r\n\r\n**Email 1 (Send Day 1, upon purchase): \"Welcome to Your 14-Day Challenge\"** | Subject: \"Your NewAura Just Shipped—Here's How to Get the Best Results\" | Preview: \"Read this before your first application\" | Content: (1) congratulate customer on taking action; (2) preview the 14-day timeline and expected milestones (visible flake reduction by day 7, stabilization by day 14); (3) one-paragraph \"pro tip\" on application technique (pea-to-marble sized amount depending on beard length, massage into beard skin, wait 2–3 minutes for absorption, can apply beard oil after); (4) CTA: \"Reply with your beard type (short/medium/full) so we can personalize your journey\" | Tone: Encouraging, professional, peer-to-peer.\r\n\r\n**Email 2 (Send Day 3): \"Day 3 Check-In: Are You Noticing Anything?\"** | Subject: \"Day 3 of 14—Quick Win?\" | Preview: \"Most customers notice immediate itch relief\" | Content: (1) validate that some customers notice itch relief immediately, others by day 3–5; (2) explain that visible flake reduction typically takes 5–7 days due to skin cell turnover; (3) troubleshooting: \"If you haven't noticed anything yet, try increasing application to 3x daily or using slightly more product\"; (4) short success story snippet (1–2 sentences from a 50+ reviewer) showing day 3–5 results; (5) CTA: \"Reply with your day 3 update—we read every message\" | Tone: Coaching, not sales.\r\n\r\n**Email 3 (Send Day 7): \"Day 7 Milestone: Check Your Beard\"** | Subject: \"Day 7 Results—Celebrate the Win\" | Preview: \"Time to see the difference\" | Content: (1) milestone language celebrating the one-week mark; (2) what to look for: flake reduction, reduced itch, improved appearance in mirror/under light; (3) explanation of why day 7 is significant (skin cell turnover cycle begins showing results); (4) user photo gallery of day 7 results (before/after close-ups from real 45+ customers); (5) if not seeing results yet: \"Some customers need 10–14 days; others see results by week 2 with a slight application tweak (try applying immediately after shower when pores are most open)\"; (6) CTA: \"Share your day 7 win in a reply—we'll feature you in our community wins\" | Tone: Celebratory, inclusive.\r\n\r\n**Email 4 (Send Day 10): \"Advanced Users: Level Up Your Routine\"** | Subject: \"Day 10—Add This to Maximize Results\" | Preview: \"The optional step 500+ customers are using\" | Content: (1) introduce optional integration of beard oil or balm after cream absorption (not mandatory, but enhances hydration); (2) explain timing (apply cream, wait 2–3 min, then apply beard oil); (3) recommend specific beard oil types that won't interfere (non-comedogenic, lightweight beard oils, not heavy mineral oils); (4) short testimonial from someone who added this step and noticed improved results; (5) CTA: \"Which beard oil are you using? Reply—we're curating a 'works with NewAura' guide\" | Tone: Expert, collaborative.\r\n\r\n**Email 5 (Send Day 12): \"Maintenance Mode Starts Here\"** | Subject: \"Day 12 of 14—Plan Your Next Chapter\" | Preview: \"Most customers transition to maintenance by day 14\" | Content: (1) explain the difference between active treatment (2–3x daily for first 14 days) and maintenance (1–2x daily ongoing); (2) data: \"Most customers maintain clear skin with 1–2 applications daily; experiment to find your minimum\"; (3) offer the quarterly bundle as a maintenance convenience option (\"never reorder, always stocked\"); (4) testimonial from a 60+ customer on their maintenance routine; (5) CTA: \"Are you planning to maintain or address occasional flare-ups? Let us know so we can send you the right tips\" | Tone: Practical, forward-looking.\r\n\r\n**Email 6 (Send Day 14): \"Your Results Are In: The Full Picture\"** | Subject: \"Day 14 Complete—Your Real Before/After\" | Preview: \"See the full 14-day transformation\" | Content: (1) frame day 14 as the full cycle completion; (2) guide to self-assessment (look in bright light, compare beard texture to day 1, assess itch level, note skin appearance); (3) gallery of before/after photos from real customers over 14 days; (4) expectation-set for ongoing maintenance and how long results last with consistent use (typically 1–2 days per application, so 2–3x daily maintains clear state); (5) if customer had not reported success via replies, soft win-back: \"If you didn't see the results you hoped for, we have solutions—check your email for a personalized troubleshooting guide\"; (6) CTA: \"Celebrate your progress: reply with your day 14 update and be featured in our community wins\" | Tone: Reflective, proud, achievement-focused.\r\n\r\n**Email 7 (Send Day 21, one week after challenge completion): \"What Happens Next?\"** | Subject: \"Week 3: The Maintenance Question\" | Preview: \"Sustaining your results is easier than you think\" | Content: (1) position maintenance as the \"boring but effective\" phase; (2) compare to other routines (\"like brushing teeth—daily habit, great results\"); (3) introduce quarterly auto-ship as a maintenance convenience (emphasize \"cancel anytime\" and \"no lock-in\"); (4) highlight that most customers stick with NewAura after the challenge because maintenance cost is lower than their original trial-and-error treatment costs; (5) exclusive offer: \"Loyal customers get 15% off quarterly auto-ship after the first three months\"; (6) CTA: \"Ready to maintain your clear beard? Start your quarterly supply here\" or \"Do you have questions? Our support team is here—just reply\" | Tone: Supportive, practical, long-term.\r\n\r\n## Marketing and Audience Targeting Strategy\r\n\r\nThree detailed audience segments for paid acquisition campaigns (Facebook, Instagram, Google, YouTube) are recommended, each with specific targeting parameters, lookalike seed criteria, and exclusion strategies.\r\n\r\n**Segment 1: \"Beard Dandruff Researchers\" (High Intent, Research Phase)**\r\n- Primary platforms: Google (search), YouTube (educational content)\r\n- Targeting parameters: Search keywords: \"beard dandruff remedy,\" \"seborrheic dermatitis treatment,\" \"ketoconazole alternative,\" \"herbal beard cream,\" \"how to stop beard flakes.\" Age: 45–70. Interests: men's grooming, dermatology, health/wellness, beard care. Behaviors: high search volume for treatment solutions, recently viewed beard care or dermatology content, engaged with educational videos on beard care.\r\n- Lookalike seed: Email list of customers who completed the 14-day challenge + email subscribers to grooming newsletters targeting 45+.\r\n- Exclusion: Remove anyone who purchased from competitors in last 30 days, users under 40, users in countries without product distribution.\r\n- Messaging angle: \"Finally—the Herbal Answer to Beard Dandruff You've Been Searching For\" (education, comparison, credibility-focused).\r\n- Budget allocation: 40% of paid acquisition spend (highest ROI due to high intent).\r\n\r\n**Segment 2: \"Steroid-Cautious Men\" (Medium-High Intent, Safety Conscious)**\r\n- Primary platforms: Facebook, Google, Reddit (organic outreach).\r\n- Targeting parameters: Age: 45–70. Interests: natural skincare, herbal medicine, alternative health, men's wellness, aging well. Behaviors: engaged with posts about steroid side effects, followed natural health accounts, commented on discussions about prescription medication concerns.\r\n- Lookalike seed: Customers who left reviews mentioning \"no steroids,\" \"natural,\" or \"safe for sensitive skin\" + email list of visitors who clicked the \"ingredient safety\" FAQ.\r\n- Exclusion: Remove users interested in pharmaceutical-only solutions, users with allergies to herbal products (from survey data if available).\r\n- Messaging angle: \"Powerful Enough Without the Risks: How One Cream Solves Beard Dandruff Without Steroids\" (safety, natural, efficacy without trade-offs).\r\n- Budget allocation: 30% of paid acquisition spend.\r\n\r\n**Segment 3: \"Professional Older Men\" (Medium Intent, Professional Identity)**\r\n- Primary platforms: LinkedIn (sponsored content), Facebook (professional demographics), YouTube (professional grooming content).\r\n- Targeting parameters: Age: 50–70. Job titles: executive, manager, professional, entrepreneur, attorney, doctor. Income: $75k+. Interests: professional grooming, business attire, career development, confidence, leadership. Behaviors: engaged with professional development content, viewed grooming or appearance-related content in professional context.\r\n- Lookalike seed: Customers from high-income zip codes + customers who mentioned \"professional\" or \"work\" in reviews + email list of professional network subscribers.\r\n- Exclusion: Remove unemployed/retired users (unless they indicate interest in active professional grooming), users interested in casual/lifestyle brands.\r\n- Messaging angle: \"Your Professional Confidence Starts with Your Appearance: Beard Dandruff Solutions for the Executive\" (professional identity, success, confidence).\r\n- Budget allocation: 20% of paid acquisition spend.\r\n\r\nA starter interest and keyword list for organic and paid content (40+ terms) includes the following: Primary keywords: beard dandruff, seborrheic dermatitis cream, beard flakes remedy, ketoconazole alternative, herbal beard cream, beard itch relief, scalp psoriasis treatment, beard dandruff shampoo, natural dandruff treatment, antifungal beard cream, beard care for men over 50, gray beard care, coarse beard treatment. Competitor brand keywords: Nizoral, Ketoconazole, Head & Shoulders, Dr. Squatch, American Crew, Roycederm. Influencer and creator keywords: men's grooming YouTube, beard care channel, dermatologist TikTok, male wellness podcast, men's skincare blog, 50+ grooming influencer. Hashtag and social keywords: #bearddandruff, #seborrheicdermatitis, #beardcare, #malegrooming, #mengrooming, #graybeard, #beardgrowth, #naturalskincare, #skincarefourmen, #beardlife. Psychographic interest keywords: men's health over 50, male confidence, professional appearance, natural health remedies, herbal medicine, dermatology, skin health, aging well.\r\n\r\nEight ad creative angles tied to real customer language and targeting are:\r\n\r\n**(1) \"The Embarrassment Angle\"** — Creative brief: Show a professional man in an office setting, hand on his beard, looking uncomfortable or touching beard with visible flakes on his shirt. Text: \"Beard flakes crushing your confidence at work? You don't have to choose between your beard and your professionalism.\" CTA: \"See Why 40,000 Men Switched.\" | Rationale: Addresses professional identity concern documented in customer research.\r\n\r\n**(2) \"The Tried-Everything Angle\"** — Creative brief: Show a bathroom shelf with multiple failed products (various shampoos, oils, etc.) and one jar of NewAura highlighted. Text: \"Ketoconazole. Zinc pyrithione. Expensive oils. Nothing lasted. Here's what finally worked.\" CTA: \"Try the Solution That Stuck.\" | Rationale: Validates existing customer experience and positions NewAura as the endpoint of a journey.\r\n\r\n**(3) \"The Age-Appropriate Angle\"** — Creative brief: Close-up of a mature man (55+) with a full, gray beard, looking confident and well-groomed. Text: \"Your Beard Earned Its Gray. It Deserves Better Than Dandruff.\" CTA: \"Get Your Confidence Back.\" | Rationale: Directly addresses demographic and positions beard as a symbol of achievement worth preserving.\r\n\r\n**(4) \"The Speed-of-Results Angle\"** — Creative brief: Split-screen showing day 1 (visible flakes) and day 7 (clear beard). Text: \"Day 1: Visible flakes. Day 7: Clear, confident beard. Most customers notice relief in 3–7 days.\" CTA: \"Start Your 14-Day Challenge.\" | Rationale: Concrete timeline addresses skepticism and sets realistic expectations.\r\n\r\n**(5) \"The Safety-First Angle\"** — Creative brief: Show the herbal ingredients (artemisia, cnidium, sophora) with text: \"No Steroids. No Harsh Synthetics. Just 8 Plant Extracts That Actually Work.\" Text: \"Safe for sensitive skin. Tested, proven, trusted by dermatologists.\" CTA: \"Learn About the Formula.\" | Rationale: Addresses steroid caution and desire for ingredient transparency.\r\n\r\n**(6) \"The Routine-Simplicity Angle\"** — Creative brief: Show a morning routine (shower, apply cream, beard oil, ready to go) in 3 simple steps. Text: \"Your Routine, Improved. Just 3 Minutes: Wash, Apply, Done. Fits Your Schedule.\" CTA: \"See Your Simplified Routine.\" | Rationale: Addresses time-pressed professionals' concerns about added steps.\r\n\r\n**(7) \"The Money-Back Angle\"** — Creative brief: Show man holding empty jar with a smile, next to the text \"60 Days to Results or Your Money Back.\" Text: \"We're So Confident This Works, We'll Refund You if It Doesn't.\" CTA: \"Try Risk-Free Today.\" | Rationale: Directly addresses purchase risk concerns with trust-building guarantee.\r\n\r\n**(8) \"The Real-Man Angle\"** — Creative brief: Use a real customer testimonial as video or carousel—a 50–60 year old man in professional or casual settings, speaking directly about his results. Text: \"[Name], 56: 'I've had my beard 20 years. Never thought I'd have to choose. This cream changed that.'\" CTA: \"Read Real Stories Like This.\" | Rationale: Authentic peer voices dramatically outperform generic marketing for this demographic.\r\n\r\n## Testing and Implementation Roadmap\r\n\r\nSix prioritized A/B tests are recommended to systematically optimize conversion, with specific hypotheses, primary metrics, sample size requirements, and expected uplift targets.\r\n\r\n**Test 1: Hero Headline Variation (Priority: Highest)**\r\n- Hypothesis: \"Professional Confidence Restored\" headline (addressing professional identity and dignity) will outperform current generic hero copy by appealing more directly to the Seasoned Silver-Beard's primary purchase driver.\r\n- Control: Current hero headline (\"Say Goodbye to Relentless Itching, Flakes, and Irritation\").\r\n- Variant: \"Your Beard, Your Confidence, Your Way: The Non-Steroid Cream That Actually Stops Beard Dandruff.\"\r\n- Primary metric: Click-through rate (CTR) to product detail or checkout; secondary: time-on-page (increased engagement).\r\n- Sample size required: Minimum 500 clicks per variant (approximately 2–4 weeks of typical traffic); minimum 50–100 conversions per variant to establish statistical significance.\r\n- Suggested timeline and budget: 4 weeks; allocate 30–40% of monthly paid traffic to test to achieve sample size rapidly.\r\n- Expected uplift: 12–18% improvement in CTR based on persona-specific messaging is realistic; 5–8% uplift in conversion rate is possible.\r\n\r\n**Test 2: CTA Button Text and Risk Reversal Messaging (Priority: Highest)**\r\n- Hypothesis: Explicit risk reversal (\"60-Day Money-Back Guarantee\") in CTA and subhead will reduce purchase hesitation and increase conversion rate, particularly for first-time buyers in the 45+ demographic who are cautious with new products.\r\n- Control: Current CTA (\"Buy 1 Get 1 Free\").\r\n- Variant A: \"Try Risk-Free: 60-Day Money-Back Guarantee\" (simplified, risk-focused).\r\n- Variant B: \"Get 2 Jars Free + 60-Day Guarantee\" (discount + guarantee combo).\r\n- Variant C: \"Start Your 14-Day Challenge: 60-Day Refund If Not Satisfied\" (gamified + guarantee).\r\n- Primary metric: Conversion rate (add-to-cart and checkout completion rate); secondary: cart abandonment rate.\r\n- Sample size required: Minimum 200–300 conversions per variant (approximately 4–6 weeks of typical conversion volume); statistical power of 80% requires this to detect a 15% relative improvement.\r\n- Suggested timeline and budget: Run 4–6 weeks; allocate full paid traffic to rotate through variants evenly.\r\n- Expected uplift: 8–15% improvement in conversion rate is realistic based on risk-reversal research in ecommerce; cart abandonment reduction of 5–10% is possible.\r\n\r\n**Test 3: Social Proof Segmentation—Age-Specific Reviews (Priority: High)**\r\n- Hypothesis: Displaying customer reviews from men 45–65 first and filtering available reviews by age/beard type will increase relevance perception and conversion rate, particularly for the target demographic.\r\n- Control: Current review display (chronological or rating-based order, no demographic filtering).\r\n- Variant: Review gallery reordered to show 45–65 reviewers first, tagged with age and beard type (e.g., \"Marcus, 52, Gray Coarse Beard\"); optional: add filter buttons (\"Show reviews from my age group,\" \"Show reviews from similar beard type\").\r\n- Primary metric: Conversion rate; secondary: review engagement (clicks on reviews, time spent reading reviews), reduction in cart abandonment.\r\n- Sample size required: Minimum 150–200 conversions per variant; statistical power of 80% to detect a 12% relative improvement.\r\n- Suggested timeline and budget: 3–4 weeks; run on site with organic and paid traffic; minimal budget required (no media buy, only testing site experience).\r\n- Expected uplift: 6–12% improvement in conversion rate due to increased relevance; improved customer satisfaction post-purchase if they feel they selected a product validated by peers in their demographic.\r\n\r\n**Test 4: Bundle Structure—Single vs. Two-Pack vs. Quarterly Subscription (Priority: High)**\r\n- Hypothesis: Offering a two-pack bundle as the \"recommended\" option (with savings math and \"best value\" framing) will increase average order value (AOV) and reduce churn, compared to single-jar prominence.\r\n- Control: Current bundle options (single $40, two-pack $70 \"Buy 1 Get 1 Free\").\r\n- Variant: Reframe default recommendation to two-pack ($70, labeled \"Best Value for First-Time Users\"); highlight per-jar savings ($35 each); add quarterly subscription option ($99, with 15% off label).\r\n- Primary metric: Average order value (AOV); secondary: conversion rate (may change if pricing feels higher), customer lifetime value (CLV) if tracking repeat purchase cohorts.\r\n- Sample size required: Minimum 100–150 conversions per variant to establish AOV with confidence; longer-term tracking (60–90 days) required to measure CLV improvement.\r\n- Suggested timeline and budget: 6–8 weeks to accumulate sufficient conversion data and early repeat purchase signals; run on site full-traffic.\r\n- Expected uplift: 15–25% improvement in AOV is realistic with good bundle framing; this is a high-impact test for revenue per customer.\r\n\r\n**Test 5: Sensory/Usage Claim Inclusion vs. Product-Only Messaging (Priority: Medium)**\r\n- Hypothesis: Adding explicit sensory and application detail (texture, finish, scent, amount guidance, routine integration) will reduce purchase hesitation and post-purchase returns by setting clearer expectations.\r\n- Control: Current product description (features/benefits, limited sensory detail).\r\n- Variant: Add detailed \"What to Expect\" section describing texture (\"smooth, lightweight cream\"), finish (\"non-greasy, matte, absorbs in 3–5 min\"), scent (\"mild herbal with cooling menthol, dissipates quickly\"), amount guidance (\"pea-sized for short beard, almond-sized for medium, marble-sized for full\"), and routine step (\"apply after shower when pores are most open, wait 2–3 min before applying beard oil\").\r\n- Primary metric: Conversion rate (may increase if customers feel more confident in product fit); secondary: return/refund rate (should decrease if expectations are clearer), post-purchase NPS or satisfaction survey.\r\n- Sample size required: Minimum 200 conversions per variant and 30–40 days post-purchase to measure return rate impact.\r\n- Suggested timeline and budget: 6–8 weeks; run on site full-traffic or via paid traffic split.\r\n- Expected uplift: 3–7% improvement in conversion rate due to reduced uncertainty; 10–20% reduction in return rate is possible if expectations are better managed.\r\n\r\n**Test 6: Video vs. Static Photo Hero—30-Second Application Demo (Priority: Medium)**\r\n- Hypothesis: A 30–45 second video showing texture and application will increase engagement, time-on-page, and conversion rate compared to a static product photo.\r\n- Control: Current hero image (product photo in jar, possibly with hand or background).\r\n- Variant: Looped video showing: (1) close-up of cream texture/consistency in jar (2–3 seconds), (2) application to beard skin in real-time (15–20 seconds), (3) finish showing non-greasy absorption and beard appearance post-application (10 seconds). Include subtle text overlay: \"30-second application. Real results in 3–7 days.\"\r\n- Primary metric: Click-through rate and conversion rate; secondary: time-on-page, bounce rate.\r\n- Sample size required: Minimum 500 clicks per variant (2–4 weeks typical traffic); 50–100 conversions per variant to establish statistical significance.\r\n- Suggested timeline and budget: 4 weeks; minimal budget (video can be shot in-house or via freelancer); test on site full-traffic or paid traffic split.\r\n- Expected uplift: 8–15% improvement in CTR and 5–10% improvement in conversion rate are realistic for video vs. static in ecommerce. Video tends to increase engagement and reduce purchase hesitation.\r\n\r\n**Six KPIs to track and target uplift percentages for successful tests:**\r\n(1) **Conversion rate (CR):** Current baseline (if not available, assume 1.5–3% for ecommerce skincare). Target uplift: 15–20% improvement from winning headlines/CTA tests; success threshold: 2.0–3.5%.\r\n(2) **Average order value (AOV):** Current baseline (estimate from bundle data). Target uplift: 15–25% from bundle optimization tests; success threshold: $50–$70 AOV with two-pack recommended.\r\n(3) **Click-through rate (CTR) to product page:** Current baseline (assume 0.8–1.5% for paid ads depending on channel). Target uplift: 12–20% from hero headline/messaging tests; success threshold: 1.2–2.0%.\r\n(4) **Cart abandonment rate (CAR):** Current baseline (estimate 60–75% for ecommerce). Target reduction: 5–10% absolute reduction (e.g., from 70% to 60–65%) from risk-reversal and social proof tests; success threshold: below 65%.\r\n(5) **Return/refund rate:** Current baseline (assume 5–15% for skincare). Target reduction: 10–20% relative reduction (e.g., from 10% to 8–9%) from sensory/usage claim tests and social proof tests; success threshold: below 8%.\r\n(6) **Customer lifetime value (CLV):** Current baseline (estimate from repeat purchase data if available). Target uplift: 20–30% improvement from bundle/subscription and retention email tests; success threshold: CLV > $100 per first-time customer (assuming 20–25% repeat purchase rate).\r\n\r\n## Implementation Roadmap and Priority Task List\r\n\r\nEight quick, prioritized tasks are recommended, with estimated effort (Low / Medium / High) and expected impact (High / Medium / Low), ordered by urgency and conversion potential.\r\n\r\n**Task 1: Hero Headline and Subhead Swap (Effort: Low | Impact: High)**\r\n- Replace current hero with \"Professional Confidence Restored: The Non-Steroid Cream That Actually Stops Beard Dandruff\" (headline) + \"Herbal relief formulated for mature, gray beards. Visible results in 3–7 days, guaranteed.\" (subhead).\r\n- Update CTA to \"Try Risk-Free for 60 Days: Buy 1 Get 1 Free.\"\r\n- Time to implement: 1–2 hours (requires design update and QA).\r\n- Expected impact: 12–15% uplift in conversion rate and 10–12% uplift in CTR.\r\n\r\n**Task 2: Add Demographic-Tagged Testimonials (Effort: Low | Impact: High)**\r\n- Curate 3–5 customer reviews from men aged 50–65 with gray or coarse beards; add age and beard type tags (e.g., \"Marcus, 52, Gray Coarse Beard\").\r\n- Display these testimonials above fold on the product detail page and in hero area if space allows.\r\n- Collect 2–3 video testimonials from 50+ customers (or use audio + photo) to add to a \"Real Stories\" section.\r\n- Time to implement: 3–5 hours (requires customer outreach, photo/video selection, layout adjustments).\r\n- Expected impact: 6–10% uplift in conversion rate due to demographic relevance.\r\n\r\n**Task 3: Build \"Your Routine\" Section (Effort: Medium | Impact: High)**\r\n- Create a simple 3-step visual guide: (1) Wash & Dry, (2) Apply Cream (2–3 min), (3) Optional—Beard Oil.\r\n- Add text emphasizing \"Fits your existing routine—adds just 3 minutes to your day.\"\r\n- Include icons or small illustrations (can be simple, no complex design required).\r\n- Time to implement: 4–6 hours (requires copywriting, design, layout).\r\n- Expected impact: 5–8% reduction in cart abandonment due to reduced complexity concerns.\r\n\r\n**Task 4: Add Sensory/Usage Microcopy (Effort: Low–Medium | Impact: Medium–High)**\r\n- Add a \"What to Expect\" section describing: texture (\"smooth, lightweight cream\"), finish (\"non-greasy, matte, absorbs in 3–5 minutes\"), scent (\"mild herbal, dissipates quickly\"), amount (\"pea-sized for short, almond-sized for medium, marble-sized for full beard\"), integration (\"apply after shower, wait 2–3 min before beard oil\").\r\n- Place immediately under main product description.\r\n- Time to implement: 2–3 hours.\r\n- Expected impact: 3–5% uplift in conversion rate due to clearer expectations.\r\n\r\n**Task 5: Build Competitive Comparison Table (Effort: Medium | Impact: Medium)**\r\n- Create a simple comparison table: NewAura vs. Ketoconazole Shampoos vs. Zinc Pyrithione Shampoos vs. Hydrocortisone Cream.\r\n- Highlight row categories: Active ingredient, daily use allowed, steroid (yes/no), schedule flexibility, application time.\r\n- Position table midway down the page to help customers understand NewAura's positioning.\r\n- Time to implement: 5–7 hours.\r\n- Expected impact: 3–5% uplift in conversion rate for research-phase visitors; improved confidence in purchase decision.\r\n\r\n**Task 6: Implement Age-Filtered Review Gallery (Effort: Medium | Impact: Medium–High)**\r\n- Add filter buttons or dropdown to review section: \"Show all reviews\" / \"Show reviews from my age group (45–60)\" / \"Show reviews from similar beard type.\"\r\n- Tag all reviews with age and beard type in backend (requires data collection from existing reviews and new review prompts).\r\n- Time to implement: 6–8 hours (backend setup, frontend buttons, review re-tagging).\r\n- Expected impact: 5–8% uplift in conversion rate due to demographic relevance of social proof.\r\n\r\n**Task 7: Add Risk-Reversal Guarantee Badge & Copy Near CTA (Effort: Low | Impact: High)**\r\n- Design a simple badge (\"60-Day Money-Back Guarantee\") and place immediately above or beside the CTA button.\r\n- Add 1–2 line microcopy below button: \"If you're not satisfied within 60 days, send it back for a full refund. No questions asked.\"\r\n- Time to implement: 2–3 hours.\r\n- Expected impact: 8–12% uplift in conversion rate due to reduced purchase risk perception.\r\n\r\n**Task 8: Prepare Email Drip Campaign Assets (Effort: High | Impact: Medium–High, Long-Term)**\r\n- Write and design the 7-email \"14-Day Flake-Free Challenge\" sequence (see section on email & retention for full outline).\r\n- Create simple templates (1–2 column layout, mobile-optimized).\r\n- Set up automation in email platform (Klaviyo, Mailchimp, ConvertKit, etc.) to trigger on purchase.\r\n- Time to implement: 12–16 hours (writing all 7 emails, design, setup, testing).\r\n- Expected impact: 15–25% reduction in return rate and 10–15% improvement in repeat purchase rate due to engagement and expectation management.\r\n\r\n**First 5 copy assets to implement immediately (recommended order):**\r\n1. Hero headline and subhead (Task 1).\r\n2. CTA button text with risk-reversal guarantee (Tasks 1 & 7 combined).\r\n3. 3–5 demographic-tagged testimonials (Task 2).\r\n4. Sensory/usage microcopy section (Task 4).\r\n5. \"Your Routine\" section with 3-step guide (Task 3).\r\n\r\nThese five assets address the top conversion barriers identified in persona research (lack of demographic representation, unclear routine fit, sensory uncertainty, purchase risk, need for credibility) and can be implemented within 2–3 weeks with estimated 15–25% cumulative uplift in conversion rate.\r\n\r\n## Sources and Research Methodology\r\n\r\nThis comprehensive research brief draws on 48+ primary and secondary sources including peer-reviewed clinical literature, product pages, customer review platforms, social media discussions, and competitor analysis. Below is a compact reference list organized by source type and research purpose.\r\n\r\n**Clinical Literature and Evidence Base:**\r\n[2] PMC National Center for Biotechnology Information. \"Seborrheic Dermatitis and Dandruff: A Comprehensive Review\" (https://pmc.ncbi.nlm.nih.gov/articles/PMC4852869/). Comprehensive epidemiology, pathophysiology, and treatment overview; defines seborrheic dermatitis vs. dandruff spectrum; establishes Malassezia colonization and sebaceous gland activity as primary drivers. Used for clinical context and ingredient mechanism discussion.\r\n\r\n[3] Mayo Clinic. \"Ketoconazole (topical route)—Description\" (https://www.mayoclinic.org/drugs-supplements/ketoconazole-topical-route/description/drg-20067739). Clinical description of ketoconazole mechanism, applications, dosing, and side effects; establishes ketoconazole as standard-of-care treatment. Used for competitive comparison and active ingredient understanding.\r\n\r\n[6] NHS Medicines. \"Ketoconazole: an antifungal medicine used to treat skin infections\" (https://www.nhs.uk/medicines/ketoconazole/). UK clinical guidance on ketoconazole use, safety, and interactions; context for international regulatory perspective. Used for safety profile discussion.\r\n\r\n[9] [16] PMC. \"Treatment of Seborrheic Dermatitis Using a Novel Herbal-based...\" Journal of Clinical & Aesthetic Dermatology, 2017 Apr;10(4):17–23 (https://pmc.ncbi.nlm.nih.gov/articles/PMC5404776/). Clinical trial of herbal-based face cream for seborrheic dermatitis; 32 subjects, 42-day treatment, significant improvements in ASFS, induration, erythema, pruritus; no adverse events. Directly relevant to NewAura formulation positioning. Used for herbal ingredient efficacy validation and clinical trial data.\r\n\r\n[19] PMC. \"Scalp Seborrheic Dermatitis and Dandruff Therapy Using a Herbal...\" Journal of Clinical & Aesthetic Dermatology, 2018 Jan 1;11(1):26–31 (https://pmc.ncbi.nlm.nih.gov/articles/PMC5788265/). Trial of herbal zinc pyrithione shampoo and scalp lotion; 50 subjects, 42-day treatment, significant improvements across ASFS and erythema at all timepoints; no adverse events. Used for herbal ingredient + zinc pyrithione combination efficacy.\r\n\r\n[23] PubMed. \"Artemisia argyi extract subfraction exerts an antifungal effect...\" Chin J Nat Med. 2024 Jan;22(1):47-61 (https://pubmed.ncbi.nlm.nih.gov/38278559/). Study of Artemisia argyi extract against dermatophytes (T. rubrum, T. mentagrophytes, M. gypseum); demonstrated antifungal mechanism via mitochondrial disruption. Relevant to Artemisia ingredient but focused on dermatophytes, not Malassezia. [VERIFY for Malassezia-specific data].\r\n\r\n[26] PMC. \"Artemisia Species with High Biological Values as a Potential Source...\" PMC9571683 (https://pmc.ncbi.nlm.nih.gov/articles/PMC9571683/). Comprehensive review of Artemisia species pharmacology and cosmetic applications; documents antibacterial, antifungal, and antioxidant activities; traditional use in skincare. Used for ingredient safety and cosmetic applications context.\r\n\r\n[30] PMC. \"Preliminary Study on Antifungal Mechanism of Aqueous Extract of...\" PMC8417377 (https://pmc.ncbi.nlm.nih.gov/articles/PMC8417377/). Study of Cnidium monnieri aqueous extract against T. rubrum; demonstrated cell wall and mitochondrial disruption; MIC ~5 mg/mL. Relevant to Cnidium ingredient but focused on dermatophytes. [VERIFY for Malassezia-specific data].\r\n\r\n[32] PubMed. \"Antipruritic effects of Sophora flavescens on acute and chronic itch...\" Biol Pharm Bull. 2003 May;26(5):722-4 (https://pubmed.ncbi.nlm.nih.gov/12736520/). Mouse model study of Sophora flavescens extract for antipruritic effects; significant dose-dependent inhibition of itch. Used for Sophora ingredient efficacy; note: animal model, not human.\r\n\r\n[33] PMC. \"Seborrheic Dermatitis and Malassezia species\" J Clin Aesthet Dermatol. 2009 Nov;2(11):14–17 (https://pmc.ncbi.nlm.nih.gov/articles/PMC2923939/). Overview of Malassezia role in seborrheic dermatitis pathogenesis; establishes ketoconazole and ciclopirox as evidence-based treatments. Used for Malassezia mechanism context.\r\n\r\n[45] [48] PMC & Dermatology Practical Concept. \"Efficacy of Topical Rosemary Extract Lotion versus Topical 2% Ketoconazole Lotion...\" Dermatol Pract Concept. 2024 Oct 30;14(4):e2024242 (https://pmc.ncbi.nlm.nih.gov/articles/PMC11619942/). Double-blind RCT comparing rosemary extract vs. ketoconazole for scalp seborrheic dermatitis; 42 subjects, 2-month treatment; ketoconazole superior for scaling (ASFS), rosemary superior for itching; both improved DLQI (quality of life). Used for herbal vs. pharmaceutical efficacy comparison and itch-relief positioning.\r\n\r\n**Topical Hydrocortisone and Steroid Safety:**\r\n[25] City Skin Clinic. \"Benefits & Safety of Topical Hydrocortisone for Skin & Hair\" (https://cityskinclinic.com/topical-hydrocortisone/). Clinical overview of hydrocortisone use for scalp conditions, seborrheic dermatitis, and side effects (skin thinning, hair thinning, discoloration). Used for steroid-alternative positioning.\r\n\r\n[28] GoodRx. \"Hydrocortisone cream (Hydrocortisone Butyrate): Uses, Side Effects...\" (https://www.goodrx.com/hydrocortisone/what-is). Comprehensive side effects list and usage guidelines for topical hydrocortisone; emphasizes limited duration use and risks with long-term application. Used for steroid caution context in Seasoned Silver-Beard messaging.\r\n\r\n**Product Pages and Competitor Analysis:**\r\n[1] [4] [40] [42] NewAura. \"NewAura™ Seborrheic Dermatitis & Psoriasis Cream\" (https://trynewaura.com/products/newaura%E2%84%A2-seborrheic-dermatitis-psoriasis-cream and similar product pages). Primary product page analysis; captures hero copy, ingredient list, pricing, guarantee, application instructions, and customer testimonials. Used for current positioning audit and messaging baseline.\r\n\r\n[3] [6] [20] Mayo Clinic & NHS. Ketoconazole product information pages. Competitive benchmark for ketoconazole formulations and positioning.\r\n\r\n[10] [13] [29] FashionBeans, ClinicAdvisor, Men's Health. \"Best Beard Dandruff Shampoos\" and \"Best Anti-Dandruff Shampoos for Men\" (https://www.fashionbeans.com/article/best-beard-dandruff-shampoos/, https://www.menshealth.com/grooming/g19060780/best-dandruff-shampoos-men/). Competitor product reviews and positioning; Nizoral highlighted as top choice; ketoconazole and zinc pyrithione positioned as most effective. Used for competitive landscape and alternative treatment context.\r\n\r\n[12] Roycederm. \"Seborrheic Dermatitis & Psoriasis Cream\" (https://roycederm.com/products/seborrheic-dermatitis-psoriasis-cream-scalp-treatment-for-psoriasis-dry-scalp-dandruff). Direct competitor product page analysis; similar herbal formulation, salicylic acid, comparable pricing ($30–$40). Used for adjacent competitor positioning.\r\n\r\n**Customer Reviews and Sentiment Analysis:**\r\n[5] [43] Walmart. \"Customer reviews for Seborrheic Dermatitis Cream, Psoriasis...\" (https://www.walmart.com/reviews/product/1562190094). Real customer testimonials; verbatim review snippets for \"Best dandruff and itch relief,\" \"Works well to treat seborrheic dermatitis,\" etc. Used for social proof and customer language mining.\r\n\r\n**Beard Care and Grooming Guidance:**\r\n[7] Beardbrand. \"How to Stop Beard Dandruff for Good\" (https://www.beardbrand.com/blogs/urbanbeardsman/beard-dandruff). Comprehensive beard dandruff guide; causes (dry skin, oily skin, contact dermatitis, seborrheic dermatitis), prevention, treatment, and real-world routine tips. Used for beard-specific context and customer language.\r\n\r\n[8] Men's Health. \"Beard Dandruff: What Causes It and How to Get Rid of It\" (https://www.menshealth.com/grooming/a44752764/how-to-get-rid-of-beard-dandruff/). Expert advice on beard dandruff causes and treatment; Malassezia fungus explanation; treatment recommendations (anti-dandruff shampoo, cleanser, hydration, wash frequency, exfoliation, trimming). Used for routine integration and sensory language context.\r\n\r\n[14] Beard Sorcery. \"Grooming Tips for Men in Their 30s and 40s\" (https://beardsorcery.com/book-of-beardcraft/grooming-tips-for-men-in-their-30s-and-40s). Age-specific grooming guidance; mentions beard oils, beard wash, beard balms, skincare integration. Used for routine integration context for 40+ demographic.\r\n\r\n[22] Men's Health. \"The 15 Best Beard Products for Men in 2025\" (https://www.menshealth.com/grooming/g19546351/best-beard-products/). Product recommendations for beard wash, conditioning, exfoliation, styling; ingredient spotlights (aloe, argan oil, coconut oil). Used for product integration and sensory language.\r\n\r\n[31] The Beard Club. \"5 Beard Dandruff Products for a Healthy Beard\" (https://thebeardclub.com/blogs/beard-culture/beard-dandruff-products). Comprehensive guide to beard dandruff products including shampoo, conditioner, moisturizer, beard oil, beard brush; integration recommendations. Used for routine integration and product synergy context.\r\n\r\n[34] Healthline. \"Beard Dandruff: What Causes It, and How Can You Get Rid of...\" (https://www.healthline.com/health/beard-dandruff). Medical overview of beard dandruff, causes (Malassezia), treatment recommendations, prevention; emphasis on integration into routine. Used for clinical context and routine guidance.\r\n\r\n[37] WebMD. \"How to Treat Beard Dandruff\" (https://www.webmd.com/skin-problems-and-treatments/how-to-treat-beard-dandruff). WebMD patient-facing guide on beard dandruff causes, treatment, prevention; ketoconazole positioning, integration guidance. Used for mainstream medical context.\r\n\r\n[41] Kingsmen Premium. \"Beards for Older Guys: Age Like Fine Wine with THESE Styles!\" (https://kingsmenpremium.com/blogs/news/beards-for-older-guys). Age-specific grooming guidance for men 50+; beard style selection by face shape, common mistakes, maintenance, product selection. Used for mature male grooming context and identity framing.\r\n\r\n**Beard Psychology and Self-Image:**\r\n[44] BumpStopper. \"The Razor's Edge: Shaving and the Psychology of Self-Image\" (https://bumpstopper.com/the-razors-edge-shaving-and-the-psychology-of-self-image/). Discussion of shaving, grooming, and self-identity; connection between grooming and confidence, social expectations, media influence. Used for psychological framing of Seasoned Silver-Beard persona.\r\n\r\n[47] The English Shaving Company. \"Beard Psychology: What Does Your Facial Hair Say About You?\" (https://www.theenglishshavingcompany.com/blog/beard-psychology-science/). Comprehensive overview of beard psychology research; beards linked to masculinity, maturity, power, dominance; references 2013 studies on perception, 1990 study on maturity association, Wiseman study on generosity perception. Used for persona psychographic framing and identity motivation context.\r\n\r\n**Skincare and Aging:**\r\n[24] AARP. \"Basic Skin Care for Older Men\" (https://www.aarp.org/entertainment/beauty-style/mens-skin-care/). Skincare basics for older men; product recommendations for cleansers, moisturizers with vitamins; sun protection; age-appropriate skincare. Used for older male skincare context.\r\n\r\n[27] Men's Health. \"Fellas, It's Time to Take Care of Your Skin\" (https://www.menshealth.com/grooming/a63665438/quick-skincare-routine-for-men/). Quick skincare routine for men; emphasis on simplicity (2–3 products), hydration, sun protection. Used for routine simplicity context for time-pressed professionals.\r\n\r\n**YouTube Video Content (for customer language and testimonial mining):**\r\n[35] YouTube / Big Beard Business. \"Best Quick and Easy Tip for Beard Dandruff Removal\" (https://www.youtube.com/watch?v=SgRtV0Kd4_k). Tutorial video on beard dandruff prevention; discusses exfoliation, washing frequency, beard oil, hydration. Used for customer pain points and solution language.\r\n\r\n[38] YouTube / Beard Dandruff Cure Video. \"Quick Guide to Curing Beard Dandruff! 100% success rate\" (https://www.youtube.com/watch?v=wOeCQJeP3zk). Tutorial on 3-step beard dandruff cure (water intake, exfoliation, oil/moisture); emphasizes simplicity and reliability. Used for routine simplification context and success language.\r\n\r\n**Research Gaps and [VERIFY] Flags:**\r\n\r\nThe following claims on the NewAura product page require verification or additional evidence:\r\n\r\n- [VERIFY] \"Trusted by thousands battling beard irritation, psoriasis, and seborrheic dermatitis\": No independent third-party audit of customer count; \"40,000+ Treated Beards\" claim lacks source documentation. Recommend obtaining customer database count or commissioning a third-party verification.\r\n\r\n- [VERIFY] \"Fast-acting relief for seborrheic dermatitis, psoriasis, eczema, and dry, irritated skin\": No published clinical trial data specific to NewAura formulation. The 2017 and 2018 herbal formulation studies provide supporting evidence for similar ingredients, but direct NewAura efficacy data is absent.\r\n\r\n- [VERIFY] \"Results typically visible within 1–3 days\": This timeline is faster than literature benchmarks (typically 5–7 days for visible flake reduction, though itch relief may be immediate). Recommend collecting user data to validate this claim.\r\n\r\n- [VERIFY] \"Safe for sensitive aging skin\": No published geriatric safety data for the specific formulation. Recommend commissioning a small safety study on 45+ demographic or obtaining detailed dermatologist feedback.\r\n\r\n- [VERIFY] \"Non-greasy finish without tinting gray beards\": No laboratory data on staining or residue. Recommend batch testing on gray hair samples or collecting user photos as evidence.\r\n\r\n- [VERIFY] Ingredient antifungal claims (Artemisia, Cnidium, Sophora): Published data exists for dermatophyte activity, but Malassezia-specific efficacy is not yet established for these individual ingredients. Recommend commissioning in vitro study of ingredients against Malassezia or publishing existing data if available.\r\n\r\n---\r\n\r\n**Conclusion and Strategic Recommendation**\r\n\r\nNewAura occupies a defensible market position at the intersection of herbal safety, non-steroid positioning, and convenience-focused application (cream vs. shampoo). However, the current product page significantly underutilizes demographic-specific messaging, credibility mapping, and sensory/usage detail that drive conversion for the Seasoned Silver-Beard avatar (men 45–65). Implementing the eight priority tasks outlined in the implementation roadmap—particularly hero headline refresh, demographic testimonial integration, routine simplification, sensory microcopy, and risk-reversal guarantee prominence—can drive an estimated 15–25% uplift in conversion rate within 4–6 weeks. Concurrently, launching the 7-email \"14-Day Flake-Free Challenge\" drip sequence will reduce returns and build long-term loyalty, likely improving customer lifetime value by 20–30%. The market research indicates strong unmet demand for non-steroid alternatives to ketoconazole and zinc pyrithione among older demographics, positioning NewAura for sustainable competitive advantage if credibility and demographic resonance are clarified on the product page and in marketing messaging.",
        "productImageUrls": [
            "https://res.cloudinary.com/dywojytq5/image/upload/v1766473181/static-ads/product-images/static-ads/product-images/1766473178022-njnyq22rsk.jpg"
        ],
        "uploadedReferenceImageUrls": [
            "https://res.cloudinary.com/dywojytq5/image/upload/v1766473181/static-ads/product-images/static-ads/product-images/1766473178022-njnyq22rsk.jpg"
        ]
        }
    
        
    
    result = lambda_handler(event, None)
    logger.info("Local run result: %s", result)