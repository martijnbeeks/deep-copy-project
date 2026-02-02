"""
Template prediction pipeline step.

Predicts which landing page templates best match avatar+angle combinations.
"""

import logging
from typing import Optional

from data_models import Avatar, MarketingAngle, TemplatePredictionResult
from services.template_prediction_service import (
    LibrarySummariesCache,
    TemplatePredictionService,
)
from services.openai_service import OpenAIService


logger = logging.getLogger(__name__)


class TemplatePredictionStep:
    """
    Pipeline step for predicting template matches.

    Uses the TemplatePredictionService to match avatar+angle combinations
    to pre-lander templates from the content library.
    """

    def __init__(
        self,
        openai_service: OpenAIService,
        library_cache: LibrarySummariesCache
    ):
        """
        Initialize the template prediction step.

        Args:
            openai_service: OpenAI service for LLM operations.
            library_cache: Cache for content library summaries.
        """
        self.prediction_service = TemplatePredictionService(
            openai_service=openai_service,
            library_cache=library_cache
        )

    def execute(
        self,
        avatar: Avatar,
        angle: MarketingAngle,
        top_k: int = 5
    ) -> Optional[TemplatePredictionResult]:
        """
        Predict which templates match an avatar+angle combination.

        Args:
            avatar: The marketing avatar.
            angle: The marketing angle to match.
            top_k: Number of top matches to return.

        Returns:
            TemplatePredictionResult with ranked matches, or None if prediction fails.
        """
        try:
            avatar_name = avatar.overview.name
            angle_title = angle.angle_title

            logger.info(
                f"Predicting templates for avatar '{avatar_name}', "
                f"angle '{angle_title[:50]}...'"
            )

            result = self.prediction_service.predict_templates(
                avatar=avatar,
                angle=angle,
                top_k=top_k
            )

            if result:
                logger.info(
                    f"Template prediction complete: top match is '{result.top_template_id}' "
                    f"with score {result.predictions[0].overall_fit_score:.2f}"
                )
            else:
                logger.warning(
                    f"No template predictions generated for avatar '{avatar_name}', "
                    f"angle '{angle_title[:50]}'"
                )

            return result

        except Exception as e:
            logger.error(
                f"Error predicting templates for avatar {avatar.id}, "
                f"angle {angle.id}: {e}"
            )
            # Return None instead of raising - predictions are optional
            return None
