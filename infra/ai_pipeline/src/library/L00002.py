from typing import List, Annotated
from pydantic import BaseModel, Field


# ---------------------------
#  META TAGS (HEAD)
# ---------------------------
class Meta(BaseModel):
    title: str = Field(
        ...,
        description=(
            "Document <title>. Appears in the browser tab and search results. "
            "Maps to {{meta.title}}."
        ),
    )
    description: str = Field(
        ...,
        description=(
            "Meta description for SEO (<meta name='description'>). "
            "Short summary (150–160 chars recommended). Maps to {{meta.description}}."
        ),
    )
    og_title: str = Field(
        ...,
        description=(
            "Open Graph title for link previews on social platforms. "
            "Maps to {{meta.og_title}}."
        ),
    )
    og_description: str = Field(
        ...,
        description=(
            "Open Graph description for rich link previews. "
            "Maps to {{meta.og_description}}."
        ),
    )
    twitter_title: str = Field(
        ...,
        description=(
            "Twitter Card title for link previews. "
            "Maps to {{meta.twitter_title}}."
        ),
    )
    twitter_description: str = Field(
        ...,
        description=(
            "Twitter Card description for link previews. "
            "Maps to {{meta.twitter_description}}."
        ),
    )


# ---------------------------
#  TOP-OF-PAGE / HERO
# ---------------------------
class Hero(BaseModel):
    headline: str = Field(
        ...,
        description=(
            "Main page headline (H1). Visually the largest title in the hero. "
            "Maps to {{content.hero.headline}}."
        ),
    )


# ---------------------------
#  ARTICLE META (BYLINE, ETC.)
# ---------------------------
class ArticleMeta(BaseModel):
    author: str = Field(
        ...,
        description=(
            "Author name shown near the top of the article. "
            "Maps to {{content.meta.author}}."
        ),
    )


# ---------------------------
#  SUMMARY (UNDER THE HERO)
# ---------------------------
class Summary(BaseModel):
    text: str = Field(
        ...,
        description=(
            "Short summary paragraph shown under the 'Summary:' label. "
            "Only the free-form text after the label is replaced. "
            "Maps to {{content.summary}}."
        ),
    )


# ---------------------------
#  LISTICLE ITEMS (REPEATED BLOCKS)
# ---------------------------
class Item(BaseModel):
    title: str = Field(
        ...,
        description=(
            "Section title (H2) for a single reason/item in the listicle. "
            "Maps to {{content.items.[i].title}}."
        ),
    )
    body: str = Field(
        ...,
        description=(
            "Body copy paragraph for the item. Line breaks in your text are allowed; "
            "the template preserves <br/> spacing. "
            "Maps to {{content.items.[i].body}}."
        ),
    )
    cta_text: str = Field(
        ...,
        description=(
            "Inline CTA link text inside the item block (the link URL stays unchanged). "
            "Maps to {{content.items.[i].cta_text}}."
        ),
    )


# ---------------------------
#  OUTRO / WRAP-UP BLOCK
# ---------------------------
class Outro(BaseModel):
    title: str = Field(
        ...,
        description=(
            "Post-listicle wrap-up heading (H2) above the final paragraph. "
            "Maps to {{content.outro.title}}."
        ),
    )
    body: str = Field(
        ...,
        description=(
            "Post-listicle wrap-up paragraph. Keeps any existing <br/> structure. "
            "Maps to {{content.outro.body}}."
        ),
    )


# ---------------------------
#  PRIMARY CTA SECTION (BIG CARD + STICKY BAR)
# ---------------------------
class CTA(BaseModel):
    headline: str = Field(
        ...,
        description=(
            "Big CTA headline in the promotional block (e.g., 'UP TO 60% OFF ...'). "
            "Maps to {{content.cta.headline}}."
        ),
    )
    subheadline: str = Field(
        ...,
        description=(
            "Secondary line under the big CTA headline. "
            "Maps to {{content.cta.subheadline}}."
        ),
    )
    primary_button: str = Field(
        ...,
        description=(
            "Main CTA button label in the big promo card AND other in-article CTA buttons "
            "(text only; URLs unchanged). Maps to {{content.cta.primary_button}}."
        ),
    )
    sticky_button: str = Field(
        ...,
        description=(
            "Sticky bar CTA button label shown as the user scrolls. "
            "Maps to {{content.cta.sticky_button}}."
        ),
    )


# ---------------------------
#  FOOTER
# ---------------------------
class Footer(BaseModel):
    copyright: str = Field(
        ...,
        description=(
            "Plain-text portion of the footer copyright line (e.g., '© 2025 Brand, Inc.'). "
            "Terms/Privacy links remain intact and are NOT changed by this field. "
            "Maps to {{content.footer.copyright}}."
        ),
    )


# ---------------------------
#  UI TEXT (BANNERS / BADGES)
# ---------------------------
class Banner(BaseModel):
    line1: str = Field(
        ...,
        description=(
            "Top banner line 1 (e.g., seasonal promo tag). "
            "Maps to {{ui.banner.line1}}."
        ),
    )
    line2: str = Field(
        ...,
        description=(
            "Top banner line 2 (subtitle or supporting text). "
            "Maps to {{ui.banner.line2}}."
        ),
    )


class UI(BaseModel):
    banner: Banner = Field(
        ...,
        description=(
            "Container for the top-of-page promotional banner copy. "
            "Controls both banner lines."
        ),
    )
    sale_badge: str = Field(
        ...,
        description=(
            "Small sale badge label shown on the hero/listicle banner (e.g., '60% OFF'). "
            "Maps to {{ui.sale_badge}}."
        ),
    )


# ---------------------------
#  CONTENT ROOT
# ---------------------------
class Content(BaseModel):
    hero: Hero = Field(
        ...,
        description="Hero section content including the main headline.",
    )
    meta: ArticleMeta = Field(
        ...,
        description="Article metadata shown near the top (currently just 'author').",
    )
    summary: Summary = Field(
        ...,
        description=(
            "One-paragraph summary displayed under the 'Summary:' label. "
            "Only the free-text portion is replaced."
        ),
    )
    items: Annotated[
        List[Item],
        Field(
            min_length=1,
            description=(
                "Ordered list of listicle items. The original template shows 11 reasons; "
                "supply exactly 11 to match the design 1:1. Each item maps to "
                "{{content.items.[i].*}} in order."
            ),
        ),
    ]
    outro: Outro = Field(
        ...,
        description="Closing ('wrap up') block beneath the listicle items.",
    )
    cta: CTA = Field(
        ...,
        description="Primary promotional CTA block and sticky-bar button text.",
    )
    footer: Footer = Field(
        ...,
        description="Footer text controls (copyright only; legal links remain unchanged).",
    )


# ---------------------------
#  MASTER PAYLOAD
# ---------------------------
class ListiclePayload(BaseModel):
    meta: Meta = Field(
        ...,
        description=(
            "SEO and social metadata for the <head>. Note: image URLs and other asset "
            "references remain unchanged by design."
        ),
    )
    content: Content = Field(
        ...,
        description=(
            "All visible article copy: hero, byline, list items, outro, main CTA, and footer."
        ),
    )
    ui: UI = Field(
        ...,
        description=(
            "Non-article UI labels like top banners and small sale badge. "
            "Purely cosmetic text; no links or assets are altered."
        ),
    )
