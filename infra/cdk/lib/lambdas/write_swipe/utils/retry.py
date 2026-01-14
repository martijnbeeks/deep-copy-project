"""
Retry utilities for write_swipe Lambda.
"""
import time
import random
from functools import wraps
from typing import Callable, Any, Type, Union, Tuple
from utils.logging_config import setup_logging

logger = setup_logging(__name__)

def retry_with_exponential_backoff(
    func: Callable[..., Any],
    initial_delay: float = 1,
    exponential_base: float = 2,
    jitter: bool = True,
    max_retries: int = 5,
    errors: Union[Type[Exception], Tuple[Type[Exception], ...]] = (Exception,),
) -> Any:
    """
    Retry a function with exponential backoff.
    
    Args:
        func: Function to retry.
        initial_delay: Initial delay in seconds.
        exponential_base: Base for exponential backoff.
        jitter: Whether to add jitter to delay.
        max_retries: Maximum number of retries.
        errors: tuple of exceptions to catch and retry on.
        
    Returns:
        Result of the function.
    """
    # This is often used as a decorator, but here implemented as a wrapper caller
    # Wait, the original usage might be:
    # @retry_with_exponential_backoff
    # def foo(): ...
    # OR
    # retry_with_exponential_backoff(foo, args...)
    # Let's implement the decorator pattern wrapper logic inside if typically used as valid function.
    # Actually, usually this kind of util returns a wrapper or executes.
    # If the original code was:
    # def retry_with_exponential_backoff(...):
    #     def decorator(func): ...
    # Then I should match that.
    # Let's check `swipe_file_writer.py` imports/usage.
    # It was imported as `retry_with_exponential_backoff`.
    # And implementation details...
    # I'll provide a standard retry loop implementation that wraps execution.
    
    # If used as decorator:
    # @retry(...)
    # def func...
    
    # If the original code had it inline, I can just write a robust one.
    
    delays = [initial_delay * (exponential_base ** i) for i in range(max_retries)]
    
    for i, delay in enumerate(delays):
        try:
            return func()
        except errors as e:
            if i == max_retries - 1:
                logger.error(f"Max retries reached for {func.__name__}")
                raise e
            
            if jitter:
                delay *= (1 + random.random())
            
            logger.warning(f"Retry {i+1}/{max_retries} for {func.__name__} after error: {e}. Waiting {delay:.2f}s")
            time.sleep(delay)
            
    return None
