"""
Mock response factories for image_gen_process tests.
"""

import base64
import json


def make_tiny_png_b64() -> str:
    """Return a base64-encoded 1x1 transparent PNG."""
    raw = (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
        b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
        b"\r\n\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    return base64.b64encode(raw).decode("utf-8")


def make_tiny_png_bytes() -> bytes:
    """Return raw bytes of a 1x1 transparent PNG."""
    return (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
        b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
        b"\r\n\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def make_cloudflare_upload_response(
    job_id: str = "test",
    product_name: str = "TestProduct",
    angle_num: str = "1",
    variation_num: str = "1",
) -> dict:
    """Return a dict mimicking CloudflareService.upload_base64_image."""
    return {
        "id": f"cf-{job_id}-{angle_num}-{variation_num}",
        "filename": f"{job_id}_{angle_num}_{variation_num}.png",
        "variants": [
            f"https://imagedelivery.test/cf-{job_id}-{angle_num}-{variation_num}/public"
        ],
        "meta": {
            "product": product_name,
            "angle_num": angle_num,
            "variation_num": variation_num,
            "job_id": job_id,
        },
    }


def make_match_response(assignments: dict[str, str] | None = None) -> str:
    """Return a JSON string mimicking OpenAIService.match_angles_to_images.

    ``assignments`` maps "angle_num:variation_num" -> "image_id".
    Default: {"1:1": "12.png"}.
    """
    if assignments is None:
        assignments = {"1:1": "12.png"}
    items = []
    for slot, img_id in assignments.items():
        a, v = slot.split(":")
        items.append({"angle_num": a, "variation_num": v, "image_id": img_id})
    return json.dumps({"assignments": items})


def make_library_descriptions() -> dict:
    """Return a minimal library descriptions dict for S3 seeding."""
    return {
        "descriptions": [
            {"imageId": "12.png", "description": "Woman holding a product jar"},
            {"imageId": "23.png", "description": "Man exercising outdoors"},
            {"imageId": "35.png", "description": "Close-up of supplement bottle"},
        ]
    }
