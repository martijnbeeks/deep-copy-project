"""
Image processing utilities for image_gen_process Lambda.

Contains image ID normalization, MIME type detection, and product image support checks.
"""

import os
import re
from typing import Dict, Optional

from utils.logging_config import setup_logging

logger = setup_logging(__name__)

# Reference image IDs that do NOT support product image merging
# These images should be used as-is without forcing product images into them
REF_IMAGES_WITHOUT_PRODUCT = {
    "10.png", "10", "15.png", "15", "24.png", "24", "25.png", "25",
    "27.png", "27", "29.png", "29", "30.png", "30", "33.png", "33",
    "35.png", "35", "40.png", "40", "41.png", "41", "43.png", "43",
    "44.png", "44", "45.png", "45", "50.png", "50", "52.png", "52",
}


def guess_mime_from_key(key: str, fallback: str = "image/png") -> str:
    """
    Guess MIME type from file key/path based on extension.
    
    Args:
        key: File key or path.
        fallback: Default MIME type if extension not recognized.
        
    Returns:
        MIME type string.
    """
    ext = os.path.splitext(key)[1].lower()
    if ext == ".png":
        return "image/png"
    if ext in (".jpg", ".jpeg"):
        return "image/jpeg"
    if ext == ".webp":
        return "image/webp"
    if ext == ".gif":
        return "image/gif"
    return fallback


def normalize_image_id(x: str) -> str:
    """
    Normalize image ID to consistent format.
    
    Ensures IDs have proper file extensions (defaults to .png).
    
    Args:
        x: Raw image ID string.
        
    Returns:
        Normalized image ID with extension.
    """
    x = str(x).strip()
    if not x:
        return x
    if re.fullmatch(r"\d+", x):
        return f"{x}.png"
    if "." not in x:
        return f"{x}.png"
    return x


def supports_product_image(
    ref_id: str,
    uploaded_images_metadata: Optional[Dict[str, dict]] = None,
    library_images_metadata: Optional[Dict[str, dict]] = None,
) -> bool:
    """
    Check if a reference image supports product image merging.
    
    Args:
        ref_id: Reference image ID.
        uploaded_images_metadata: Metadata dict for uploaded images (from vision check).
        library_images_metadata: Metadata dict for library images (from vision check).
        
    Returns:
        True if the image supports product merging, False otherwise.
    """
    if not ref_id:
        return True  # Default to supporting if no ID provided
    
    # First check if it's an uploaded image (starts with "uploaded_" prefix or is in metadata)
    if uploaded_images_metadata and ref_id in uploaded_images_metadata:
        img_meta = uploaded_images_metadata[ref_id]
        has_product = img_meta.get("hasProduct", True)  # Default to True if not set
        logger.debug("Uploaded image %s hasProduct=%s", ref_id, has_product)
        return has_product
    
    # Check if it's a library image that was checked with vision
    if library_images_metadata and ref_id in library_images_metadata:
        img_meta = library_images_metadata[ref_id]
        has_product = img_meta.get("hasProduct", True)
        logger.debug("Library image (vision-checked) %s hasProduct=%s", ref_id, has_product)
        return has_product
    
    # Fallback: check static library exclusion list (for images not in forced_ids)
    normalized = normalize_image_id(ref_id)
    base_id = normalized.replace(".png", "").replace(".jpg", "").replace(".webp", "").replace(".jpeg", "")
    
    is_excluded = (
        ref_id in REF_IMAGES_WITHOUT_PRODUCT
        or normalized in REF_IMAGES_WITHOUT_PRODUCT
        or base_id in REF_IMAGES_WITHOUT_PRODUCT
    )
    
    result = not is_excluded
    logger.debug(
        "Static library image (fallback): ref_id=%s normalized=%s base_id=%s is_excluded=%s result=%s",
        ref_id,
        normalized,
        base_id,
        is_excluded,
        result,
    )
    return result
