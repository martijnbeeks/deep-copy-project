from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, HttpUrl

## Avatar Sheet Data Models

class AvatarDemographics(BaseModel):
    """Section A: Demographic Profile"""
    age_range: str = Field(..., description="Age Range")
    gender: str = Field(..., description="Gender")
    occupation: str = Field(..., description="Occupation / Life Stage")
    income_level: str = Field(..., description="Income Level")
    location_type: str = Field(..., description="Location Type: (urban / suburban / rural)")
    family_situation: str = Field(..., description="Family Situation: (single / married / divorced / kids at home / empty nest)")
    education_level: str = Field(..., description="Education Level")
    one_sentence_description: str = Field(..., description="Who they are and what makes their situation unique")

class AvatarProblemExperience(BaseModel):
    """Section B: Problem Experience"""
    duration: str = Field(..., description="Problem Duration: How long have they been dealing with this?")
    severity: str = Field(..., description="Problem Severity: Early stage / Moderate / Severe / Crisis")
    frequency: str = Field(..., description="Problem Frequency: How often do they think about it? Daily obsession vs. occasional annoyance?")
    trigger_event: str = Field(..., description="Trigger Event: What specific moment made them start actively searching for a solution?")
    daily_life_impact: str = Field(..., description="Daily Life Impact: How does this problem affect their everyday activities?")
    social_impact: str = Field(..., description="Social Impact: How does this affect relationships, work, public situations?")
    who_else_knows: str = Field(..., description="Who Else Knows: Is this a private struggle or do others know? Who have they told?")

class AvatarPainDimensions(BaseModel):
    """Section C: Pain Dimensions"""
    surface_pain: str = Field(..., description="Surface Pain (Physical/Practical): The problem as they describe it in literal terms")
    emotional_pain: str = Field(..., description="Emotional Pain: The feelings this problem creates — shame, frustration, fear, anger")
    social_pain: str = Field(..., description="Social Pain: How this affects how others see them or how they show up in the world")
    identity_pain: str = Field(..., description="Identity Pain: How this conflicts with who they believe they are or want to be")
    secret_pain: str = Field(..., description="Secret Pain: What they won't say out loud but feel deeply")
    dominant_negative_emotion: str = Field(..., description="Dominant Negative Emotion: The ONE emotion that dominates — shame / fear / frustration / hopelessness / anger")

class AvatarDesireDimensions(BaseModel):
    """Section D: Desire Dimensions"""
    surface_desire: str = Field(..., description="Surface Desire: What they say they want — the obvious fix")
    emotional_desire: str = Field(..., description="Emotional Desire: How they want to FEEL")
    social_desire: str = Field(..., description="Social Desire: How they want to be SEEN by others")
    identity_desire: str = Field(..., description="Identity Desire: Who they want to BECOME")
    secret_desire: str = Field(..., description="Secret Desire: The deeper want they might not admit")
    dream_outcome: str = Field(..., description="Dream Outcome: If this problem was completely solved, what does their life look like?")

class AvatarAwareness(BaseModel):
    """Section E: Awareness & Sophistication"""
    problem_awareness: str = Field(..., description="Problem Awareness: Do they know exactly what's causing this, or are they confused?")
    solution_awareness: str = Field(..., description="Solution Awareness: Do they know solutions exist? Have they researched options?")
    product_awareness: str = Field(..., description="Product Awareness: Do they know about products like ours specifically?")
    market_sophistication: str = Field(..., description="Market Sophistication: How much have they seen? First-time buyer vs. seen-it-all skeptic?")
    schwartz_awareness_level: str = Field(..., description="Schwartz Awareness Level: Unaware / Problem-Aware / Solution-Aware / Product-Aware / Most Aware")

class AvatarFailedSolutions(BaseModel):
    """Section F: Failed Solution History"""
    solutions_tried: str = Field(..., description="Solutions Already Tried: List everything they've attempted")
    money_spent: str = Field(..., description="Money Already Spent: Approximate total spent on this problem")
    why_failed: str = Field(..., description="Why Past Solutions Failed: In their words — what went wrong?")
    beliefs_about_failure: str = Field(..., description="Belief About Why Nothing Works: What conclusion have they drawn about why they can't solve this?")
    current_coping: str = Field(..., description="Current Coping Mechanism: What are they doing now to manage the problem?")

class AvatarObjections(BaseModel):
    """Section G: Objections & Skepticism"""
    primary_objection: str = Field(..., description="Primary Objection: The #1 reason they would NOT buy")
    secondary_objections: str = Field(..., description="Secondary Objections: Other concerns")
    hidden_objection: str = Field(..., description="Hidden Objection: What they're really worried about but won't say")
    skepticism_source: str = Field(..., description="Source of Skepticism: Why don't they trust solutions? Past experience? General cynicism?")
    proof_needed: str = Field(..., description="What Proof Would They Need: What evidence would overcome their skepticism?")
    trusted_sources: str = Field(..., description="Whose Opinion Do They Trust: Doctors? Friends? Online reviews? Celebrities? People like them?")

class AvatarBuyingPsychology(BaseModel):
    """Section H: Buying Psychology"""
    decision_making_style: str = Field(..., description="Decision-Making Style: Impulse buyer / Careful researcher / Needs permission / Analysis paralysis")
    budget_range: str = Field(..., description="Budget Range: What would they realistically pay for a solution?")
    price_sensitivity: str = Field(..., description="Price Sensitivity: Very sensitive / Moderate / Will pay premium for results")
    risk_tolerance: str = Field(..., description="Risk Tolerance: Will they try something new easily, or need heavy reassurance?")
    decision_influencers: str = Field(..., description="Who Influences Their Decision: Spouse? Doctor? Friends? No one — solo decider?")
    buying_urgency: str = Field(..., description="Buying Urgency: Need it now / Can wait / Just browsing")
    buy_today_trigger: str = Field(..., description="What Would Make Them Buy TODAY: The specific trigger or offer that converts them immediately")
    dealbreaker: str = Field(..., description="What Would Make Them Walk Away: The dealbreaker that kills the sale")

class AvatarInformationComm(BaseModel):
    """Section I: Information & Communication"""
    info_sources: str = Field(..., description="Where They Seek Information: Google / YouTube / Reddit / Facebook Groups / Doctor / Friends")
    content_format: str = Field(..., description="Preferred Content Format: Video / Text / Images / Testimonials / Data")
    language_style: str = Field(..., description="Language Style: Clinical and technical / Casual and emotional / Direct and simple")
    problem_vocab: str = Field(..., description="Words They Use to Describe Problem: Their exact vocabulary")
    avoided_words: str = Field(..., description="Words They Avoid: Terms that feel too clinical, embarrassing, or off-putting")
    resonating_tone: str = Field(..., description="Tone That Resonates: Empathetic / Authoritative / Peer-to-peer / Clinical / Urgent")

class AvatarRawLanguage(BaseModel):
    """Section J: Raw Language Map"""
    pain_language: List[str] = Field(..., description="Pain Language (3+ quotes): Direct quotes expressing pain")
    desire_language: List[str] = Field(..., description="Desire Language (3+ quotes): Direct quotes expressing desire")
    objection_language: List[str] = Field(..., description="Objection Language (2+ quotes): Direct quotes expressing skepticism/objection")
    failed_solution_language: List[str] = Field(..., description="Failed Solution Language (2+ quotes): Direct quotes about what they've tried")

class AvatarStrategicSummary(BaseModel):
    """Section K: Strategic Summary"""
    market_size: str = Field(..., description="Market Size Estimate: Small / Medium / Large — based on frequency in research")
    buying_readiness: str = Field(..., description="Buying Readiness: Cold / Warm / Hot")
    competitive_saturation: str = Field(..., description="Competitive Saturation: Are competitors already targeting this avatar heavily?")
    message_match_difficulty: str = Field(..., description="Message Match Difficulty: Easy to reach with messaging / Requires nuanced approach")
    one_line_hook: str = Field(..., description="One-Line Hook That Would Stop Them: A headline or opening that would grab THIS avatar specifically")

class AvatarRanking(BaseModel):
    """Section L: Ranking"""
    ranking: int = Field(..., description="High, medium, low based on market size x buying readiness")
    reason: str = Field(..., description="Reason for the ranking")

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

    name: str = Field(..., description="Descriptive Name of the Avatar")
    demographics: AvatarDemographics = Field(..., description="Section A: Demographic Profile")
    problem_experience: AvatarProblemExperience = Field(..., description="Section B: Problem Experience")
    pain_dimensions: AvatarPainDimensions = Field(..., description="Section C: Pain Dimensions")
    desire_dimensions: AvatarDesireDimensions = Field(..., description="Section D: Desire Dimensions")
    awareness: AvatarAwareness = Field(..., description="Section E: Awareness & Sophistication")
    failed_solutions: AvatarFailedSolutions = Field(..., description="Section F: Failed Solution History")
    objections: AvatarObjections = Field(..., description="Section G: Objections & Skepticism")
    buying_psychology: AvatarBuyingPsychology = Field(..., description="Section H: Buying Psychology")
    info_comm: AvatarInformationComm = Field(..., description="Section I: Information & Communication")
    raw_language: AvatarRawLanguage = Field(..., description="Section J: Raw Language Map")
    strategic_summary: AvatarStrategicSummary = Field(..., description="Section K: Strategic Summary")
    ranking: AvatarRanking = Field(..., description="Section L: Ranking")



class IdentifiedAvatar(BaseModel):
    """A potential customer avatar identified from research."""
    name: str = Field(..., description="Name of the avatar (e.g., 'Busy Mom').")
    description: str = Field(..., description="Brief description of who they are and why they are a good fit.")

class IdentifiedAvatarList(BaseModel):
    """List of identified avatars."""
    avatars: List[IdentifiedAvatar] = Field(..., description="List of potential customer avatars.")



# Marketing Angles Data Models

class MarketingAngle(BaseModel):
    """A generated marketing angle."""
    angle_title: str = Field(..., description="A name for this specific pitch")
    angle_subtitle: str = Field(..., description="A short tagline that captures the angle's promise")
    angle_type: str = Field(..., description="The category of argument being made (e.g., Pain-Lead, Desire-Lead, etc.)")
    emotional_driver: str = Field(..., description="The primary emotion this angle triggers (Fear / Hope / Anger / Shame / Desire)")
    risk_level: str = Field(..., description="Compliance or proof risk for running this angle (Low / Medium / High)")
    core_argument: str = Field(..., description="The single-sentence logical argument this angle makes")
    target_age_range: str = Field(..., description="The age bracket this angle speaks to")
    target_audience: str = Field(..., description="A refined description of who this specific angle is for")
    pain_points: List[str] = Field(..., description="The most relevant frustrations for this particular angle")
    desires: List[str] = Field(..., description="The most relevant goals and wants for this particular angle")
    common_objections: List[str] = Field(..., description="Why this person might say 'no' to this specific pitch")
    failed_alternatives: List[str] = Field(..., description="What they've tried before that didn't work — and why this angle addresses it")
    
    # Raw Language
    pain_quotes: List[str] = Field(..., description="Direct quotes from research expressing the pain this angle targets")
    desire_quotes: List[str] = Field(..., description="Direct quotes from research expressing the desire this angle promises")
    objection_quotes: List[str] = Field(..., description="Direct quotes from research expressing skepticism this angle must overcome")

class TopAngle(BaseModel):
    """Top selected angle."""
    name: str = Field(..., description="Name of the angle")
    angle_type: str = Field(..., description="Type of angle")
    core_argument: str = Field(..., description="Core argument")
    why_selected: str = Field(..., description="Reason for selection")
    primary_hook: str = Field(..., description="Primary hook")
    emotional_driver: str = Field(..., description="Emotional driver")
    risk_level: str = Field(..., description="Risk level (Low/Medium/High)")

class Top3Angles(BaseModel):
    """Top 3 angles for an avatar."""
    primary_angle: TopAngle = Field(..., description="#1 Primary Angle")
    secondary_angle: TopAngle = Field(..., description="#2 Secondary Angle")
    test_angle: TopAngle = Field(..., description="#3 Test Angle")

class AvatarMarketingAngles(BaseModel):
    """Marketing angles generated for a specific avatar."""
    avatar_name: str = Field(..., description="Name of the avatar")
    generated_angles: List[MarketingAngle] = Field(..., description="List of 5-7 distinct marketing angles")
    top_3_angles: Top3Angles = Field(..., description="Selection of top 3 angles")


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
        None, description="Prospect’s general self-awareness/readiness to change. Explain in 2-3 sentences."
    )
    level_of_awareness: Optional[AwarenessLevel] = Field(
        None, description="Prospect’s current awareness of problem/solution/product. Explain in 2-3 sentences."
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
