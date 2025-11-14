from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, HttpUrl

## Avatar Sheet Data Models

class Demographics(BaseModel):
    """Demographic & general information about the avatar."""
    age_range: Optional[int] = Field(
        None, description="Inclusive min/max age in years, e.g. (28, 45)."
    )
    gender: Optional[List[str]] = Field(
        None, description="Gender distribution labels, e.g. ['male', 'female', 'non-binary']."
    )
    locations: Optional[List[str]] = Field(
        None, description="Primary regions/countries where the segment is concentrated."
    )
    monthly_revenue: Optional[int] = Field(
        None, description="Typical monthly revenue range (min, max) in your chosen currency."
    )
    professional_backgrounds: List[str] = Field(
        default_factory=list, description="Typical professional backgrounds (e.g., 'founder', 'marketing lead')."
    )
    typical_identities: List[str] = Field(
        default_factory=list, description="Typical identities/lifestyles/roles (e.g., 'bootstrapped founder')."
    )

class PainPointGroup(BaseModel):
    """A themed set of related challenges/concerns."""
    title: str = Field(..., description="Name of the pain point theme, e.g., 'Lead Generation'.")
    bullets: List[str] = Field(
        ..., min_items=1, description="Concrete challenges/concerns under this theme."
    )

class Goals(BaseModel):
    """Outcomes the avatar wants."""
    short_term: List[str] = Field(
        default_factory=list, description="Short-term goals (weeks/months)."
    )
    long_term: List[str] = Field(
        default_factory=list, description="Long-term aspirations (quarters/years)."
    )

class Quotes(BaseModel):
    """Verbatim quotes used for messaging and copy."""
    general_client: List[str] = Field(
        default_factory=list, description='General direct client quotes, e.g., "I just need consistent leads."'
    )
    pain_frustrations: List[str] = Field(
        default_factory=list, description='Quotes that express pains/frustrations.'
    )
    mindset: List[str] = Field(
        default_factory=list, description='Quotes that capture mindset, e.g., principles or mottos.'
    )
    emotional_state_drivers: List[str] = Field(
        default_factory=list, description='Quotes about emotional state/personal drivers.'
    )

class EmotionalJourney(BaseModel):
    """Narrative progression through the buying journey."""
    awareness: str = Field(..., description="Initial awareness stage (problem/status quo).")
    frustration: str = Field(..., description="Frustration stage (failed attempts/costs of inaction).")
    seeking_solutions: str = Field(..., description="Desperation & seeking solutions stage (research/criteria).")
    relief_commitment: str = Field(..., description="Relief & commitment stage (decision/outcome).")
    
class Angle(BaseModel):
    """A marketing angle for a product."""
    angle: str = Field(..., description="The marketing angle for the product.")
    title: str = Field(..., description="The title of the marketing angle.")

class Avatar(BaseModel):
    """
    Marketing Avatar sheet for product–market fit & messaging research.
    Use this to standardize ICP/persona data for campaigns, ads, and positioning.
    """
    model_config = ConfigDict(
        title="Marketing Avatar",
        description="Structured avatar sheet capturing demographics, pains, goals, psychology, quotes, journey, and angles.",
        extra="forbid",
    )

    demographics: Demographics = Field(..., description="Demographic & general information.")
    pain_points: List[PainPointGroup] = Field(
        ..., min_items=1, description="List of pain point themes, each with concrete challenges."
    )
    goals: Goals = Field(..., description="Short-term goals and long-term aspirations.")
    emotional_drivers: List[str] = Field(
        default_factory=list, description="Emotional drivers & psychological insights."
    )
    quotes: Quotes = Field(..., description="Verbatim quotes for copy and creative.")
    emotional_journey: EmotionalJourney = Field(
        ..., description="Typical emotional journey from awareness to commitment."
    )
    marketing_angles: List[Angle] = Field(
        default_factory=list, description="Main marketing angles to test or use."
    )





# Offer brief data models
class ConsciousnessLevel(str, Enum):
    """How self-aware and change-ready the prospect is."""
    LOW = "low"
    HIGH = "high"


class AwarenessLevel(str, Enum):
    """Prospect’s awareness per Schwartz’s stages."""
    UNAWARE = "unaware"
    PROBLEM_AWARE = "problem_aware"
    SOLUTION_AWARE = "solution_aware"
    PRODUCT_AWARE = "product_aware"
    MOST_AWARE = "most_aware"


class SophisticationLevel(str, Enum):
    """Market sophistication level (make claims → mechanisms → advanced strategies)."""
    LEVEL_1 = "level_1"   # Birth of market; simple core claim works.
    LEVEL_2 = "level_2"   # Outshine competition; bigger/more dramatic promise.
    LEVEL_3 = "level_3"   # Introduce mechanism; explain "how it works" to earn belief.
    LEVEL_4 = "level_4"   # Upgrade/improve mechanism; v2.0 of the “secret sauce”.
    LEVEL_5 = "level_5"   # Maximum skepticism; use advanced strategies to break through.


class StageOfSophistication(BaseModel):
    """Choose the market’s sophistication level and capture reasoning/context."""
    level: SophisticationLevel = Field(
        ...,
        description=(
            "Overall market maturity: "
            "L1=Birth/basic claim; L2=Bolder promise; L3=Introduce mechanism; "
            "L4=Improved mechanism; L5=Advanced strategies to overcome cynicism."
        )
    )
    rationale: Optional[str] = Field(
        None,
        description="Why this level fits (signals from ads, competitors, buyer skepticism)."
    )


class HeadlineIdea(BaseModel):
    """A headline and optional supporting subheadline."""
    headline: str = Field(..., description="Punchy primary promise or hook.")
    subheadline: Optional[str] = Field(
        None,
        description="Clarifies/grounds the headline with specifics, mechanism, or outcome."
    )


class BeliefChain(BaseModel):
    """A chain of beliefs the prospect must adopt to buy."""
    outcome: str = Field(..., description="What the buyer must feel confident about (e.g., 'This can work for me').")
    steps: List[str] = Field(
        ...,
        description="Ordered micro-beliefs (e.g., problem is real → solution type works → this product’s mechanism works → I can use it)."
    )


class SwipeExample(BaseModel):
    """Reference examples/inspiration for the offer or creatives."""
    title: str = Field(..., description="Short label for the swipe (publisher, creator, or concept).")
    # url: Optional[HttpUrl] = Field(None, description="Link to the asset if available.")
    notes: Optional[str] = Field(None, description="What to model: headline structure, proof style, funnel flow, etc.")


class ProductInfo(BaseModel):
    """Basic info about the product you will market."""
    name: Optional[str] = Field(None, description="Working name of the product/offer.")
    description: Optional[str] = Field(None, description="What it is, who it’s for, core outcomes/benefits.")
    details: Optional[str] = Field(
        None,
        description="Format, modules, deliverables, bonuses, guarantees, price points, terms."
    )


class OfferBrief(BaseModel):
    """
    Structured brief to guide AI when generating copy, concepts, and funnel assets.
    Fill as many fields as possible; lists can contain multiple options to explore.
    """
    potential_product_names: List[str] = Field(
        default_factory=list,
        description="Brainstormed product/offer name options."
    )
    level_of_consciousness: Optional[ConsciousnessLevel] = Field(
        None, description="Prospect’s general self-awareness/readiness to change."
    )
    level_of_awareness: Optional[AwarenessLevel] = Field(
        None, description="Prospect’s current awareness of problem/solution/product."
    )
    stage_of_sophistication: Optional[StageOfSophistication] = Field(
        None, description="Market sophistication selection with reasoning."
    )

    big_idea: Optional[str] = Field(
        None,
        description="Single, transformative central idea that unifies the campaign."
    )
    metaphors: List[str] = Field(
        default_factory=list,
        description="Images/analogies to make the big idea and mechanism vivid."
    )

    potential_ump: List[str] = Field(
        default_factory=list,
        description="Unique Mechanism of the Problem: counterintuitive reason the problem persists."
    )
    potential_ums: List[str] = Field(
        default_factory=list,
        description="Unique Mechanism of the Solution: how THIS solution uniquely works."
    )

    guru: Optional[str] = Field(
        None,
        description="Authority or spokesperson (real or archetype) associated with the offer."
    )
    discovery_story: Optional[str] = Field(
        None,
        description="Origin narrative: aha moment, failed attempts, breakthrough mechanism."
    )

    product: Optional[ProductInfo] = Field(
        None, description="Core product details to anchor claims and copy."
    )

    headline_ideas: List[HeadlineIdea] = Field(
        default_factory=list,
        description="Potential headline/subheadline pairs for ads, LPs, emails."
    )

    objections: List[str] = Field(
        default_factory=list,
        description="All likely objections (price, time, credibility, fit, complexity, risk)."
    )

    belief_chains: List[BeliefChain] = Field(
        default_factory=list,
        description="Required belief paths the buyer must traverse to purchase."
    )

    funnel_architecture: List[str] = Field(
        default_factory=list,
        description=(
            "High-level funnel steps in order (e.g., 'Ad → Lead Magnet → Nurture → VSL → Checkout → Upsell'). "
            "Use one string per variation if testing multiple architectures."
        )
    )

    potential_domains: List[str] = Field(
        default_factory=list,
        description="Available or desired domains/URLs for the offer."
    )

    examples_swipes: List[SwipeExample] = Field(
        default_factory=list,
        description="Reference campaigns, pages, or ads to emulate."
    )

    other_notes: Optional[str] = Field(
        None,
        description="Anything else helpful: compliance constraints, must-include proof, JTBD, ICP nuances."
    )
