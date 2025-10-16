

from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from enum import Enum

class AdvertorialType(str, Enum):
    listicle = "listicle"
    advertorial = "advertorial"

class ReactionReply(BaseModel):
    name: str
    text: str
    likes: str
    time: str

class Reaction(BaseModel):
    name: str
    text: str
    likes: str
    time: str
    avatar: Optional[str] = None
    reply1: Optional[ReactionReply] = None
    reply2: Optional[ReactionReply] = None

class ListicleItem(BaseModel):
    number: int
    title: str
    description: str

class ListicleContent(BaseModel):
    """Schema for listicle templates (blissy.html, javycoffee.html, hike.html)"""
    
    # Core content
    title: str
    summary: str
    listicles: List[ListicleItem]  # Up to 12 items for sections 1-12
    conclusion: str
    
    # Hero section
    hero_headline: str
    hero_subheadline: str
    hero_image: Optional[str] = None
    
    # Author
    author_name: str
    author_date: str
    author_image: Optional[str] = None
    author_verifiedIcon: Optional[str] = None
    
    # Navigation
    topbar_label: Optional[str] = None
    alert_banner: Optional[str] = None
    breadcrumbs_text: Optional[str] = None
    
    # Story
    story_intro: str
    
    # Sections 1-12 (all required for listicle templates)
    section1_title: str
    section1_body: str
    section1_image: Optional[str] = None
    
    section2_title: str
    section2_body: str
    section2_image: Optional[str] = None
    
    section3_title: str
    section3_body: str
    section3_image: Optional[str] = None
    
    section4_title: str
    section4_body: str
    section4_image: Optional[str] = None
    
    section5_title: str
    section5_body: str
    section5_image: Optional[str] = None
    
    section6_title: str
    section6_body: str
    
    section7_title: str
    section7_body: str
    section7_image: Optional[str] = None
    
    section8_title: str
    section8_body: str
    
    section9_title: str
    section9_body: str
    
    section10_title: str
    section10_body: str
    section10_imageAlt: Optional[str] = None
    
    section11_title: str
    section11_body: str
    
    section12_title: str
    section12_body: str
    
    # CTAs
    cta_primary: str
    cta_primaryUrl: Optional[str] = None
    cta_secondary: Optional[str] = None
    cta_secondaryUrl: Optional[str] = None
    
    # Sidebar
    sidebar_ctaHeadline: Optional[str] = None
    sidebar_ctaButton: Optional[str] = None
    sidebar_ctaUrl: Optional[str] = None
    sidebar_productImage: Optional[str] = None
    sidebar_ratingImage: Optional[str] = None
    
    # Sticky CTA
    sticky_cta: Optional[str] = None
    sticky_ctaUrl: Optional[str] = None
    
    # Social proof (up to 12 reactions)
    reactions_title: Optional[str] = None
    reactions_r1: Optional[Reaction] = None
    reactions_r2: Optional[Reaction] = None
    reactions_r3: Optional[Reaction] = None
    reactions_r4: Optional[Reaction] = None
    reactions_r5: Optional[Reaction] = None
    reactions_r6: Optional[Reaction] = None
    reactions_r7: Optional[Reaction] = None
    reactions_r8: Optional[Reaction] = None
    reactions_r9: Optional[Reaction] = None
    reactions_r10: Optional[Reaction] = None
    reactions_r11: Optional[Reaction] = None
    reactions_r12: Optional[Reaction] = None
    
    # Footer
    footer_copyright: Optional[str] = None
    footer_disclaimer: Optional[str] = None
    footer_contactUrl: Optional[str] = None
    footer_privacyUrl: Optional[str] = None
    footer_termsUrl: Optional[str] = None
    footer_cookieUrl: Optional[str] = None
    
    # Brand & Product
    brand_logo: Optional[str] = None
    product_image: Optional[str] = None
    
    # Trust elements
    guarantee_badge: Optional[str] = None
    assurances_blurb: Optional[str] = None
    shipping_threshold: Optional[str] = None
    info_icon: Optional[str] = None
    reviews_url: Optional[str] = None

class AdvertorialContent(BaseModel):
    """Schema for advertorial templates (bugmd.html, bunion.html, footpads.html, example_with_placeholders.html)"""
    
    # Core content
    title: str
    summary: str
    
    # Story elements
    story_intro: str
    doctor_intro: Optional[str] = None
    experience_intro: Optional[str] = None
    
    # Problem/condition statements
    condition1: Optional[str] = None
    condition2: Optional[str] = None
    condition3: Optional[str] = None
    
    # Hero section
    hero_headline: str
    hero_subheadline: str
    hero_image: Optional[str] = None
    
    # Author
    author_name: str
    author_date: str
    author_image: Optional[str] = None
    author_verifiedIcon: Optional[str] = None
    
    # Navigation
    topbar_label: Optional[str] = None
    alert_banner: Optional[str] = None
    breadcrumbs_text: Optional[str] = None
    
    # Sections 1-12 (sections 6-12 are optional for advertorials)
    section1_title: str
    section1_body: str
    section1_image: Optional[str] = None
    
    section2_title: str
    section2_body: str
    section2_image: Optional[str] = None
    
    section3_title: str
    section3_body: str
    section3_image: Optional[str] = None
    
    section4_title: str
    section4_body: str
    section4_image: Optional[str] = None
    
    section5_title: str
    section5_body: str
    section5_image: Optional[str] = None
    
    section6_title: Optional[str] = None
    section6_body: Optional[str] = None
    
    section7_title: Optional[str] = None
    section7_body: Optional[str] = None
    section7_image: Optional[str] = None
    
    section8_title: Optional[str] = None
    section8_body: Optional[str] = None
    
    section9_title: Optional[str] = None
    section9_body: Optional[str] = None
    
    section10_title: Optional[str] = None
    section10_body: Optional[str] = None
    section10_imageAlt: Optional[str] = None
    
    section11_title: Optional[str] = None
    section11_body: Optional[str] = None
    
    section12_title: Optional[str] = None
    section12_body: Optional[str] = None
    
    # CTAs
    cta_primary: str
    cta_primaryUrl: Optional[str] = None
    cta_secondary: Optional[str] = None
    cta_secondaryUrl: Optional[str] = None
    
    # Sidebar
    sidebar_ctaHeadline: Optional[str] = None
    sidebar_ctaButton: Optional[str] = None
    sidebar_ctaUrl: Optional[str] = None
    sidebar_productImage: Optional[str] = None
    sidebar_ratingImage: Optional[str] = None
    
    # Sticky CTA
    sticky_cta: Optional[str] = None
    sticky_ctaUrl: Optional[str] = None
    
    # Trust elements
    guarantee_text: Optional[str] = None
    social_proof: Optional[str] = None
    price_info: Optional[str] = None
    
    # Social proof (up to 12 reactions)
    reactions_title: Optional[str] = None
    reactions_r1: Optional[Reaction] = None
    reactions_r2: Optional[Reaction] = None
    reactions_r3: Optional[Reaction] = None
    reactions_r4: Optional[Reaction] = None
    reactions_r5: Optional[Reaction] = None
    reactions_r6: Optional[Reaction] = None
    reactions_r7: Optional[Reaction] = None
    reactions_r8: Optional[Reaction] = None
    reactions_r9: Optional[Reaction] = None
    reactions_r10: Optional[Reaction] = None
    reactions_r11: Optional[Reaction] = None
    reactions_r12: Optional[Reaction] = None
    
    # Footer
    footer_copyright: Optional[str] = None
    footer_disclaimer: Optional[str] = None
    footer_contactUrl: Optional[str] = None
    footer_privacyUrl: Optional[str] = None
    footer_termsUrl: Optional[str] = None
    footer_cookieUrl: Optional[str] = None
    
    # Brand & Product
    brand_logo: Optional[str] = None
    product_image: Optional[str] = None
    
    # Additional trust elements
    guarantee_badge: Optional[str] = None
    assurances_blurb: Optional[str] = None
    shipping_threshold: Optional[str] = None
    info_icon: Optional[str] = None
    reviews_url: Optional[str] = None

class SwipeResult(BaseModel):
    angle: str
    content: Dict[str, Any]  # Contains ListicleContent or AdvertorialContent

class BackendServiceOutput(BaseModel):
    """Main API response schema"""
    job_id: str
    project_name: str
    advertorial_type: AdvertorialType
    summary: str
    offer_brief: str
    avatar_sheet: Dict[str, Any]
    swipe_results: List[SwipeResult]
    research_page_analysis: Optional[str] = None
    doc1_analysis: Optional[str] = None
    doc2_analysis: Optional[str] = None
    generated_at: str
    metadata: Optional[Dict[str, Any]] = None
