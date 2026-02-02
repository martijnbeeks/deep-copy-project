import base64
import io
import logging
import os
import time

from PIL import Image
from playwright.sync_api import sync_playwright

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def compress_image_if_needed(image_bytes: bytes, max_size_mb: float = 1.0) -> str:
    """
    Convert image bytes to a JPEG and ensure it fits within `max_size_mb`.

    Returns:
        Base64-encoded JPEG string (no data URL prefix).
    """
    max_bytes = int(max_size_mb * 1024 * 1024)
        
    try:
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB for JPEG output
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        quality = 90
        scale_step = 0.85
        output_io = io.BytesIO()

        while True:
            output_io.seek(0)
            output_io.truncate()

            img.save(
                output_io,
                format="JPEG",
                quality=quality,
                optimize=True,
                progressive=True,
            )

            current_size = output_io.tell()
            if current_size <= max_bytes:
                break

            # Prefer lowering quality first, then resize.
            if quality > 30:
                quality -= 10
                continue

            width, height = img.size
            new_width = max(1, int(width * scale_step))
            new_height = max(1, int(height * scale_step))
            if new_width == width and new_height == height:
                break
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            quality = 70

        jpeg_bytes = output_io.getvalue()
        logger.info(
            "Compressed image to %s bytes (target<=%s, quality=%s)",
            len(jpeg_bytes),
            max_bytes,
            quality,
        )
        return base64.b64encode(jpeg_bytes).decode("utf-8")
        
    except Exception as e:
        logger.error(f"Failed to compress image: {e}")
        # Best-effort fallback: still return base64 of original bytes.
        return base64.b64encode(image_bytes).decode("utf-8")


def capture_product_image(url: str) -> str | None:
    """
    Capture a screenshot from the rendered webpage (Playwright) and return it as
    a base64-encoded JPEG string (no data URL prefix).

    Default behavior captures the top part of the page to keep sizes small.
    Configure via env vars:
      - SCREENSHOT_MODE: "top" (default) | "viewport" | "full"
      - SCREENSHOT_TOP_HEIGHT: pixels for "top" mode (default: 800)
      - SCREENSHOT_MAX_SIZE_MB: max output size in MB after JPEG conversion (default: 0.5)
      - SCREENSHOT_VIEWPORT_WIDTH / SCREENSHOT_VIEWPORT_HEIGHT: viewport size
    """
    start_time = time.time()
    screenshot_mode = os.environ.get("SCREENSHOT_MODE", "top").lower()
    top_height = int(os.environ.get("SCREENSHOT_TOP_HEIGHT", "800"))
    max_size_mb = float(os.environ.get("SCREENSHOT_MAX_SIZE_MB", "0.5"))
    viewport_width = int(os.environ.get("SCREENSHOT_VIEWPORT_WIDTH", "1280"))
    viewport_height = int(os.environ.get("SCREENSHOT_VIEWPORT_HEIGHT", "2000"))

    try:
        with sync_playwright() as p:
            launch_args = {
                "headless": True,
                "args": [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--single-process",
                    "--no-zygote",
                    "--disable-software-rasterizer",
                ],
            }

            browser = p.chromium.launch(**launch_args)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/118.0.0.0 Safari/537.36"
                ),
                viewport={"width": viewport_width, "height": viewport_height},
            )
            page = context.new_page()

            logger.info("Loading page for screenshot: %s", url)
            page.set_default_navigation_timeout(45000)
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            try:
                page.wait_for_load_state("networkidle", timeout=5000)
            except Exception:
                pass
            page.wait_for_timeout(1000)

            # Ensure we start at the top
            try:
                page.evaluate("window.scrollTo(0, 0)")
            except Exception:
                pass

            screenshot_kwargs = {"type": "png"}
            if screenshot_mode == "full":
                screenshot_kwargs["full_page"] = True
            elif screenshot_mode == "viewport":
                screenshot_kwargs["full_page"] = False
            else:
                # Default: capture just the top part of the viewport to keep sizes smaller
                screenshot_kwargs["full_page"] = False
                screenshot_kwargs["clip"] = {
                    "x": 0,
                    "y": 0,
                    "width": viewport_width,
                    "height": min(top_height, viewport_height),
                }

            screenshot_bytes = page.screenshot(**screenshot_kwargs)

            page.close()
            context.close()
            browser.close()

        logger.info(
            "Screenshot captured (%s bytes) in %.2fs",
            len(screenshot_bytes),
            time.time() - start_time,
        )
        return compress_image_if_needed(screenshot_bytes, max_size_mb=max_size_mb)
    except Exception as e:
        logger.error("Error capturing screenshot: %s", e)
        return None

