#!/usr/bin/env python3
"""
Live database tests for prompt templates.

Tests all prompts in the database for:
- Correct format (valid placeholder syntax)
- Required placeholders match between metadata and content
- Minimum content length
- No duplicate placeholders
- Balanced braces

Usage:
    # Set DATABASE_URL environment variable or use .env file
    export DATABASE_URL="postgresql://user:password@host:port/dbname"

    # Run all tests
    python test_prompts_live.py

    # Run with pytest for detailed output
    pytest test_prompts_live.py -v

    # Run specific test
    pytest test_prompts_live.py::TestPromptValidation::test_all_prompts_have_valid_placeholder_syntax -v
"""

import os
import re
import ssl
import sys
from dataclasses import dataclass
from typing import Optional
from urllib.parse import parse_qs, urlparse

import pg8000.native
import pytest
from dotenv import load_dotenv


# Configuration
MINIMUM_PROMPT_LENGTH = 100  # Minimum characters for a prompt
VALID_CATEGORIES = {"process_job_v2", "write_swipe", "image_gen_process"}


@dataclass
class PromptRecord:
    """Represents a prompt with its metadata and content."""

    prompt_id: str
    name: str
    category: str
    function_name: str
    required_params: list  # From prompts table
    version_number: int
    content: str
    placeholders: list  # From prompt_versions table


def get_database_url() -> str:
    """Get database URL from environment or .env file."""
    load_dotenv()
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL environment variable not set. "
            "Set it or create a .env file with DATABASE_URL=postgresql://..."
        )
    return url


def parse_database_url(database_url: str) -> dict:
    """Parse PostgreSQL connection URL into pg8000 parameters."""
    parsed = urlparse(database_url)
    params = {
        "user": parsed.username or "postgres",
        "password": parsed.password or "",
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 5432,
        "database": (parsed.path or "/postgres").lstrip("/"),
    }

    query_params = parse_qs(parsed.query)
    sslmode = query_params.get("sslmode", [None])[0]
    if sslmode and sslmode != "disable":
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        params["ssl_context"] = ssl_context

    return params


def extract_placeholders_from_content(content: str) -> set[str]:
    """Extract all {placeholder} names from template content."""
    # Strip escaped braces first to match str.format_map() behavior
    cleaned = content.replace("{{", "").replace("}}", "")
    # Only match valid Python identifiers (not JSON keys or other brace content)
    return set(re.findall(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}", cleaned))


def get_all_prompts() -> list[PromptRecord]:
    """Fetch all prompts with their latest versions from the database."""
    database_url = get_database_url()
    conn_params = parse_database_url(database_url)
    ssl_context = conn_params.pop("ssl_context", None)

    conn = pg8000.native.Connection(**conn_params, ssl_context=ssl_context)

    try:
        rows = conn.run(
            """
            SELECT
                p.id,
                p.name,
                p.category,
                p.function_name,
                p.required_params,
                pv.version_number,
                pv.content,
                pv.placeholders
            FROM prompts p
            JOIN prompt_versions pv ON pv.prompt_id = p.id
            WHERE pv.version_number = (
                SELECT MAX(pv2.version_number)
                FROM prompt_versions pv2
                WHERE pv2.prompt_id = p.id
            )
            ORDER BY p.category, p.function_name
            """
        )

        prompts = []
        for row in rows:
            prompts.append(
                PromptRecord(
                    prompt_id=row[0],
                    name=row[1],
                    category=row[2],
                    function_name=row[3],
                    required_params=row[4] if row[4] else [],
                    version_number=row[5],
                    content=row[6],
                    placeholders=row[7] if row[7] else [],
                )
            )

        return prompts
    finally:
        conn.close()


class TestPromptValidation:
    """Test suite for validating prompts in the database."""

    @pytest.fixture(scope="class")
    def prompts(self) -> list[PromptRecord]:
        """Fixture to load all prompts once per test class."""
        return get_all_prompts()

    def test_database_connection(self, prompts: list[PromptRecord]):
        """Verify we can connect to the database and fetch prompts."""
        assert len(prompts) > 0, "No prompts found in database"
        print(f"\nFound {len(prompts)} prompts in database")

    def test_all_prompts_have_valid_categories(self, prompts: list[PromptRecord]):
        """All prompts must have a valid category."""
        invalid = []
        for prompt in prompts:
            if prompt.category not in VALID_CATEGORIES:
                invalid.append(
                    f"  - {prompt.name}: category '{prompt.category}' not in {VALID_CATEGORIES}"
                )

        if invalid:
            pytest.fail(
                f"Found {len(invalid)} prompts with invalid categories:\n" + "\n".join(invalid)
            )

    def test_all_prompts_have_valid_placeholder_syntax(self, prompts: list[PromptRecord]):
        """All placeholders must be valid Python identifiers."""
        invalid = []
        identifier_pattern = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")

        for prompt in prompts:
            placeholders = extract_placeholders_from_content(prompt.content)
            for placeholder in placeholders:
                if not identifier_pattern.match(placeholder):
                    invalid.append(
                        f"  - {prompt.function_name}: invalid placeholder '{{{placeholder}}}'"
                    )

        if invalid:
            pytest.fail(
                f"Found {len(invalid)} invalid placeholders:\n" + "\n".join(invalid)
            )

    def test_all_prompts_have_balanced_braces(self, prompts: list[PromptRecord]):
        """All prompts must have balanced curly braces."""
        invalid = []

        for prompt in prompts:
            content = prompt.content
            # Count single braces (not escaped doubles)
            # First, temporarily replace escaped braces
            temp = content.replace("{{", "").replace("}}", "")
            open_count = temp.count("{")
            close_count = temp.count("}")

            if open_count != close_count:
                invalid.append(
                    f"  - {prompt.function_name}: unbalanced braces "
                    f"(open={open_count}, close={close_count})"
                )

        if invalid:
            pytest.fail(
                f"Found {len(invalid)} prompts with unbalanced braces:\n" + "\n".join(invalid)
            )

    def test_content_placeholders_match_metadata(self, prompts: list[PromptRecord]):
        """
        Placeholders in content must match the required_params metadata.

        This ensures that:
        1. All placeholders in content are documented in required_params
        2. All required_params are actually used in the content
        """
        mismatches = []

        for prompt in prompts:
            content_placeholders = extract_placeholders_from_content(prompt.content)
            required_set = set(prompt.required_params)

            missing_in_metadata = content_placeholders - required_set
            unused_in_content = required_set - content_placeholders

            if missing_in_metadata or unused_in_content:
                errors = []
                if missing_in_metadata:
                    errors.append(f"in content but not in required_params: {missing_in_metadata}")
                if unused_in_content:
                    errors.append(f"in required_params but not in content: {unused_in_content}")
                mismatches.append(f"  - {prompt.function_name}: " + "; ".join(errors))

        if mismatches:
            pytest.fail(
                f"Found {len(mismatches)} prompts with placeholder mismatches:\n"
                + "\n".join(mismatches)
            )

    def test_placeholders_metadata_matches_content(self, prompts: list[PromptRecord]):
        """
        The placeholders field in prompt_versions must match actual content placeholders.
        """
        mismatches = []

        for prompt in prompts:
            content_placeholders = extract_placeholders_from_content(prompt.content)
            version_placeholders = set(prompt.placeholders)

            if content_placeholders != version_placeholders:
                mismatches.append(
                    f"  - {prompt.function_name}: "
                    f"content has {content_placeholders}, "
                    f"metadata has {version_placeholders}"
                )

        if mismatches:
            pytest.fail(
                f"Found {len(mismatches)} prompts with version placeholder mismatches:\n"
                + "\n".join(mismatches)
            )

    def test_all_prompts_meet_minimum_length(self, prompts: list[PromptRecord]):
        """All prompts must have content of at least MINIMUM_PROMPT_LENGTH characters."""
        too_short = []

        for prompt in prompts:
            if len(prompt.content) < MINIMUM_PROMPT_LENGTH:
                too_short.append(
                    f"  - {prompt.function_name}: {len(prompt.content)} chars "
                    f"(minimum: {MINIMUM_PROMPT_LENGTH})"
                )

        if too_short:
            pytest.fail(
                f"Found {len(too_short)} prompts below minimum length:\n" + "\n".join(too_short)
            )

    def test_no_duplicate_placeholders_in_required_params(self, prompts: list[PromptRecord]):
        """required_params should not contain duplicate entries."""
        duplicates = []

        for prompt in prompts:
            if len(prompt.required_params) != len(set(prompt.required_params)):
                seen = set()
                dupes = []
                for p in prompt.required_params:
                    if p in seen:
                        dupes.append(p)
                    seen.add(p)
                duplicates.append(f"  - {prompt.function_name}: duplicates {dupes}")

        if duplicates:
            pytest.fail(
                f"Found {len(duplicates)} prompts with duplicate required_params:\n"
                + "\n".join(duplicates)
            )

    def test_all_prompts_have_content(self, prompts: list[PromptRecord]):
        """All prompts must have non-empty content."""
        empty = []

        for prompt in prompts:
            if not prompt.content or not prompt.content.strip():
                empty.append(f"  - {prompt.function_name}: empty content")

        if empty:
            pytest.fail(f"Found {len(empty)} prompts with empty content:\n" + "\n".join(empty))

    def test_all_prompts_have_function_name(self, prompts: list[PromptRecord]):
        """All prompts must have a function_name."""
        missing = []

        for prompt in prompts:
            if not prompt.function_name:
                missing.append(f"  - {prompt.name}: missing function_name")

        if missing:
            pytest.fail(
                f"Found {len(missing)} prompts without function_name:\n" + "\n".join(missing)
            )

    def test_function_names_are_unique_per_category(self, prompts: list[PromptRecord]):
        """Function names must be unique within each category."""
        by_category: dict[str, list[str]] = {}

        for prompt in prompts:
            if prompt.category not in by_category:
                by_category[prompt.category] = []
            by_category[prompt.category].append(prompt.function_name)

        duplicates = []
        for category, names in by_category.items():
            seen = set()
            for name in names:
                if name in seen:
                    duplicates.append(f"  - {category}/{name}")
                seen.add(name)

        if duplicates:
            pytest.fail(
                f"Found duplicate function names within categories:\n" + "\n".join(duplicates)
            )

    def test_prompt_content_does_not_contain_sql_injection_patterns(
        self, prompts: list[PromptRecord]
    ):
        """Prompt content should not contain common SQL injection patterns."""
        suspicious_patterns = [
            r";\s*DROP\s+TABLE",
            r";\s*DELETE\s+FROM",
            r";\s*UPDATE\s+.*\s+SET",
            r";\s*INSERT\s+INTO",
            r"--\s*$",  # SQL comment at end of line
            r"'\s*OR\s+'1'\s*=\s*'1",
        ]

        suspicious = []
        for prompt in prompts:
            for pattern in suspicious_patterns:
                if re.search(pattern, prompt.content, re.IGNORECASE):
                    suspicious.append(
                        f"  - {prompt.function_name}: matches suspicious pattern '{pattern}'"
                    )

        if suspicious:
            pytest.fail(
                f"Found {len(suspicious)} prompts with suspicious SQL patterns:\n"
                + "\n".join(suspicious)
            )


class TestPromptsByCategory:
    """Test prompts grouped by category."""

    @pytest.fixture(scope="class")
    def prompts(self) -> list[PromptRecord]:
        """Fixture to load all prompts once per test class."""
        return get_all_prompts()

    @pytest.fixture(scope="class")
    def prompts_by_category(
        self, prompts: list[PromptRecord]
    ) -> dict[str, list[PromptRecord]]:
        """Group prompts by category."""
        by_category: dict[str, list[PromptRecord]] = {}
        for prompt in prompts:
            if prompt.category not in by_category:
                by_category[prompt.category] = []
            by_category[prompt.category].append(prompt)
        return by_category

    def test_process_job_v2_has_required_prompts(
        self, prompts_by_category: dict[str, list[PromptRecord]]
    ):
        """process_job_v2 category should have essential prompts."""
        # Based on prompts.py function definitions
        expected_functions = {
            "get_analyze_research_page_prompt",
            "get_deep_research_prompt",
            "get_identify_avatars_prompt",
            "get_complete_avatar_details_prompt",
            "get_necessary_beliefs_prompt",
            "get_marketing_angles_prompt",
            "get_offer_brief_prompt",
            "get_summary_prompt",
            "get_template_prediction_prompt",
        }

        category_prompts = prompts_by_category.get("process_job_v2", [])
        actual_functions = {p.function_name for p in category_prompts}

        missing = expected_functions - actual_functions
        if missing:
            pytest.fail(
                f"process_job_v2 missing required prompts: {missing}\n"
                f"Available: {actual_functions}"
            )

    def test_write_swipe_has_required_prompts(
        self, prompts_by_category: dict[str, list[PromptRecord]]
    ):
        """write_swipe category should have essential prompts."""
        # Based on prompts.py function definitions
        expected_functions = {
            "get_style_guide_analysis_prompt",
            "get_advertorial_rewrite_prompt",
            "get_advertorial_rewrite_prompt_customer_pov",
            "get_advertorial_rewrite_prompt_authority",
            "get_advertorial_image_generation_prompt",
            "get_listicle_generation_prompt",
            "get_listicle_image_generation_prompt",
        }

        category_prompts = prompts_by_category.get("write_swipe", [])
        actual_functions = {p.function_name for p in category_prompts}

        missing = expected_functions - actual_functions
        if missing:
            pytest.fail(
                f"write_swipe missing required prompts: {missing}\n"
                f"Available: {actual_functions}"
            )

    def test_image_gen_process_has_required_prompts(
        self, prompts_by_category: dict[str, list[PromptRecord]]
    ):
        """image_gen_process category should have essential prompts."""
        # Based on prompts.py function definitions
        expected_functions = {
            "get_detect_product_prompt",
            "get_summarize_docs_prompt",
            "get_match_angles_system_prompt",
            "get_match_angles_user_prompt",
            "get_image_gen_base_prompt",
            "get_image_gen_with_product_prompt",
            "get_image_gen_without_product_prompt_no_support",
            "get_image_gen_without_product_prompt_with_support",
        }

        category_prompts = prompts_by_category.get("image_gen_process", [])
        actual_functions = {p.function_name for p in category_prompts}

        missing = expected_functions - actual_functions
        if missing:
            pytest.fail(
                f"image_gen_process missing required prompts: {missing}\n"
                f"Available: {actual_functions}"
            )

    def test_each_category_has_at_least_one_prompt(
        self, prompts_by_category: dict[str, list[PromptRecord]]
    ):
        """Each valid category should have at least one prompt."""
        missing_categories = []
        for category in VALID_CATEGORIES:
            prompts = prompts_by_category.get(category, [])
            if len(prompts) < 1:
                missing_categories.append(category)

        if missing_categories:
            pytest.fail(
                f"Categories with no prompts: {missing_categories}\n"
                f"Categories with prompts: {list(prompts_by_category.keys())}"
            )


class TestPromptRendering:
    """Test that prompts can be rendered with sample data."""

    @pytest.fixture(scope="class")
    def prompts(self) -> list[PromptRecord]:
        """Fixture to load all prompts once per test class."""
        return get_all_prompts()

    def test_all_prompts_can_be_rendered_with_sample_values(
        self, prompts: list[PromptRecord]
    ):
        """All prompts should render successfully with placeholder sample values."""
        render_errors = []

        for prompt in prompts:
            placeholders = extract_placeholders_from_content(prompt.content)
            # Create sample values for all placeholders
            sample_values = {p: f"SAMPLE_{p.upper()}" for p in placeholders}

            try:
                rendered = prompt.content.format_map(sample_values)
                # Verify all placeholders were replaced
                remaining = extract_placeholders_from_content(rendered)
                if remaining:
                    render_errors.append(
                        f"  - {prompt.function_name}: placeholders not replaced: {remaining}"
                    )
            except (KeyError, ValueError, IndexError) as e:
                render_errors.append(f"  - {prompt.function_name}: render error: {e}")

        if render_errors:
            pytest.fail(
                f"Found {len(render_errors)} prompts that failed to render:\n"
                + "\n".join(render_errors)
            )


def generate_prompt_report() -> str:
    """Generate a summary report of all prompts in the database."""
    prompts = get_all_prompts()

    lines = [
        "=" * 80,
        "PROMPT VALIDATION REPORT",
        "=" * 80,
        "",
        f"Total prompts: {len(prompts)}",
        "",
    ]

    # Group by category
    by_category: dict[str, list[PromptRecord]] = {}
    for prompt in prompts:
        if prompt.category not in by_category:
            by_category[prompt.category] = []
        by_category[prompt.category].append(prompt)

    for category, cat_prompts in sorted(by_category.items()):
        lines.append(f"\n{category} ({len(cat_prompts)} prompts)")
        lines.append("-" * 40)

        for prompt in cat_prompts:
            placeholders = extract_placeholders_from_content(prompt.content)
            lines.append(f"  {prompt.function_name}")
            lines.append(f"    Version: {prompt.version_number}")
            lines.append(f"    Length: {len(prompt.content)} chars")
            lines.append(f"    Placeholders: {sorted(placeholders)}")
            lines.append("")

    return "\n".join(lines)


def run_quick_validation() -> tuple[bool, list[str]]:
    """
    Run quick validation without pytest.

    Returns:
        Tuple of (success: bool, errors: list[str])
    """
    errors = []

    try:
        prompts = get_all_prompts()
    except Exception as e:
        return False, [f"Failed to connect to database: {e}"]

    if len(prompts) == 0:
        return False, ["No prompts found in database"]

    # Check each prompt
    for prompt in prompts:
        # Check category
        if prompt.category not in VALID_CATEGORIES:
            errors.append(f"{prompt.function_name}: invalid category '{prompt.category}'")

        # Check content length
        if len(prompt.content) < MINIMUM_PROMPT_LENGTH:
            errors.append(
                f"{prompt.function_name}: too short ({len(prompt.content)} chars)"
            )

        # Check placeholder syntax
        content_placeholders = extract_placeholders_from_content(prompt.content)
        identifier_pattern = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")
        for ph in content_placeholders:
            if not identifier_pattern.match(ph):
                errors.append(f"{prompt.function_name}: invalid placeholder '{{{ph}}}'")

        # Check placeholder metadata matches content
        required_set = set(prompt.required_params)
        if content_placeholders != required_set:
            missing = content_placeholders - required_set
            extra = required_set - content_placeholders
            if missing:
                errors.append(
                    f"{prompt.function_name}: placeholders in content but not metadata: {missing}"
                )
            if extra:
                errors.append(
                    f"{prompt.function_name}: placeholders in metadata but not content: {extra}"
                )

        # Try to render with sample values
        sample_values = {p: f"SAMPLE_{p.upper()}" for p in content_placeholders}
        try:
            prompt.content.format_map(sample_values)
        except (KeyError, ValueError, IndexError) as e:
            errors.append(f"{prompt.function_name}: render error: {e}")

    return len(errors) == 0, errors


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Test prompts in the database")
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Run quick validation without pytest"
    )
    parser.add_argument(
        "--report",
        action="store_true",
        help="Generate prompt report only"
    )
    args = parser.parse_args()

    try:
        if args.report:
            print(generate_prompt_report())
            sys.exit(0)

        if args.quick:
            print("Running quick validation...")
            success, errors = run_quick_validation()
            if success:
                print("All prompts validated successfully!")
                sys.exit(0)
            else:
                print(f"Found {len(errors)} validation errors:")
                for error in errors:
                    print(f"  - {error}")
                sys.exit(1)

        # Default: generate report and run full pytest suite
        print(generate_prompt_report())
        print("\n" + "=" * 80)
        print("Running validation tests...")
        print("=" * 80 + "\n")

        # Run pytest programmatically
        sys.exit(pytest.main([__file__, "-v", "--tb=short"]))
    except RuntimeError as e:
        print(f"Error: {e}")
        sys.exit(1)
