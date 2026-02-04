"""
Template prediction service for process_job_v2 Lambda.

Provides functionality to match avatar+angle combinations to pre-lander
templates from the content library using LLM-based scoring.
"""

import json
import logging
from datetime import datetime, timezone
from typing import List, Optional

from data_models import (
    Avatar,
    ContentLibrarySummaries,
    LandingPageSummary,
    MarketingAngle,
    TemplateMatch,
    TemplatePredictionResult,
)
from services.openai_service import OpenAIService
from services.prompt_service import PromptService


logger = logging.getLogger(__name__)


class TemplatePredictionMatches(list):
    """Wrapper for list of TemplateMatch for structured parsing."""
    pass


class LibrarySummariesCache:
    """
    Cache for content library summaries.

    Loads summaries from S3 and keeps them in memory for the duration
    of the Lambda execution to avoid repeated S3 calls.
    """

    LIBRARY_KEY = "content_library/library_summaries.json"

    def __init__(self, s3_client, s3_bucket: str):
        """
        Initialize the cache.

        Args:
            s3_client: Boto3 S3 client instance.
            s3_bucket: S3 bucket name containing the library.
        """
        self.s3_client = s3_client
        self.s3_bucket = s3_bucket
        self._cached_summaries: Optional[ContentLibrarySummaries] = None

    def get_summaries(self) -> Optional[ContentLibrarySummaries]:
        """
        Get library summaries, loading from S3 if not cached.

        Returns:
            ContentLibrarySummaries if available, None if library doesn't exist.
        """
        if self._cached_summaries is not None:
            return self._cached_summaries

        try:
            logger.info(f"Loading library summaries from s3://{self.s3_bucket}/{self.LIBRARY_KEY}")

            response = self.s3_client.get_object(
                Bucket=self.s3_bucket,
                Key=self.LIBRARY_KEY
            )

            data = json.loads(response['Body'].read().decode('utf-8'))
            self._cached_summaries = ContentLibrarySummaries(**data)

            logger.info(
                f"Loaded {self._cached_summaries.total_pages} template summaries "
                f"(version: {self._cached_summaries.version})"
            )
            return self._cached_summaries

        except self.s3_client.exceptions.NoSuchKey:
            logger.warning(
                f"Library summaries not found at s3://{self.s3_bucket}/{self.LIBRARY_KEY}. "
                "Run generate_content_library_summaries.py to create the library."
            )
            return None
        except Exception as e:
            logger.error(f"Error loading library summaries: {e}")
            return None

    def get_summary_by_id(self, template_id: str) -> Optional[LandingPageSummary]:
        """
        Get a specific template summary by ID.

        Args:
            template_id: The template ID to look up.

        Returns:
            LandingPageSummary if found, None otherwise.
        """
        summaries = self.get_summaries()
        if summaries is None:
            return None

        for summary in summaries.summaries:
            if summary.id == template_id:
                return summary
        return None


class TemplatePredictionService:
    """
    Service for predicting which landing page templates match an avatar+angle.

    Uses OpenAI to semantically score templates against avatar and angle
    characteristics, returning ranked matches with confidence scores.
    """

    def __init__(
        self,
        openai_service: OpenAIService,
        library_cache: LibrarySummariesCache,
        prompt_service: PromptService,
    ):
        """
        Initialize the prediction service.

        Args:
            openai_service: OpenAI service for LLM calls.
            library_cache: Cache for library summaries.
            prompt_service: PromptService for DB-stored prompts.
        """
        self.openai_service = openai_service
        self.library_cache = library_cache
        self.prompt_service = prompt_service

    def _create_avatar_summary(self, avatar: Avatar) -> str:
        """
        Create a condensed summary of an avatar for the prediction prompt.

        Args:
            avatar: The avatar to summarize.

        Returns:
            Condensed summary string.
        """
        return f"""Name: {avatar.overview.name}
Description: {avatar.overview.description}
Age Range: {avatar.demographics.age_range}
Gender: {avatar.demographics.gender}
Market Size: {avatar.overview.market_size.value}
Buying Readiness: {avatar.overview.buying_readiness.value}
Awareness Level: {avatar.overview.awareness_level.value}

Key Pain Points:
- Surface: {', '.join(avatar.pain_desire.pain.surface[:3])}
- Emotional: {', '.join(avatar.pain_desire.pain.emotional[:3])}

Key Desires:
- Emotional: {avatar.pain_desire.desire.emotional}
- Dream Outcome: {avatar.pain_desire.desire.dream_outcome}

Dominant Emotion: {avatar.pain_desire.dominant_emotion}

Identities: {', '.join(avatar.demographics.identities[:5])}
"""

    def _create_angle_summary(self, angle: MarketingAngle) -> str:
        """
        Create a condensed summary of a marketing angle for the prediction prompt.

        Args:
            angle: The marketing angle to summarize.

        Returns:
            Condensed summary string.
        """
        return f"""Title: {angle.angle_title}
Subtitle: {angle.angle_subtitle}
Type: {angle.angle_type.value}
Emotional Driver: {angle.emotional_driver.value}
Risk Level: {angle.risk_level.value}

Core Argument: {angle.core_argument}
Target Audience: {angle.target_audience}
Target Age Range: {angle.target_age_range}

Pain Points: {', '.join(angle.pain_points[:5])}
Desires: {', '.join(angle.desires[:5])}
"""

    def _create_library_summary(self, summaries: ContentLibrarySummaries) -> str:
        """
        Create a condensed summary of available templates for the prediction prompt.

        Args:
            summaries: The library summaries.

        Returns:
            JSON string of template summaries.
        """
        template_list = []
        for s in summaries.summaries:
            template_list.append({
                "id": s.id,
                "product_category": s.product_category,
                "short_description": s.short_description,
                "target_audience": s.target_audience,
                "primary_pain_point": s.primary_pain_point,
                "primary_benefit": s.primary_benefit,
                "tone": s.tone,
                "keywords": s.keywords[:5],
            })
        return json.dumps(template_list, indent=2)

    def predict_templates(
        self,
        avatar: Avatar,
        angle: MarketingAngle,
        top_k: int = 5
    ) -> Optional[TemplatePredictionResult]:
        """
        Predict which templates best match an avatar+angle combination.

        Args:
            avatar: The marketing avatar.
            angle: The marketing angle.
            top_k: Number of top matches to return.

        Returns:
            TemplatePredictionResult with ranked matches, or None if prediction fails.
        """
        # Load library summaries
        summaries = self.library_cache.get_summaries()
        if summaries is None or len(summaries.summaries) == 0:
            logger.warning("No template summaries available for prediction")
            return None

        # Create condensed summaries for the prompt
        avatar_summary = self._create_avatar_summary(avatar)
        angle_summary = self._create_angle_summary(angle)
        library_summary = self._create_library_summary(summaries)

        # Generate prompt
        kwargs = dict(
            avatar_summary=avatar_summary,
            angle_summary=angle_summary,
            library_summaries=library_summary,
        )
        prompt = self.prompt_service.get_prompt("get_template_prediction_prompt", **kwargs)

        try:
            # Define response schema for structured output
            from pydantic import BaseModel, Field
            from typing import List as TypingList

            class PredictionResponse(BaseModel):
                matches: TypingList[TemplateMatch] = Field(
                    ...,
                    description="Ranked list of template matches"
                )

            # Call OpenAI with structured output
            response = self.openai_service.parse_structured(
                prompt=prompt,
                response_format=PredictionResponse,
                subtask="template_prediction"
            )

            # Sort by score and take top_k
            matches = sorted(
                response.matches,
                key=lambda m: m.overall_fit_score,
                reverse=True
            )[:top_k]

            # Validate that all predicted template IDs exist
            valid_ids = {s.id for s in summaries.summaries}
            matches = [m for m in matches if m.template_id in valid_ids]

            if not matches:
                logger.warning("No valid template matches returned from prediction")
                return None

            return TemplatePredictionResult(
                avatar_id=avatar.id,
                angle_id=angle.id,
                predictions=matches,
                top_template_id=matches[0].template_id,
                predicted_at=datetime.now(timezone.utc).isoformat()
            )

        except Exception as e:
            logger.error(f"Error predicting templates for avatar {avatar.id}, angle {angle.id}: {e}")
            return None
