from typing import List, Optional
from pydantic import BaseModel, Field, conlist

# ---- Primitive building blocks ------------------------------------------------

RichText = conlist(
    str,
    min_items=1,
    description=(
        "Ordered list of text fragments that replace sequential text nodes within the same "
        "HTML container. Use this when the original block contains multiple runs of text "
        "(e.g., mixed formatting, interleaved inline tags). The Nth item maps to {{...textN}}."
    ),
)

# ---- Top promo bars -----------------------------------------------------------

class TopPromo(BaseModel):
    left: Optional[RichText] = Field(
        default=None,
        description=(
            "Text for the left-side top promo bar. Populates {{content.top_promo.left.textN}}. "
            "Keep line-length similar to the original to avoid wrap changes."
        ),
    )
    bottom: Optional[RichText] = Field(
        default=None,
        description=(
            "Text for the bottom promo ribbon (if present). Populates "
            "{{content.top_promo.bottom.textN}}. Maintain short, promo-style phrasing."
        ),
    )

# ---- Hero --------------------------------------------------------------------

class Hero(BaseModel):
    headline: str = Field(
        ...,
        description=(
            "Primary H1 headline for the hero. Populates {{content.hero.headline}}. "
            "Keep it concise to preserve line breaks and layout."
        ),
    )
    subhead: Optional[RichText] = Field(
        default=None,
        description=(
            "Hero subheadline as rich text nodes. Populates {{content.hero.subhead.textN}}. "
            "Use multiple entries when the original subhead had multiple text nodes."
        ),
    )
    kicker: Optional[str] = Field(
        default=None,
        description=(
            "A short supporting line below/near the hero. Populates {{content.hero.kicker}}."
        ),
    )

# ---- Reasons list -------------------------------------------------------------

class ReasonBlock(BaseModel):
    text: RichText = Field(
        ...,
        description=(
            "The body copy for a single reason card. Populates {{content.reasons[i].textN}} "
            "for i starting at 1 in visual order. Keep paragraph lengths comparable to the original."
        ),
    )

# ---- Post-reasons content -----------------------------------------------------

class SectionAfter(BaseModel):
    headline1: Optional[str] = Field(
        default=None,
        description="First follow-up section headline. Populates {{content.section_after.headline1}}.",
    )
    headline2: Optional[str] = Field(
        default=None,
        description="Second follow-up section headline. Populates {{content.section_after.headline2}}.",
    )
    paragraphs: Optional[List[RichText]] = Field(
        default=None,
        description=(
            "Sequential paragraphs after the reasons. Each list item is one paragraph (as RichText). "
            "Maps to {{content.section_after.paragraph{j}.textN}} in order of appearance."
        ),
    )

# ---- Special offer box --------------------------------------------------------

class SpecialOffer(BaseModel):
    paragraphs: Optional[List[RichText]] = Field(
        default=None,
        description=(
            "Paragraphs in the special-offer/notice box. Each item maps to "
            "{{content.special_offer.paragraph{k}.textN}} preserving order."
        ),
    )

# ---- CTA cluster --------------------------------------------------------------

class CTA(BaseModel):
    primary_button: Optional[RichText] = Field(
        default=None,
        description=(
            "Visible text of the main CTA button. Populates {{content.cta.primary_button.textN}}. "
            "Keep short to avoid button wrapping."
        ),
    )
    note: Optional[RichText] = Field(
        default=None,
        description=(
            "Small note/footline near the main CTA area. Populates {{content.cta.note.textN}}."
        ),
    )

# ---- Press quotes slider ------------------------------------------------------

class Press(BaseModel):
    quotes: Optional[List[RichText]] = Field(
        default=None,
        description=(
            "List of press quote texts, in slider order. Each item maps to "
            "{{content.press.quote{q}.textN}}. Keep length similar to avoid slide height changes."
        ),
    )

# ---- Testimonials slider ------------------------------------------------------

class Testimonial(BaseModel):
    quote: RichText = Field(
        ...,
        description="The testimonial quote body. Maps to {{content.testimonials[i].quote.textN}}.",
    )
    name: Optional[RichText] = Field(
        default=None,
        description=(
            "Attribution line (name/metadata) beneath the quote. "
            "Maps to {{content.testimonials[i].name.textN}}."
        ),
    )

class Testimonials(BaseModel):
    items: Optional[List[Testimonial]] = Field(
        default=None,
        description=(
            "Testimonials in the same order as they appear in the slider. "
            "Preserves layout by keeping text lengths consistent."
        ),
    )

# ---- Floating CTA -------------------------------------------------------------

class FloatingCTA(BaseModel):
    message: Optional[RichText] = Field(
        default=None,
        description=(
            "Short sticky message near the floating CTA. Maps to {{content.floating_cta.message.textN}}."
        ),
    )
    button: Optional[RichText] = Field(
        default=None,
        description=(
            "Floating CTA button label. Maps to {{content.floating_cta.button.textN}}. "
            "Keep concise to prevent overflow."
        ),
    )

# ---- Contact modal ------------------------------------------------------------

class Contact(BaseModel):
    header: Optional[RichText] = Field(
        default=None,
        description="Modal header text. Maps to {{content.contact.header.textN}}.",
    )
    body: Optional[RichText] = Field(
        default=None,
        description="Modal body copy. Maps to {{content.contact.body.textN}}.",
    )
    close_label: Optional[RichText] = Field(
        default=None,
        description="Close button label. Maps to {{content.contact.close_label.textN}}.",
    )

# ---- Footer ------------------------------------------------------------------

class Footer(BaseModel):
    legal: Optional[RichText] = Field(
        default=None,
        description=(
            "Footer legal/rights notice. Maps to {{content.footer.legal.textN}}. "
            "Preserve any legal phrasing requirements."
        ),
    )

# ---- Root content -------------------------------------------------------------

class Content(BaseModel):
    """
    Schema mirroring the HTML placeholders under the `content` root.
    Only text is replaced at render-time; all CSS/JS/imgs remain untouched.
    """
    top_promo: Optional[TopPromo] = Field(
        default=None,
        description="Top promo bars: left label(s) and optional bottom ribbon text.",
    )
    hero: Hero = Field(
        ...,
        description="Hero area copy (headline, subhead, kicker).",
    )
    reasons: List[ReasonBlock] = Field(
        ...,
        min_items=1,
        description=(
            "Ordered list of reason blocks. The i-th entry maps to {{content.reasons[i].textN}} "
            "with i starting at 1 in the HTML and continue until 11."
        ),
    )
    section_after: Optional[SectionAfter] = Field(
        default=None,
        description="Headlines and paragraphs following the reasons list.",
    )
    special_offer: Optional[SpecialOffer] = Field(
        default=None,
        description="Special-offer/notice box paragraphs.",
    )
    cta: Optional[CTA] = Field(
        default=None,
        description="Main CTA area: button label and note.",
    )
    press: Optional[Press] = Field(
        default=None,
        description="Press quotes slider content.",
    )
    testimonials: Optional[Testimonials] = Field(
        default=None,
        description="Testimonials slider entries.",
    )
    floating_cta: Optional[FloatingCTA] = Field(
        default=None,
        description="Sticky/floating CTA message and button label.",
    )
    contact: Optional[Contact] = Field(
        default=None,
        description="Contact modal texts.",
    )
    footer: Optional[Footer] = Field(
        default=None,
        description="Footer legal text.",
    )

class PageData(BaseModel):
    """
    Top-level model. Serialize to JSON and feed directly into a renderer that resolves
    placeholders like {{content.hero.headline}} or {{content.reasons[1].text2}}.
    """
    content: Content = Field(
        ...,
        description="All user-supplied text that replaces placeholders in the HTML.",
    )
