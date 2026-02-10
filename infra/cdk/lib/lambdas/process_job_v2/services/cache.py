"""
Research cache service for process_job_v2 Lambda.

Provides caching for expensive deep research operations to avoid
redundant Perplexity API calls for the same sales page URL.
"""

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

from data_models import CachedResearchData


logger = logging.getLogger(__name__)

# Current cache schema version - increment this to invalidate old caches
CACHE_VERSION = "1.0"


class ResearchCacheService:
    """
    Service for caching deep research results in S3.
    
    Stores and retrieves cached research data keyed by a hash of the
    sales page URL. This allows skipping Steps 1-3 of the pipeline
    when the same URL has been processed before.
    """
    
    def __init__(self, s3_client, s3_bucket: str):
        """
        Initialize the cache service.
        
        Args:
            s3_client: Boto3 S3 client instance.
            s3_bucket: S3 bucket name for storing cache files.
        """
        self.s3_client = s3_client
        self.s3_bucket = s3_bucket
    
    @staticmethod
    def normalize_url(url: str) -> str:
        """
        Normalize a URL for consistent cache key generation.
        
        Normalizes by:
        - Converting to lowercase
        - Removing trailing slashes
        - Removing query parameters (optional based on use case)
        
        Args:
            url: The URL to normalize.
            
        Returns:
            Normalized URL string.
        """
        url = url.lower().strip()
        
        # Remove trailing slash
        if url.endswith('/'):
            url = url[:-1]
        
        return url
    
    @staticmethod
    def get_cache_key(sales_page_url: str, target_product_name: Optional[str] = None) -> str:
        """
        Generate a deterministic cache key from a sales page URL and optional product name.

        Uses SHA256 hash of the normalized URL (plus product name when provided)
        to create a consistent, filesystem-safe key.

        Args:
            sales_page_url: The sales page URL to hash.
            target_product_name: Optional product name that changes the research prompt.

        Returns:
            SHA256 hash string.
        """
        normalized = ResearchCacheService.normalize_url(sales_page_url)
        if target_product_name:
            normalized = normalized + "|" + target_product_name
        return hashlib.sha256(normalized.encode('utf-8')).hexdigest()
    
    def _get_cache_path(self, cache_key: str) -> str:
        """
        Get the S3 key path for a cache entry.
        
        Args:
            cache_key: The cache key (URL hash).
            
        Returns:
            S3 key path string.
        """
        return f"cache/research/{cache_key}/research_cache.json"
    
    def get_cached_research(self, sales_page_url: str, target_product_name: Optional[str] = None) -> Optional[CachedResearchData]:
        """
        Retrieve cached research data for a sales page URL.

        Args:
            sales_page_url: The sales page URL to look up.
            target_product_name: Optional product name included in cache key.

        Returns:
            CachedResearchData if cache hit, None if cache miss.
        """
        cache_key = self.get_cache_key(sales_page_url, target_product_name=target_product_name)
        cache_path = self._get_cache_path(cache_key)
        
        try:
            logger.info(f"Checking cache for URL: {sales_page_url}")
            logger.debug(f"Cache key: {cache_key}, path: {cache_path}")
            
            response = self.s3_client.get_object(
                Bucket=self.s3_bucket,
                Key=cache_path
            )
            
            cache_data = json.loads(response['Body'].read().decode('utf-8'))
            cached_research = CachedResearchData(**cache_data)
            
            # Check cache version for compatibility
            if cached_research.cache_version != CACHE_VERSION:
                logger.info(
                    f"Cache version mismatch: {cached_research.cache_version} != {CACHE_VERSION}. "
                    "Treating as cache miss."
                )
                return None
            
            logger.info(
                f"Cache HIT for URL: {sales_page_url} "
                f"(cached at: {cached_research.cached_at})"
            )
            return cached_research
            
        except self.s3_client.exceptions.NoSuchKey:
            logger.info(f"Cache MISS for URL: {sales_page_url} (key not found)")
            return None
        except Exception as e:
            # Log but don't fail - treat as cache miss
            logger.warning(f"Error reading cache for URL {sales_page_url}: {e}")
            return None
    
    def save_research_cache(
        self,
        sales_page_url: str,
        research_page_analysis: str,
        deep_research_prompt: str,
        deep_research_output: str,
        target_product_name: Optional[str] = None,
    ) -> None:
        """
        Save research data to the cache.

        Args:
            sales_page_url: The original sales page URL.
            research_page_analysis: Output from page analysis step.
            deep_research_prompt: The generated research prompt.
            deep_research_output: Output from deep research step.
            target_product_name: Optional product name included in cache key.
        """
        cache_key = self.get_cache_key(sales_page_url, target_product_name=target_product_name)
        cache_path = self._get_cache_path(cache_key)
        
        try:
            cache_data = CachedResearchData(
                sales_page_url=sales_page_url,
                research_page_analysis=research_page_analysis,
                deep_research_prompt=deep_research_prompt,
                deep_research_output=deep_research_output,
                cached_at=datetime.now(timezone.utc).isoformat(),
                cache_version=CACHE_VERSION
            )
            
            body = json.dumps(cache_data.model_dump(), ensure_ascii=False, indent=2)
            
            self.s3_client.put_object(
                Bucket=self.s3_bucket,
                Key=cache_path,
                Body=body,
                ContentType='application/json'
            )
            
            logger.info(
                f"Saved research cache for URL: {sales_page_url} "
                f"(key: {cache_key[:16]}...)"
            )
            
        except Exception as e:
            # Log but don't fail the pipeline - caching is optional
            logger.error(f"Error saving cache for URL {sales_page_url}: {e}")
