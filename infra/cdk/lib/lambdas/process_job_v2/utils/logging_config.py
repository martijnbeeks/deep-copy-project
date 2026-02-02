"""
Logging configuration for process_job_v2 Lambda.

Provides consistent logging setup across all modules.
"""

import logging
import os
import sys
from typing import Optional


# Module-level logger instance
_logger: Optional[logging.Logger] = None


def setup_logging() -> logging.Logger:
    """
    Configure and return the root logger for the Lambda.
    
    Derives log level from LOG_LEVEL environment variable (default: INFO).
    Sets up stdout handler for local/ECS execution, or aligns existing
    Lambda handlers to the configured level.
    
    Returns:
        Configured logger instance.
    """
    global _logger
    
    if _logger is not None:
        return _logger
    
    logger = logging.getLogger()
    
    # Derive log level from env, default INFO
    log_level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)
    logger.setLevel(log_level)
    
    # Add stdout handler if none exist (local/ECS), otherwise align existing handlers' levels (Lambda)
    if not logger.handlers:
        stdout_handler = logging.StreamHandler(stream=sys.stdout)
        stdout_handler.setLevel(log_level)
        formatter = logging.Formatter(
            fmt="%(asctime)s %(levelname)s %(name)s - %(message)s"
        )
        stdout_handler.setFormatter(formatter)
        logger.addHandler(stdout_handler)
    else:
        for handler in logger.handlers:
            try:
                handler.setLevel(log_level)
            except Exception:
                pass
    
    _logger = logger
    return logger


def get_logger() -> logging.Logger:
    """
    Get the configured logger instance.
    
    If setup_logging() hasn't been called yet, it will be called automatically.
    
    Returns:
        Configured logger instance.
    """
    if _logger is None:
        return setup_logging()
    return _logger
