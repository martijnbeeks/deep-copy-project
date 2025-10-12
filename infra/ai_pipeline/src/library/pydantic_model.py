from typing import Optional
from pydantic import BaseModel, Field, constr, ConfigDict


PlainText = constr(strip_whitespace=True, min_length=1)


class Topbar(BaseModel):
    # {{content.topbar.label}}
    label: PlainText = Field(
        ...,
        description=(
            "Short text in the very top strip of the page (e.g., 'Trending in the US'). "
            "Keep it concise (3–6 words). Plain text only; no HTML tags."
        ),
        examples=["Trending in Europe", "Editor’s Pick"],
    )


class Alert(BaseModel):
    # {{content.alert.banner}}
    banner: PlainText = Field(
        ...,
        description=(
            "Urgency/update banner directly under the header (appears next to/after 'UPDATE:'). "
            "Use one brief sentence or phrase. Plain text only."
        ),
        examples=["Limited-time discount available today only."],
    )


class Breadcrumbs(BaseModel):
    # {{content.breadcrumbs}}
    text: PlainText = Field(
        ...,
        description=(
            "Breadcrumb-style line above the main headline (e.g., 'Home  ›  Wellness'). "
            "Use separators like '›' or '/'. Plain text only."
        ),
        examples=["Home › Science & Tech", "Lifestyle / Beauty"],
    )


class Hero(BaseModel):
    # {{content.hero.headline}}, {{content.hero.subheadline}}
    headline: PlainText = Field(
        ...,
        description=(
            "Primary page H1 (large hero title). Compelling but not too long. "
            "Aim for 6–14 words. Plain text only."
        ),
        examples=["Why This Red-Light Cap Is Selling Out"],
    )
    subheadline: Optional[PlainText] = Field(
        None,
        description=(
            "Single supporting line directly under the H1. Optional. "
            "Keep to one short sentence. Plain text only."
        ),
        examples=["A dermatologist-inspired approach you can use at home."],
    )


class Story(BaseModel):
    # {{content.story.intro}}
    intro: Optional[PlainText] = Field(
        None,
        description=(
            "Short intro paragraph immediately near the top/story area. "
            "1–2 sentences, plain text (no HTML)."
        ),
        examples=["I put this device to the test for 30 days—here’s what happened."],
    )


class SectionBlock(BaseModel):
    # {{content.sectionN.title}} and {{content.sectionN.body}}
    title: PlainText = Field(
        ...,
        description=(
            "Section heading as it appears in-article (H2/H3 style). "
            "Keep it punchy (3–10 words). Plain text only."
        ),
        examples=["What Makes It Different", "Key Benefits"],
    )
    body: Optional[PlainText] = Field(
        None,
        description=(
            "The main paragraph(s) for this section. The template expects plain text "
            "only (no lists or HTML). If you need bullets, write them as plain lines "
            "separated by periods or dashes."
        ),
        examples=["Clinically inspired LEDs target scalp health and hair density over time."],
    )


class CTAGroup(BaseModel):
    # {{content.cta.primary}}, {{content.cta.secondary}}
    primary: PlainText = Field(
        ...,
        description=(
            "Main call-to-action button label (e.g., 'Get 50% Off Now'). "
            "Keep to 2–6 words. Plain text only."
        ),
        examples=["Get 50% Off", "Shop Now"],
    )
    secondary: Optional[PlainText] = Field(
        None,
        description=(
            "Secondary CTA label where present (e.g., 'See How It Works'). Optional. "
            "2–5 words. Plain text only."
        ),
        examples=["Learn More", "See Details"],
    )


class Sidebar(BaseModel):
    # {{content.sidebar.ctaHeadline}}, {{content.sidebar.ctaButton}}
    ctaHeadline: Optional[PlainText] = Field(
        None,
        description=(
            "Right-column promo headline near the product card. "
            "Short, persuasive line. Plain text only."
        ),
        examples=["GET 50% OFF THE RED-LIGHT CAP TODAY"],
    )
    ctaButton: Optional[PlainText] = Field(
        None,
        description=(
            "Right-column button label. 2–5 words, action-forward. Plain text only."
        ),
        examples=["Claim Discount", "Buy Now"],
    )


class Sticky(BaseModel):
    # {{content.sticky.cta}}
    cta: Optional[PlainText] = Field(
        None,
        description=(
            "Floating/sticky CTA button label shown on scroll. "
            "2–4 words. Plain text only."
        ),
        examples=["Shop Now", "Get Offer"],
    )


class Assurances(BaseModel):
    # {{content.assurances.blurb}}
    blurb: Optional[PlainText] = Field(
        None,
        description=(
            "Short reassurance/guarantee blurb near trust indicators "
            "(e.g., warranty, returns). One short sentence. Plain text only."
        ),
        examples=["Backed by a 60-day money-back guarantee."],
    )


class Footer(BaseModel):
    # {{content.footer.disclaimer}}, {{content.footer.copyright}}
    disclaimer: Optional[PlainText] = Field(
        None,
        description=(
            "Legal/medical/advertorial disclaimer line in the footer. "
            "Plain text only; keep it to 1–2 sentences."
        ),
        examples=["This content is for informational purposes and not medical advice."],
    )
    copyright: Optional[PlainText] = Field(
        None,
        description=(
            "Copyright/ownership line at the very bottom. Plain text only."
        ),
        examples=["© 2025 BrandName. All rights reserved."],
    )


# === New: Reactions (Comments) ===
class ReactionReply(BaseModel):
    name: PlainText = Field(..., description="Display name of the reply author. Plain text only.")
    text: PlainText = Field(..., description="Reply text, one short paragraph. Plain text only.")
    likes: Optional[int] = Field(None, description="Number of likes for this reply.")
    time: Optional[PlainText] = Field(None, description="Relative timestamp label (e.g., '2 h', '51 min'). Plain text only.")

class Reaction(BaseModel):
    name: PlainText = Field(..., description="Display name of the commenter. Plain text only.")
    text: PlainText = Field(..., description="Comment text, one short paragraph. Plain text only.")
    likes: Optional[int] = Field(None, description="Number of likes for this comment.")
    time: Optional[PlainText] = Field(None, description="Relative timestamp label (e.g., '3 h'). Plain text only.")
    # Optional threaded replies commonly seen in the template
    reply1: Optional[ReactionReply] = None
    reply2: Optional[ReactionReply] = None

class Reactions(BaseModel):
    """Structured placeholders for the social-style comment block at the end of the page."""
    title: PlainText = Field(..., description="Section heading label for the reactions/comments block.")
    r1: Optional[Reaction] = None
    r2: Optional[Reaction] = None
    r3: Optional[Reaction] = None
    r4: Optional[Reaction] = None
    r5: Optional[Reaction] = None
    r6: Optional[Reaction] = None
    r7: Optional[Reaction] = None
    r8: Optional[Reaction] = None
    r9: Optional[Reaction] = None
    r10: Optional[Reaction] = None
    r11: Optional[Reaction] = None
    r12: Optional[Reaction] = None

class Content(BaseModel):
    """
    Data model that maps 1:1 to the HTML placeholders in your advertorial template.
    IMPORTANT:
    - All fields are plain text (NO HTML tags).
    - Do not include quotes beyond normal punctuation; the template injects text directly.
    - Image sources, scripts, and links are NOT provided here and remain hard-coded
      in the template to guarantee pixel-identical rendering.
    """
    topbar: Topbar
    alert: Alert
    breadcrumbs: Breadcrumbs
    hero: Hero
    story: Optional[Story] = None

    # Sections are explicitly named to match placeholders exactly:
    section1: SectionBlock
    section2: SectionBlock
    section3: SectionBlock
    section4: SectionBlock
    section5: SectionBlock
    section6: SectionBlock
    section7: SectionBlock
    section8: SectionBlock
    section9: SectionBlock
    section10: SectionBlock
    section11: SectionBlock
    section12: SectionBlock

    assurances: Optional[Assurances] = None
    cta: CTAGroup
    sidebar: Optional[Sidebar] = None
    sticky: Optional[Sticky] = None
    reactions: Optional[Reactions] = None
    footer: Optional[Footer] = None

class Advertorial(BaseModel):
    """Root model that mirrors the JSON document structure exactly."""
    content: Content = Field(..., description="All copy fragments required by the advertorial template.")

    model_config = ConfigDict(extra='forbid')