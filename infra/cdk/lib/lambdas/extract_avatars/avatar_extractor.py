"""
Avatar extraction module for AWS Lambda.
Extracts customer avatars from product pages using OpenAI vision.
"""
import base64
import os
import logging
import time
from typing import List
from pydantic import BaseModel, Field
from openai import OpenAI
from playwright.sync_api import sync_playwright
from get_largest_image import compress_image_if_needed

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
    company_type: str = Field(..., description="The type of company the product is for")
    product_description: str = Field(..., description="A description of the product")


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


def extract_avatars_from_url(url: str, openai_api_key: str, model: str = "gpt-5") -> AvatarCollection:
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
        
        # Compress and encode the image (max 0.5MB)
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
        print(f"OpenAI API call completed in {time.time() - api_start:.2f}s")
        
        total_time = time.time() - start_time
        result = response.choices[0].message.parsed
        print(f"Successfully extracted avatars from OpenAI - Total time: {total_time:.2f}s")
        
        
        
        # result = AvatarCollection(
        #     avatars=[
        #         CustomerAvatar(
        #             persona_name='Appearance-Conscious Man (General)',
        #             characteristics=['grooming-focused', 'time-poor', 'results-driven'],
        #             description='A man who cares about first impressions, needs a reliable scalp/dandruff solution that restores confidence without a complicated routine.',
        #             age_range='25-44',
        #             gender='male',
        #             key_buying_motivation='A clinically backed, visible-results treatment that removes flakes and restores confidence.',
        #             pain_point='Visible flakes/itchy scalp that undermines confidence in social and professional settings.',
        #             emotion='Embarrassment',
        #             desire='A fast, effective, non-irritating product with proven results and low effort.',
        #             objections=['Is it actually effective or just marketing?', 'Too expensive compared to drugstore brands', 'May irritate my scalp or smell too strong', 'Subscription/auto-renewal concerns'],
        #             failed_alternatives=['Generic anti-dandruff shampoos', 'Home remedies (oils, vinegar rinses)', 'Changing shampoo frequently with no lasting improvement'],
        #             is_broad_avatar=True
        #         ),
        #         CustomerAvatar(
        #             persona_name='Young Urban Professional',
        #             characteristics=['career-driven', 'socially-active', 'image-conscious'],
        #             description='A young professional who needs a discreet, fast-working solution so flakes don\'t interfere with networking, dates or client meetings.',
        #             age_range='25-34',
        #             gender='male',
        #             key_buying_motivation='Restore a polished appearance quickly so he can feel confident at work and socially.',
        #             pain_point='Flakes showing on dark clothing and in photos during important events.',
        #             emotion='Anxiety',
        #             desire='A low-effort product that delivers visible improvement and keeps his look professional.',
        #             objections=['Won\'t show results fast enough for an upcoming event', 'Product might be too strong or leave residue', 'Price vs perceived short-term benefit'],
        #             failed_alternatives=['Dry shampoo to hide flakes', 'One-off medicated shampoos that temporarily help', 'Stylists\' quick fixes'],
        #             is_broad_avatar=False
        #         ),
        #         CustomerAvatar(
        #             persona_name='Busy Parent / Time-Pressed Guy',
        #             characteristics=['time-poor', 'practical', 'family-oriented'],
        #             description='A busy dad who wants a simple, reliable treatment he can use without extra steps or frequent visits to specialists.',
        #             age_range='35-44',
        #             gender='male',
        #             key_buying_motivation='A straightforward product that fits a rushed routine and actually stops flakes long-term.',
        #             pain_point='Persistent scalp issues but no time for complex treatments or repeated pharmacy trips.',
        #             emotion='Frustration',
        #             desire='An easy-to-use product with a clear guarantee (money-back) so he can try it risk-free.',
        #             objections=['Won\'t stick with a multi-step regimen', 'Subscription or recurring cost concerns', 'Unclear instructions for quick use'],
        #             failed_alternatives=['Occasional use of medicated shampoos', 'Home remedies between washes', 'Inconsistent products bought on sale'],
        #             is_broad_avatar=False
        #         ),
        #         CustomerAvatar(
        #             persona_name='Sensitive-Scalp / Ingredient-Conscious Man',
        #             characteristics=['health-aware', 'ingredient-focused', 'cautious'],
        #             description='A man whose scalp reacts easily and who carefully reads labels, seeking a gentle, clinically supported formula that won\'t cause irritation.',
        #             age_range='30-50',
        #             gender='male',
        #             key_buying_motivation='A clinically backed, gentle formula with clear ingredient transparency that soothes rather than aggravates the scalp.',
        #             pain_point='Past treatments caused burning, dryness or allergic reactions.',
        #             emotion='Worry',
        #             desire='A safe, proven product with gentle actives and evidence or certifications to support claims.',
        #             objections=['Contains harsh chemicals or allergens', 'Scent/added fragrances will irritate me', 'Clinical claims are exaggerated'],
        #             failed_alternatives=['High-strength medicated shampoos that dried skin', 'Prescription creams with unpleasant side effects', 'Natural remedies that didn\'t work'],
        #             is_broad_avatar=False
        #         ),
        #         CustomerAvatar(
        #             persona_name='Aging Man Concerned About Hair & Scalp',
        #             characteristics=['appearance-concerned', 'conservative', 'value-seeking'],
        #             description='An older man noticing thinning hair and scalp flaking who wants a reputable product that improves scalp health and looks age-appropriate.',
        #             age_range='45-60',
        #             gender='male',
        #             key_buying_motivation='Improve scalp condition to make hair look healthier and reduce signs of aging or neglect.',
        #             pain_point='Thinning hair combined with flakes makes him look older and less groomed.',
        #             emotion='Concern',
        #             desire='A credible, long-term solution that addresses scalp health and restores a neater appearance.',
        #             objections=['Skeptical of \'miracle\' or marketing claims', 'Cost vs long-term benefit', 'Worried product won\'t address thinning as promised'],
        #             failed_alternatives=['Expensive salon or clinic treatments with little benefit', 'Switching shampoos frequently', 'Over-the-counter anti-hair-loss products that didn\'t help flakes'],
        #             is_broad_avatar=False
        #         ),
        #         CustomerAvatar(
        #             persona_name='Deal-Seeking Trial Shopper',
        #             characteristics=['price-sensitive', 'curiosity-driven', 'digital-shopper'],
        #             description='A shopper who follows grooming trends and wants to try a low-risk solution (trial/demo or money-back) before committing to full price.',
        #             age_range='18-34',
        #             gender='male',
        #             key_buying_motivation='Low-risk trial offers, discounts, and clear guarantees that lower the barrier to test the product.',
        #             pain_point='Has limited budget and is unsure which product will actually work long-term.',
        #             emotion='Skepticism mixed with curiosity',
        #             desire='An affordable trial or guarantee so they can test results without financial regret.',
        #             objections=['Worries about hidden subscription or auto-renewal', 'Doubts about the validity of testimonials', 'Shipping or return hassles'],
        #             failed_alternatives=['Cheap drugstore brands that didn\'t last', 'Free sample promotions with no clear results', 'Impulse buys from social ads'],
        #             is_broad_avatar=False
        #         )
        #     ],
        #     company_type="Direct-to-consumer men's grooming / scalp care brand",
        #     product_description="A clinically backed scalp treatment (jar formula) targeted primarily at men to reduce flakes and soothe itchy scalp; marketed with real-life testimonials, a money-back results guarantee (e.g., results in 120 days or you don't pay), and clear ingredient/certification claims to reassure customers."
        # )
        
        return result
        
    except Exception as e:
        logger.error(f"Error extracting avatars from URL: {e}")
        raise
