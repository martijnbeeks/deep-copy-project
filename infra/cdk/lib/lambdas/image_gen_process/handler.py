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
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import boto3
import requests
from botocore.exceptions import ClientError
from openai import OpenAI
import google.generativeai as genai
from cloudflare import Cloudflare



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


def _summarize_docs_if_needed(openai_client: OpenAI, foundational_text: str, language: str) -> Optional[str]:
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
    resp = openai_client.chat.completions.create(
        model=os.environ.get("OPENAI_TEXT_MODEL", "gpt-5-mini"),
        messages=[{"role": "user", "content": prompt}],
    )
    content = resp.choices[0].message.content or ""
    return content.strip()


def _match_angles_to_images(
    openai_client: OpenAI,
    selected_avatar: str,
    selected_angles: List[str],
    library: Any,
    forced_ids: List[str],
) -> Dict[Tuple[str, str], str]:
    """
    Returns mapping (angle_num, variation_num) -> image_id
    Ensures uniqueness across all slots as much as possible.
    """
    # Extract available ids from library
    available_ids: List[str] = []
    if isinstance(library, dict):
        # some formats might be { "images": [...] }
        images = library.get("images") or library.get("items") or library.get("data") or []
    else:
        images = library
    if isinstance(images, list):
        for item in images:
            if isinstance(item, dict) and item.get("id"):
                available_ids.append(str(item["id"]))
            elif isinstance(item, str):
                available_ids.append(item)
    available_set = set(available_ids)

    # Slots
    slots: List[Tuple[str, str, str]] = []  # (angle_num, variation_num, angle_text)
    for idx, angle in enumerate(selected_angles):
        angle_num = str(idx + 1)
        for variation_num in ("1", "2"):
            slots.append((angle_num, variation_num, angle))

    slot_assignments: Dict[Tuple[str, str], str] = {}
    used: set[str] = set()

    # Step 1: forced round-robin
    forced_ids = [_normalize_image_id(x) for x in (forced_ids or []) if str(x).strip()]
    forced_ids = [x for x in forced_ids if (not available_set) or (x in available_set)]
    for i, forced_id in enumerate(forced_ids):
        if i >= len(slots):
            break
        angle_num, variation_num, _angle = slots[i]
        slot_assignments[(angle_num, variation_num)] = forced_id
        used.add(forced_id)

    # Remaining slots
    remaining_slots = [s for s in slots if (s[0], s[1]) not in slot_assignments]
    if not remaining_slots:
        return slot_assignments

    # Compact library text for LLM (avoid huge token usage)
    compact_lines: List[str] = []
    if isinstance(images, list):
        for item in images:
            if isinstance(item, dict):
                _id = str(item.get("id", "")).strip()
                if not _id:
                    continue
                # try common fields
                desc = (
                    item.get("description")
                    or item.get("summary")
                    or item.get("style")
                    or item.get("text")
                    or ""
                )
                desc_str = str(desc).replace("\n", " ").strip()
                compact_lines.append(f"{_id}: {desc_str[:240]}")
            elif isinstance(item, str):
                compact_lines.append(item)
    random.shuffle(compact_lines)
    library_text = "\n".join(compact_lines)
    if len(library_text) > 20000:
        library_text = library_text[:20000] + "\n[TRUNCATED]"

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
        f"Library (id: description):\n{library_text}\n"
    )
    try:
        resp = openai_client.chat.completions.create(
            model=os.environ.get("OPENAI_TEXT_MODEL", "gpt-5-mini"),
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
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
    except Exception as e:
        logger.warning("matchAnglesToReferenceImages LLM path failed, will fallback: %s", e)

    # Fallback fill
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

    return slot_assignments


def _generate_image_openai(
    openai_client: OpenAI,
    prompt: str,
    reference_image_data: Optional[Dict[str, str]],
    product_image_data: Optional[Dict[str, str]],
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
    if product_image_data and product_image_data.get("base64"):
        content.append(
            {
                "type": "input_image",
                "image_url": f"data:{product_image_data.get('mimeType','image/png')};base64,{product_image_data['base64']}",
                "detail": "high",
            }
        )
    resp = openai_client.responses.create(
        model=os.environ.get("OPENAI_IMAGE_MODEL", "gpt-4o"),
        input=[{"role": "user", "content": content}],
        tools=[{"type": "image_generation"}],
        max_output_tokens=1000,
    )
    img_b64 = _extract_openai_image_b64(resp)
    if not img_b64:
        raise RuntimeError("OpenAI returned no image")
    return img_b64


def _generate_image_nano_banana(
    prompt: str,
    reference_image_bytes: Optional[bytes],
    product_image_bytes: Optional[bytes],
) -> str:
    # Best-effort Gemini image generation. Returns base64 (PNG).
    import PIL.Image

    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY") or ""
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY/GEMINI_API_KEY not set")
    genai.configure(api_key=api_key)

    contents: List[Any] = [prompt]
    if reference_image_bytes:
        contents.append(PIL.Image.open(io.BytesIO(reference_image_bytes)))
    if product_image_bytes:
        contents.append(PIL.Image.open(io.BytesIO(product_image_bytes)))

    model = genai.GenerativeModel("gemini-3-pro-image-preview")
    resp = model.generate_content(contents)

    # The response format varies; attempt to find inline_data bytes
    # Common path: resp.candidates[0].content.parts[*].inline_data.data
    try:
        candidates = getattr(resp, "candidates", None) or []
        for cand in candidates:
            content = getattr(cand, "content", None)
            parts = getattr(content, "parts", None) or []
            for part in parts:
                inline = getattr(part, "inline_data", None)
                if inline and getattr(inline, "data", None):
                    data_bytes = inline.data
                    return base64.b64encode(data_bytes).decode("utf-8")
    except Exception:
        pass
    raise RuntimeError("Gemini returned no image bytes")


def lambda_handler(event, _context):
    job_id = event.get("job_id") or event.get("jobId")
    logger.info("Starting image-gen job: job_id=%s", job_id)

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
        language = event.get("language") or "english"
        product_name = event.get("productName")
        provider = "nano_banana"

        if not selected_avatar or not isinstance(selected_avatar, str):
            raise ValueError("selectedAvatar is required")
        if not isinstance(selected_angles, list) or not selected_angles:
            raise ValueError("selectedAngles must be a non-empty list")

        logger.info(
            "Inputs: angles=%s provider=%s language=%s productName=%s hasProductImage=%s",
            len(selected_angles),
            provider,
            language,
            product_name,
            bool(product_urls),
        )

        # Load descriptions
        library = _load_json_from_s3(bucket, descriptions_key)

        # Download first product image (if provided) for conditioning
        product_image_data = None
        product_image_bytes = None
        if isinstance(product_urls, list) and product_urls:
            product_image_data = _download_image_to_b64(product_urls[0])
            if product_image_data and product_image_data.get("base64"):
                product_image_bytes = base64.b64decode(product_image_data["base64"])

        # Optional doc analysis (short)
        analysis_json_or_text = _summarize_docs_if_needed(openai_client, foundational_text, language)

        assignments = _match_angles_to_images(openai_client, selected_avatar, selected_angles, library, forced_ids)
        logger.info("Assigned %s slots to reference images", len(assignments))

        generated: List[dict] = []
        for idx, angle in enumerate(selected_angles):
            angle_num = str(idx + 1)
            for variation_num in ("1", "2"):
                key = (angle_num, variation_num)
                ref_id = assignments.get(key)
                if not ref_id:
                    continue

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
                if analysis_json_or_text:
                    prompt_parts.append(f"Research summary (JSON/text): {analysis_json_or_text}")
                prompt_parts.append(
                    "Use the provided reference creative image as the layout/style template. "
                    "If a product image is provided, incorporate it naturally. "
                    "Return only the final image."
                )
                prompt = "\n".join(prompt_parts)

                try:
                    if provider in ("nano_banana", "nanobanana", "nano-banana"):
                        img_b64 = _generate_image_nano_banana(prompt, ref_bytes, product_image_bytes)
                    else:
                        img_b64 = _generate_image_openai(openai_client, prompt, ref_data, product_image_data)

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
                    logger.exception(
                        "Image generation/upload failed: job_id=%s angle=%s var=%s ref_id=%s",
                        job_id,
                        angle_num,
                        variation_num,
                        ref_id,
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
    event = {
        "job_id": results["job_id"],
        "result_prefix": f"results/{results['job_id']}",
        "foundationalDocText": f"{results["results"]['deep_research_output']} \n Avatar Sheet: {results["results"]['avatar_sheet']} \n Offer Brief: {results["results"]['offer_brief']} \n Marketing Philosophy: {results["results"]['marketing_philosophy_analysis']} \n Summary: {results["results"]['summary']}",
        "selectedAvatar": "Avatar name: Michael, 68 — “The Evidence-First Retiree Michael is a 68-year-old retired engineer who values independence and routine—morning reading, driving to errands, and staying active without needing help. He’s noticing subtle vision changes (especially contrast and low-light clarity) and feels a quiet fear about what losing vision would mean for autonomy. He is highly skeptical of supplements that use vague claims (“clinically proven,” “doctor recommended”) without specifics. He responds best to measured, conservative language that signals medical-grade credibility without promising outcomes: clear Supplement Facts, third-party lab verification, and references to established research like AREDS2. His decision trigger is not hype—it’s trustworthy evidence, transparency, and the sense that he can confidently discuss the product with his eye doctor.",
        "selectedAngles": [angle["angle"] for angle in results["results"]['marketing_angles']],
        "language": "english",
        "productImageUrls": ["https://img.funnelish.com/79526/0/1766338180-Untitled_design.webp"],
        "forcedReferenceImageIds": ["10.png", "11.png"],
        "productName": "Clarivea",
    }
    
        
    
    result = lambda_handler(event, None)
    logger.info("Local run result: %s", result)