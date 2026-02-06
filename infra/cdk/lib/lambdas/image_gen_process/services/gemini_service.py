"""
Gemini service wrapper for image_gen_process Lambda.

Contains Google Gemini API wrapper for image generation with usage tracking.
"""

import base64
import io
import time
from typing import Any, List, Optional

from utils.logging_config import setup_logging
from llm_usage import (
    UsageContext,
    emit_llm_usage_event,
    normalize_gemini_usage,
)

logger = setup_logging(__name__)


class GeminiService:
    """Google Gemini API service wrapper with usage tracking."""
    
    def __init__(self):
        """
        Initialize Gemini service.
        
        Client auto-picks GOOGLE_API_KEY / GEMINI_API_KEY from env per google-genai docs.
        """
        from google import genai
        self.client = genai.Client()
        self.genai = genai
    
    def generate_image(
        self,
        prompt: str,
        reference_image_bytes: Optional[bytes],
        product_image_bytes: Optional[bytes],
        job_id: Optional[str],
    ) -> str:
        """
        Generate image using Gemini's image generation API.
        
        Args:
            prompt: Generation prompt.
            reference_image_bytes: Reference image as bytes.
            product_image_bytes: Product image as bytes (optional).
            job_id: Job ID for usage tracking.
            
        Returns:
            Base64-encoded generated image (PNG).
            
        Raises:
            RuntimeError: If Gemini returns no image.
        """
        import PIL.Image
        from google.genai import types
        
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
        
        try:
            resp = self.client.models.generate_content(
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
        
        data_bytes = self._extract_first_image_bytes(resp)
        if not data_bytes:
            raise RuntimeError("Gemini returned no image bytes")
        data_bytes = self._enforce_max_size(data_bytes)
        return base64.b64encode(data_bytes).decode("utf-8")
    
    @staticmethod
    def _enforce_max_size(data: bytes, max_bytes: int = 1_000_000) -> bytes:
        """Compress image to fit within *max_bytes* (default 1 MB).

        Strategy: re-encode as JPEG with progressively lower quality.
        """
        if len(data) <= max_bytes:
            return data

        import PIL.Image

        img = PIL.Image.open(io.BytesIO(data))
        if img.mode == "RGBA":
            img = img.convert("RGB")

        for quality in (90, 80, 70, 60, 50, 40, 30):
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=quality)
            if buf.tell() <= max_bytes:
                logger.debug("Compressed image to %d bytes (quality=%d)", buf.tell(), quality)
                return buf.getvalue()

        # Last resort: scale down until it fits
        scale = 0.9
        while scale > 0.1:
            resized = img.resize(
                (int(img.width * scale), int(img.height * scale)),
                PIL.Image.LANCZOS,
            )
            buf = io.BytesIO()
            resized.save(buf, format="JPEG", quality=30)
            if buf.tell() <= max_bytes:
                logger.debug(
                    "Resized image to %dx%d (%d bytes)",
                    resized.width, resized.height, buf.tell(),
                )
                return buf.getvalue()
            scale -= 0.1

        logger.warning("Could not compress image below %d bytes", max_bytes)
        return buf.getvalue()

    def _extract_first_image_bytes(self, response: Any) -> Optional[bytes]:
        """
        Extract first image bytes from Gemini response.
        
        google-genai response objects commonly expose:
        - response.parts[*] with part.inline_data + part.as_image()
        but we keep fallbacks to handle schema drift.
        
        Args:
            response: Gemini API response object.
            
        Returns:
            Raw image bytes or None.
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
