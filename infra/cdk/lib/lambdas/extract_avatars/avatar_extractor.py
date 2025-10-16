"""
Avatar extraction module for AWS Lambda.
Extracts customer avatars from product pages using Grok vision from x.ai.
"""
import base64
import logging
import time
from typing import List
from pydantic import BaseModel, Field
from openai import OpenAI  # x.ai API is OpenAI-compatible
from playwright.sync_api import sync_playwright

logger = logging.getLogger(__name__)


class CustomerAvatar(BaseModel):
    """Single customer avatar/persona"""
    persona_name: str = Field(..., description="A short, descriptive name that captures the essence of the customer")
    description: str = Field(..., description="1 sentence summarizing their lifestyle, motivations, and key challenges")
    age_range: str = Field(..., description="Approximate age bracket (e.g., 25-34)")
    gender: str = Field(..., description="male, female, or both")
    key_buying_motivation: str = Field(..., description="What drives them to purchase this product")


class AvatarCollection(BaseModel):
    """Collection of customer avatars for a product"""
    avatars: List[CustomerAvatar] = Field(..., min_items=3, description="At least 3 distinct customer avatars")


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
        page = browser.new_page()
        print(f"Browser launch took {time.time() - browser_start:.2f}s")

        # Load the page
        logger.info(f"Loading page: {url}")
        page_load_start = time.time()
        page.goto(url, wait_until="networkidle", timeout=30000)
        print(f"Page load took {time.time() - page_load_start:.2f}s")

        # Take a full-page screenshot and return bytes
        logger.info("Capturing screenshot")
        screenshot_start = time.time()
        screenshot_bytes = page.screenshot(full_page=True)
        print(f"Screenshot capture took {time.time() - screenshot_start:.2f}s")
        
        page.close()
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


def extract_avatars_from_url(url: str, grok_api_key: str, model: str = "grok-4-fast-non-reasoning") -> AvatarCollection:
    """
    Extract customer avatars from a product page URL using Grok from x.ai.
    Optimized for AWS Lambda - no file storage required.
    
    Args:
        url: The product page URL to analyze
        grok_api_key: Grok API key from x.ai
        model: Grok model to use (default: grok-4-fast-non-reasoning)
        
    Returns:
        AvatarCollection containing the extracted avatars
    """
    start_time = time.time()
    
    # Initialize x.ai client (OpenAI-compatible API)
    client = OpenAI(
        api_key=grok_api_key,
        base_url="https://api.x.ai/v1"
    )
    
    try:
        # Capture the page as image bytes (no file storage)
        logger.info(f"Capturing page: {url}")
        capture_start = time.time()
        image_bytes = capture_page_as_image_bytes(url)
        print(f"Page capture completed in {time.time() - capture_start:.2f}s")
        
        # Encode the image
        encode_start = time.time()
        base64_image = encode_image_bytes(image_bytes)
        print(f"Image encoded in {time.time() - encode_start:.2f}s ({len(base64_image)} chars)")
        
        # Prepare the prompt
        prompt = """You are a marketing strategist and expert in defining customer avatars (detailed ideal customer profiles).

Based on the attached product page, identify several potential avatars for this product.

For each avatar, include:

- Persona name: a short, descriptive name that captures the essence of the customer.
- Description: 1 sentence summarizing their lifestyle, motivations, and key challenges.
- Age range: approximate age bracket (e.g., 25–34).
- Gender: male, female, or both.
- Key buying motivation: what drives them to purchase this product.

Provide at least 3 avatars that represent distinct customer segments."""

        # Call Grok API with structured output
        logger.info(f"Calling Grok API ({model}) to extract avatars")
        api_start = time.time()
        response = client.beta.chat.completions.parse(
            model=model,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{base64_image}"
                        }
                    }
                ]
            }],
            response_format=AvatarCollection,
        )
        print(f"Grok API call completed in {time.time() - api_start:.2f}s")
        
        total_time = time.time() - start_time
        print(f"Successfully extracted avatars from Grok - Total time: {total_time:.2f}s")
        
        return response.choices[0].message.parsed
        
    except Exception as e:
        logger.error(f"Error extracting avatars from URL: {e}")
        raise

