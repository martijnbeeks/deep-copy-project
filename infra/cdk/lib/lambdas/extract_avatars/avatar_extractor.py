"""
Avatar extraction module for AWS Lambda.
Extracts customer avatars from product pages using OpenAI vision.
"""
import base64
import logging
from typing import List
from pydantic import BaseModel, Field
from openai import OpenAI
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

        browser = p.chromium.launch(**launch_args)
        page = browser.new_page()

        # Load the page
        logger.info(f"Loading page: {url}")
        page.goto(url, wait_until="networkidle", timeout=30000)

        # Take a full-page screenshot and return bytes
        logger.info("Capturing screenshot")
        screenshot_bytes = page.screenshot(full_page=True)
        
        page.close()
        browser.close()
        
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


def extract_avatars_from_url(url: str, openai_api_key: str, model: str = "gpt-5-mini") -> AvatarCollection:
    """
    Extract customer avatars from a product page URL using OpenAI.
    Optimized for AWS Lambda - no file storage required.
    
    Args:
        url: The product page URL to analyze
        openai_api_key: OpenAI API key
        model: OpenAI model to use (default: gpt-4o-mini)
        
    Returns:
        AvatarCollection containing the extracted avatars
    """
    client = OpenAI(api_key=openai_api_key)
    
    try:
        # Capture the page as image bytes (no file storage)
        logger.info(f"Capturing page: {url}")
        image_bytes = capture_page_as_image_bytes(url)
        
        # Encode the image
        base64_image = encode_image_bytes(image_bytes)
        logger.info(f"Image captured and encoded ({len(base64_image)} chars)")
        
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

        # Call OpenAI with structured output
        logger.info(f"Calling OpenAI API ({model}) to extract avatars")
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
        logger.info("Successfully extracted avatars from OpenAI")
        
        return response.choices[0].message.parsed
        
    except Exception as e:
        logger.error(f"Error extracting avatars from URL: {e}")
        raise

