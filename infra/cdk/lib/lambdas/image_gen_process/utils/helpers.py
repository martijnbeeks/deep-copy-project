"""
General helper utilities for image_gen_process Lambda.

Contains environment variable helpers, timestamp utilities, and string manipulation.
"""

import os
import re
from datetime import datetime, timezone
from typing import Optional


def env(name: str, default: Optional[str] = None) -> str:
    """
    Get required environment variable.
    
    Args:
        name: Environment variable name.
        default: Optional default value.
        
    Returns:
        Environment variable value.
        
    Raises:
        RuntimeError: If variable is not set and no default provided.
    """
    v = os.environ.get(name, default)
    if v is None or v == "":
        raise RuntimeError(f"Missing env {name}")
    return v


def now_iso() -> str:
    """
    Get current UTC timestamp in ISO format.
    
    Returns:
        ISO formatted timestamp string.
    """
    return datetime.now(timezone.utc).isoformat()


def slug(s: str) -> str:
    """
    Convert string to URL-safe slug.
    
    Args:
        s: Input string.
        
    Returns:
        Slugified string (lowercase, alphanumeric, dashes only, max 80 chars).
    """
    s = s.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")[:80] or "unknown"
