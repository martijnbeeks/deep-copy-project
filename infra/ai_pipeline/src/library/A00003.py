from __future__ import annotations

from typing import List, Optional
from datetime import date
from pydantic import BaseModel, Field, conint, confloat, ConfigDict


# ───────────────────────────────────────────────────────────────────────────────
# Primitive, reusable blocks
# ───────────────────────────────────────────────────────────────────────────────

class Byline(BaseModel):
    """Line under/near the hero that identifies the author and when the piece was published."""
    author_name: str = Field(
        ...,
        description="Display name exactly as you want it to appear (e.g., 'Dr. Jane Smith')."
    )
    author_credentials: Optional[str] = Field(
        None,
        description="Short credentials that may follow the name (e.g., 'DPM, Foot & Ankle Specialist'). "
                    "Include punctuation as you want it rendered."
    )
    location: Optional[str] = Field(
        None,
        description="Optional location tag after the byline (e.g., 'Austin, TX'). Leave empty if not shown."
    )
    publish_date: Optional[date] = Field(
        None,
        description="Publication date. If your template renders a 'today' or relative date, "
                    "you can leave this empty or still supply the canonical date here."
    )

class BulletList(BaseModel):
    """A bullet list (e.g., objections, benefits)."""
    title: Optional[str] = Field(
        None,
        description="Optional lead-in heading placed just above the bullets."
    )
    items: List[str] = Field(
        default_factory=list,
        description="Each entry is a single bullet point. Do not include bullet symbols; the template handles them."
    )

class TextBlock(BaseModel):
    """A freeform paragraph or short block of copy."""
    text: str = Field(
        ...,
        description="Single paragraph of body copy. For multiple paragraphs, use multiple TextBlocks."
    )

class PullQuote(BaseModel):
    """Callout text shown in larger type to emphasize a key takeaway."""
    quote: str = Field(..., description="The highlighted one-liner or short statement.")
    attribution: Optional[str] = Field(
        None,
        description="Who said the quote (e.g., a customer name or 'Board-Certified Podiatrist')."
    )

class CTA(BaseModel):
    """Primary call-to-action area."""
    headline: str = Field(
        ...,
        description="Large CTA headline (e.g., 'GET 50% OFF'). Keep line breaks out unless your template expects them."
    )
    subheadline: Optional[str] = Field(
        None,
        description="Smaller supporting line directly under the CTA headline (e.g., product name or time-limited note)."
    )
    button_label: str = Field(
        ...,
        description="Exact text inside the main CTA button (e.g., 'Claim My Discount')."
    )
    legal_disclaimer: Optional[str] = Field(
        None,
        description="Tiny legal or stock disclaimer shown near the CTA (optional)."
    )

class Review(BaseModel):
    """One user review/testimonial card."""
    reviewer_name: str = Field(..., description="Display name for the reviewer.")
    title: Optional[str] = Field(None, description="Short review title or headline.")
    body: str = Field(..., description="The testimonial text itself.")
    rating_stars: conint(ge=1, le=5) = Field(
        5,
        description="Star rating from 1 to 5. The template draws the stars; you provide the numeric value."
    )
    verified_purchase: bool = Field(
        True,
        description="Whether to show a 'Verified Purchase' badge."
    )
    review_date: Optional[date] = Field(
        None,
        description="The date associated with the review card (optional)."
    )
    helpful_count: Optional[conint(ge=0)] = Field(
        None,
        description="If the template shows 'X people found this helpful', provide the integer; else leave empty."
    )

class SocialProof(BaseModel):
    """Aggregate rating and logos/badges area."""
    as_seen_on_text: Optional[str] = Field(
        None,
        description="Short line above badges (e.g., 'As seen on'). Leave empty if not rendered."
    )
    aggregate_rating: Optional[confloat(ge=0, le=5)] = Field(
        None,
        description="Average rating (e.g., 4.8). Only supply if your template shows it."
    )
    rating_count_label: Optional[str] = Field(
        None,
        description="Companion label (e.g., '3,412+ reviews'). Supply exactly as displayed, including '+' or commas."
    )
    reviews: List[Review] = Field(
        default_factory=list,
        description="List of testimonial cards. Order matters and mirrors rendering order."
    )

class AvailabilityPricing(BaseModel):
    """Scarcity, exclusivity, and price anchoring statements."""
    stock_warning: Optional[str] = Field(
        None,
        description="Urgency line (e.g., 'Likely to sell out by tomorrow')."
    )
    exclusivity_note: Optional[str] = Field(
        None,
        description="Where it’s available (e.g., 'Only on our official website')."
    )
    price_anchors: List[str] = Field(
        default_factory=list,
        description="Lines that contrast alternatives (e.g., 'Surgery can cost $5,000', 'Custom orthotics $400+'). "
                    "One anchor per list item; the template handles bullets/separators."
    )
    discount_block: Optional[str] = Field(
        None,
        description="Short paragraph that frames the current discount (e.g., 'Today you can get it for 50% off')."
    )
    guarantee_text: Optional[str] = Field(
        None,
        description="Any satisfaction/return guarantee copy."
    )

class Section(BaseModel):
    """A titled content chapter consisting of text, bullets, and optional callouts."""
    title: Optional[str] = Field(
        None,
        description="Section headline (e.g., 'The Shocking Root Cause of Bunion Pain'). Empty for text-only sections."
    )
    paragraphs: List[TextBlock] = Field(
        default_factory=list,
        description="Sequential paragraphs in this section. Avoid embedded HTML; the template provides markup."
    )
    bullets: Optional[BulletList] = Field(
        None,
        description="Optional bullet list that sits within this section."
    )
    pull_quote: Optional[PullQuote] = Field(
        None,
        description="Optional emphasized quote block that appears in this section."
    )
    microcopy: Optional[str] = Field(
        None,
        description="Tiny helper text (e.g., caption under an illustration) if the template shows it next to text."
    )

class FooterCopy(BaseModel):
    """Legal and boilerplate text near the bottom of the page."""
    disclaimers: List[str] = Field(
        default_factory=list,
        description="Each item renders as its own disclaimer line/sentence."
    )
    copyright_line: Optional[str] = Field(
        None,
        description="Footer copyright or ownership line exactly as it should appear."
    )


# ───────────────────────────────────────────────────────────────────────────────
# Page-level content schema (maps to {{content.*}} placeholders)
# ───────────────────────────────────────────────────────────────────────────────

class TopBar(BaseModel):
    """Labels that appear at the very top (thin bar + ribbon)."""
    advertorial_label: Optional[str] = Field(
        None,
        description="Small label usually in the top bar (e.g., 'Advertorial')."
    )
    update_notice: Optional[str] = Field(
        None,
        description="Red 'UPDATE:' line or equivalent urgent top-strip message."
    )

class Hero(BaseModel):
    """Primary masthead area at the top of the page."""
    pretitle: Optional[str] = Field(
        None,
        description="Small line above the headline (e.g., category or kicker)."
    )
    headline: str = Field(
        ...,
        description="Main hero headline in large type. Keep it concise for the layout’s line-length."
    )
    dek: Optional[str] = Field(
        None,
        description="Short supporting sentence under the headline."
    )
    byline: Optional[Byline] = Field(
        None,
        description="Author/date strip beneath the hero (if present in your layout)."
    )

class CTAGroup(BaseModel):
    """The page can surface multiple CTA blocks (e.g., a hero CTA and a closing CTA)."""
    primary: CTA = Field(
        ...,
        description="Main CTA block that appears first (often near the top or after initial pitch)."
    )
    secondary: Optional[CTA] = Field(
        None,
        description="Optional secondary CTA placed later in the page (e.g., final reminder)."
    )

class AdvertorialContent(BaseModel):
    """
    Text knobs for the advertorial. 
    All images, CSS, and JS remain in the template; provide ONLY the text you want to render.
    """
    top: Optional[TopBar] = Field(
        None,
        description="Topmost small labels/banners including 'Advertorial' and any 'UPDATE' message."
    )
    breadcrumbs: Optional[List[str]] = Field(
        None,
        description="Linear path like ['Home', 'Bunion Pain', 'Bunion Fix']. Elements render with separators."
    )
    hero: Hero = Field(
        ...,
        description="Hero headline block and optional byline content."
    )
    sections: List[Section] = Field(
        default_factory=list,
        description="Ordered content chapters that make up the narrative. Include body paragraphs, bullets, and pull quotes."
    )
    proof: Optional[SocialProof] = Field(
        None,
        description="Badges, aggregate rating, and testimonials/reviews."
    )
    availability_pricing: Optional[AvailabilityPricing] = Field(
        None,
        description="Scarcity statements, exclusivity note, price anchors, discounts, and guarantees."
    )
    cta: CTAGroup = Field(
        ...,
        description="Primary (and optional secondary) call-to-action blocks."
    )
    footer: Optional[FooterCopy] = Field(
        None,
        description="Legal and boilerplate lines at the very bottom."
    )

class Advertorial(BaseModel):
    """Root model that mirrors the JSON document structure exactly."""
    content: AdvertorialContent = Field(..., description="All copy fragments required by the advertorial template.")

    model_config = ConfigDict(extra='forbid')