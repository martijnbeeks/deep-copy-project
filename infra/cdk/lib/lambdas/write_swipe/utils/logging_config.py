"""
Logging configuration for write_swipe Lambda.
"""

import logging
import os
import sys

def setup_logging(name: str = __name__) -> logging.Logger:
    """
    Configure and return a logger for the application.
    """
    logger = logging.getLogger(name)
    
    log_level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)
    logger.setLevel(log_level)
    
    if not logger.handlers:
        stdout_handler = logging.StreamHandler(stream=sys.stdout)
        stdout_handler.setLevel(log_level)
        formatter = logging.Formatter(fmt="%(asctime)s %(levelname)s %(name)s - %(message)s")
        stdout_handler.setFormatter(formatter)
        logger.addHandler(stdout_handler)
    else:
        for h in logger.handlers:
            try:
                h.setLevel(log_level)
            except Exception:
                pass
    
    return logger
