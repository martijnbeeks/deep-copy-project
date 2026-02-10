"""
Cloudflare Images service wrapper for process_job_v2 Lambda.

Uploads the product screenshot to Cloudflare Images CDN.
"""

import base64
import logging
from typing import Dict, Optional

from cloudflare import Cloudflare

logger = logging.getLogger(__name__)


class CloudflareService:
    """Cloudflare Images API service wrapper."""

    def __init__(self, api_token: str, account_id: str):
        """
        Initialize Cloudflare service.

        Args:
            api_token: Cloudflare API token.
            account_id: Cloudflare account ID.
        """
        self.account_id = account_id
        self.client = Cloudflare(api_token=api_token)

    def upload_base64_image(
        self,
        base64_data: str,
        filename: str,
        metadata: Optional[Dict[str, str]] = None,
    ) -> str:
        """
        Upload a base64-encoded image to Cloudflare Images.

        Args:
            base64_data: Base64-encoded image data.
            filename: Filename for the uploaded image.
            metadata: Optional metadata dict.

        Returns:
            URL string (first variant).

        Raises:
            RuntimeError: If upload fails.
        """
        import httpx

        # Strip data-URI prefix if present
        base64_data = base64_data.strip()
        if base64_data.startswith("data:") and "," in base64_data:
            base64_only = base64_data.split(",", 1)[1]
        else:
            base64_only = base64_data
        img_bytes = base64.b64decode(base64_only)

        try:
            resp = self.client.post(
                f"/accounts/{self.account_id}/images/v1",
                cast_to=httpx.Response,
                options={
                    "headers": {"Content-Type": "multipart/form-data"},
                    "multipart_syntax": "json",
                },
                body={
                    "requireSignedURLs": False,
                    "metadata": metadata or {},
                },
                files={
                    "file": (filename, img_bytes, "image/jpeg"),
                },
            )

            payload = resp.json()
            if not payload.get("success", False):
                raise RuntimeError(f"Cloudflare Images upload failed: {payload}")

            result = payload.get("result") or {}
            variants = result.get("variants", [])
            if not variants:
                raise RuntimeError(f"Cloudflare Images returned no variants: {result}")

            url = variants[0]
            logger.info("Uploaded product image to Cloudflare: %s", url)
            return url

        except Exception as e:
            logger.error(
                "Cloudflare Images upload failed: filename=%s err=%s",
                filename,
                e,
            )
            raise
