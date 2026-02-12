"""
Unit tests for the PageAnalysisQualityCheck logic in AnalyzePageStep.

Tests that _check_analysis_quality correctly scores generic (low-quality)
analyses low and specific (high-quality) analyses high, and that the full
execute() flow raises PageAnalysisQualityError when the quality gate fails.

Run from the lambdas directory:
    process_job_v2/.venv/bin/python -m pytest tests/process_job_v2/test_quality_check_live.py -v -s
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# ---------------------------------------------------------------------------
# sys.path setup
# ---------------------------------------------------------------------------
_LAMBDA_ROOT = str(Path(__file__).resolve().parents[2] / "process_job_v2")
if _LAMBDA_ROOT not in sys.path:
    sys.path.insert(0, _LAMBDA_ROOT)

from data_models import PageAnalysisQualityCheck
from mock_responses import make_page_analysis_quality_check


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

FUNNELISH_URL = (
    "https://zlcjvndkff.myfunnelish.com/template/"
    "advetorial-1770816354178023?preview=4357864&revision=latest"
)


@pytest.fixture()
def make_step(_aws_env_and_moto):
    """Factory that creates an AnalyzePageStep with a mocked OpenAIService."""
    from pipeline.steps.analyze_page import AnalyzePageStep

    def _factory(parse_structured_return):
        mock_openai = MagicMock()
        mock_openai.parse_structured.return_value = parse_structured_return
        mock_prompt = MagicMock()
        step = AnalyzePageStep(
            openai_service=mock_openai,
            prompt_service=mock_prompt,
        )
        return step

    return _factory


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestQualityCheckWithGenericAnalysis:
    """Test that a generic/useless analysis gets rejected."""

    def test_generic_analysis_scores_low(self, make_step):
        """A vague, non-specific analysis should score <= 2."""
        low_quality = make_page_analysis_quality_check(score=1)
        low_quality.product_name_identified = False
        low_quality.product_type_identified = False
        low_quality.specific_claims_extracted = False
        low_quality.target_audience_identified = False
        low_quality.price_or_offer_identified = False
        low_quality.failure_reason = "Analysis is too vague and generic."

        step = make_step(low_quality)

        generic_analysis = (
            "This appears to be a web page. It contains some text and images. "
            "The page seems to be about some kind of product or service. "
            "There may be some benefits mentioned. The page has a modern design "
            "with various sections. It's hard to determine the exact product "
            "from the screenshot."
        )

        result = step._check_analysis_quality(generic_analysis, FUNNELISH_URL)

        assert result.overall_quality_score <= 2
        assert not result.product_name_identified
        assert not result.specific_claims_extracted

    def test_good_analysis_scores_high(self, make_step):
        """A specific, product-focused analysis should score >= 3."""
        high_quality = make_page_analysis_quality_check(score=4)

        step = make_step(high_quality)

        good_analysis = (
            "Product: VisionGuard Pro - an eye health supplement in softgel form. "
            "Type: Dietary supplement (60-count bottle). "
            "Key claims: Contains AREDS2-studied ingredients including 10mg lutein, "
            "2mg zeaxanthin, 500mg vitamin C, 400IU vitamin E, and 80mg zinc. "
            "Claims to support macular health and protect against age-related vision decline. "
            "Target audience: Adults 50+ concerned about age-related macular degeneration. "
            "Pricing: $49.95/bottle, subscribe & save at $39.95/month. "
            "Free shipping on orders over $50. 90-day money-back guarantee. "
            "Third-party tested by NSF International."
        )

        result = step._check_analysis_quality(good_analysis, "https://example.com/visionguard")

        assert result.overall_quality_score >= 3
        assert result.product_name_identified
        assert result.specific_claims_extracted


class TestQualityGateRejectsLowScore:
    """Test that execute() raises PageAnalysisQualityError when score <= 2."""

    def test_low_quality_analysis_raises_error(self, _aws_env_and_moto):
        """
        When the quality check returns score <= 2, execute() should raise
        PageAnalysisQualityError.
        """
        from pipeline.steps.analyze_page import AnalyzePageStep, PageAnalysisQualityError

        low_quality = make_page_analysis_quality_check(score=1)
        low_quality.product_name_identified = False
        low_quality.product_type_identified = False
        low_quality.specific_claims_extracted = False
        low_quality.target_audience_identified = False
        low_quality.price_or_offer_identified = False
        low_quality.failure_reason = "Page did not render; no product info found."

        mock_openai = MagicMock()
        mock_openai.create_response.return_value = "Some vague analysis text"
        mock_openai.parse_structured.return_value = low_quality

        mock_prompt = MagicMock()
        mock_prompt.get_prompt.return_value = "Analyze this page."

        mock_screenshots = MagicMock()
        mock_screenshots.fullpage_bytes = b"\x89PNG" + b"\x00" * 100
        mock_screenshots.product_image_bytes = b"\x89PNG" + b"\x00" * 50

        step = AnalyzePageStep(
            openai_service=mock_openai,
            prompt_service=mock_prompt,
        )

        with pytest.raises(PageAnalysisQualityError, match="quality check failed"):
            from unittest.mock import patch
            with patch("pipeline.steps.analyze_page.capture_page_screenshots", return_value=mock_screenshots):
                with patch("pipeline.steps.analyze_page.compress_image_if_needed", return_value=b"\x89PNG"):
                    with patch("pipeline.steps.analyze_page.compress_to_base64", return_value="base64data"):
                        step.execute(FUNNELISH_URL)

    def test_high_quality_analysis_passes(self, _aws_env_and_moto):
        """
        When the quality check returns score >= 3, execute() should return
        a PageAnalysisResult without raising.
        """
        from pipeline.steps.analyze_page import AnalyzePageStep

        high_quality = make_page_analysis_quality_check(score=4)

        mock_openai = MagicMock()
        mock_openai.create_response.return_value = "Detailed product analysis"
        mock_openai.parse_structured.return_value = high_quality

        mock_prompt = MagicMock()
        mock_prompt.get_prompt.return_value = "Analyze this page."

        mock_screenshots = MagicMock()
        mock_screenshots.fullpage_bytes = b"\x89PNG" + b"\x00" * 100
        mock_screenshots.product_image_bytes = b"\x89PNG" + b"\x00" * 50

        step = AnalyzePageStep(
            openai_service=mock_openai,
            prompt_service=mock_prompt,
        )

        from unittest.mock import patch
        with patch("pipeline.steps.analyze_page.capture_page_screenshots", return_value=mock_screenshots):
            with patch("pipeline.steps.analyze_page.compress_image_if_needed", return_value=b"\x89PNG"):
                with patch("pipeline.steps.analyze_page.compress_to_base64", return_value="base64data"):
                    result = step.execute("https://example.com/good-page")

        assert result.analysis == "Detailed product analysis"
        assert result.product_image == "base64data"
