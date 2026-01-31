"""
Cloudflare Images service wrapper for prelander_image_gen Lambda.
"""

import base64
import os
from typing import Optional

from cloudflare import Cloudflare

from utils.logging_config import setup_logging

logger = setup_logging(__name__)


class CloudflareService:
    """Cloudflare Images API service wrapper."""
    
    def __init__(self):
        """
        Initialize Cloudflare service.
        
        Uses CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID from environment.
        
        Raises:
            RuntimeError: If required credentials are not set.
        """
        self.api_token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
        self.account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
        
        if not self.api_token:
            raise RuntimeError("CLOUDFLARE_API_TOKEN not set")
        if not self.account_id:
            raise RuntimeError("CLOUDFLARE_ACCOUNT_ID not set")
        
        self.client = Cloudflare(api_token=self.api_token)
    
    def upload_base64_image(
        self,
        base64_data: str,
        filename: str,
        role: str,
        job_id: Optional[str] = None,
    ) -> dict:
        """
        Upload an image to Cloudflare Images.
        
        Args:
            base64_data: Base64-encoded image data.
            filename: Filename for the uploaded image.
            role: Image role for metadata.
            job_id: Job ID for metadata.
            
        Returns:
            Dict with 'id', 'filename', 'variants', and 'meta' keys.
            
        Raises:
            RuntimeError: If upload fails.
        """
        import httpx
        
        # Decode base64
        base64_data = base64_data.strip()
        if base64_data.startswith("data:") and "," in base64_data:
            base64_only = base64_data.split(",", 1)[1]
        else:
            base64_only = base64_data
        img_bytes = base64.b64decode(base64_only)

        metadata_obj = {
            "role": role,
            "job_id": job_id or "",
        }

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
            status_code = getattr(e, "status_code", None)
            response = getattr(e, "response", None)
            logger.error(
                "Cloudflare Images upload failed: job_id=%s filename=%s role=%s status_code=%s response=%s err=%s",
                job_id,
                filename,
                role,
                status_code,
                response,
                e,
            )
            raise

