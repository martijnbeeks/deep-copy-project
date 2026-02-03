"""
Prompt service for loading prompt templates from PostgreSQL.

Fetches prompt templates from the database and renders them with provided
parameters. Raises errors if prompts cannot be loaded or are missing.
"""

import logging
import re
import time
from typing import Dict, Set
from urllib.parse import urlparse, parse_qs

logger = logging.getLogger(__name__)

# Module-level cache for warm Lambda reuse
_prompt_cache: Dict[str, Dict[str, str]] = {}
_cache_timestamp: float = 0.0
_CACHE_TTL_SECONDS = 300  # 5 minutes


class PromptNotFoundError(Exception):
    """Raised when a prompt is not found in the database."""
    pass


class PromptRenderError(Exception):
    """Raised when a prompt template cannot be rendered with the given parameters."""
    pass


class PromptLoadError(Exception):
    """Raised when prompts cannot be loaded from the database."""
    pass


def _extract_placeholders(template: str) -> Set[str]:
    """Extract all {placeholder} names from a template string."""
    return set(re.findall(r"\{([^}]+)\}", template))


def _parse_database_url(database_url: str) -> dict:
    """
    Parse a PostgreSQL connection URL into pg8000 connection parameters.

    Supports: postgresql://user:password@host:port/dbname?sslmode=require
    """
    parsed = urlparse(database_url)
    params = {
        "user": parsed.username or "postgres",
        "password": parsed.password or "",
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 5432,
        "database": (parsed.path or "/postgres").lstrip("/"),
    }

    # Parse query parameters for SSL
    query_params = parse_qs(parsed.query)
    sslmode = query_params.get("sslmode", [None])[0]
    if sslmode and sslmode != "disable":
        import ssl
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        params["ssl_context"] = ssl_context

    return params


class PromptService:
    """
    Service for loading and rendering prompt templates from PostgreSQL.

    Loads all prompts for a given category in a single query, caches them
    in memory with a TTL for warm Lambda reuse. Raises errors if prompts
    cannot be loaded, are missing, or have mismatched placeholders.
    """

    def __init__(self, database_url: str, category: str):
        """
        Initialize the prompt service.

        Args:
            database_url: PostgreSQL connection URL.
            category: The prompt category to load (e.g. 'process_job_v2').

        Raises:
            PromptLoadError: If prompts cannot be loaded from the database.
        """
        self.database_url = database_url
        self.category = category
        self._prompts: Dict[str, str] = {}
        self._load_prompts()

    def _load_prompts(self) -> None:
        """
        Load all prompts for this category from the database.

        Uses module-level cache with TTL to avoid repeated DB queries
        on warm Lambda invocations.

        Raises:
            PromptLoadError: If the database connection or query fails.
        """
        global _prompt_cache, _cache_timestamp

        now = time.time()

        # Check module-level cache
        if (
            self.category in _prompt_cache
            and (now - _cache_timestamp) < _CACHE_TTL_SECONDS
        ):
            self._prompts = _prompt_cache[self.category]
            logger.info(
                "Using cached prompts for category '%s' (%d prompts)",
                self.category,
                len(self._prompts),
            )
            return

        try:
            import pg8000.native

            conn_params = _parse_database_url(self.database_url)
            ssl_context = conn_params.pop("ssl_context", None)

            conn = pg8000.native.Connection(
                **conn_params,
                ssl_context=ssl_context,
            )

            try:
                rows = conn.run(
                    """
                    SELECT p.function_name, pv.content
                    FROM prompts p
                    JOIN prompt_versions pv ON pv.prompt_id = p.id
                    WHERE p.category = :category
                      AND pv.version_number = (
                          SELECT MAX(pv2.version_number)
                          FROM prompt_versions pv2
                          WHERE pv2.prompt_id = p.id
                      )
                    """,
                    category=self.category,
                )

                self._prompts = {}
                for row in rows:
                    function_name = row[0]
                    content = row[1]
                    self._prompts[function_name] = content

                # Update module-level cache
                _prompt_cache[self.category] = self._prompts
                _cache_timestamp = now

                logger.info(
                    "Loaded %d prompts from DB for category '%s'",
                    len(self._prompts),
                    self.category,
                )
            finally:
                conn.close()

        except Exception as e:
            raise PromptLoadError(
                f"Failed to load prompts from DB for category '{self.category}': {e}"
            ) from e

    def get_prompt(self, function_name: str, **kwargs) -> str:
        """
        Get a rendered prompt template by function name.

        Looks up the template in the loaded prompts, validates that all
        required placeholders are provided, and renders the template.

        Args:
            function_name: The function name identifying the prompt
                          (e.g. 'get_deep_research_prompt').
            **kwargs: Template parameters to substitute.

        Returns:
            Rendered prompt string.

        Raises:
            PromptNotFoundError: If the prompt is not in the database.
            PromptRenderError: If required placeholders are missing from kwargs.
        """
        template = self._prompts.get(function_name)
        if template is None:
            raise PromptNotFoundError(
                f"Prompt '{function_name}' not found in DB for category '{self.category}'. "
                f"Available prompts: {list(self._prompts.keys())}"
            )

        # Validate that all placeholders in the template have corresponding kwargs
        required_placeholders = _extract_placeholders(template)
        provided_keys = set(kwargs.keys())
        missing = required_placeholders - provided_keys
        if missing:
            raise PromptRenderError(
                f"Prompt '{function_name}' requires placeholders {missing} "
                f"but they were not provided. Provided: {provided_keys}"
        )

        try:
            return template.format_map(kwargs)
        except (KeyError, ValueError, IndexError) as e:
            raise PromptRenderError(
                f"Failed to render prompt '{function_name}': {e}"
            ) from e
