"""
Mock response factories for process_job_v2 tests.

Provides factory functions that return minimal valid Pydantic model instances
matching what the real OpenAI parse_structured / create_response calls return.
"""

from data_models import (
    Avatar,
    AvatarDemographics,
    AvatarFailedSolutions,
    AvatarMarketingAngles,
    AvatarObjectionsBuying,
    AvatarOverview,
    AvatarPainDesire,
    AvatarProblemExperience,
    AvatarRawLanguage,
    DesireDimension,
    FailedSolutionItem,
    Gender,
    IdentifiedAvatar,
    IdentifiedAvatarList,
    MarketingAngle,
    OfferBrief,
    PageAnalysisQualityCheck,
    PainDimension,
    QuoteWithSource,
    TemplatePredictionResult,
    TemplateMatch,
)


def make_identified_avatar_list(count: int = 2) -> IdentifiedAvatarList:
    """Return a minimal IdentifiedAvatarList."""
    avatars = []
    for i in range(count):
        avatars.append(
            IdentifiedAvatar(
                name=f"Test Avatar {i + 1}",
                description=f"Description for avatar {i + 1}",
            )
        )
    return IdentifiedAvatarList(avatars=avatars)


def make_avatar(name: str = "Test Avatar 1") -> Avatar:
    """Return a minimal valid Avatar instance."""
    return Avatar(
        short_description="A test avatar",
        age="30-50",
        gender=Gender.MALE,
        problem_urgency=4,
        purchasing_power=3,
        saturation_level=3,
        audience_size=4,
        overall_score=4,
        overview=AvatarOverview(
            name=name,
            description="A health-conscious man looking for solutions",
            market_size="3",
            market_sophistication={
                "level": "level_3",
                "rationale": "Market has moved beyond simple claims to mechanism-based marketing",
            },
            buying_readiness="warm",
            intensity=3,
            awareness_level="solution aware",
            awareness_level_description="Knows solutions exist, comparing options",
            competition_level="medium",
            one_line_hook="The supplement that actually shows you what's inside",
        ),
        demographics=AvatarDemographics(
            age_range="30-50",
            gender=Gender.MALE,
            locations=["United States"],
            professional_background=["Corporate professional"],
            identities=["Health-conscious buyer"],
        ),
        problem_experience=AvatarProblemExperience(
            duration="1-3 years",
            severity="Moderate",
            trigger_event="Started noticing fatigue",
            daily_life_impact=["Low energy in the afternoon"],
        ),
        pain_desire=AvatarPainDesire(
            pain=PainDimension(
                surface=["Low energy"],
                emotional=["Frustration"],
                identity=["I should be healthier"],
                secret=["Fear of decline"],
            ),
            desire=DesireDimension(
                emotional="Feel energetic and sharp",
                social="Be seen as vibrant and capable",
                identity="I take care of my health proactively",
                secret="Just want to keep up with my kids",
                dream_outcome="Boundless energy throughout the day",
            ),
            dominant_emotion="Frustration",
        ),
        failed_solutions=AvatarFailedSolutions(
            solutions=[
                FailedSolutionItem(
                    solution_tried="Generic multivitamin",
                    why_it_failed="No noticeable difference",
                    our_opportunity="Clinically dosed formula",
                )
            ],
            money_already_spent="$100-$300",
            current_coping="Coffee and energy drinks",
        ),
        objections_buying=AvatarObjectionsBuying(
            primary_objection="Is this actually clinically proven?",
            hidden_objection="What if I waste money again?",
            decision_style="Careful Researcher",
            price_range="$30-$60/month",
            what_makes_them_buy=["Third-party testing", "Money-back guarantee"],
            what_makes_them_walk=["Proprietary blends", "No refund policy"],
        ),
        raw_language=AvatarRawLanguage(
            pain_quotes=[
                QuoteWithSource(quote="I'm tired of feeling tired", source="Reddit")
            ],
            desire_quotes=[
                QuoteWithSource(quote="I want something that works", source="Amazon Review")
            ],
            objection_quotes=[
                QuoteWithSource(quote="Most supplements are garbage", source="YouTube")
            ],
            words_they_use=["energy", "natural", "clean"],
            words_they_avoid=["miracle", "cure"],
        ),
        advertising_platforms="Facebook, Instagram, YouTube",
    )


def make_marketing_angles(avatar_name: str = "Test Avatar 1") -> AvatarMarketingAngles:
    """Return a minimal valid AvatarMarketingAngles instance."""
    return AvatarMarketingAngles(
        avatar_name=avatar_name,
        generated_angles=[
            MarketingAngle(
                angle_title="Science-Backed Energy",
                angle_subtitle="Clinical doses, real results",
                angle_type="mechanism",
                emotional_driver="trust",
                risk_level="low",
                market_size="4",
                saturation="2",
                angle_problem_urgency=4,
                novelty=3,
                proof_strength=4,
                avatar_fit=4,
                ltv_potential=4,
                overall_score=4,
                core_argument="Clinical evidence trumps marketing hype",
                target_age_range="30-50",
                target_audience="Health-conscious men",
                pain_points=["Low energy", "Skepticism"],
                desires=["Feel energetic", "Trust the product"],
                common_objections=["Is it clinically proven?"],
                failed_alternatives=["Generic multivitamins"],
            ),
        ],
        ranking=[0],
    )


def make_offer_brief() -> OfferBrief:
    """Return a minimal valid OfferBrief instance."""
    return OfferBrief(
        potential_product_names=["TestProduct"],
        big_idea="Transparent health supplementation",
    )


def make_template_prediction_result(
    avatar_id: str = "test-avatar",
    angle_id: str = "test-angle",
) -> TemplatePredictionResult:
    """Return a minimal valid TemplatePredictionResult."""
    return TemplatePredictionResult(
        avatar_id=avatar_id,
        angle_id=angle_id,
        predictions=[
            TemplateMatch(
                template_id="A00001",
                overall_fit_score=0.85,
                audience_fit=0.9,
                pain_point_fit=0.8,
                tone_fit=0.85,
                reasoning="Good match for health-conscious audience",
            )
        ],
        top_template_id="A00001",
        predicted_at="2025-01-01T00:00:00Z",
    )


def make_page_analysis() -> str:
    """Return a mock page analysis string."""
    return (
        "This is a supplement product page targeting health-conscious adults. "
        "The product claims to improve energy and vitality using clinically studied "
        "ingredients. Key selling points include third-party testing and a money-back guarantee."
    )


def make_deep_research_output() -> str:
    """Return a mock deep research string."""
    return (
        "Comprehensive research: The supplement market is growing at 8% CAGR. "
        "Target demographics are adults 30-65 who are concerned about energy, "
        "cognitive function, and overall vitality. Primary pain points include "
        "fatigue, brain fog, and skepticism about supplement efficacy. "
        "Failed alternatives include generic multivitamins and energy drinks."
    )


def make_library_summaries_json() -> dict:
    """Return a minimal library summaries JSON for S3 seeding."""
    return {
        "version": "1.0",
        "generated_at": "2025-01-01T00:00:00Z",
        "total_pages": 1,
        "summaries": [
            {
                "id": "A00001",
                "s3_key": "content_library/A00001.html",
                "product_name": "Test Supplement",
                "product_category": "supplement",
                "short_description": "A health supplement landing page",
                "target_audience": "Health-conscious adults",
                "primary_pain_point": "Low energy",
                "primary_benefit": "All-day energy",
                "tone": "professional",
                "keywords": ["energy", "supplement", "health"],
                "price_point": "mid",
            }
        ],
    }


def make_page_analysis_quality_check(score: int = 4) -> PageAnalysisQualityCheck:
    """Return a passing PageAnalysisQualityCheck instance."""
    return PageAnalysisQualityCheck(
        product_name_identified=True,
        product_type_identified=True,
        specific_claims_extracted=True,
        target_audience_identified=True,
        price_or_offer_identified=True,
        overall_quality_score=score,
        failure_reason="N/A",
    )
