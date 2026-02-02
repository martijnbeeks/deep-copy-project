"""
Gemini service wrapper for prelander_image_gen Lambda.
"""

import base64
import io
import time
from typing import Any, Optional

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
        product_image_bytes: Optional[bytes],
        job_id: Optional[str],
    ) -> str:
        """
        Generate image using Gemini's image generation API.
        
        Args:
            prompt: Generation prompt.
            product_image_bytes: Product image as bytes (optional).
            job_id: Job ID for usage tracking.
            
        Returns:
            Base64-encoded generated image (PNG).
            
        Raises:
            RuntimeError: If Gemini returns no image.
        """
        import PIL.Image
        from google.genai import types
        
        contents = [prompt]
        
        # Add product image if provided
        if product_image_bytes:
            logger.debug("Adding product image to Gemini generation")
            contents.append(PIL.Image.open(io.BytesIO(product_image_bytes)))
        else:
            logger.debug("No product image provided for Gemini generation")
        
        model_name = "gemini-3-pro-image-preview"
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
                ctx=UsageContext(endpoint="POST /prelander-images/generate", job_id=job_id, job_type="PRELANDER_IMAGE_GEN"),
                provider="google",
                model=model_name,
                operation="models.generate_content",
                subtask="prelander_image_gen.generate_image",
                latency_ms=int((time.time() - t0) * 1000),
                success=True,
                retry_attempt=1,
                usage={**normalize_gemini_usage(resp), "imagesGenerated": 1},
            )
        except Exception as e:
            emit_llm_usage_event(
                ctx=UsageContext(endpoint="POST /prelander-images/generate", job_id=job_id, job_type="PRELANDER_IMAGE_GEN"),
                provider="google",
                model=model_name,
                operation="models.generate_content",
                subtask="prelander_image_gen.generate_image",
                latency_ms=int((time.time() - t0) * 1000),
                success=False,
                retry_attempt=1,
                error_type=type(e).__name__,
            )
            raise
        
        data_bytes = self._extract_first_image_bytes(resp)
        if not data_bytes:
            raise RuntimeError("Gemini returned no image bytes")
        return base64.b64encode(data_bytes).decode("utf-8")
    
    def _extract_first_image_bytes(self, response: Any) -> Optional[bytes]:
        """
        Extract first image bytes from Gemini response.
        
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

