"""
Logging configuration for image_gen_process Lambda.

Provides centralized logging setup that works both in Lambda environment
and for local development.
"""

import logging
import os
import sys


def setup_logging(name: str = __name__) -> logging.Logger:
    """
    Configure and return a logger for the application.
    
    Args:
        name: Logger name (defaults to module name).
        
    Returns:
        Configured logger instance.
    """
    logger = logging.getLogger(name)
    
    # Derive log level from env, default INFO
    log_level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)
    logger.setLevel(log_level)
    
    # Add stdout handler if none exist (local), otherwise align existing handlers' levels (Lambda)
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
