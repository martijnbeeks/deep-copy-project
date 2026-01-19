"""
Retry utilities for process_job_v2 Lambda.
"""
import time
import random
import logging
from typing import Callable, Any, Type, Union, Tuple


logger = logging.getLogger(__name__)


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
        func: Function to retry (takes no arguments).
        initial_delay: Initial delay in seconds.
        exponential_base: Base for exponential backoff.
        jitter: Whether to add jitter to delay.
        max_retries: Maximum number of retries.
        errors: Tuple of exceptions to catch and retry on.
        
    Returns:
        Result of the function.
        
    Raises:
        Exception: If max retries exceeded, raises the last exception.
    """
    delays = [initial_delay * (exponential_base ** i) for i in range(max_retries)]
    
    for i, delay in enumerate(delays):
        try:
            return func()
        except errors as e:
            if i == max_retries - 1:
                logger.error(f"Max retries reached for {getattr(func, '__name__', 'lambda')}")
                raise e
            
            if jitter:
                delay *= (1 + random.random())
            
            logger.warning(
                f"Retry {i+1}/{max_retries} for {getattr(func, '__name__', 'lambda')} "
                f"after error: {e}. Waiting {delay:.2f}s"
            )
            time.sleep(delay)
            
    return None
