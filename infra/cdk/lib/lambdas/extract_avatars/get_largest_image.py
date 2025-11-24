import sys
import time
import json
import requests
import base64
import io
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from PIL import Image
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def compress_image_if_needed(image_bytes: bytes, max_size_mb: int = 1) -> bytes:
    """
    Compress image if it exceeds the max size.
    Resize and reduce quality iteratively until it fits.
    """
    max_bytes = max_size_mb * 1024 * 1024
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
        # convert to base64 string
        base64_str = base64.b64encode(compressed_bytes).decode("utf-8")
        logger.info(f"Compressed image to {len(compressed_bytes)} bytes (Quality: {quality})")
        return base64_str
        
    except Exception as e:
        logger.error(f"Failed to compress image: {e}")
        # Return original if compression fails, better than nothing (or raise)
        return image_bytes


def capture_product_image(url: str) -> bytes:
    """
    Capture the most likely product image from a webpage.
    Priority:
    1. Open Graph (og:image) or Twitter Card (twitter:image) meta tags.
    2. JSON-LD Product schema image.
    3. Fallback to finding the largest image that fits product dimensions (square-ish).
    
    Returns compressed image bytes in base64 string
    """
    start_time = time.time()
    
    # Use a realistic user agent
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
    }
    
    final_image_bytes = None
    
    try:
        logger.info(f"Fetching page for image extraction: {url}")
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        html_content = response.text
        
        soup = BeautifulSoup(html_content, "html.parser")
        
        candidate_urls = []

        # 1. Meta Tags (High Priority)
        og_image = soup.find("meta", property="og:image")
        if og_image and og_image.get("content"):
            candidate_urls.append(og_image["content"])
            logger.info(f"Found og:image: {og_image['content']}")
            
        twitter_image = soup.find("meta", property="twitter:image")
        if twitter_image and twitter_image.get("content"):
            candidate_urls.append(twitter_image["content"])
            logger.info(f"Found twitter:image: {twitter_image['content']}")

        # 2. JSON-LD Schema (High Priority)
        json_ld_scripts = soup.find_all('script', type='application/ld+json')
        for script in json_ld_scripts:
            try:
                data = json.loads(script.string)
                # Handle list of schemas or single schema
                if isinstance(data, list):
                    schemas = data
                else:
                    schemas = [data]
                
                for schema in schemas:
                    if schema.get('@type') == 'Product':
                        image = schema.get('image')
                        if isinstance(image, str):
                            candidate_urls.append(image)
                            logger.info(f"Found JSON-LD Product image: {image}")
                        elif isinstance(image, list):
                             # Often the first one is the main one
                             candidate_urls.extend(image)
                             logger.info(f"Found JSON-LD Product images: {image}")
            except Exception:
                continue

        # Try downloading high priority candidates first
        found_candidate = False
        for img_url in candidate_urls:
            full_url = urljoin(url, img_url)
            image_bytes = download_and_validate_image(full_url, headers)
            if image_bytes:
                 print(f"Image capture took {time.time() - start_time:.2f}s (Strategy: Meta/Schema)")
                 final_image_bytes = image_bytes
                 found_candidate = True
                 break
        
        if not found_candidate:
            # 3. Fallback: heuristic scan of <img> tags
            logger.info("No suitable meta/schema images found. scanning <img> tags...")
            img_tags = soup.find_all("img")
            image_urls = set()
            for img in img_tags:
                src = img.get("src")
                if not src:
                    src = img.get("data-src")
                if src:
                    full_url = urljoin(url, src)
                    image_urls.add(full_url)
            
            best_image_bytes = None
            max_score = 0
            
            for img_url in image_urls:
                 # Download to check size/aspect ratio
                 img_data = download_image_bytes(img_url, headers)
                 if not img_data:
                     continue
                     
                 try:
                    with Image.open(io.BytesIO(img_data)) as im:
                        width, height = im.size
                        area = width * height
                        
                        # Filter out small icons/pixels
                        if width < 200 or height < 200:
                            continue
                            
                        aspect_ratio = width / height
                        
                        # Scoring heuristic:
                        # - Area is important (bigger is usually better for detail)
                        # - Aspect ratio close to 1.0 (square) is typical for products (0.5 to 2.0 range)
                        # - Penalize very wide banners (aspect ratio > 2.5)
                        
                        score = area
                        if 0.8 <= aspect_ratio <= 1.2:
                            score *= 1.5 # Boost square-ish images
                        elif aspect_ratio > 2.5 or aspect_ratio < 0.4:
                            score *= 0.1 # Penalize extreme ratios
                        
                        if score > max_score:
                            max_score = score
                            best_image_bytes = img_data
                            logger.info(f"New best candidate ({width}x{height}, ar={aspect_ratio:.2f}): {img_url}")
                 except Exception:
                     continue
            
            if best_image_bytes:
                print(f"Image capture took {time.time() - start_time:.2f}s (Strategy: Heuristic Scan)")
                final_image_bytes = best_image_bytes
            else:
                logger.warning("No suitable images found.")
                return None

    except Exception as e:
        logger.error(f"Error extracting image: {e}")
        return None
        
    # Compress if we found an image
    if final_image_bytes:
        return compress_image_if_needed(final_image_bytes, max_size_mb=0.5)
    return None

def download_image_bytes(url, headers):
    try:
        if url.startswith("data:image"):
            header, encoded = url.split(",", 1)
            return base64.b64decode(encoded)
            
        with requests.get(url, headers=headers, stream=True, timeout=10) as r:
            if r.status_code == 200 and 'image' in r.headers.get('content-type', ''):
                return r.content
    except Exception:
        return None
    return None

def download_and_validate_image(url, headers):
    """Download image and ensure it's a valid image file larger than a thumbnail."""
    img_data = download_image_bytes(url, headers)
    if not img_data:
        return None
        
    try:
        with Image.open(io.BytesIO(img_data)) as im:
            width, height = im.size
            if width > 200 and height > 200:
                return img_data
    except Exception:
        pass
    return None


