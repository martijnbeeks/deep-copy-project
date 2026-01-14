"""
Image processing utilities for process_job_v2 Lambda.

Provides screenshot capture and image compression functionality.
"""

import io
import logging
from PIL import Image
from playwright.sync_api import sync_playwright


logger = logging.getLogger(__name__)


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
