"""
Image processing utilities for process_job_v2 Lambda.

Provides screenshot capture and image compression functionality.
"""

import base64
import io
import logging
from dataclasses import dataclass

from PIL import Image
from playwright.sync_api import sync_playwright


logger = logging.getLogger(__name__)


PRODUCT_IMAGE_HEIGHT = 800
VIEWPORT_WIDTH = 1280
VIEWPORT_HEIGHT = 2000

MODAL_CLOSE_SELECTORS = [
    "[data-dismiss]",
    ".close",
    ".modal-close",
    ".popup-close",
    "[aria-label='Close']",
    "button[aria-label='Close']",
    "button[aria-label='close']",
]

SCROLL_SCRIPT = """
    return new Promise(res => {
        const distance = 600;
        let lastHeight = 0;
        let interval = setInterval(() => {
            window.scrollBy(0, distance);
            let scrollHeight = document.body.scrollHeight;
            if (scrollHeight > lastHeight) {
                lastHeight = scrollHeight;
            } else {
                clearInterval(interval);
                window.scrollTo(0, 0);
                setTimeout(res, 600);
            }
            if ((window.innerHeight + window.scrollY) >= scrollHeight) {
                clearInterval(interval);
                window.scrollTo(0, 0);
                setTimeout(res, 600);
            }
        }, 380);
    });
"""


@dataclass
class PageScreenshots:
    """Result of capturing both full-page and product image screenshots."""
    fullpage_bytes: bytes
    product_image_bytes: bytes


def capture_page_screenshots(url: str) -> PageScreenshots:
    """
    Capture both a full-page screenshot and a product image (top 800px) in one browser session.

    Dismisses modals/popups, captures the product image before scrolling,
    then scrolls to trigger lazy loading and captures the full-page screenshot.

    Args:
        url: The URL to capture.

    Returns:
        PageScreenshots with fullpage_bytes and product_image_bytes.

    Raises:
        Exception: If page loading fails.
    """
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
                "--disable-web-security",
            ],
        }

        user_data_dir = "/tmp/playwright-user"
        context = p.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            viewport={"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
            **launch_args,
        )
        page = context.new_page()

        # Load the page
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            try:
                page.wait_for_load_state("networkidle", timeout=30000)
            except Exception:
                logger.warning(f"Timeout waiting for network idle on {url}, proceeding")
        except Exception as e:
            logger.error(f"Failed to load page {url}: {e}")
            raise

        # Dismiss modals/popups
        try:
            page.keyboard.press("Escape")
            page.wait_for_timeout(400)
        except Exception:
            pass

        for sel in MODAL_CLOSE_SELECTORS:
            try:
                btn = page.query_selector(sel)
                if btn:
                    btn.click()
                    page.wait_for_timeout(400)
            except Exception:
                continue

        # Ensure we're at the top before capturing product image
        try:
            page.evaluate("window.scrollTo(0, 0)")
        except Exception:
            pass

        # Capture product image (top portion of the page)
        product_image_bytes = page.screenshot(
            type="png",
            full_page=False,
            clip={
                "x": 0,
                "y": 0,
                "width": VIEWPORT_WIDTH,
                "height": min(PRODUCT_IMAGE_HEIGHT, VIEWPORT_HEIGHT),
            },
        )
        logger.info(f"Captured product image ({len(product_image_bytes)} bytes) for {url}")

        # Scroll to trigger lazy loading
        try:
            page.evaluate(SCROLL_SCRIPT)
        except Exception:
            pass

        # Capture full-page screenshot
        fullpage_bytes = page.screenshot(full_page=True)
        logger.info(f"Captured full-page screenshot ({len(fullpage_bytes)} bytes) for {url}")

        page.close()
        context.close()

        return PageScreenshots(
            fullpage_bytes=fullpage_bytes,
            product_image_bytes=product_image_bytes,
        )


def compress_to_base64(image_bytes: bytes, max_size_mb: float = 0.5) -> str:
    """
    Compress image bytes to JPEG and return as a base64 string.

    Args:
        image_bytes: Raw image data (PNG or other format).
        max_size_mb: Maximum size in megabytes for the compressed output.

    Returns:
        Base64-encoded JPEG string (no data URL prefix).
    """
    max_bytes = int(max_size_mb * 1024 * 1024)

    try:
        img = Image.open(io.BytesIO(image_bytes))

        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        quality = 90
        scale_step = 0.85
        output_io = io.BytesIO()

        while True:
            output_io.seek(0)
            output_io.truncate()
            img.save(output_io, format="JPEG", quality=quality, optimize=True, progressive=True)
            current_size = output_io.tell()

            if current_size <= max_bytes:
                break

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
        logger.info(f"Compressed image to {len(jpeg_bytes)} bytes (target<={max_bytes}, quality={quality})")
        return base64.b64encode(jpeg_bytes).decode("utf-8")

    except Exception as e:
        logger.error(f"Failed to compress image: {e}")
        return base64.b64encode(image_bytes).decode("utf-8")


def save_fullpage_png(url: str) -> bytes:
    """
    Capture a full-page screenshot of a URL using Playwright.
    
    Args:
        url: The URL to capture.
        
    Returns:
        Screenshot image as bytes (PNG format).
        
    Raises:
        Exception: If page loading fails.
    """
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
                "--disable-web-security",
            ],
        }

        # Use a persistent context instead of passing --user-data-dir to launch()
        user_data_dir = "/tmp/playwright-user"
        context = p.chromium.launch_persistent_context(user_data_dir=user_data_dir, **launch_args)
        page = context.new_page()

        # Load the page
        try:
            # Use domcontentloaded first with a longer timeout (60s)
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            
            # Try to wait for network idle, but proceed if it times out (some sites never idle)
            try:
                page.wait_for_load_state("networkidle", timeout=30000)
            except Exception:
                logger.warning(f"Timeout waiting for network idle on {url}, proceeding with screenshot")
                
        except Exception as e:
            logger.error(f"Failed to load page {url}: {e}")
            raise e

        # Take a full-page screenshot
        screenshot_bytes = page.screenshot(full_page=True)

        logger.info(f"Captured full-page screenshot for {url}")

        page.close()
        context.close()
        return screenshot_bytes


def compress_image_if_needed(image_bytes: bytes, max_size_mb: float = 0.5) -> bytes:
    """
    Compress image if it exceeds the max size.
    
    Resize and reduce quality iteratively until it fits within the size limit.
    
    Args:
        image_bytes: Original image data.
        max_size_mb: Maximum allowed size in megabytes (default: 0.5 MB).
        
    Returns:
        Compressed image bytes, or original if already under limit or compression fails.
    """
    max_bytes = int(max_size_mb * 1024 * 1024)
    if len(image_bytes) <= max_bytes:
        return image_bytes
        
    logger.info(f"Image size {len(image_bytes)} exceeds limit of {max_bytes}. Compressing...")
    
    try:
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if necessary (e.g. PNG with transparency to JPEG)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
             
        # Iteratively reduce quality/size
        quality = 90
        output_io = io.BytesIO()
        
        while True:
            output_io.seek(0)
            output_io.truncate()
            img.save(output_io, format='JPEG', quality=quality)
            current_size = output_io.tell()
            
            if current_size <= max_bytes or quality <= 10:
                break
                
            # Reduce quality
            quality -= 10
            
            # If quality is getting low, also resize
            if quality < 60:
                width, height = img.size
                new_width = int(width * 0.8)
                new_height = int(height * 0.8)
                # Ensure we don't shrink to 0
                if new_width < 1 or new_height < 1:
                    break
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        compressed_bytes = output_io.getvalue()
        logger.info(f"Compressed image to {len(compressed_bytes)} bytes")
        return compressed_bytes
        
    except Exception as e:
        logger.error(f"Failed to compress image: {e}")
        # Return original if compression fails
        return image_bytes
