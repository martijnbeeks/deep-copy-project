"""
Mock response factories for prelander_image_gen tests.
"""

import base64


def make_tiny_png_b64() -> str:
    """Return a base64-encoded 1x1 transparent PNG."""
    # Minimal valid 1x1 PNG
    raw = (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
        b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
        b"\r\n\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    return base64.b64encode(raw).decode("utf-8")


def make_cloudflare_upload_response(job_id: str = "test", role: str = "hero") -> dict:
    """Return a dict mimicking CloudflareService.upload_base64_image."""
    return {
        "id": f"cf-{job_id}-{role}",
        "filename": f"{job_id}_{role}.png",
        "variants": [f"https://imagedelivery.test/cf-{job_id}-{role}/public"],
        "meta": {"role": role, "job_id": job_id},
    }
