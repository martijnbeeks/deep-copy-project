from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class Meta(BaseModel):
    """Content for <head> metadata (does not affect visible layout)."""
    title: str = Field(
        ...,
        description="The <title> of the page shown in the browser tab and search results. Keep it concise (~55–65 chars)."
    )
    description: str = Field(
        ...,
        description="Meta description used by search engines (~150–160 chars). Summarize the page’s promise/value."
    )


class Hero(BaseModel):
    """Top-of-page attention grabbers: big headline and the italic sub-quote."""
    headline: str = Field(
        ...,
        description="Primary H1 headline in the hero. Use a clear outcome/value statement."
    )
    quote: str = Field(
        ...,
        description="Short italicized line under the dynamic date. Can be a testimonial-style teaser or promise."
    )


class Guarantee(BaseModel):
    """Small gray strip with icon: communicates risk-reversal / satisfaction."""
    title: str = Field(
        ...,
        description="Bold label inside the guarantee strip (e.g., '30-DAY SATISFACTION GUARANTEE')."
    )
    copy: str = Field(
        ...,
        description="One-sentence explanation that expands on the guarantee. Only visible on larger screens."
    )


class Section1(BaseModel):
    """Intro section below the first product image."""
    h2: str = Field(
        ...,
        description="Section headline (H2) above the first explanatory paragraph."
    )
    p1: str = Field(
        ...,
        description="Lead paragraph introducing the story/problem/solution. Aim for 2–5 sentences."
    )


class Section2(BaseModel):
    """Two sub-blocks with images in between; explains the core mechanism/benefit."""
    h2a: str = Field(
        ...,
        description="First H2 after the second product image. Sets up the key benefit or mechanism."
    )
    p1: str = Field(
        ...,
        description="Paragraph supporting h2a. Keep it skimmable with short sentences."
    )
    h2b: str = Field(
        ...,
        description="Second H2 after the third image. Often introduces a complementary benefit or use case."
    )
    p2: str = Field(
        ...,
        description="Paragraph supporting h2b. Use social proof, data points, or a concrete example."
    )


class Section3(BaseModel):
    """Deep dive / proof section with two H2s and one image in between."""
    h2a: str = Field(
        ...,
        description="First H2 above the evidence/benefits paragraph."
    )
    p1: str = Field(
        ...,
        description="Paragraph that provides credibility: tests, ingredients, tech, expert notes."
    )
    h2b: str = Field(
        ...,
        description="Second H2 that pivots to another compelling angle (e.g., convenience, safety)."
    )
    p2: str = Field(
        ...,
        description="Paragraph supporting h2b with specifics the reader can visualize."
    )


class Section4(BaseModel):
    """‘How to use’ area with bullet-like steps followed by benefits/coverage."""
    h2: str = Field(
        ...,
        description="H2 introducing the usage instructions (e.g., 'How to Use...')."
    )
    intro: str = Field(
        ...,
        description="Short intro sentence before the steps (what to expect/setup tips)."
    )
    step1: str = Field(..., description="Step 1 instruction. Begin with an imperative verb.")
    step2: str = Field(..., description="Step 2 instruction.")
    step3: str = Field(..., description="Step 3 instruction.")
    step4: str = Field(..., description="Step 4 instruction (optional—leave concise).")
    benefit: str = Field(
        ...,
        description="One-sentence benefits wrap-up after the steps (e.g., speed, ease, cleanliness)."
    )
    worksOn: str = Field(
        ...,
        description="One sentence listing where/when it works best (surfaces, rooms, situations)."
    )


class Review(BaseModel):
    """A single short testimonial block used in Section 5."""
    text: str = Field(
        ...,
        description="The testimonial content. 1–3 sentences; authentic, specific outcome."
    )
    author: str = Field(
        ...,
        description="Attribution for the testimonial (name or initials). Avoid personal data beyond a first name/initial."
    )


class Section5(BaseModel):
    """Testimonials section with three boxed reviews."""
    h2: str = Field(
        ...,
        description="H2 that introduces social proof (e.g., 'What Customers Are Saying')."
    )
    intro: str = Field(
        ...,
        description="Brief lead-in sentence before the stacked reviews."
    )
    review1: Review = Field(..., description="Top testimonial box.")
    review2: Review = Field(..., description="Middle testimonial box.")
    review3: Review = Field(..., description="Bottom testimonial box.")


class ComparisonRow(BaseModel):
    """One row in the left/right comparison grid."""
    left: str = Field(
        ...,
        description="Copy for the left cell describing your product’s attribute/result."
    )
    right: str = Field(
        ...,
        description="Copy for the right cell describing the alternative/competitor status quo."
    )


class ComparisonGrid(BaseModel):
    """Comparison grid beneath 'Why We Love...' area."""
    altHeader: str = Field(
        ...,
        description="Bold sub-header placed in the grid header row (right side), e.g., 'THE ALTERNATIVE'."
    )
    row1: ComparisonRow = Field(..., description="First comparison row.")
    row2: ComparisonRow = Field(..., description="Second comparison row.")
    # Row 3 includes a small footnote (‘when used…’) appended below the left cell.
    row3_left: str = Field(
        ...,
        description="Row 3 left cell text (your product)."
    )
    row3_right: str = Field(
        ...,
        description="Row 3 right cell text (alternative)."
    )
    row3_note: str = Field(
        ...,
        description="Short note rendered under row 3 left cell (e.g., 'when used as directed')."
    )
    row4: ComparisonRow = Field(..., description="Fourth comparison row.")


class Section6(BaseModel):
    """‘Why we love it’ + comparison grid + explanatory paragraphs + bottom line."""
    h2: str = Field(
        ...,
        description="Bold H2 headline for the reasons/advantages section."
    )
    grid: ComparisonGrid = Field(
        ...,
        description="Structured left/right benefit comparison table."
    )
    p1: str = Field(..., description="Paragraph after the grid (reason 1 or synthesis).")
    p2: str = Field(..., description="Paragraph (reason 2 or differentiator).")
    p3: str = Field(..., description="Paragraph (reason 3 or practical detail).")
    p4: str = Field(..., description="Paragraph (reason 4 or extra proof).")
    bottomLineLead: str = Field(
        ...,
        description="Bold ‘Bottom line’ lead-in phrase (e.g., 'Bottom line:' or a punchy summary)."
    )
    bottomLineTail: str = Field(
        ...,
        description="Sentence fragment that continues the bottom line statement."
    )


class Section7(BaseModel):
    """Final CTA block with ‘internet only’ image, quick steps, offer, and button text."""
    h2: str = Field(
        ...,
        description="H2 headline above the closing pitch (e.g., 'How to Get Yours')."
    )
    p1: str = Field(
        ...,
        description="Left-aligned short paragraph that sets urgency or availability."
    )
    p2: str = Field(
        ...,
        description="Follow-up paragraph reinforcing the offer or next steps."
    )
    step1: str = Field(
        ...,
        description="First short step in the unordered list (e.g., 'Choose your bundle')."
    )
    step2: str = Field(
        ...,
        description="Second short step in the unordered list (e.g., 'Confirm shipping')."
    )
    offerLead: str = Field(
        ...,
        description="Sentence leading into the clickable CTA text (e.g., 'Tap here to claim...')."
    )
    offerCta: str = Field(
        ...,
        description="The emphasized, clickable CTA text inside the sentence (linked via .btn-link)."
    )
    button: str = Field(
        ...,
        description="Standalone primary button label (e.g., 'Check Current Availability »')."
    )


class Citations(BaseModel):
    """Optional references callout at the very end."""
    title: str = Field(
        ...,
        description="Small italic/bold label starting the citations area (e.g., 'CITATIONS')."
    )
    link1: str = Field(
        ...,
        description="Single line of citation text or a reference label. Keep neutral and factual."
    )


class Sidebar(BaseModel):
    """Right column card with image and CTA button."""
    title: str = Field(
        ...,
        description="Short product/supporting title above the sidebar image."
    )
    button: str = Field(
        ...,
        description="Sidebar primary button text (mirrors the main CTA tone)."
    )


class Footer(BaseModel):
    """Footer link labels and copyright line fragments (year is auto-inserted by JS)."""
    privacy: str = Field(
        ...,
        description="Visible label for the Privacy Policy link."
    )
    terms: str = Field(
        ...,
        description="Visible label for the Terms of Service link."
    )
    returns: str = Field(
        ...,
        description="Visible label for the Refund/Returns Policy link."
    )
    copyrightPrefix: str = Field(
        ...,
        description="Text shown before the dynamically inserted year (e.g., '© '). Include trailing space if desired."
    )
    copyrightSuffix: str = Field(
        ...,
        description="Text shown after the dynamically inserted year (e.g., ' YourBrand. All rights reserved.')."
    )


class Content(BaseModel):
    """
    Master content payload that maps 1:1 with HTML placeholders like {{content.hero.headline}}.
    Populate this model and render directly into the template without changing placeholder keys.
    """
    meta: Meta = Field(..., description="SEO meta fields used in <head>.")
    hero: Hero = Field(..., description="H1 and supporting italic line under the date.")
    guarantee: Guarantee = Field(..., description="Small satisfaction guarantee strip under the hero.")
    section1: Section1 = Field(..., description="Intro copy under the first large image.")
    section2: Section2 = Field(..., description="Middle narrative with two H2s and images.")
    section3: Section3 = Field(..., description="Deep-dive proof/benefits area with two H2s.")
    section4: Section4 = Field(..., description="How-to steps and quick benefits.")
    section5: Section5 = Field(..., description="Testimonials/social proof (three compact reviews).")
    section6: Section6 = Field(..., description="Why-we-love-it reasons + comparison grid + bottom line.")
    section7: Section7 = Field(..., description="Final CTA section with short steps and closing button.")
    citations: Citations = Field(..., description="Optional compact citations area.")
    sidebar: Sidebar = Field(..., description="Right column product card content.")
    footer: Footer = Field(..., description="Footer link labels and copyright line fragments.")


class Advertorial(BaseModel):
    """Root model that mirrors the JSON document structure exactly."""
    content: Content = Field(..., description="All copy fragments required by the advertorial template.")

    model_config = ConfigDict(extra='forbid')