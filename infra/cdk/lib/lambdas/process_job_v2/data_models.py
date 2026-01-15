## Avatar Sheet Data Models
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


# =============================================================================
# AVATAR DATA MODELS (Matching UI screenshots)
# =============================================================================

class MarketSize(str, Enum):
    """Market size indicator for the avatar segment."""
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"


class BuyingReadiness(str, Enum):
    """How ready this avatar is to purchase."""
    COLD = "cold"    # Not actively looking
    WARM = "warm"    # Interested but needs convincing
    HOT = "hot"      # Ready to buy now


class CompetitionLevel(str, Enum):
    """How heavily competitors target this avatar."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class AwarenessLevel(str, Enum):
    """Schwartz awareness level of the avatar."""
    UNAWARE = "Unaware"
    PROBLEM_AWARE = "problem aware"
    SOLUTION_AWARE = "solution aware"
    PRODUCT_AWARE = "product aware"
    MOST_AWARE = "most aware"


class AvatarOverview(BaseModel):
    """
    Section 1: Avatar Overview (Always visible)
    High-level summary card that appears at the top of the avatar sheet.
    """
    name: str = Field(
        ..., 
        description="Descriptive name for this avatar (e.g., 'THE WORRIED SELF-MANAGER', 'THE BUSY MOM')"
    )
    description: str = Field(
        ..., 
        description="One-sentence description of who they are, their situation, and what makes them unique. Example: 'A 55-75 year old who noticed early vision changes and wants to act before it gets worse — but needs proof before they'll trust any product.'"
    )
    market_size: MarketSize = Field(
        ..., 
        description="Estimated size of this avatar segment: small (niche), medium (solid segment), or large (mass market)"
    )
    buying_readiness: BuyingReadiness = Field(
        ..., 
        description="How ready this avatar is to purchase: cold (not looking), warm (interested but skeptical), hot (ready to buy)"
    )
    awareness_level: AwarenessLevel = Field(
        ..., 
        description="Schwartz awareness stage: unaware, problem aware, solution aware, product aware, or most aware"
    )
    competition_level: CompetitionLevel = Field(
        ..., 
        description="How heavily competitors are already targeting this avatar: low (untapped), medium (some competition), high (saturated)"
    )
    one_line_hook: str = Field(
        ..., 
        description="A headline or opening line that would immediately grab THIS avatar's attention. Example: 'The eye supplement that shows you exactly what's inside — because you're tired of proprietary blend labels.'"
    )


class AvatarDemographics(BaseModel):
    """
    Section 2: Demographics & Identity
    Who they are demographically and how they see themselves.
    """
    age_range: str = Field(
        ..., 
        description="Age range of the avatar (e.g., '55-75', '30-45', '25-40')"
    )
    gender: str = Field(
        ..., 
        description="Gender(s) this avatar includes (e.g., 'Female', 'Male', 'Female, Male', 'All')"
    )
    locations: List[str] = Field(
        default_factory=list,
        description="Geographic locations where this avatar is found. List each as a tag. Examples: ['United States', 'Canada', 'United Kingdom', 'Australia']"
    )
    professional_background: List[str] = Field(
        default_factory=list,
        description="Professional backgrounds or life stages. List each as a tag. Examples: ['Retiree', 'Healthcare professional', 'Corporate professional', 'Stay-at-home parent']"
    )
    identities: List[str] = Field(
        default_factory=list,
        description="Psychographic identities — how they see themselves. List each as a tag. Examples: ['Science-first buyer', 'Value-conscious shopper', 'Proactive health seeker', 'Independent decision-maker', 'Skeptic of marketing hype']"
    )


class AvatarProblemExperience(BaseModel):
    """
    Section 3: Problem Experience
    How they experience the problem in their daily life.
    """
    duration: str = Field(
        ..., 
        description="How long they've been dealing with this problem. Example: '6 months - 5 years', '2+ years', 'Recently diagnosed'"
    )
    severity: str = Field(
        ..., 
        description="Current severity of their problem: 'Early stage', 'Early to Moderate', 'Moderate', 'Severe', 'Crisis'"
    )
    trigger_event: str = Field(
        ..., 
        description="The specific moment that made them start actively searching for a solution. Write as a quote or specific event. Example: 'Doctor mentioned early signs of AMD at last eye exam.'"
    )
    daily_life_impact: List[str] = Field(
        default_factory=list,
        description="Specific ways this problem affects their everyday activities. List each impact as a bullet point. Examples: ['Struggles with screen time — eyes tire faster', 'Avoids night driving when possible', 'Holds phone and books further away', 'Difficulty reading menus in dim restaurants']"
    )


class PainDimension(BaseModel):
    """
    Pain points organized by psychological dimension.
    Each dimension captures a different layer of the pain experience.
    """
    surface: List[str] = Field(
        default_factory=list,
        description="Surface-level, physical, or practical pain points — the problem as they describe it in literal terms. Examples: ['Blurry vision when reading', 'Eye strain after screen time', 'Trouble in dim lighting']"
    )
    emotional: List[str] = Field(
        default_factory=list,
        description="Emotional pain — the feelings this problem creates (fear, frustration, shame, anger). Examples: ['Anxiety about AMD/cataracts', 'Fear of losing independence', 'Frustration at not knowing what actually works']"
    )
    identity: List[str] = Field(
        default_factory=list,
        description="Identity pain — how this conflicts with who they believe they are. Write as quotes or self-statements. Examples: ['\"I\\'ve always been sharp and independent\"', '\"I\\'m not ready to be old\"']"
    )
    secret: List[str] = Field(
        default_factory=list,
        description="Secret pain — what they won't say out loud but feel deeply. The fears they keep private. Examples: ['Terrified of going blind', 'Scared of being a burden']"
    )


class DesireDimension(BaseModel):
    """
    Desires organized by psychological dimension.
    Each dimension captures a different layer of what they want.
    """
    emotional: str = Field(
        ..., 
        description="How they want to FEEL. The emotional state they're seeking. Example: 'Feel confident and at peace about my eye health'"
    )
    social: str = Field(
        ..., 
        description="How they want to be SEEN by others. Their desired social perception. Example: 'Be seen as sharp and capable — not \"getting old\" or declining'"
    )
    identity: str = Field(
        ..., 
        description="Who they want to BECOME. The identity they aspire to. Write as a self-statement. Example: '\"I\\'m proactive about health, not reactive\"'"
    )
    secret: str = Field(
        ..., 
        description="The deeper want they might not admit publicly. Example: 'Just want to keep reading to my grandchildren'"
    )
    dream_outcome: str = Field(
        ..., 
        description="If this problem was completely solved, what does their life look like? Paint the picture. Example: 'Clear, comfortable vision for decades — without constant worry'"
    )


class AvatarPainDesire(BaseModel):
    """
    Section 4: Pain & Desire
    Deep dive into their pain points and desires across psychological dimensions.
    """
    pain: PainDimension = Field(
        ..., 
        description="Pain points organized by dimension: surface, emotional, identity, secret"
    )
    desire: DesireDimension = Field(
        ..., 
        description="Desires organized by dimension: emotional, social, identity, secret, dream_outcome"
    )
    dominant_emotion: str = Field(
        ..., 
        description="The ONE dominant emotion driving their behavior. Examples: 'Fear / Anxiety', 'Frustration', 'Shame', 'Hopelessness', 'Anger'"
    )


class FailedSolutionItem(BaseModel):
    """A single failed solution with analysis of why it failed and our opportunity."""
    solution_tried: str = Field(
        ..., 
        description="What they tried. Be specific about the product/approach. Examples: 'Store-brand AREDS2', 'Basic lutein from Amazon', 'Blue light glasses'"
    )
    why_it_failed: str = Field(
        ..., 
        description="Why it didn't work FOR THEM — in their words or from their perspective. Examples: '\"Proprietary blend\" — can\\'t verify doses', 'No results after 3 months', 'Only addresses screens, not root'"
    )
    our_opportunity: str = Field(
        ..., 
        description="How our product/solution addresses this specific failure. Examples: 'Full ingredient transparency', 'Clinical doses + multi-action formula', 'Inside-out nutrition approach'"
    )


class AvatarFailedSolutions(BaseModel):
    """
    Section 5: Failed Solutions
    What they've already tried and why it didn't work.
    """
    solutions: List[FailedSolutionItem] = Field(
        default_factory=list,
        description="List of solutions they've tried, why each failed, and how we address it. Include 3-5 common failed solutions."
    )
    money_already_spent: str = Field(
        ..., 
        description="Approximate total they've already spent trying to solve this problem. Example: '$150 - $400', '$500+', 'Under $100'"
    )
    current_coping: str = Field(
        ..., 
        description="What they're currently doing to manage the problem (their workaround). Example: 'Basic multivitamin, adjusting screens, worrying'"
    )


class AvatarObjectionsBuying(BaseModel):
    """
    Section 6: Objections & Buying
    Their objections, buying psychology, and decision triggers.
    """
    primary_objection: str = Field(
        ..., 
        description="The #1 reason they would NOT buy — their biggest concern. Write as a quote. Example: '\"Is this actually clinically proven or just marketing hype?\"'"
    )
    hidden_objection: str = Field(
        ..., 
        description="What they're REALLY worried about but won't say out loud. Write as a quote. Example: '\"What if I waste money AGAIN on something that doesn\\'t work?\"'"
    )
    decision_style: str = Field(
        ..., 
        description="How they make purchase decisions: 'Impulse buyer', 'Careful Researcher', 'Needs permission', 'Analysis paralysis'"
    )
    price_range: str = Field(
        ..., 
        description="What they'd realistically pay for a solution (monthly or one-time). Example: '$30 - $60/month', '$50-100 one-time'"
    )
    what_makes_them_buy: List[str] = Field(
        default_factory=list,
        description="Specific triggers or proof points that would make them buy. Examples: ['Third-party lab verification', 'Clear clinical study cites', '60-90 day money-back', 'Doctor endorsement']"
    )
    what_makes_them_walk: List[str] = Field(
        default_factory=list,
        description="Dealbreakers that would make them immediately leave. Examples: ['\"Proprietary blend\" labels', 'Overhyped language (\"miracle\")', 'No clear refund policy', 'No independent reviews']"
    )


class QuoteWithSource(BaseModel):
    """A direct quote from research with its source."""
    quote: str = Field(
        ..., 
        description="The exact quote from research. Include quotation marks. Example: '\"I'm scared I won't be able to read to my grandchildren.\"'"
    )
    source: str = Field(
        ..., 
        description="Where this quote came from. Be specific. Examples: 'Reddit r/eyecare', 'Facebook Group', 'Amazon Review', 'YouTube Comment'"
    )


class AvatarRawLanguage(BaseModel):
    """
    Section 7: Raw Language
    Direct quotes from research and vocabulary patterns.
    """
    pain_quotes: List[QuoteWithSource] = Field(
        default_factory=list,
        description="Direct quotes expressing their pain (2-4 quotes). These are real words from real people found in research."
    )
    desire_quotes: List[QuoteWithSource] = Field(
        default_factory=list,
        description="Direct quotes expressing what they want (2-4 quotes). These reveal their language around solutions."
    )
    objection_quotes: List[QuoteWithSource] = Field(
        default_factory=list,
        description="Direct quotes expressing skepticism or objections (2-4 quotes). These show how they push back."
    )
    words_they_use: List[str] = Field(
        default_factory=list,
        description="Words and phrases THEY use to describe the problem/solution. Use their vocabulary in copy. Examples: ['eye health', 'vision support', 'macular health']"
    )
    words_they_avoid: List[str] = Field(
        default_factory=list,
        description="Words that turn them off or feel wrong. AVOID these in copy. Examples: ['miracle', 'cure', 'guaranteed results']"
    )


class Avatar(BaseModel):
    """
    Complete Marketing Avatar sheet for product–market fit & messaging research.
    
    Use this to standardize ICP/persona data for campaigns, ads, and positioning.
    The avatar captures who they are, what they struggle with, what they want,
    what they've tried, why they're skeptical, and how they talk about it.
    """
    model_config = ConfigDict(
        title="Marketing Avatar",
        description="Structured avatar sheet capturing demographics, pains, desires, failed solutions, objections, and raw language.",
        extra="forbid",
    )

    short_description: str = Field(
        ..., 
        description="Short description of the avatar", max_length=40
    )

    age: str = Field(
        ...,
        description="Age range of the avatar", max_length=20
    )

    gender: str = Field(
        ...,
        description="Gender of the avatar", max_length=20
    )

    # Section 1: Avatar Overview (Always visible)
    overview: AvatarOverview = Field(
        ..., 
        description="Section 1: Avatar Overview — high-level summary with name, description, market indicators, and hook"
    )
    
    # Section 2: Demographics & Identity
    demographics: AvatarDemographics = Field(
        ..., 
        description="Section 2: Demographics & Identity — who they are and how they see themselves"
    )
    
    # Section 3: Problem Experience
    problem_experience: AvatarProblemExperience = Field(
        ..., 
        description="Section 3: Problem Experience — duration, severity, trigger, and daily impact"
    )
    
    # Section 4: Pain & Desire
    pain_desire: AvatarPainDesire = Field(
        ..., 
        description="Section 4: Pain & Desire — psychological dimensions of pain and desire with dominant emotion"
    )
    
    # Section 5: Failed Solutions
    failed_solutions: AvatarFailedSolutions = Field(
        ..., 
        description="Section 5: Failed Solutions — what they've tried, why it failed, and current coping"
    )
    
    # Section 6: Objections & Buying
    objections_buying: AvatarObjectionsBuying = Field(
        ..., 
        description="Section 6: Objections & Buying — objections, decision style, price range, buy/walk triggers"
    )
    
    # Section 7: Raw Language
    raw_language: AvatarRawLanguage = Field(
        ..., 
        description="Section 7: Raw Language — direct quotes with sources and vocabulary patterns"
    )


# =============================================================================
# IDENTIFIED AVATARS
# =============================================================================

class IdentifiedAvatar(BaseModel):
    """A potential customer avatar identified from research."""
    name: str = Field(..., description="Name of the avatar (e.g., 'Busy Mom').")
    description: str = Field(..., description="Brief description of who they are and why they are a good fit.")


class IdentifiedAvatarList(BaseModel):
    """List of identified avatars."""
    avatars: List[IdentifiedAvatar] = Field(..., description="List of potential customer avatars.")


# =============================================================================
# MARKETING ANGLES DATA MODELS
# =============================================================================

class AngleType(str, Enum):
    """Category of argument the angle makes."""
    MECHANISM = "mechanism"          # Leads with HOW it works
    PAIN_LEAD = "pain_lead"          # Leads with the problem/pain
    DESIRE_LEAD = "desire_lead"      # Leads with the outcome/benefit
    SOCIAL_PROOF = "social_proof"    # Leads with testimonials/authority
    FEAR_BASED = "fear_based"        # Leads with consequences of inaction
    CURIOSITY = "curiosity"          # Leads with intrigue/mystery
    CONTRARIAN = "contrarian"        # Challenges conventional wisdom
    STORY = "story"                  # Leads with narrative


class EmotionalDriver(str, Enum):
    """Primary emotion the angle triggers."""
    FEAR = "fear"
    HOPE = "hope"
    ANGER = "anger"
    SHAME = "shame"
    DESIRE = "desire"
    CURIOSITY = "curiosity"
    TRUST = "trust"


class RiskLevel(str, Enum):
    """Compliance or proof risk for running this angle."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class MarketingAngle(BaseModel):
    """
    A generated marketing angle for an avatar.
    Each angle represents a distinct way to pitch the product to this audience.
    """
    angle_title: str = Field(
        ..., 
        description="The name/headline for this specific pitch. Example: 'Formulated with AREDS2-Studied Ingredients'"
    )
    angle_subtitle: str = Field(
        ..., 
        description="A short tagline that captures the angle's promise. Example: 'Clinically-Studied Ingredients — Trust Without Overclaiming'"
    )
    angle_type: AngleType = Field(
        ..., 
        description="The category of argument being made: mechanism, pain_lead, desire_lead, social_proof, fear_based, curiosity, contrarian, story"
    )
    emotional_driver: EmotionalDriver = Field(
        ..., 
        description="The primary emotion this angle triggers: fear, hope, anger, shame, desire, curiosity, trust"
    )
    risk_level: RiskLevel = Field(
        ..., 
        description="Compliance or proof risk for running this angle: low, medium, high"
    )

    market_size: MarketSize = Field(
        ..., 
        description="Estimated size of this avatar segment: small (niche), medium (solid segment), or large (mass market)"
    )
    buying_readiness: BuyingReadiness = Field(
        ..., 
        description="How ready this avatar is to purchase: cold (not looking), warm (interested but skeptical), hot (ready to buy)"
    )
    
    # Core content
    core_argument: str = Field(
        ..., 
        description="The single-sentence logical argument this angle makes. Example: 'Trust comes from transparency and clinical backing, not marketing hype— this formula uses the exact ingredients studied in AREDS2.'"
    )
    target_age_range: str = Field(
        ..., 
        description="The age bracket this angle speaks to. Example: '55-80', '30-45'"
    )
    target_audience: str = Field(
        ..., 
        description="A refined description of who this specific angle is for. Example: 'Older adults concerned about age-related vision decline'"
    )
    
    # Pain, Desire, Objections, Failed Alternatives
    pain_points: List[str] = Field(
        default_factory=list,
        description="The most relevant pain points for this particular angle. Examples: ['Skepticism about vague clinical claims', 'Fear of vision decline and loss of independence', 'Need for clinician-level trust']"
    )
    desires: List[str] = Field(
        default_factory=list,
        description="The most relevant desires for this particular angle. Examples: ['Maintain independence and daily activities (reading, driving)', 'Use a product that eye doctors would recommend', 'Clear, evidence-based product information']"
    )
    common_objections: List[str] = Field(
        default_factory=list,
        description="Why this person might say 'no' to this specific pitch. Examples: ['Is this clinically proven or just marketing?', 'Will this interact with my medications?', 'Will I actually notice a difference?']"
    )
    failed_alternatives: List[str] = Field(
        default_factory=list,
        description="What they've tried before that didn't work. Examples: ['Generic Amazon lutein supplements with no COA', 'Expensive brand claims lacking ingredient transparency', 'Prescriptions (not applicable) or unverified miracle supplements']"
    )
    
    # Raw Language (quotes with sources)
    pain_quotes: List[QuoteWithSource] = Field(
        default_factory=list,
        description="Direct quotes from research expressing the pain this angle targets, with sources. Example: {'quote': 'I'm so tired of proprietary blend labels that hide underdosed ingredients.', 'source': 'Reddit'}"
    )
    desire_quotes: List[QuoteWithSource] = Field(
        default_factory=list,
        description="Direct quotes from research expressing the desire this angle promises, with sources. Example: {'quote': 'I just want something that actually works and isn't full of BS marketing.', 'source': 'Reddit'}"
    )
    objection_quotes: List[QuoteWithSource] = Field(
        default_factory=list,
        description="Direct quotes from research expressing skepticism this angle must overcome, with sources. Example: {'quote': 'Clinically proven by who? Their own company?', 'source': 'YouTube Comment'}"
    )


class TopAngle(BaseModel):
    """A selected top angle with reasoning for selection."""
    name: str = Field(
        ..., 
        description="Name/title of the angle"
    )
    angle_type: AngleType = Field(
        ..., 
        description="Type of angle: mechanism, pain_lead, desire_lead, etc."
    )
    core_argument: str = Field(
        ..., 
        description="The single-sentence logical argument this angle makes"
    )
    why_selected: str = Field(
        ..., 
        description="Reason for selecting this angle as a top pick. Example: 'Highest trust-building potential for skeptical audience'"
    )
    primary_hook: str = Field(
        ..., 
        description="The headline or opening hook for this angle. Example: 'The eye supplement that shows you exactly what's inside'"
    )
    emotional_driver: EmotionalDriver = Field(
        ..., 
        description="Primary emotion: fear, hope, anger, shame, desire, curiosity, trust"
    )
    risk_level: RiskLevel = Field(
        ..., 
        description="Compliance risk level: low, medium, high"
    )


class Top3Angles(BaseModel):
    """Top 3 recommended angles for an avatar, prioritized by expected performance."""
    primary_angle: TopAngle = Field(
        ..., 
        description="#1 Primary Angle — the safest, most likely to convert"
    )
    secondary_angle: TopAngle = Field(
        ..., 
        description="#2 Secondary Angle — strong alternative or different emotional approach"
    )
    test_angle: TopAngle = Field(
        ..., 
        description="#3 Test Angle — higher risk/reward or contrarian approach worth testing"
    )


class AvatarMarketingAngles(BaseModel):
    """Complete set of marketing angles generated for a specific avatar."""
    avatar_name: str = Field(
        ..., 
        description="Name of the avatar these angles are for"
    )
    generated_angles: List[MarketingAngle] = Field(
        default_factory=list,
        description="List of 5-7 distinct marketing angles, each with full detail"
    )
    ranking: List[int] = Field(
        default_factory=list,
        description="Indices into generated_angles in ranked order (best first). E.g., [2, 0, 4, 1, 3] means the angle at index 2 is #1, index 0 is #2, etc. Length should match generated_angles."
    )
    top_3_angles: Optional[Top3Angles] = Field(
        None,
        description="Selection of top 3 recommended angles with reasoning"
    )





# =============================================================================
# Offer Brief Data Models (Updated with all screenshot fields)
# =============================================================================

class ConsciousnessLevel(str, Enum):
    """How self-aware and change-ready the prospect is."""
    LOW = "low"
    HIGH = "high"



class SophisticationLevel(str, Enum):
    """Market sophistication level (make claims → mechanisms → advanced strategies)."""
    LEVEL_1 = "level_1"   # Birth of market; simple core claim works.
    LEVEL_2 = "level_2"   # Outshine competition; bigger/more dramatic promise.
    LEVEL_3 = "level_3"   # Introduce mechanism; explain "how it works" to earn belief.
    LEVEL_4 = "level_4"   # Upgrade/improve mechanism; v2.0 of the "secret sauce".
    LEVEL_5 = "level_5"   # Maximum skepticism; use advanced strategies to break through.


class MarketTemperature(str, Enum):
    """Market temperature indicating buyer readiness and trust level."""
    COLD = "cold"           # Not interested, unaware of need
    WARM = "warm"           # Interested but needs trust signals before buying
    HOT = "hot"             # Ready to buy, actively searching
    SKEPTICAL = "skeptical" # Burned before, needs heavy proof
    SATURATED = "saturated" # Seen everything, extremely hard to reach


class StageOfSophistication(BaseModel):
    """Choose the market's sophistication level and capture reasoning/context."""
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
        description="Why this level fits (signals from ads, competitors, buyer skepticism).",
        max_length=75
    )


class HeadlineIdea(BaseModel):
    """A headline and optional supporting subheadline."""
    headline: str = Field(..., description="Punchy primary promise or hook.")
    subheadline: Optional[str] = Field(
        None,
        description="Clarifies/grounds the headline with specifics, mechanism, or outcome."
    )


# Updated BeliefChain to match screenshot structure (FROM → TO → PROOF)
class BeliefStep(BaseModel):
    """A single belief shift in the belief chain."""
    belief_name: str = Field(..., description="Name of the belief (e.g., 'Problem Belief', 'Solution Belief')")
    from_belief: str = Field(..., description="The starting belief the prospect holds")
    to_belief: str = Field(..., description="The target belief we want them to adopt")
    proof: str = Field(..., description="Evidence or mechanism that enables this belief shift")


class BeliefChain(BaseModel):
    """A chain of beliefs the prospect must adopt to buy."""
    outcome: str = Field(..., description="What the buyer must feel confident about (e.g., 'This can work for me').")
    steps: List[str] = Field(
        ...,
        description="Ordered micro-beliefs (e.g., problem is real → solution type works → this product's mechanism works → I can use it)."
    )


class BeliefArchitecture(BaseModel):
    """Complete belief architecture with detailed belief chain and summary argument."""
    belief_chain: List[BeliefStep] = Field(
        default_factory=list,
        description="Ordered list of belief shifts (Problem → Solution → Mechanism → Product → Timing → Risk)"
    )
    complete_argument: Optional[str] = Field(
        None,
        description="The complete persuasive argument that incorporates all belief shifts into a cohesive narrative."
    )


class SwipeExample(BaseModel):
    """Reference examples/inspiration for the offer or creatives."""
    title: str = Field(..., description="Short label for the swipe (publisher, creator, or concept).")
    # url: Optional[HttpUrl] = Field(None, description="Link to the asset if available.")
    notes: Optional[str] = Field(None, description="What to model: headline structure, proof style, funnel flow, etc.")


# Updated ProductInfo with all screenshot fields
class ProductInfo(BaseModel):
    """Basic info about the product you will market."""
    name: Optional[str] = Field(None, description="Working name of the product/offer.")
    description: Optional[str] = Field(None, description="What it is, who it's for, core outcomes/benefits. Please do not use too technical terms.", max_length=30)
    details: Optional[str] = Field(
        None,
        description="Format, modules, deliverables, bonuses, guarantees, price points, terms. Please do not use too technical terms.",
        max_length=75
    )
    # New fields from Section 3: Product Details
    format: Optional[str] = Field(None, description="Product format (e.g., 'Softgel supplement (60 count)', 'Digital course', 'Physical book')")
    price: Optional[str] = Field(None, description="One-time price (e.g., '$49/bottle')")
    subscription_price: Optional[str] = Field(None, description="Subscription/recurring price if applicable (e.g., '$39 subscribe')")
    guarantee: Optional[str] = Field(None, description="Guarantee offered (e.g., '90-day money-back')")
    shipping: Optional[str] = Field(None, description="Shipping details (e.g., 'Free (US)')")
    key_differentiator: Optional[str] = Field(
        None, 
        description="The primary thing that sets this product apart from competitors"
    )
    compliance_notes: List[str] = Field(
        default_factory=list,
        description="Legal/compliance requirements (e.g., 'FDA supplement disclaimer required', 'No disease claims')"
    )


# New models for Section 4: Pain & Desire Clusters
class PainCluster(BaseModel):
    """Clustered pain points by dimension."""
    surface: List[str] = Field(default_factory=list, description="Surface-level, practical pain points")
    emotional: List[str] = Field(default_factory=list, description="Emotional pain points (fear, frustration, shame)")
    identity: List[str] = Field(default_factory=list, description="Identity-level pain (conflicts with self-image)")
    secret: List[str] = Field(default_factory=list, description="Hidden pain they won't admit publicly")


class DesireCluster(BaseModel):
    """Clustered desires by dimension."""
    surface: List[str] = Field(default_factory=list, description="Surface-level, practical desires")
    emotional: List[str] = Field(default_factory=list, description="Emotional desires (how they want to feel)")
    identity: List[str] = Field(default_factory=list, description="Identity desires (who they want to become)")
    secret: List[str] = Field(default_factory=list, description="Hidden desires they won't admit publicly")


class PainDesireSection(BaseModel):
    """Section 4: Pain & Desire mapping for the offer."""
    pain_clusters: Optional[PainCluster] = Field(None, description="Pain points organized by dimension")
    desire_clusters: Optional[DesireCluster] = Field(None, description="Desires organized by dimension")
    dominant_emotion: Optional[str] = Field(
        None, 
        description="The ONE dominant emotion driving behavior (e.g., 'Fear — specifically fear of loss and dependence')"
    )


# New models for Section 5: Failed Solutions
class OfferFailedSolutionItem(BaseModel):
    """A single failed solution with analysis for the Offer Brief."""
    solution: str = Field(..., description="What they tried (e.g., 'Store-brand AREDS2', 'Cheap Amazon lutein')")
    why_it_failed: str = Field(..., description="Why it didn't work for them")
    our_opportunity: str = Field(..., description="How our product addresses this failure")


class FailedSolutionsSection(BaseModel):
    """Section 5: Failed Solutions analysis."""
    solutions: List[OfferFailedSolutionItem] = Field(
        default_factory=list,
        description="Table of failed solutions with failure reasons and opportunities"
    )
    money_already_spent: Optional[str] = Field(None, description="Approximate total spent on failed solutions (e.g., '$100 - $400')")
    belief_about_failure: Optional[str] = Field(
        None, 
        description="What conclusion they've drawn about why nothing works (e.g., 'Most supplements are underdosed scams hiding behind legal loopholes')"
    )
    current_coping: Optional[str] = Field(
        None,
        description="What they're currently doing to manage the problem (e.g., 'Basic multivitamin, screen adjustments, hoping for the best')"
    )


# New models for Section 6: Competitor Landscape
class CompetitorEntry(BaseModel):
    """A single competitor in the landscape."""
    name: str = Field(..., description="Competitor name/brand")
    price: str = Field(..., description="Price or price range")
    key_claim: str = Field(..., description="Their primary marketing claim")
    weakness: str = Field(..., description="Their main weakness or vulnerability")
    complaints: str = Field(..., description="Common customer complaints about them")


class CompetitorLandscape(BaseModel):
    """Section 6: Competitor analysis and positioning."""
    competitors: List[CompetitorEntry] = Field(
        default_factory=list,
        description="Table of main competitors with their claims, weaknesses, and complaints"
    )
    competitor_gaps: List[str] = Field(
        default_factory=list,
        description="What competitors are NOT doing that creates opportunity (e.g., 'No one leads with transparency')"
    )
    our_advantages: List[str] = Field(
        default_factory=list,
        description="Our specific advantages vs. competitors (e.g., 'Full dose transparency', 'Third-party lab COA')"
    )
    positioning_statement: Optional[str] = Field(
        None,
        description="Clear positioning statement vs. competitors (e.g., 'Unlike [X] who hide doses behind proprietary blends, we show you exactly what's inside')"
    )


# New models for Section 8: Objections
class ObjectionSeverity(str, Enum):
    """Severity level of an objection."""
    HIGH = "high"       # Red - critical objection that kills sales
    MEDIUM = "medium"   # Yellow - significant concern that needs addressing
    LOW = "low"         # Green - minor concern, easily overcome


class ObjectionItem(BaseModel):
    """A single objection with severity and response strategy."""
    objection: str = Field(..., description="The objection as the prospect would phrase it")
    severity: ObjectionSeverity = Field(..., description="How critical this objection is (high/medium/low)")
    response: str = Field(..., description="How to counter this objection")


class ObjectionsSection(BaseModel):
    """Section 8: Objections handling."""
    objections: List[ObjectionItem] = Field(
        default_factory=list,
        description="List of objections with severity ratings and responses"
    )
    hidden_objection: Optional[str] = Field(
        None,
        description="The objection they won't say out loud (e.g., 'What if I waste money AGAIN on something that doesn't work?')"
    )
    hidden_objection_counter: Optional[str] = Field(
        None,
        description="How to counter the hidden objection (e.g., '90-day money-back guarantee + verifiable proof BEFORE buying')"
    )


# New models for Section 9: Research & Inspiration
class RawQuoteWithSource(BaseModel):
    """A raw quote from research with its source."""
    quote: str = Field(..., description="The exact quote from research")
    source: str = Field(..., description="Where this quote came from (e.g., 'Reddit r/Supplements', 'Amazon Review', 'Facebook Group')")


class RawQuotesSection(BaseModel):
    """Raw quotes organized by type."""
    pain_quotes: List[RawQuoteWithSource] = Field(default_factory=list, description="Quotes expressing pain")
    desire_quotes: List[RawQuoteWithSource] = Field(default_factory=list, description="Quotes expressing desire")
    objection_quotes: List[RawQuoteWithSource] = Field(default_factory=list, description="Quotes expressing skepticism/objections")


class ResearchInspiration(BaseModel):
    """Section 9: Research sources and creative inspiration."""
    raw_quotes: Optional[RawQuotesSection] = Field(None, description="Raw quotes from research organized by type")
    research_sources: List[str] = Field(
        default_factory=list,
        description="Sources used for research (e.g., 'Reddit', 'Amazon Reviews', 'Facebook Groups', 'YouTube', 'Google PAA')"
    )
    inspiration_swipes: List[SwipeExample] = Field(
        default_factory=list,
        description="Brands/campaigns to model (e.g., 'Athletic Greens — transparency positioning')"
    )


# Market Snapshot for Section 1
class MarketSnapshot(BaseModel):
    """Section 1: Market Snapshot - always visible summary."""
    sophistication: Optional[StageOfSophistication] = Field(None, description="Market sophistication level with rationale")
    awareness: Optional[AwarenessLevel] = Field(None, description="Prospect's awareness level")
    awareness_description: Optional[str] = Field(None, description="Brief description of awareness state (e.g., 'Know solutions exist, seeking')", max_length=20)
    consciousness: Optional[ConsciousnessLevel] = Field(None, description="Prospect's consciousness/readiness level")
    consciousness_description: Optional[str] = Field(None, description="Brief description of consciousness state (e.g., 'Actively searching')", max_length=20)
    market_temperature: Optional[MarketTemperature] = Field(None, description="Market temperature (cold/warm/hot/skeptical/saturated)")
    market_temperature_description: Optional[str] = Field(
        None, 
        description="Explanation of market temperature (e.g., 'Warm — Interested but needs trust signals before buying')",
        max_length=75
    )


# Big Idea Section for Section 2
class BigIdeaSection(BaseModel):
    """Section 2: The Big Idea and mechanisms."""
    big_idea: Optional[str] = Field(
        None,
        description="Single, transformative central idea that unifies the campaign"
    )
    problem_mechanism_ump: Optional[str] = Field(
        None,
        description="Unique Mechanism of the Problem: Why nothing has worked (counterintuitive reason the problem persists)"
    )
    solution_mechanism_ums: Optional[str] = Field(
        None,
        description="Unique Mechanism of the Solution: Why THIS works (how this solution uniquely solves the problem)"
    )
    metaphors: List[str] = Field(
        default_factory=list,
        description="Images/analogies to make the big idea and mechanism vivid"
    )
    guru: Optional[str] = Field(
        None,
        description="Authority or spokesperson (real or archetype) associated with the offer"
    )
    discovery_story: Optional[str] = Field(
        None,
        description="Origin narrative: aha moment, failed attempts, breakthrough mechanism"
    )


class OfferBrief(BaseModel):
    """
    Structured brief to guide AI when generating copy, concepts, and funnel assets.
    Updated to include all fields from the UI screenshots.
    Fill as many fields as possible; lists can contain multiple options to explore.
    """
    # Section 1: Market Snapshot
    market_snapshot: Optional[MarketSnapshot] = Field(
        None, 
        description="Section 1: Market Snapshot - sophistication, awareness, consciousness, temperature"
    )
    
    # Section 2: The Big Idea
    big_idea_section: Optional[BigIdeaSection] = Field(
        None,
        description="Section 2: The Big Idea - central idea, mechanisms, metaphors, guru, discovery story"
    )
    
    # Section 3: Product Details
    product: Optional[ProductInfo] = Field(
        None, 
        description="Section 3: Product Details - name, format, price, guarantee, differentiator, compliance"
    )
    
    # Section 4: Pain & Desire
    pain_desire: Optional[PainDesireSection] = Field(
        None,
        description="Section 4: Pain & Desire clusters and dominant emotion"
    )
    
    # Section 5: Failed Solutions
    failed_solutions: Optional[FailedSolutionsSection] = Field(
        None,
        description="Section 5: Failed Solutions analysis"
    )
    
    # Section 6: Competitor Landscape
    competitor_landscape: Optional[CompetitorLandscape] = Field(
        None,
        description="Section 6: Competitor analysis and positioning"
    )
    
    # Section 7: Belief Architecture
    belief_architecture: Optional[BeliefArchitecture] = Field(
        None,
        description="Section 7: Belief chain and complete argument"
    )
    
    # Section 8: Objections
    objections_section: Optional[ObjectionsSection] = Field(
        None,
        description="Section 8: Objections with severity, responses, and hidden objection"
    )
    
    # Section 9: Research & Inspiration
    research_inspiration: Optional[ResearchInspiration] = Field(
        None,
        description="Section 9: Raw quotes, research sources, and inspiration swipes"
    )
    
    # Legacy fields (kept for backward compatibility)
    potential_product_names: List[str] = Field(
        default_factory=list,
        description="Brainstormed product/offer name options."
    )
    level_of_consciousness: Optional[ConsciousnessLevel] = Field(
        None, description="Prospect's general self-awareness/readiness to change. Explain in 2-3 sentences."
    )
    level_of_awareness: Optional[AwarenessLevel] = Field(
        None, description="Prospect's current awareness of problem/solution/product. Explain in 2-3 sentences."
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


# =============================================================================
# CACHE DATA MODELS
# =============================================================================

class CachedResearchData(BaseModel):
    """
    Cached output from Steps 1-3 (page analysis through deep research).
    
    Used to skip expensive Perplexity API calls when the same sales page URL
    has been processed before 
    """
    sales_page_url: str = Field(
        ..., 
        description="The original sales page URL that was analyzed"
    )
    research_page_analysis: str = Field(
        ..., 
        description="Output from Step 1: GPT-5 Vision analysis of the sales page"
    )
    deep_research_prompt: str = Field(
        ..., 
        description="Output from Step 2: The prompt generated for deep research"
    )
    deep_research_output: str = Field(
        ..., 
        description="Output from Step 3: The comprehensive research from Perplexity"
    )
    cached_at: str = Field(
        ..., 
        description="ISO timestamp when this cache entry was created"
    )
    cache_version: str = Field(
        default="1.0", 
        description="Version identifier for cache schema, used for invalidation"
    )