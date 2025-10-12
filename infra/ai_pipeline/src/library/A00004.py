from typing import Optional
from pydantic import BaseModel, Field, PositiveInt, ConfigDict


# ──────────────────────────────────────────────────────────────────────────────
# Leaf models (small, reusable parts)
# ──────────────────────────────────────────────────────────────────────────────

class Author(BaseModel):
    """Author block shown under the hero headline (photo is fixed in HTML)."""
    name: str = Field(
        ...,
        description="Display name of the article author. Pure text; no HTML."
    )


class SectionTitleOnly(BaseModel):
    """A simple section that only needs a visible H3 title."""
    title: str = Field(
        ...,
        description="H3 section heading as rendered in the article body."
    )


class ReviewItem(BaseModel):
    """One customer review block used in the left-column review list."""
    name: str = Field(..., description="Reviewer’s display name.")
    quote: str = Field(
        ...,
        description="The testimonial text as it appears below the name."
    )
    likes: PositiveInt = Field(
        ...,
        description="Numeric like count shown with the thumbs-up icon (e.g., 128)."
    )


class SidebarMiniReview(BaseModel):
    """Small testimonial unit in the right sidebar above the product card."""
    quote: str = Field(..., description="Short italicized review text.")
    name: str = Field(..., description="Reviewer’s name shown in bold.")
    location: str = Field(
        ...,
        description="Reviewer’s location (e.g., 'Austin, TX')."
    )


class FooterLinks(BaseModel):
    """Visible labels for footer navigation links (HREFs remain fixed in the HTML)."""
    terms: str = Field(..., description="Link label for Terms page.")
    privacy: str = Field(..., description="Link label for Privacy page.")
    cookie: str = Field(..., description="Link label for Cookie/Privacy page (second link).")
    contact: str = Field(..., description="Link label for Contact page.")


# ──────────────────────────────────────────────────────────────────────────────
# Meta / Head
# ──────────────────────────────────────────────────────────────────────────────

class Meta(BaseModel):
    """
    Metadata used in <title> and social cards.
    Does not change asset URLs; only textual fields are replaceable.
    """
    title: str = Field(..., description="<title> content shown in browser tab and SERPs.")
    og_title: str = Field(..., description="OpenGraph Title for rich link previews.")
    og_description: str = Field(..., description="OpenGraph Description for rich link previews.")
    twitter_title: str = Field(..., description="Twitter card title.")
    twitter_description: str = Field(..., description="Twitter card description.")
    label: str = Field(
        ...,
        description="Small label above the headline (e.g., 'Advertorial')."
    )


# ──────────────────────────────────────────────────────────────────────────────
# Hero / Intro
# ──────────────────────────────────────────────────────────────────────────────

class Intro(BaseModel):
    """The four opening paragraphs directly under the hero image."""
    p1: str = Field(..., description="Intro paragraph #1.")
    p2: str = Field(..., description="Intro paragraph #2.")
    p3: str = Field(..., description="Intro paragraph #3.")
    p4: str = Field(..., description="Intro paragraph #4.")


# ──────────────────────────────────────────────────────────────────────────────
# Mid-article sections
# ──────────────────────────────────────────────────────────────────────────────

class Section1(BaseModel):
    """First body section: one H3 + body copy + one italicized pull-quote."""
    title: str = Field(..., description="H3 section title.")
    p1: str = Field(..., description="Paragraph 1.")
    p2: str = Field(..., description="Paragraph 2.")
    quote1: str = Field(..., description="Italicized pull-quote.")
    p3: str = Field(..., description="Paragraph 3.")


class Section2(BaseModel):
    """Second body section with a bold lead and multiple paragraphs."""
    lead: str = Field(..., description="Bold lead-in sentence shown at the start of the section.")
    p1: str = Field(..., description="Paragraph 1.")
    p2: str = Field(..., description="Paragraph 2.")
    p3: str = Field(..., description="Paragraph 3.")
    p4: str = Field(..., description="Paragraph 4.")
    p5: str = Field(..., description="Paragraph 5.")
    p6: str = Field(..., description="Paragraph 6.")
    p7: str = Field(..., description="Paragraph 7.")


class Section2B(BaseModel):
    """Follow-up sub-section after Section 2, with another image in between."""
    title: str = Field(..., description="H3 sub-section title.")
    p1: str = Field(..., description="Paragraph 1.")
    p2: str = Field(..., description="Paragraph 2.")
    p3: str = Field(..., description="Paragraph 3 (follows an image).")
    p4: str = Field(..., description="Paragraph 4.")


class Section3(BaseModel):
    """
    Section with a two-column image + text row.
    The first paragraph is split into prefix / link label / suffix to preserve the inline CTA link.
    """
    title: str = Field(..., description="H3 section title.")
    p1_prefix: str = Field(
        ...,
        description="Text immediately before the inline CTA link."
    )
    link_label: str = Field(
        ...,
        description="Visible text of the inline CTA link (HREF is fixed in HTML)."
    )
    p1_suffix: str = Field(
        ...,
        description="Text immediately after the inline CTA link."
    )
    p2: str = Field(..., description="Paragraph 2.")
    p3: str = Field(..., description="Paragraph 3.")
    p4: str = Field(..., description="Paragraph 4.")
    p5: str = Field(..., description="Paragraph 5.")
    p6: str = Field(..., description="Paragraph 6.")
    p7: str = Field(..., description="Paragraph 7.")


class Section4(BaseModel):
    """Section with interleaved images and paragraphs."""
    title: str = Field(..., description="H3 section title.")
    p1: str = Field(..., description="Paragraph 1 (after first image).")
    p2: str = Field(..., description="Paragraph 2.")
    p3: str = Field(..., description="Paragraph 3.")
    p4: str = Field(..., description="Paragraph 4 (after second image).")
    p5: str = Field(..., description="Paragraph 5.")


class Section5(BaseModel):
    """Section that ends with a text link back to the product (HREF fixed)."""
    title: str = Field(..., description="H3 section title.")
    p1: str = Field(..., description="Paragraph 1.")
    p2: str = Field(..., description="Paragraph 2.")
    p3: str = Field(..., description="Paragraph 3.")
    p4: str = Field(..., description="Paragraph 4.")
    link_label: str = Field(
        ...,
        description="Visible text for the inline product link."
    )
    p5: str = Field(..., description="Paragraph 5 (after link).")


class Section6(BaseModel):
    """Short concluding block after the yellow box."""
    p1: str = Field(..., description="Bold opening sentence.")
    p2: str = Field(..., description="Paragraph 2.")
    p3: str = Field(..., description="Paragraph 3.")


# ──────────────────────────────────────────────────────────────────────────────
# Calls-To-Action & Sales messaging
# ──────────────────────────────────────────────────────────────────────────────

class CTA(BaseModel):
    """Visible text for the two primary buttons (HREFs are fixed)."""
    primary: str = Field(
        ...,
        description="Main CTA button in the left column (e.g., 'Shop Now')."
    )
    discount: str = Field(
        ...,
        description="CTA button within the orange/discount section."
    )


class FlashSale(BaseModel):
    """Inline sentence with a highlighted span for urgency messaging."""
    prefix: str = Field(
        ...,
        description="Text before the highlighted span (e.g., 'Hurry—')."
    )
    highlight: str = Field(
        ...,
        description="The orange highlighted fragment (e.g., 'FLASH SALE: 50% OFF')."
    )
    suffix: str = Field(
        ...,
        description="Text immediately after the highlighted span."
    )


class Sticky(BaseModel):
    """Bottom sticky bar CTA on mobile/smaller viewports."""
    cta: str = Field(..., description="Main sticky CTA label (uppercase styling in CSS).")
    cta_sub: str = Field(
        ...,
        description="Smaller subtitle shown below the sticky CTA label."
    )


# ──────────────────────────────────────────────────────────────────────────────
# Reviews & callouts
# ──────────────────────────────────────────────────────────────────────────────

class Reviews(BaseModel):
    """Three stacked review cards in the main content area."""
    like_label: str = Field(
        ...,
        description="Small label before the like counter (e.g., 'Was this helpful?')."
    )
    r1: ReviewItem
    r2: ReviewItem
    r3: ReviewItem


# ──────────────────────────────────────────────────────────────────────────────
# Sidebar (right column)
# ──────────────────────────────────────────────────────────────────────────────

class Sidebar(BaseModel):
    """Right sidebar containing two mini-reviews and a product card."""
    title: str = Field(
        ...,
        description="Top header text for the sidebar reviews (e.g., 'Customer Reviews')."
    )
    r1: SidebarMiniReview
    r2: SidebarMiniReview
    product_title: str = Field(
        ...,
        description="H2 title in the product card (links to product page)."
    )
    product_tagline: str = Field(
        ...,
        description="Short descriptive sentence under the product card title."
    )
    cta: str = Field(
        ...,
        description="Button label in the sidebar product card."
    )


# ──────────────────────────────────────────────────────────────────────────────
# Footer
# ──────────────────────────────────────────────────────────────────────────────

class Footer(BaseModel):
    """
    Footer text and link labels (URLs are fixed in the HTML).
    Long-form disclaimers should be plain text without HTML tags.
    """
    links: FooterLinks
    copyright: str = Field(
        ...,
        description="Copyright/legal line(s). May include brand name and year."
    )
    notice_ad: str = Field(
        ...,
        description="Short advertising notice (e.g., 'This is an advertisement...')."
    )
    disclaimer: str = Field(
        ...,
        description="General disclaimer text shown in the footer."
    )
    marketing_disclosure: str = Field(
        ...,
        description="Marketing disclosure text (e.g., affiliate or sponsored content notes)."
    )
    advertising_disclosure: str = Field(
        ...,
        description="Advertising-specific disclosure text."
    )


# ──────────────────────────────────────────────────────────────────────────────
# Pulling it all together
# ──────────────────────────────────────────────────────────────────────────────

class Content(BaseModel):
    """
    Root content object; every field maps to a {{content.*}} placeholder
    in the HTML. Images, CSS, JS, and HREFs are fixed in the template.
    """
    meta: Meta
    author: Author
    intro: Intro

    section1: Section1
    section2: Section2
    section2b: Section2B
    section3: Section3
    section4: Section4
    section5: Section5
    section6: Section6

    cta: CTA
    flash_sale: FlashSale
    sticky: Sticky

    reviews: Reviews

    yellow_box: str = Field(
        ...,
        description="Content of the dashed yellow callout box appearing before Section 6."
    )
    orange_box: str = Field(
        ...,
        description="Content of the dashed orange promotional box near the end."
    )

    sidebar: Sidebar
    footer: Footer

    class Config:
        extra = "forbid"  # Disallow unknown fields to catch typos early.


# ──────────────────────────────────────────────────────────────────────────────
# OPTIONAL: Top-level container if you prefer a { 'content': ... } JSON shape
#           to match the placeholder root exactly.
# ──────────────────────────────────────────────────────────────────────────────

class Advertorial(BaseModel):
    """
    Optional wrapper if your renderer expects a top-level 'content' object:
    pass TemplateData(content=Content(...)) to your templating layer.
    """
    content: Content = Field(..., description="All copy fragments required by the advertorial template.")

    model_config = ConfigDict(extra='forbid')
