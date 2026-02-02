"""
Shared helpers for write_swipe Lambda.
"""
from datetime import datetime, timezone

def now_iso() -> str:
    """Get current UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).isoformat()
