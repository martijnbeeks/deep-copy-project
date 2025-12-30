"""
Avatar extraction module for AWS Lambda.
Extracts customer avatars from product pages using OpenAI vision.
"""
import base64
import os
import logging
import time
from typing import List, Optional
from pydantic import BaseModel, Field
from openai import OpenAI
from playwright.sync_api import sync_playwright
from get_largest_image import compress_image_if_needed
from llm_usage import UsageContext, emit_llm_usage_event, normalize_openai_usage

logger = logging.getLogger(__name__)


class CustomerAvatar(BaseModel):
    """Single customer avatar/persona"""
    persona_name: str = Field(..., description="A short, descriptive name that captures the essence of the customer")
    characteristics: List[str] = Field(..., description="Characteristics of the customer, e.g. Stands all day, Active lifestyle, etc. Provide at least 3 characteristics and max three words each.")
    description: str = Field(..., description="1 sentence summarizing their lifestyle, motivations, and key challenges")
    age_range: str = Field(..., description="Approximate age bracket (e.g., 25-34)")
    gender: str = Field(..., description="male, female, or both")
    key_buying_motivation: str = Field(..., description="What drives them to purchase this product")
    pain_point: str = Field(..., description="Specific problem or challenge the customer faces")
    emotion: str = Field(..., description="Emotion they feel related to the pain point")
    desire: str = Field(..., description="What they desire as a solution to their pain point")
    objections: List[str] = Field(..., description="List of objections or concerns they might have")
    failed_alternatives: List[str] = Field(..., description="List of alternatives they've tried that didn't work")
    is_broad_avatar: bool = Field(..., description="Whether this avatar represents the overall customer base")


class AvatarCollection(BaseModel):
    """Collection of customer avatars for a product"""
    avatars: List[CustomerAvatar] = Field(..., min_items=5, description="At least 5 distinct customer avatars")
    company_type: str = Field(..., description="The type of company the product is for. Max 4 words.")
    product_description: str = Field(..., description="A description of the product. Max 4 words.")


def capture_page_as_image_bytes(url: str) -> bytes:
    """
    Capture a webpage as a full-page PNG screenshot and return bytes directly.
    Optimized for AWS Lambda environment.
    
    Args:
        url: The URL to capture
        
    Returns:
        PNG image as bytes
    """
    start_time = time.time()
    
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

        browser_start = time.time()
        browser = p.chromium.launch(**launch_args)
        # Use a realistic desktop UA and a browser context for better compatibility
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/118.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1366, "height": 900},
        )
        page = context.new_page()
        print(f"Browser launch took {time.time() - browser_start:.2f}s")

        # Load the page
        logger.info(f"Loading page: {url}")
        page_load_start = time.time()
        # Many modern sites keep long-lived network connections which prevents
        # the "networkidle" state from ever being reached. Prefer a faster,
        # reliable load signal and then allow the page to settle briefly.
        page.set_default_navigation_timeout(45000)
        page.goto(url, wait_until="domcontentloaded", timeout=45000)
        try:
            page.wait_for_load_state("networkidle", timeout=5000)
        except Exception:
            pass
        page.wait_for_timeout(1500)

        # --- New Part: Dismiss modals/popups ---
        # 1. Press ESC to close generic overlays
        try:
            page.keyboard.press("Escape")
            page.wait_for_timeout(400)
        except Exception:
            pass  # keyboard may not be attached; continue

        # 2. Try clicking common close/exit selectors
        selectors = [
            "[data-dismiss]",
            ".close",
            ".modal-close",
            ".popup-close",
            "[aria-label='Close']",
            "button[aria-label='Close']",
            "button[aria-label='close']"
        ]
        for sel in selectors:
            try:
                btn = page.query_selector(sel)
                if btn:
                    btn.click()
                    page.wait_for_timeout(400)
            except Exception:
                continue

        # --- New Part: Scroll the page to the bottom, pausing to trigger lazy loads ---
        try:
            scroll_script = """
                let totalHeight = 0;
                const distance = 600;
                let lastHeight = 0;
                return new Promise(res => {
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
                            setTimeout(res, 600);
                        }
                    }, 380);
                });
            """
            page.evaluate(scroll_script)
        except Exception:
            pass

        # --- Screenshot mode config ---
        screenshot_mode = os.environ.get("SCREENSHOT_MODE", "full").lower()
        full_page = screenshot_mode != "viewport"

        screenshot_bytes = page.screenshot(full_page=full_page)

        # Take a full-page screenshot and return bytes
        logger.info("Capturing screenshot")
        screenshot_start = time.time()
       
        print(f"Screenshot capture took {time.time() - screenshot_start:.2f}s")
        
        page.close()
        context.close()
        browser.close()
        
        total_time = time.time() - start_time
        print(f"Total capture_page_as_image_bytes took {total_time:.2f}s")
        
        return screenshot_bytes


def encode_image_bytes(image_bytes: bytes) -> str:
    """
    Encode image bytes to base64.
    
    Args:
        image_bytes: Image data as bytes
        
    Returns:
        Base64-encoded string of the image
    """
    return base64.b64encode(image_bytes).decode("utf-8")


def extract_avatars_from_url(
    url: str,
    openai_api_key: str,
    model: str = "gpt-5",
    job_id: Optional[str] = None,
) -> AvatarCollection:
    """
    Extract customer avatars from a product page URL using OpenAI vision.
    Optimized for AWS Lambda - no file storage required.
    
    Args:
        url: The product page URL to analyze
        openai_api_key: OpenAI API key
        model: OpenAI model to use (default: gpt-4o)
        
    Returns:
        AvatarCollection containing the extracted avatars
    """
    start_time = time.time()
    
    # Initialize OpenAI client
    client = OpenAI(api_key=openai_api_key)
    
    try:
        # Capture the page as image bytes (no file storage)
        logger.info(f"Capturing page: {url}")
        capture_start = time.time()
        image_bytes = capture_page_as_image_bytes(url)
        print(f"Page capture completed in {time.time() - capture_start:.2f}s")
        
        # Compress and encode the image (max 0.5MB). Note: compression converts to JPEG.
        encode_start = time.time()
        base64_image = compress_image_if_needed(image_bytes, max_size_mb=0.5)
        print(f"Image processed in {time.time() - encode_start:.2f}s ({len(base64_image)} chars)")
        
        # Prepare the prompt
        prompt = """You are a marketing strategist and expert in defining customer avatars (detailed ideal customer profiles).

Based on the attached product page, identify several potential avatars for this product.

For each avatar, include:

- Persona name: a short, descriptive name that captures the essence of the customer.
- Description: 1 sentence summarizing their lifestyle, motivations, and key challenges.
- Age range: approximate age bracket (e.g., 25–34).
- Gender: male, female, or both.
- Key buying motivation: what drives them to purchase this product.
- Pain point: specific problem or challenge the customer faces.
- Emotion: emotion they feel related to the pain point.
- Desire: what they desire as a solution to their pain point.
- Objections: list of objections or concerns they might have.
- Failed alternatives: list of alternatives they've tried that didn't work.

Provide at least 5 avatars that represent distinct customer segments. Please also provide a general avatar that represents the overall customer base. Always return this one as the first avatar."""

        # Call OpenAI API with structured output
        logger.info(f"Calling OpenAI API ({model}) to extract avatars")
        api_start = time.time()
        t0 = time.time()
        try:
            response = client.beta.chat.completions.parse(
                model=model,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }],
                response_format=AvatarCollection,
            )
            emit_llm_usage_event(
                ctx=UsageContext(endpoint="POST /avatars/extract", job_id=job_id, job_type="AVATAR_EXTRACTION"),
                provider="openai",
                model=model,
                operation="beta.chat.completions.parse",
                subtask="extract_avatars.extract_avatars_from_url",
                latency_ms=int((time.time() - t0) * 1000),
                success=True,
                retry_attempt=1,
                usage=normalize_openai_usage(response),
            )
        except Exception as e:
            emit_llm_usage_event(
                ctx=UsageContext(endpoint="POST /avatars/extract", job_id=job_id, job_type="AVATAR_EXTRACTION"),
                provider="openai",
                model=model,
                operation="beta.chat.completions.parse",
                subtask="extract_avatars.extract_avatars_from_url",
                latency_ms=int((time.time() - t0) * 1000),
                success=False,
                retry_attempt=1,
                error_type=type(e).__name__,
            )
            raise
        print(f"OpenAI API call completed in {time.time() - api_start:.2f}s")
        
        total_time = time.time() - start_time
        result = response.choices[0].message.parsed
        print(f"Successfully extracted avatars from OpenAI - Total time: {total_time:.2f}s")
        
        
        return result
        
    except Exception as e:
        logger.error(f"Error extracting avatars from URL: {e}")
        raise
