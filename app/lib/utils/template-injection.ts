import { InjectableTemplate } from '@/lib/db/types'

// HTML escape utility function for text content
function escapeHtml(text: string): string {
  if (!text) return ''

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Sanitize text content for layout safety (escapes all HTML)
function sanitizeTextContent(text: string, maxLength?: number): string {
  if (!text) return ''

  // Escape HTML characters
  let sanitized = escapeHtml(text)

  // Truncation removed - display full content
  return sanitized
}

// Sanitize body content - allows safe HTML tags like <br>, <p>, <ul>, <li>, <strong>, <em>
function sanitizeBodyContent(text: string, maxLength?: number): string {
  if (!text) return ''

  // Allow safe HTML tags: <br>, <br/>, <p>, </p>, <ul>, </ul>, <li>, </li>, <strong>, </strong>, <em>, </em>, <b>, </b>, <i>, </i>
  // Escape only dangerous tags like <script>, <iframe>, etc.
  let sanitized = text
    // First, escape script tags and other dangerous content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
    .replace(/javascript:/gi, '') // Remove javascript: protocol
  // Keep safe HTML tags as-is
  // The safe tags (<br>, <p>, <ul>, <li>, <strong>, <em>, <b>, <i>) are already in the text

  // Truncation removed - display full content
  return sanitized
}

// Sanitize URL content
function sanitizeUrl(url: string): string {
  if (!url) return '#'

  // Only allow safe URL characters, escape others
  return url.replace(/[<>"']/g, (match) => {
    switch (match) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case "'": return '&#39;'
      default: return match
    }
  })
}

export interface ContentData {
  hero: {
    headline: string
    subheadline: string
    image: string
    imageAlt: string
  }
  author: {
    name: string
    image: string
    date: string
    verifiedIcon: string
  }
  topbar: {
    label: string
    image: string
  }
  alert: {
    banner: string
  }
  breadcrumbs: {
    text: string
  }
  story: {
    intro: string
  }
  section1: {
    title: string
    body: string
    image: string
    imageAlt: string
  }
  section2: {
    title: string
    body: string
    image: string
    imageAlt: string
  }
  section3: {
    title: string
    body: string
    image: string
    imageAlt: string
  }
  section4: {
    title: string
    body: string
    image: string
    imageAlt: string
  }
  section5: {
    title: string
    body: string
    image: string
    imageAlt: string
  }
  section6: {
    title: string
    body: string
    image: string
    imageAlt: string
  }
  section7: {
    title: string
    body: string
    image: string
    imageAlt: string
  }
  section8: {
    title: string
    body: string
    image: string
    imageAlt: string
  }
  section9: {
    title: string
    body: string
    image: string
    imageAlt: string
  }
  section10: {
    title: string
    body: string
    image: string
    imageAlt: string
  }
  section11: {
    title: string
    body: string
    image: string
    imageAlt: string
  }
  section12: {
    title: string
    body: string
    image: string
    imageAlt: string
  }
  cta: {
    primary: string
    primaryUrl: string
    secondary: string
    secondaryUrl: string
  }
  sidebar: {
    title?: string
    subtitle?: string
    ctaHeadline: string
    ctaButton: string
    ctaUrl: string
    productImage: string
    ratingImage: string
  }
  sticky: {
    cta: string
    ctaUrl: string
  }
  reactions: {
    title: string
    r1: {
      text: string
      name: string
      image: string
      likes: string
      time: string
      reply: string
    }
    r2: {
      text: string
      name: string
      image: string
      likes: string
      time: string
      reply: string
    }
    r3: {
      text: string
      name: string
      image: string
      likes: string
      time: string
      reply: string
    }
    r4: {
      text: string
      name: string
      image: string
      likes: string
      time: string
      reply: string
    }
  }
  footer: {
    copyright: string
    disclaimer: string
    contactUrl: string
    privacyUrl: string
    termsUrl: string
    cookieUrl: string
  }
  brands: {
    brand1: {
      name: string
      logo: string
    }
  }
  product: {
    name: string
    image: string
  }
  guarantee: {
    badge: string
  }
  assurances: {
    blurb: string
  }
  shipping: {
    threshold: string
  }
  info: {
    icon: string
  }
  reviews: {
    url: string
  }
}

export function extractContentFromAngle(results: any, swipe: any, angleIndex: number): ContentData {
  // Parse the swipe content for this specific angle
  const swipeContent = swipe.content ? JSON.parse(swipe.content) : {}
  const listicles = swipeContent.listicles || []


  // Extract key information
  const projectName = results.project_name || 'Nerve Relief™'
  const productName = swipeContent.title || projectName

  // Create content specific to this angle
  const content: ContentData = {
    hero: {
      headline: sanitizeTextContent(swipe.angle || swipeContent.title || productName || 'Finally — real relief for nerve pain', 100),
      subheadline: sanitizeTextContent(swipeContent.summary || 'Pharmaceutical-grade transdermal magnesium that targets damaged nerves. Try risk-free for 90 days.', 200),
      image: sanitizeUrl(swipeContent.hero?.image || 'https://placehold.co/600x400?text=Hero+Image'),
      imageAlt: sanitizeTextContent(swipeContent.hero?.imageAlt || 'Hero Image', 50)
    },
    author: {
      name: sanitizeTextContent(swipeContent.author || 'Nerve Relief Content Team', 50),
      image: sanitizeUrl('https://placehold.co/100x100?text=Author'),
      date: new Date().toLocaleDateString(),
      verifiedIcon: sanitizeUrl('https://placehold.co/20x20?text=✓')
    },
    topbar: {
      label: sanitizeTextContent('LIMITED TIME OFFER - 50% OFF TODAY ONLY!', 100),
      image: sanitizeUrl('https://placehold.co/50x50?text=Icon')
    },
    alert: {
      banner: sanitizeTextContent('Hurry! Only 47 left in stock. Order now before it\'s too late!', 150)
    },
    breadcrumbs: {
      text: sanitizeTextContent('Home > Health > Products > Featured', 100)
    },
    story: {
      intro: sanitizeBodyContent(results.summary?.substring(0, 200) + '...' || 'Here\'s what happened when I tried this revolutionary product...', 300)
    },
    section1: {
      title: sanitizeTextContent(listicles[0]?.title || 'Reason #1: Revolutionary Technology', 100),
      body: sanitizeBodyContent(listicles[0]?.description || 'This breakthrough technology has been proven to work...', 500),
      image: sanitizeUrl('https://placehold.co/600x400?text=Product+Image'),
      imageAlt: sanitizeTextContent('Product demonstration', 50)
    },
    section2: {
      title: sanitizeTextContent(listicles[1]?.title || 'Reason #2: Scientifically Proven', 100),
      body: sanitizeBodyContent(listicles[1]?.description || 'Clinical studies show amazing results...', 500),
      image: sanitizeUrl('https://placehold.co/600x400?text=Product+Image'),
      imageAlt: sanitizeTextContent('Scientific proof', 50)
    },
    section3: {
      title: sanitizeTextContent(listicles[2]?.title || 'Reason #3: Easy to Use', 100),
      body: sanitizeBodyContent(listicles[2]?.description || 'Simply follow these easy steps...', 500),
      image: sanitizeUrl('https://placehold.co/600x400?text=Product+Image'),
      imageAlt: sanitizeTextContent('Easy usage', 50)
    },
    section4: {
      title: sanitizeTextContent(listicles[3]?.title || 'Reason #4: Money Back Guarantee', 100),
      body: sanitizeBodyContent(listicles[3]?.description || 'We\'re so confident you\'ll love it...', 500),
      image: sanitizeUrl('https://placehold.co/600x400?text=Product+Image'),
      imageAlt: sanitizeTextContent('Guarantee badge', 50)
    },
    section5: {
      title: sanitizeTextContent(listicles[4]?.title || 'Reason #5: Thousands of Happy Customers', 100),
      body: sanitizeBodyContent(listicles[4]?.description || 'See what our customers are saying...', 500),
      image: sanitizeUrl('https://placehold.co/600x400?text=Product+Image'),
      imageAlt: sanitizeTextContent('Happy customers', 50)
    },
    section6: {
      title: sanitizeTextContent(listicles[5]?.title || swipeContent.section6_title || 'Reason #6: Limited Time Offer', 100),
      body: sanitizeBodyContent(listicles[5]?.description || swipeContent.section6_body || 'Don\'t miss out on this special deal...', 500),
      image: sanitizeUrl('https://placehold.co/600x400?text=Product+Image'),
      imageAlt: sanitizeTextContent('Limited offer', 50)
    },
    section7: {
      title: sanitizeTextContent(listicles[6]?.title || swipeContent.section7_title || 'Reason #7: Free Shipping', 100),
      body: sanitizeBodyContent(listicles[6]?.description || swipeContent.section7_body || 'Get it delivered right to your door...', 500),
      image: sanitizeUrl('https://placehold.co/600x400?text=Product+Image'),
      imageAlt: sanitizeTextContent('Free shipping', 50)
    },
    section8: {
      title: sanitizeTextContent(listicles[7]?.title || swipeContent.section8_title || 'Reason #8: Premium Quality', 100),
      body: sanitizeBodyContent(listicles[7]?.description || swipeContent.section8_body || 'Made with the finest materials...', 500),
      image: sanitizeUrl('https://placehold.co/600x400?text=Product+Image'),
      imageAlt: sanitizeTextContent('Premium quality', 50)
    },
    section9: {
      title: sanitizeTextContent(listicles[8]?.title || swipeContent.section9_title || 'Reason #9: Doctor Recommended', 100),
      body: sanitizeBodyContent(listicles[8]?.description || swipeContent.section9_body || 'Trusted by healthcare professionals...', 500),
      image: sanitizeUrl('https://placehold.co/600x400?text=Product+Image'),
      imageAlt: sanitizeTextContent('Doctor recommendation', 50)
    },
    section10: {
      title: sanitizeTextContent(listicles[9]?.title || swipeContent.section10_title || 'Reason #10: Risk-Free Trial', 100),
      body: sanitizeBodyContent(listicles[9]?.description || swipeContent.section10_body || 'Try it for 30 days, no questions asked...', 500),
      image: sanitizeUrl('https://placehold.co/600x400?text=Product+Image'),
      imageAlt: sanitizeTextContent('Risk-free trial', 50)
    },
    section11: {
      title: sanitizeTextContent(swipeContent.section11_title || 'Expert Recommendation', 100),
      body: sanitizeBodyContent(swipeContent.section11_body || 'Leading experts recommend this product...', 500),
      image: sanitizeUrl('https://placehold.co/600x400?text=Expert+Image'),
      imageAlt: sanitizeTextContent('Expert recommendation', 50)
    },
    section12: {
      title: sanitizeTextContent(swipeContent.section12_title || 'Final Call to Action', 100),
      body: sanitizeBodyContent(swipeContent.section12_body || 'Order now and start your journey to better health...', 500),
      image: sanitizeUrl('https://placehold.co/600x400?text=CTA+Image'),
      imageAlt: sanitizeTextContent('Call to action', 50)
    },
    cta: {
      primary: sanitizeTextContent(swipeContent.cta || 'Get Yours Now - 50% Off!', 100),
      primaryUrl: '#order',
      secondary: sanitizeTextContent('Order Today and Save Big!', 100),
      secondaryUrl: '#learn'
    },
    sidebar: {
      ctaHeadline: sanitizeTextContent('Limited Time Offer!', 50),
      ctaButton: sanitizeTextContent('Order Now - 50% Off!', 50),
      ctaUrl: '#order',
      productImage: sanitizeUrl('https://placehold.co/300x300?text=Product+Image'),
      ratingImage: sanitizeUrl('https://placehold.co/20x20?text=★')
    },
    sticky: {
      cta: sanitizeTextContent('Order Now - 50% Off!', 50),
      ctaUrl: '#order'
    },
    reactions: {
      title: sanitizeTextContent('What Our Customers Are Saying', 50),
      r1: {
        name: sanitizeTextContent('Sarah M.', 20),
        text: sanitizeTextContent('This product changed my life! I can\'t believe how well it works.', 200),
        time: sanitizeTextContent('2 hours ago', 20),
        likes: '24',
        image: sanitizeUrl('https://placehold.co/40x40?text=SM'),
        reply: 'Reply'
      },
      r2: {
        name: sanitizeTextContent('Mike R.', 20),
        text: sanitizeTextContent('Amazing results in just one week. Highly recommended!', 200),
        time: sanitizeTextContent('5 hours ago', 20),
        likes: '18',
        image: sanitizeUrl('https://placehold.co/40x40?text=MR'),
        reply: 'Reply'
      },
      r3: {
        name: sanitizeTextContent('Jennifer L.', 20),
        text: sanitizeTextContent('Best purchase I\'ve made this year. Worth every penny!', 200),
        time: sanitizeTextContent('1 day ago', 20),
        likes: '31',
        image: sanitizeUrl('https://placehold.co/40x40?text=JL'),
        reply: 'Reply'
      },
      r4: {
        name: sanitizeTextContent('David K.', 20),
        text: sanitizeTextContent('Worth every penny. Life-changing results!', 200),
        time: sanitizeTextContent('1d', 20),
        likes: '20',
        image: sanitizeUrl('https://placehold.co/40x40?text=DK'),
        reply: 'Reply'
      }
    },
    guarantee: {
      badge: sanitizeUrl('https://placehold.co/80x80?text=Badge')
    },
    assurances: {
      blurb: sanitizeTextContent('Your satisfaction is our top priority. If you\'re not completely satisfied, we\'ll refund your money, no questions asked.', 300)
    },
    footer: {
      copyright: sanitizeTextContent('© 2024 Your Company. All rights reserved.', 100),
      disclaimer: sanitizeTextContent('Results may vary. Individual results are not guaranteed.', 200),
      contactUrl: '#',
      privacyUrl: '#',
      termsUrl: '#',
      cookieUrl: '#'
    },
    shipping: {
      threshold: sanitizeTextContent('$50', 20)
    },
    product: {
      name: sanitizeTextContent('Your Product', 50),
      image: sanitizeUrl('https://placehold.co/400x400?text=Product+Image')
    },
    info: {
      icon: sanitizeUrl('https://placehold.co/20x20?text=Info+Icon')
    },
    reviews: {
      url: '#'
    },
    brands: {
      brand1: {
        name: sanitizeTextContent('Your Brand', 50),
        logo: sanitizeUrl('https://placehold.co/120x40?text=Your+Logo')
      }
    }
  }

  return content
}

// Extract content data from individual swipe result - EXACT field mapping
export function extractContentFromSwipeResult(swipeResult: any, templateType: 'listicle' | 'advertorial'): ContentData {
  // Parse the swipe result content - this contains the rich JSON data for this specific angle
  // Handle multiple formats:
  // 1. Wrapper with full_advertorial property (from swipe-files API: { full_advertorial: {...} })
  // 2. Already the full_advertorial object itself (passed directly from process route)
  // 3. Nested content property (old format: { content: {...} })
  // 4. Already parsed content object
  let swipeContent: any = {}

  // Check if this is a wrapper with full_advertorial property
  if (swipeResult.full_advertorial && typeof swipeResult.full_advertorial === 'object') {
    swipeContent = swipeResult.full_advertorial
  }
  // Check if this is already the full_advertorial object itself (has typical advertorial structure)
  else if (swipeResult.hero || swipeResult.section1 || swipeResult.topbar || swipeResult.alert) {
    // Already the content object itself (no nesting) - this is what we get from process route
    swipeContent = swipeResult
  }
  // Check for nested content property (old format)
  else if (swipeResult.content) {
    if (typeof swipeResult.content === 'string') {
      try {
        swipeContent = JSON.parse(swipeResult.content)
      } catch (e) {
        swipeContent = {}
      }
    } else {
      // Already an object (Listicle or Advertorial)
      swipeContent = swipeResult.content
    }
  } else {
    // Fallback: use swipeResult as-is
    swipeContent = swipeResult
  }

  // Check if this is a Listicle or Advertorial structure (from swipe-files endpoint)
  const isListicle = swipeContent.title && swipeContent.listicles && Array.isArray(swipeContent.listicles)
  const isAdvertorial = swipeContent.title && swipeContent.subtitle && swipeContent.body

  // Create content data using EXACT field names from API - NO DUPLICATES
  const content: ContentData = {
    // Hero section - handle both old format and Listicle/Advertorial format
    hero: {
      headline: sanitizeTextContent(
        swipeContent.hero?.headline ||
        swipeContent.title ||
        'Transform Your Daily Routine',
        100
      ),
      subheadline: sanitizeTextContent(
        swipeContent.hero?.subheadline ||
        (isListicle ? swipeContent.summary : null) ||
        (isAdvertorial ? swipeContent.subtitle : null) ||
        'Discover the solution that thousands are already using',
        200
      ),
      image: sanitizeUrl(swipeContent.hero?.image || 'https://placehold.co/600x400?text=Hero+Image'),
      imageAlt: sanitizeTextContent(swipeContent.hero?.imageAlt || 'Hero Image', 50)
    },

    // Author section - handle both formats
    author: {
      name: sanitizeTextContent(
        swipeContent.author?.name ||
        (isListicle ? swipeContent.author : null) ||
        'Health Expert',
        50
      ),
      image: sanitizeUrl(swipeContent.author?.image || 'https://placehold.co/100x100?text=Author'),
      date: new Date().toLocaleDateString(),
      verifiedIcon: sanitizeUrl('https://placehold.co/20x20?text=✓') // Not in API, keep default
    },

    // Topbar - exact field mapping
    topbar: {
      label: sanitizeTextContent(swipeContent.topbar?.label || 'Featured', 100),
      image: sanitizeUrl(swipeContent.topbar?.image || 'https://placehold.co/50x50?text=Icon')
    },

    // Alert banner - exact field mapping
    alert: {
      banner: sanitizeTextContent(swipeContent.alert?.banner || 'Limited Time Offer', 150)
    },

    // Breadcrumbs - exact field mapping (handle both string and object formats)
    breadcrumbs: {
      text: sanitizeTextContent(
        typeof swipeContent.breadcrumbs === 'string'
          ? swipeContent.breadcrumbs
          : swipeContent.breadcrumbs?.text || 'Home > Health > Products',
        200
      )
    },

    // Story intro - handle both formats
    story: {
      intro: sanitizeBodyContent(
        swipeContent.story?.intro ||
        (isListicle ? swipeContent.summary : null) ||
        (isAdvertorial ? swipeContent.body?.substring(0, 300) : null) ||
        'Here\'s what you need to know about this breakthrough solution...',
        300
      )
    },

    // Sections 1-12 - use real API data, handle Listicle format (listicles array)
    section1: {
      title: sanitizeTextContent(
        swipeContent.section1?.title ||
        swipeContent.section1?.headline ||
        (isListicle && swipeContent.listicles?.[0] ? swipeContent.listicles[0].title : null) ||
        'The Problem You Face',
        100
      ),
      body: sanitizeBodyContent(
        swipeContent.section1?.body ||
        swipeContent.section1?.description ||
        (isListicle && swipeContent.listicles?.[0] ? swipeContent.listicles[0].description : null) ||
        (isAdvertorial ? swipeContent.body?.substring(0, 500) : null) ||
        'Many people struggle with this issue daily, affecting their quality of life.',
        500
      ),
      image: sanitizeUrl(swipeContent.section1?.image || 'https://placehold.co/600x400?text=Problem+Image'),
      imageAlt: sanitizeTextContent(swipeContent.section1?.imageAlt || 'Problem illustration', 50)
    },
    section2: {
      title: sanitizeTextContent(
        swipeContent.section2?.title ||
        swipeContent.section2?.headline ||
        (isListicle && swipeContent.listicles?.[1] ? swipeContent.listicles[1].title : null) ||
        'The Science Behind It',
        100
      ),
      body: sanitizeBodyContent(
        swipeContent.section2?.body ||
        swipeContent.section2?.description ||
        (isListicle && swipeContent.listicles?.[1] ? swipeContent.listicles[1].description : null) ||
        (isAdvertorial ? swipeContent.body?.substring(500, 1000) : null) ||
        'Research shows that this approach has been proven effective in clinical studies.',
        500
      ),
      image: sanitizeUrl(swipeContent.section2?.image || 'https://placehold.co/600x400?text=Science+Image'),
      imageAlt: sanitizeTextContent(swipeContent.section2?.imageAlt || 'Scientific research', 50)
    },
    section3: {
      title: sanitizeTextContent(
        swipeContent.section3?.title ||
        swipeContent.section3?.headline ||
        (isListicle && swipeContent.listicles?.[2] ? swipeContent.listicles[2].title : null) ||
        'How It Works',
        100
      ),
      body: sanitizeBodyContent(
        swipeContent.section3?.body ||
        swipeContent.section3?.description ||
        (isListicle && swipeContent.listicles?.[2] ? swipeContent.listicles[2].description : null) ||
        (isAdvertorial ? swipeContent.body?.substring(1000, 1500) : null) ||
        'Our solution works by targeting the root cause of the problem.',
        500
      ),
      image: sanitizeUrl(swipeContent.section3?.image || 'https://placehold.co/600x400?text=How+It+Works'),
      imageAlt: sanitizeTextContent(swipeContent.section3?.imageAlt || 'Process illustration', 50)
    },
    section4: {
      title: sanitizeTextContent(
        swipeContent.section4?.title ||
        swipeContent.section4?.headline ||
        (isListicle && swipeContent.listicles?.[3] ? swipeContent.listicles[3].title : null) ||
        'Real Results',
        100
      ),
      body: sanitizeBodyContent(
        swipeContent.section4?.body ||
        swipeContent.section4?.description ||
        (isListicle && swipeContent.listicles?.[3] ? swipeContent.listicles[3].description : null) ||
        (isAdvertorial ? swipeContent.body?.substring(1500, 2000) : null) ||
        'Thousands of users have experienced significant improvements.',
        500
      ),
      image: sanitizeUrl(swipeContent.section4?.image || 'https://placehold.co/600x400?text=Results+Image'),
      imageAlt: sanitizeTextContent(swipeContent.section4?.imageAlt || 'Success results', 50)
    },
    section5: {
      title: sanitizeTextContent(
        swipeContent.section5?.title ||
        swipeContent.section5?.headline ||
        (isListicle && swipeContent.listicles?.[4] ? swipeContent.listicles[4].title : null) ||
        'What Makes Us Different',
        100
      ),
      body: sanitizeBodyContent(
        swipeContent.section5?.body ||
        swipeContent.section5?.description ||
        (isListicle && swipeContent.listicles?.[4] ? swipeContent.listicles[4].description : null) ||
        (isAdvertorial ? swipeContent.body?.substring(2000, 2500) : null) ||
        'Our unique approach sets us apart from other solutions.',
        500
      ),
      image: sanitizeUrl(swipeContent.section5?.image || 'https://placehold.co/600x400?text=Difference+Image'),
      imageAlt: sanitizeTextContent(swipeContent.section5?.imageAlt || 'Unique features', 50)
    },
    section6: {
      title: sanitizeTextContent(
        swipeContent.section6?.title ||
        swipeContent.section6?.headline ||
        (isListicle && swipeContent.listicles?.[5] ? swipeContent.listicles[5].title : null) ||
        'Easy to Use',
        100
      ),
      body: sanitizeBodyContent(
        swipeContent.section6?.body ||
        swipeContent.section6?.description ||
        (isListicle && swipeContent.listicles?.[5] ? swipeContent.listicles[5].description : null) ||
        (isAdvertorial ? swipeContent.body?.substring(2500, 3000) : null) ||
        'Simple application process that fits into your daily routine.',
        500
      ),
      image: sanitizeUrl(swipeContent.section6?.image || 'https://placehold.co/600x400?text=Easy+Use'),
      imageAlt: sanitizeTextContent(swipeContent.section6?.imageAlt || 'Easy application', 50)
    },
    section7: {
      title: sanitizeTextContent(
        swipeContent.section7?.title ||
        swipeContent.section7?.headline ||
        (isListicle && swipeContent.listicles?.[6] ? swipeContent.listicles[6].title : null) ||
        'Safety First',
        100
      ),
      body: sanitizeBodyContent(
        swipeContent.section7?.body ||
        swipeContent.section7?.description ||
        (isListicle && swipeContent.listicles?.[6] ? swipeContent.listicles[6].description : null) ||
        (isAdvertorial ? swipeContent.body?.substring(3000, 3500) : null) ||
        'Made with high-quality, safe ingredients you can trust.',
        500
      ),
      image: sanitizeUrl(swipeContent.section7?.image || 'https://placehold.co/600x400?text=Safety+Image'),
      imageAlt: sanitizeTextContent(swipeContent.section7?.imageAlt || 'Safety assurance', 50)
    },
    section8: {
      title: sanitizeTextContent(
        swipeContent.section8?.title ||
        swipeContent.section8?.headline ||
        (isListicle && swipeContent.listicles?.[7] ? swipeContent.listicles[7].title : null) ||
        'Customer Stories',
        100
      ),
      body: sanitizeBodyContent(
        swipeContent.section8?.body ||
        swipeContent.section8?.description ||
        (isListicle && swipeContent.listicles?.[7] ? swipeContent.listicles[7].description : null) ||
        (isAdvertorial ? swipeContent.body?.substring(3500, 4000) : null) ||
        'Hear from real customers who have transformed their lives.',
        500
      ),
      image: sanitizeUrl(swipeContent.section8?.image || 'https://placehold.co/600x400?text=Testimonials'),
      imageAlt: sanitizeTextContent(swipeContent.section8?.imageAlt || 'Customer testimonials', 50)
    },
    section9: {
      title: sanitizeTextContent(
        swipeContent.section9?.title ||
        swipeContent.section9?.headline ||
        (isListicle && swipeContent.listicles?.[8] ? swipeContent.listicles[8].title : null) ||
        'Expert Endorsement',
        100
      ),
      body: sanitizeBodyContent(
        swipeContent.section9?.body ||
        swipeContent.section9?.description ||
        (isListicle && swipeContent.listicles?.[8] ? swipeContent.listicles[8].description : null) ||
        (isAdvertorial ? swipeContent.body?.substring(4000, 4500) : null) ||
        'Recommended by healthcare professionals and experts.',
        500
      ),
      image: sanitizeUrl(swipeContent.section9?.image || 'https://placehold.co/600x400?text=Expert+Endorsement'),
      imageAlt: sanitizeTextContent(swipeContent.section9?.imageAlt || 'Expert recommendation', 50)
    },
    section10: {
      title: sanitizeTextContent(
        swipeContent.section10?.title ||
        swipeContent.section10?.headline ||
        (isListicle && swipeContent.listicles?.[9] ? swipeContent.listicles[9].title : null) ||
        'Risk-Free Trial',
        100
      ),
      body: sanitizeBodyContent(
        swipeContent.section10?.body ||
        swipeContent.section10?.description ||
        (isListicle && swipeContent.listicles?.[9] ? swipeContent.listicles[9].description : null) ||
        (isAdvertorial ? swipeContent.body?.substring(4500, 5000) : null) ||
        'Try it risk-free with our satisfaction guarantee.',
        500
      ),
      image: sanitizeUrl(swipeContent.section10?.image || 'https://placehold.co/600x400?text=Risk+Free'),
      imageAlt: sanitizeTextContent(swipeContent.section10?.imageAlt || 'Risk-free guarantee', 50)
    },
    section11: {
      title: sanitizeTextContent(
        swipeContent.section11?.title ||
        swipeContent.section11?.headline ||
        (isListicle && swipeContent.listicles?.[10] ? swipeContent.listicles[10].title : null) ||
        'Limited Time Offer',
        100
      ),
      body: sanitizeBodyContent(
        swipeContent.section11?.body ||
        swipeContent.section11?.description ||
        (isListicle && swipeContent.listicles?.[10] ? swipeContent.listicles[10].description : null) ||
        (isAdvertorial ? swipeContent.body?.substring(5000, 5500) : null) ||
        'Special pricing available for a limited time only.',
        500
      ),
      image: sanitizeUrl(swipeContent.section11?.image || 'https://placehold.co/600x400?text=Special+Offer'),
      imageAlt: sanitizeTextContent(swipeContent.section11?.imageAlt || 'Special offer', 50)
    },
    section12: {
      title: sanitizeTextContent(
        swipeContent.section12?.title ||
        swipeContent.section12?.headline ||
        (isListicle && swipeContent.listicles?.[11] ? swipeContent.listicles[11].title : null) ||
        (isListicle && swipeContent.conclusion ? 'Conclusion' : null) ||
        'Get Started Today',
        100
      ),
      body: sanitizeBodyContent(
        swipeContent.section12?.body ||
        swipeContent.section12?.description ||
        (isListicle && swipeContent.listicles?.[11] ? swipeContent.listicles[11].description : null) ||
        (isListicle && swipeContent.conclusion ? swipeContent.conclusion : null) ||
        (isAdvertorial ? swipeContent.body?.substring(5500) : null) ||
        'Don\'t wait - start your journey to better health today.',
        500
      ),
      image: sanitizeUrl(swipeContent.section12?.image || 'https://placehold.co/600x400?text=Get+Started'),
      imageAlt: sanitizeTextContent(swipeContent.section12?.imageAlt || 'Call to action', 50)
    },

    // CTA section - handle both formats (object with primary/secondary or direct string)
    cta: {
      primary: sanitizeTextContent(
        swipeContent.cta?.primary ||
        (typeof swipeContent.cta === 'string' ? swipeContent.cta : null) ||
        swipeContent.hero?.cta ||
        (isListicle ? swipeContent.cta : null) ||
        (isAdvertorial ? swipeContent.cta : null) ||
        'Get Started Now',
        200
      ),
      primaryUrl: '#order',
      secondary: sanitizeTextContent(
        swipeContent.cta?.secondary ||
        'Learn More',
        200
      ),
      secondaryUrl: '#learn'
    },

    // Sidebar section - extract ALL fields from API response dynamically
    sidebar: {
      // Extract title if it exists in API response
      title: sanitizeTextContent(swipeContent.sidebar?.title || '', 200),
      // Extract subtitle if it exists in API response
      subtitle: sanitizeTextContent(swipeContent.sidebar?.subtitle || '', 200),
      // Keep existing fields for backward compatibility
      ctaHeadline: sanitizeTextContent(swipeContent.sidebar?.ctaHeadline || swipeContent.sidebar?.title || swipeContent.cta?.primary || 'Special Offer', 100),
      ctaButton: sanitizeTextContent(swipeContent.sidebar?.ctaButton || swipeContent.cta?.primary || 'Get Started', 100),
      ctaUrl: '#order',
      productImage: sanitizeUrl(swipeContent.sidebar?.productImage || swipeContent.product?.image || 'https://placehold.co/300x300?text=Product+Image'),
      ratingImage: sanitizeUrl(swipeContent.sidebar?.ratingImage || 'https://placehold.co/20x20?text=★')
    },

    // Sticky CTA - use real data from API with comprehensive fallbacks
    sticky: {
      cta: sanitizeTextContent(
        swipeContent.sticky?.cta ||
        swipeContent.cta?.primary ||
        (typeof swipeContent.cta === 'string' ? swipeContent.cta : null) ||
        'Get Started Now',
        200
      ),
      ctaUrl: '#order'
    },

    // Reactions section - use real API data with meaningful fallbacks
    reactions: {
      title: sanitizeTextContent(swipeContent.reactions?.title || 'What People Are Saying', 50),
      r1: {
        text: sanitizeTextContent(swipeContent.reactions?.r1?.text || 'This really works! I\'ve seen amazing results.', 200),
        name: sanitizeTextContent(swipeContent.reactions?.r1?.name || 'Sarah M.', 20),
        image: sanitizeUrl(swipeContent.reactions?.r1?.avatar || swipeContent.reactions?.r1?.image || 'https://placehold.co/40x40?text=SM'),
        likes: swipeContent.reactions?.r1?.likes || '12',
        time: sanitizeTextContent(swipeContent.reactions?.r1?.time || '2h', 20),
        reply: 'Reply' // Not in API, keep default
      },
      r2: {
        text: sanitizeTextContent(swipeContent.reactions?.r2?.text || 'Highly recommend this to anyone struggling with this issue.', 200),
        name: sanitizeTextContent(swipeContent.reactions?.r2?.name || 'Mike R.', 20),
        image: sanitizeUrl(swipeContent.reactions?.r2?.avatar || swipeContent.reactions?.r2?.image || 'https://placehold.co/40x40?text=MR'),
        likes: swipeContent.reactions?.r2?.likes || '8',
        time: sanitizeTextContent(swipeContent.reactions?.r2?.time || '4h', 20),
        reply: 'Reply' // Not in API, keep default
      },
      r3: {
        text: sanitizeTextContent(swipeContent.reactions?.r3?.text || 'Finally found something that actually works for me.', 200),
        name: sanitizeTextContent(swipeContent.reactions?.r3?.name || 'Jennifer L.', 20),
        image: sanitizeUrl(swipeContent.reactions?.r3?.avatar || swipeContent.reactions?.r3?.image || 'https://placehold.co/40x40?text=JL'),
        likes: swipeContent.reactions?.r3?.likes || '15',
        time: sanitizeTextContent(swipeContent.reactions?.r3?.time || '6h', 20),
        reply: 'Reply' // Not in API, keep default
      },
      r4: {
        text: sanitizeTextContent(swipeContent.reactions?.r4?.text || 'Worth every penny. Life-changing results!', 200),
        name: sanitizeTextContent(swipeContent.reactions?.r4?.name || 'David K.', 20),
        image: sanitizeUrl(swipeContent.reactions?.r4?.avatar || swipeContent.reactions?.r4?.image || 'https://placehold.co/40x40?text=DK'),
        likes: swipeContent.reactions?.r4?.likes || '20',
        time: sanitizeTextContent(swipeContent.reactions?.r4?.time || '1d', 20),
        reply: 'Reply' // Not in API, keep default
      }
    },

    // Footer section - use real API data with meaningful fallbacks
    footer: {
      copyright: sanitizeTextContent(swipeContent.footer?.copyright || '© 2024 All Rights Reserved', 100),
      disclaimer: sanitizeTextContent((() => {
        const apiDisclaimer = swipeContent.footer?.disclaimer || 'Results may vary. Consult your healthcare provider.'
        // Limit disclaimer to reasonable length and only show once
        if (apiDisclaimer.length > 200) {
          return 'Results may vary. Individual results are not guaranteed. Consult your healthcare provider.'
        }
        return apiDisclaimer
      })(), 200),
      contactUrl: '#', // Not in API, keep default
      privacyUrl: '#', // Not in API, keep default
      termsUrl: '#', // Not in API, keep default
      cookieUrl: '#' // Not in API, keep default
    },

    // Brands section - not in API, keep defaults with descriptive fallback images
    brands: {
      brand1: {
        name: sanitizeTextContent('Trusted Partner', 50),
        logo: sanitizeUrl('https://placehold.co/100x50?text=Brand+Logo')
      }
    },

    // Product section - not in API, keep defaults with descriptive fallback images
    product: {
      name: sanitizeTextContent('Premium Solution', 50),
      image: sanitizeUrl('https://placehold.co/400x400?text=Product+Image')
    },

    // Guarantee section - not in API, keep defaults with descriptive fallback images
    guarantee: {
      badge: sanitizeUrl('https://placehold.co/80x80?text=Guarantee+Badge')
    },

    // Assurances section - use real API data with meaningful fallback
    assurances: {
      blurb: sanitizeBodyContent(swipeContent.assurances?.blurb || 'Backed by our satisfaction guarantee', 1000)
    },

    // Shipping section - not in API, keep defaults
    shipping: {
      threshold: sanitizeTextContent('Free shipping on orders over $50', 50)
    },

    // Info section - not in API, keep defaults with descriptive fallback images
    info: {
      icon: sanitizeUrl('https://placehold.co/20x20?text=Info+Icon')
    },

    // Reviews section - not in API, keep defaults
    reviews: {
      url: '#'
    }
  }

  return content
}

// Extract content data from DeepCopy results (fallback function)
export function extractContentFromResults(results: any): ContentData {
  // Extract rich content from the API response
  const summary = results.summary || ''
  const offerBrief = results.offer_brief || ''
  const avatarSheet = results.avatar_sheet ? JSON.parse(results.avatar_sheet) : {}
  const swipeResults = results.swipe_results || []
  const deepResearch = results.deep_research_output || ''

  // Process all swipe results to get diverse content
  const allListicles: any[] = []
  const allAngles: string[] = []

  swipeResults.forEach((swipe: any, index: number) => {
    if (swipe.content) {
      try {
        const swipeContent = JSON.parse(swipe.content)
        allAngles.push(swipe.angle || `Angle ${index + 1}`)
        if (swipeContent.listicles) {
          allListicles.push(...swipeContent.listicles)
        }
      } catch (e) {
      }
    }
  })

  // Get the first swipe result for main content structure
  const firstSwipe = swipeResults[0] || {}
  const swipeContent = firstSwipe.content ? JSON.parse(firstSwipe.content) : {}


  // Extract key information
  const projectName = results.project_name || 'Nerve Relief™'
  const productName = swipeContent.title || projectName

  // Create rich content from API data
  // Use different angles for variety - mix content from different swipe results
  const heroAngle = swipeResults[1] || swipeResults[0] || {} // Use second angle for hero if available
  const heroContent = heroAngle.content ? JSON.parse(heroAngle.content) : swipeContent

  const content: ContentData = {
    hero: {
      headline: sanitizeTextContent(heroContent.title || swipeContent.title || productName || 'Finally — real relief for nerve pain', 100),
      subheadline: sanitizeTextContent(heroContent.summary || swipeContent.summary || 'Pharmaceutical-grade transdermal magnesium that targets damaged nerves. Try risk-free for 90 days.', 200),
      image: sanitizeUrl(heroContent.hero?.image || swipeContent.hero?.image || 'https://placehold.co/600x400?text=Hero+Image'),
      imageAlt: sanitizeTextContent(heroContent.hero?.imageAlt || swipeContent.hero?.imageAlt || 'Hero Image', 50)
    },
    author: {
      name: swipeContent.author || 'Nerve Relief Content Team',
      image: 'https://placehold.co/100x100?text=Author',
      date: new Date().toLocaleDateString(),
      verifiedIcon: 'https://placehold.co/20x20?text=✓'
    },
    topbar: {
      label: 'LIMITED TIME OFFER - 50% OFF TODAY ONLY!',
      image: 'https://placehold.co/50x50?text=Icon'
    },
    alert: {
      banner: 'Hurry! Only 47 left in stock. Order now before it\'s too late!'
    },
    breadcrumbs: {
      text: 'Home > Health > Products > Featured'
    },
    story: {
      intro: summary.substring(0, 200) + '...' || 'Here\'s what happened when I tried this revolutionary product...'
    },
    section1: {
      title: allListicles[0]?.title || 'Tangible value: just $1.30/day for consistent relief',
      body: allListicles[0]?.description || 'Make the math obvious: Best Value — $39/kit on a monthly auto‑ship = $39 ÷ 30 ≈ $1.30/day. Use microcopy like "From $1.30/day with monthly auto‑ship" to help buyers compare to Rx co‑pays or OTC cycling costs.',
      image: 'https://placehold.co/600x400?text=Value+Math',
      imageAlt: 'Per-day cost calculation'
    },
    section2: {
      title: allListicles[1]?.title || 'Risk‑free trial + proven social proof',
      body: allListicles[1]?.description || 'Pair the per‑day math with trust: "4.8/5 — from 4,219 reviews • 90‑day money‑back." That combo makes trying at $1.30/day feel low‑stakes.',
      image: 'https://placehold.co/600x400?text=Reviews+Guarantee',
      imageAlt: 'Customer reviews and guarantee'
    },
    section3: {
      title: allListicles[2]?.title || 'Subscription mechanics are transparent and simple',
      body: allListicles[2]?.description || 'Cost‑conscious buyers want clear billing rules. Use exact microcopy: "Billed monthly. First charge occurs at purchase. Ships automatically. Skip or cancel anytime from your account or via support."',
      image: 'https://placehold.co/600x400?text=Subscription+Terms',
      imageAlt: 'Transparent subscription terms'
    },
    section4: {
      title: allListicles[3]?.title || 'Pharmaceutical‑grade ingredients that target damaged nerves',
      body: allListicles[3]?.description || 'Short, confident explanation of the mechanism: "Pharmaceutical‑grade transdermal magnesium + MSM + arnica + B6 — a topical \'repair kit for frayed wiring\' that helps nourish damaged peripheral nerves."',
      image: 'https://placehold.co/600x400?text=Ingredients',
      imageAlt: 'Pharmaceutical-grade ingredients'
    },
    section5: {
      title: allListicles[4]?.title || 'Fast‑absorbing, non‑greasy formula — fits into daily routines',
      body: allListicles[4]?.description || 'Address use/feel and timelines: "Fast‑absorbing, non‑greasy; many users report calmer symptoms within days — results vary." Add a 2‑step usage microcopy near product images.',
      image: 'https://placehold.co/600x400?text=Easy+Application',
      imageAlt: 'Easy daily application'
    },
    section6: {
      title: allListicles[5]?.title || 'Better value than prescriptions and many OTC options',
      body: allListicles[5]?.description || 'Frame savings with per‑day math: compare typical Rx co‑pays or monthly OTC spending to $1.30/day. Example microcopy: "At $1.30/day, you\'re paying less than a daily coffee and far less than recurring prescription costs."',
      image: 'https://placehold.co/600x400?text=Value+Comparison',
      imageAlt: 'Value comparison chart'
    },
    section7: {
      title: allListicles[6]?.title || 'Clear plan choices with exact savings shown',
      body: allListicles[6]?.description || 'Three‑column price card copy you can drop in: Best Value: "$39/kit — Monthly — Save 13% — Price Lock & Free Shipping." Popular: "$42/kit — 3‑Month Pack — Flexible Delivery." One‑Time: "$45 — Single Kit — No Commitment."',
      image: 'https://placehold.co/600x400?text=Pricing+Plans',
      imageAlt: 'Pricing plan comparison'
    },
    section8: {
      title: allListicles[7]?.title || 'Objections handled in short, factual rebuttals',
      body: allListicles[7]?.description || 'Use crisp copy for common doubts: Hidden subscriptions → "Cancel or pause anytime — no penalties. Clear billing and shipping dates in your account." Efficacy vs OTC → "Pharmaceutical‑grade ingredients + targeted delivery — designed to reach damaged nerve sites."',
      image: 'https://placehold.co/600x400?text=FAQ+Answers',
      imageAlt: 'Common objections answered'
    },
    section9: {
      title: allListicles[8]?.title || 'UX priorities that reduce friction and build trust',
      body: allListicles[8]?.description || 'Place per‑day math, starline, and guarantee in the hero: e.g., Headline: "Finally — real relief for nerve pain." Sub: "From $1.30/day • 4.8/5 from 4,219 reviews • 90‑day money‑back."',
      image: 'https://placehold.co/600x400?text=Trust+Signals',
      imageAlt: 'Trust signals and guarantees'
    },
    section10: {
      title: allListicles[9]?.title || 'A/B tests and metrics to prioritize (quick wins)',
      body: allListicles[9]?.description || 'High‑impact tests: Hero per‑day math vs standard hero — metric: subscription attach rate. "How to cancel" link in checkout vs none — metric: checkout conversion. Customer quote near CTA vs lower on page — metric: session‑to‑purchase.',
      image: 'https://placehold.co/600x400?text=Testing+Metrics',
      imageAlt: 'A/B testing and metrics'
    },
    section11: {
      title: allListicles[10]?.title || 'What Our Customers Are Saying',
      body: allListicles[10]?.description || 'Real customer testimonials from our 4,219+ reviews: "This cream really helped my nerve pain after just a few days." "Love the fast absorption with no greasy feel." "Good value compared to prescriptions that just didn\'t work."',
      image: 'https://placehold.co/600x400?text=Customer+Testimonials',
      imageAlt: 'Happy customer testimonials'
    },
    section12: {
      title: allListicles[11]?.title || 'Try Nerve Relief™ Risk-Free Today',
      body: allListicles[11]?.description || 'Join 90,000+ satisfied users who trust Nerve Relief™ for their nerve pain management. With our 90-day money-back guarantee, you have nothing to lose and everything to gain.',
      image: 'https://placehold.co/600x400?text=Call+To+Action',
      imageAlt: 'Risk-free trial offer'
    },
    cta: {
      primary: heroContent.cta || swipeContent.cta || 'Try Nerve Relief™ Risk-Free — From $1.30/day. Subscribe & Save 13% — Cancel Anytime',
      primaryUrl: '#order',
      secondary: 'Join 90,000+ satisfied users who trust Nerve Relief™',
      secondaryUrl: '#learn'
    },
    sidebar: {
      ctaHeadline: '4.8/5 from 4,219 reviews • 90-day money-back',
      ctaButton: 'Subscribe & Save 13% — Cancel Anytime',
      ctaUrl: '#order',
      productImage: 'https://placehold.co/300x300?text=Product+Image',
      ratingImage: 'https://placehold.co/20x20?text=★'
    },
    sticky: {
      cta: 'Try Risk-Free for 90 Days',
      ctaUrl: '#order'
    },
    reactions: {
      title: 'What Our Customers Are Saying',
      r1: {
        name: 'Sarah M.',
        text: 'This cream really helped my nerve pain after just a few days.',
        time: '2 hours ago',
        likes: '24',
        image: 'https://placehold.co/40x40?text=SM',
        reply: 'Reply'
      },
      r2: {
        name: 'Mike R.',
        text: 'Love the fast absorption with no greasy feel.',
        time: '5 hours ago',
        likes: '18',
        image: 'https://placehold.co/40x40?text=MR',
        reply: 'Reply'
      },
      r3: {
        name: 'Jennifer L.',
        text: 'Good value compared to prescriptions that just didn\'t work.',
        time: '1 day ago',
        likes: '31',
        image: 'https://placehold.co/40x40?text=JL',
        reply: 'Reply'
      },
      r4: {
        name: 'David K.',
        text: 'Worth every penny. Life-changing results!',
        time: '1d',
        likes: '20',
        image: 'https://placehold.co/40x40?text=DK',
        reply: 'Reply'
      }
    },
    brands: {
      brand1: {
        name: 'Nerve Relief™',
        logo: 'https://placehold.co/120x40?text=Nerve+Relief'
      }
    },
    guarantee: {
      badge: 'https://placehold.co/80x80?text=90+Day'
    },
    assurances: {
      blurb: 'Try it risk-free for 90 days. If you\'re not completely satisfied, contact support for a full refund — no hoops.'
    },
    footer: {
      copyright: '© 2024 Nerve Relief™. All rights reserved.',
      disclaimer: 'Results may vary. Individual results are not guaranteed. This product is not intended to diagnose, treat, cure, or prevent any disease.',
      contactUrl: '#',
      privacyUrl: '#',
      termsUrl: '#',
      cookieUrl: '#'
    },
    shipping: {
      threshold: 'Free shipping on subscriptions'
    },
    product: {
      name: 'Nerve Relief™',
      image: 'https://placehold.co/400x400?text=Product+Image'
    },
    info: {
      icon: 'https://placehold.co/20x20?text=Info+Icon'
    },
    reviews: {
      url: '#'
    }
  }

  return content
}

// Comprehensive deduplication function to remove ALL duplicate content
function removeDuplicateContent(htmlContent: string, content: ContentData): string {
  // Get all content values that might appear multiple times
  const contentValues = [
    content.hero.headline,
    content.hero.subheadline,
    content.cta.primary,
    content.cta.primaryUrl,
    content.footer.disclaimer,
    content.footer.copyright,
    content.assurances.blurb,
    content.guarantee.badge,
    content.sticky.cta,
    content.reactions.title,
    content.brands.brand1.name,
    content.product.name
  ].filter(value => value && value.length > 10) // Only check meaningful content

  // Remove duplicates for each content value
  for (const value of contentValues) {
    if (value && value.length > 10) {
      const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escapedValue, 'g')
      const matches = htmlContent.match(regex)

      if (matches && matches.length > 1) {
        // Replace all occurrences with the first one, then remove duplicates
        htmlContent = htmlContent.replace(regex, value)

        // Split by the value and deduplicate sections
        const sections = htmlContent.split(value)
        const uniqueSections = sections.filter((section, index, arr) =>
          arr.indexOf(section) === index || section.trim() !== ''
        )
        htmlContent = uniqueSections.join(value)
      }
    }
  }

  // Special handling for long disclaimers - always use short version
  const longDisclaimerPatterns = [
    /Legal notice:[\s\S]*?Merit Relief[\s\S]*?(?=Legal notice:|$)/g,
    /Results may vary[\s\S]*?senior concerns\./g,
    /This product is not intended to diagnose[\s\S]*?healthcare provider\./g
  ]

  for (const pattern of longDisclaimerPatterns) {
    const matches = htmlContent.match(pattern)
    if (matches && matches.length > 1) {
      // Replace all long disclaimers with a single short one
      const shortDisclaimer = 'Results may vary. Individual results are not guaranteed. Consult your healthcare provider.'
      htmlContent = htmlContent.replace(pattern, shortDisclaimer)

      // Remove duplicate short disclaimers
      const shortDisclaimerRegex = new RegExp(shortDisclaimer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      const shortMatches = htmlContent.match(shortDisclaimerRegex)
      if (shortMatches && shortMatches.length > 1) {
        htmlContent = htmlContent.replace(shortDisclaimerRegex, shortDisclaimer)
        const sections = htmlContent.split(shortDisclaimer)
        const uniqueSections = sections.filter((section, index, arr) =>
          arr.indexOf(section) === index || section.trim() !== ''
        )
        htmlContent = uniqueSections.join(shortDisclaimer)
      }
    }
  }

  // Remove duplicate paragraphs/sections that are identical
  const paragraphRegex = /<p[^>]*>[\s\S]*?<\/p>/g
  const paragraphs = htmlContent.match(paragraphRegex) || []
  const uniqueParagraphs = [...new Set(paragraphs)]

  if (paragraphs.length !== uniqueParagraphs.length) {
    // Rebuild content with unique paragraphs only
    let newContent = htmlContent
    for (const paragraph of paragraphs) {
      if (paragraphs.filter(p => p === paragraph).length > 1) {
        // This paragraph appears multiple times, keep only the first occurrence
        const escapedParagraph = paragraph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const paragraphRegex = new RegExp(escapedParagraph, 'g')
        const matches = newContent.match(paragraphRegex)
        if (matches && matches.length > 1) {
          newContent = newContent.replace(paragraphRegex, paragraph)
          const sections = newContent.split(paragraph)
          const uniqueSections = sections.filter((section, index, arr) =>
            arr.indexOf(section) === index || section.trim() !== ''
          )
          newContent = uniqueSections.join(paragraph)
        }
      }
    }
    htmlContent = newContent
  }

  return htmlContent
}

// Helper function to get a value from a nested object using dot notation path
function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.')
  let current = obj
  
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = current[key]
  }
  
  return current
}

// Helper function to convert a value to string safely
function valueToString(value: any): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    // For arrays, join with comma or return first element as string
    return value.map(v => valueToString(v)).join(', ')
  }
  if (typeof value === 'object') {
    // For objects, try to stringify or return empty
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }
  return ''
}

export function injectContentIntoTemplate(template: InjectableTemplate, content: ContentData): string {
  try {
    let htmlContent = template.html_content

    // Validate template has content
    if (!htmlContent || htmlContent.trim().length === 0) {
      return createFallbackTemplate(content)
    }

    // STEP 1: Find ALL placeholders in the template using regex
    // This makes the system future-proof - it will handle any placeholder the template uses
    const placeholderRegex = /\{\{content\.([^}]+)\}\}/g
    const foundPlaceholders = new Set<string>()
    let match
    
    while ((match = placeholderRegex.exec(htmlContent)) !== null) {
      foundPlaceholders.add(match[1]) // match[1] is the field path (e.g., "sidebar.title")
    }
    
    // STEP 2: Build replacements dynamically based on what's in the template AND what's in the content
    // This approach ensures we only inject fields that:
    // 1. Exist in the template (found via regex)
    // 2. Exist in the content object (from API response)
    const replacements: { [key: string]: string } = {}
    
    for (const fieldPath of foundPlaceholders) {
      const placeholder = `{{content.${fieldPath}}}`
      
      // Check if this field exists in the content object
      const value = getNestedValue(content, fieldPath)
      
      if (value !== undefined && value !== null) {
        // Field exists - convert to string and add to replacements
        // Content is already sanitized from extractContentFromSwipeResult
        const stringValue = valueToString(value)
        replacements[placeholder] = stringValue
      } else {
        // Field doesn't exist in content - replace with empty string for cleaner output
        // This prevents placeholders from appearing in the final HTML
        replacements[placeholder] = ''
      }
    }
    
    // STEP 3: Apply all replacements
    for (const [placeholder, value] of Object.entries(replacements)) {
      // Escape special regex characters in placeholder
      const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      htmlContent = htmlContent.replace(new RegExp(escapedPlaceholder, 'g'), value)
    }

    // Comprehensive deduplication - remove ALL duplicate content
    htmlContent = removeDuplicateContent(htmlContent, content)

    // Additional aggressive deduplication
    htmlContent = aggressiveDeduplication(htmlContent)


    // Add image fallback handling to prevent broken image symbols
    htmlContent = addImageFallbacks(htmlContent)

    // Add CSS to hide broken images gracefully
    htmlContent = addBrokenImageCSS(htmlContent)

    // Add JavaScript to handle broken images dynamically
    htmlContent = addBrokenImageJS(htmlContent)

    // Disable all clickable links to prevent navigation
    htmlContent = disableAllLinks(htmlContent)

    return htmlContent

  } catch (error) {
    return createFallbackTemplate(content)
  }
}

// Create a fallback template when injection fails
function createFallbackTemplate(content: ContentData): string {

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${content.hero.headline}</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      line-height: 1.6; 
      margin: 0; 
      padding: 20px; 
      background: #f5f5f5;
    }
    .container { 
      max-width: 800px; 
      margin: 0 auto; 
      background: white; 
      padding: 40px; 
      border-radius: 8px; 
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .hero { 
      text-align: center; 
      margin-bottom: 40px; 
      padding: 40px 0; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 8px;
    }
    .hero h1 { 
      font-size: 2.5rem; 
      margin-bottom: 20px; 
      font-weight: 700;
    }
    .hero p { 
      font-size: 1.2rem; 
      opacity: 0.9;
    }
    .section { 
      margin: 30px 0; 
      padding: 20px; 
      border-left: 4px solid #667eea;
      background: #f8f9fa;
    }
    .section h2 { 
      color: #333; 
      margin-bottom: 15px; 
      font-size: 1.5rem;
    }
    .cta { 
      text-align: center; 
      margin: 40px 0; 
      padding: 30px; 
      background: #28a745; 
      color: white; 
      border-radius: 8px;
    }
    .cta button { 
      background: white; 
      color: #28a745; 
      border: none; 
      padding: 15px 30px; 
      font-size: 1.1rem; 
      border-radius: 25px; 
      cursor: pointer; 
      font-weight: 600;
    }
    .footer { 
      text-align: center; 
      margin-top: 40px; 
      padding: 20px; 
      color: #666; 
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      <h1>${content.hero.headline}</h1>
      <p>${content.hero.subheadline}</p>
    </div>
    
    <div class="section">
      <h2>${content.section1.title}</h2>
      <p>${content.section1.body}</p>
    </div>
    
    <div class="section">
      <h2>${content.section2.title}</h2>
      <p>${content.section2.body}</p>
    </div>
    
    <div class="section">
      <h2>${content.section3.title}</h2>
      <p>${content.section3.body}</p>
    </div>
    
    <div class="cta">
      <h2>Ready to Get Started?</h2>
      <p>${content.cta.primary}</p>
      <button>${content.cta.primary}</button>
    </div>
    
    <div class="footer">
      <p>${content.footer.copyright}</p>
      <p>${content.footer.disclaimer}</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

// Refined deduplication function to remove duplicates while preserving HTML structure
function aggressiveDeduplication(htmlContent: string): string {

  let cleanedContent = htmlContent

  // 1. Remove duplicate legal notices/disclaimers (most common issue)
  const disclaimerPatterns = [
    /Legal notice:[\s\S]*?senior concerns\./g,
    /Results may vary[\s\S]*?healthcare provider\./g,
    /This product is not intended to diagnose[\s\S]*?healthcare provider\./g,
    /Individual results vary[\s\S]*?senior concerns\./g,
    /Merit Relief is an over[\s\S]*?senior concerns\./g,
    /The statements on this page[\s\S]*?senior concerns\./g,
    /The Mineral Delivery System[\s\S]*?complete details\./g
  ]

  for (const pattern of disclaimerPatterns) {
    const matches = cleanedContent.match(pattern)
    if (matches && matches.length > 1) {
      // Keep only the first occurrence
      cleanedContent = cleanedContent.replace(pattern, (match, offset) => {
        return offset === cleanedContent.indexOf(match) ? match : ''
      })
    }
  }

  // 2. Remove duplicate CTAs (only exact text matches, not HTML structure)
  const ctaPatterns = [
    /Try Merit Relief.*?Today/gi,
    /Get Started Now/gi,
    /Order Now/gi,
    /Limited.*?trial/gi,
    /Risk.*?Free/gi
  ]

  for (const pattern of ctaPatterns) {
    const matches = cleanedContent.match(pattern)
    if (matches && matches.length > 1) {
      // Keep only the first occurrence
      cleanedContent = cleanedContent.replace(pattern, (match, offset) => {
        return offset === cleanedContent.indexOf(match) ? match : ''
      })
    }
  }

  // 3. Remove duplicate text content only (preserve HTML structure)
  const textContentPattern = /<[^>]*>([^<]*)<\/[^>]*>/g
  const textMatches = [...cleanedContent.matchAll(textContentPattern)]
  const seenText = new Set()

  for (const match of textMatches) {
    const text = match[1].trim()
    if (text.length > 20) { // Only check meaningful text
      const normalized = text.toLowerCase().replace(/\s+/g, ' ')
      if (seenText.has(normalized)) {
        // This text content appears multiple times, remove duplicates
        const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const textRegex = new RegExp(`<[^>]*>${escapedText}<\/[^>]*>`, 'g')
        const allMatches = cleanedContent.match(textRegex) || []
        if (allMatches.length > 1) {
          cleanedContent = cleanedContent.replace(textRegex, (textMatch, offset) => {
            return offset === cleanedContent.indexOf(textMatch) ? textMatch : ''
          })
        }
      } else {
        seenText.add(normalized)
      }
    }
  }

  // 4. Remove duplicate buttons/CTAs in HTML (preserve structure)
  const buttonPattern = /<button[^>]*>.*?<\/button>/gi
  const buttons = cleanedContent.match(buttonPattern) || []
  const uniqueButtons = [...new Set(buttons)]

  if (buttons.length !== uniqueButtons.length) {
    // Keep only unique buttons
    let newContent = cleanedContent
    for (const button of buttons) {
      if (buttons.filter(b => b === button).length > 1) {
        // This button appears multiple times, keep only the first occurrence
        const escapedButton = button.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const buttonRegex = new RegExp(escapedButton, 'g')
        newContent = newContent.replace(buttonRegex, button)
      }
    }
    cleanedContent = newContent
  }

  return cleanedContent
}


// Create appropriate fallback image URL based on context
function createFallbackImageUrl(altText: string, originalSrc: string): string {
  // Determine image type and dimensions based on context
  let dimensions = '600x400'
  let text = altText || 'Image'

  // Adjust dimensions based on image context
  if (altText.toLowerCase().includes('avatar') || altText.toLowerCase().includes('profile')) {
    dimensions = '100x100'
    text = 'Avatar'
  } else if (altText.toLowerCase().includes('icon') || altText.toLowerCase().includes('logo')) {
    dimensions = '50x50'
    text = 'Icon'
  } else if (altText.toLowerCase().includes('thumbnail') || altText.toLowerCase().includes('small')) {
    dimensions = '200x150'
    text = 'Thumbnail'
  } else if (altText.toLowerCase().includes('banner') || altText.toLowerCase().includes('hero')) {
    dimensions = '800x400'
    text = 'Banner'
  } else if (altText.toLowerCase().includes('rating') || altText.toLowerCase().includes('star')) {
    dimensions = '20x20'
    text = '★'
  }

  // Clean up text for URL
  text = text.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 20)

  return `https://placehold.co/${dimensions}?text=${encodeURIComponent(text)}`
}

// Add image fallback handling to prevent broken image symbols
function addImageFallbacks(htmlContent: string): string {

  // Replace all <img> tags with versions that have onerror fallbacks
  htmlContent = htmlContent.replace(
    /<img([^>]*?)\s+src\s*=\s*["']([^"']*)["']([^>]*?)>/gi,
    (match, beforeSrc, src, afterSrc) => {
      // Check if onerror is already present
      if (match.includes('onerror=')) {
        return match
      }

      // Extract alt text if present
      const altMatch = match.match(/alt\s*=\s*["']([^"']*)["']/i)
      const altText = altMatch ? altMatch[1] : 'Image'

      // Create fallback image URL with descriptive text and appropriate dimensions
      const fallbackUrl = createFallbackImageUrl(altText, src)

      // Check if style is already present
      if (match.includes('style=')) {
        return match.replace('>', ` onerror="this.src='${fallbackUrl}'; this.onerror=null;">`)
      } else {
        return `<img${beforeSrc} src="${src}"${afterSrc} onerror="this.src='${fallbackUrl}'; this.onerror=null;" style="object-fit: cover;">`
      }
    }
  )

  // Also handle img tags without explicit src attributes (in case of template placeholders)
  htmlContent = htmlContent.replace(
    /<img([^>]*?)>/gi,
    (match, attributes) => {
      // Check if onerror is already handled
      if (match.includes('onerror=')) {
        return match
      }

      // Extract src if present
      const srcMatch = match.match(/src\s*=\s*["']([^"']*)["']/i)
      const src = srcMatch ? srcMatch[1] : ''

      // Extract alt text
      const altMatch = match.match(/alt\s*=\s*["']([^"']*)["']/i)
      const altText = altMatch ? altMatch[1] : 'Image'

      // Create fallback image URL
      const fallbackUrl = createFallbackImageUrl(altText, src)

      // Add onerror handler without overriding existing styles
      if (match.includes('style=')) {
        return match.replace('>', ` onerror="this.src='${fallbackUrl}'; this.onerror=null;">`)
      } else {
        return match.replace('>', ` onerror="this.src='${fallbackUrl}'; this.onerror=null;" style="object-fit: cover;">`)
      }
    }
  )

  return htmlContent
}

// Add CSS to hide broken images gracefully
function addBrokenImageCSS(htmlContent: string): string {

  // CSS to hide broken images and provide graceful fallbacks
  const brokenImageCSS = `
    <style>
      /* Hide broken images completely */
      img:not([src]), 
      img[src=""], 
      img[src*="undefined"], 
      img[src*="null"] {
        display: none !important;
      }
      
      /* Style for fallback images */
      img[src*="placehold.co"] {
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        background-color: #f9fafb;
      }
      
      /* Ensure images don't break layout when they fail */
      img {
        max-width: 100%;
        height: auto;
        object-fit: cover;
      }
      
      /* Hide any remaining broken image symbols */
      img::before {
        content: "";
        display: none;
      }
    </style>
  `

  // Insert CSS into the head section
  if (htmlContent.includes('<head>')) {
    htmlContent = htmlContent.replace('<head>', `<head>${brokenImageCSS}`)
  } else if (htmlContent.includes('<html>')) {
    htmlContent = htmlContent.replace('<html>', `<html>${brokenImageCSS}`)
  } else {
    // If no head tag, add CSS at the beginning
    htmlContent = `${brokenImageCSS}${htmlContent}`
  }

  return htmlContent
}

// Add JavaScript to handle broken images dynamically
function addBrokenImageJS(htmlContent: string): string {

  // JavaScript to handle broken images dynamically
  const brokenImageJS = `
      <script>
      (function() {
        // Function to create fallback image
        function createFallbackImage(altText, originalSrc) {
          let dimensions = '600x400';
          let text = altText || 'Image';
          
          // Adjust dimensions based on context
          if (altText && altText.toLowerCase().includes('avatar')) {
            dimensions = '100x100';
            text = 'Avatar';
          } else if (altText && altText.toLowerCase().includes('icon')) {
            dimensions = '50x50';
            text = 'Icon';
          } else if (altText && altText.toLowerCase().includes('rating')) {
            dimensions = '20x20';
            text = '★';
          }
          
          text = text.replace(/[^a-zA-Z0-9\\s]/g, '').substring(0, 20);
          return 'https://placehold.co/' + dimensions + '?text=' + encodeURIComponent(text);
        }
        
        // Handle broken images when page loads
        function handleBrokenImages() {
          const images = document.querySelectorAll('img');
          images.forEach(function(img) {
            // Check if image is broken
            if (img.naturalWidth === 0 || img.complete === false) {
              const altText = img.alt || 'Image';
              const fallbackUrl = createFallbackImage(altText, img.src);
              img.src = fallbackUrl;
              img.style.objectFit = 'cover';
            }
            
            // Add error handler for future failures
            img.addEventListener('error', function() {
              const altText = this.alt || 'Image';
              const fallbackUrl = createFallbackImage(altText, this.src);
              this.src = fallbackUrl;
              this.style.objectFit = 'cover';
            });
          });
        }
        
        // Run when DOM is ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', handleBrokenImages);
  } else {
          handleBrokenImages();
        }
        
        // Also run after a short delay to catch any late-loading images
        setTimeout(handleBrokenImages, 1000);
      })();
      </script>
    `

  // Insert JavaScript before closing body tag or at the end
  if (htmlContent.includes('</body>')) {
    htmlContent = htmlContent.replace('</body>', `${brokenImageJS}</body>`)
  } else if (htmlContent.includes('</html>')) {
    htmlContent = htmlContent.replace('</html>', `${brokenImageJS}</html>`)
  } else {
    // If no body tag, add script at the end
    htmlContent = `${htmlContent}${brokenImageJS}`
  }

  return htmlContent
}

// Disable all clickable links to prevent navigation
function disableAllLinks(htmlContent: string): string {

  // Remove all href attributes from <a> tags
  htmlContent = htmlContent.replace(/<a([^>]*)\s+href\s*=\s*["'][^"']*["']([^>]*)>/gi, '<a$1$2>')

  // Remove all onclick attributes
  htmlContent = htmlContent.replace(/\s+onclick\s*=\s*["'][^"']*["']/gi, '')

  // Remove all onmousedown attributes
  htmlContent = htmlContent.replace(/\s+onmousedown\s*=\s*["'][^"']*["']/gi, '')

  // Remove all onmouseup attributes
  htmlContent = htmlContent.replace(/\s+onmouseup\s*=\s*["'][^"']*["']/gi, '')

  // Add pointer-events: none to all links via inline styles (only if no existing style attribute)
  htmlContent = htmlContent.replace(/<a([^>]*?)(?:\s+style\s*=\s*["'][^"']*["'])?([^>]*)>/gi, (match, before, after) => {
    if (match.includes('style=')) {
      // If style already exists, add to it
      return match.replace(/style\s*=\s*["']([^"']*)["']/, 'style="$1; pointer-events: none; cursor: default;"')
    } else {
      // Add new style attribute
      return `<a${before}${after} style="pointer-events: none; cursor: default;">`
    }
  })

  // Also disable buttons that might have click handlers (only if no existing style attribute)
  htmlContent = htmlContent.replace(/<button([^>]*?)(?:\s+style\s*=\s*["'][^"']*["'])?([^>]*)>/gi, (match, before, after) => {
    if (match.includes('style=')) {
      // If style already exists, add to it
      return match.replace(/style\s*=\s*["']([^"']*)["']/, 'style="$1; pointer-events: none; cursor: default;"')
    } else {
      // Add new style attribute
      return `<button${before}${after} style="pointer-events: none; cursor: default;">`
    }
  })

  return htmlContent
}

function createCarouselHtml(templates: Array<{ angle: string, html: string }>): string {

  if (templates.length === 0) {
    return '<div>No templates available</div>'
  }

  if (templates.length === 1) {
    return templates[0].html
  }

  const carouselId = `carousel-${Date.now()}`

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Marketing Angles - Template Carousel</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
    }
    
    .carousel-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .carousel-header {
      text-align: center;
      margin-bottom: 30px;
    }
    
    .carousel-title {
      font-size: 2.5rem;
      color: #333;
      margin-bottom: 10px;
    }
    
    .carousel-subtitle {
      color: #666;
      font-size: 1.1rem;
    }
    
    .carousel-nav {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-bottom: 30px;
      flex-wrap: wrap;
    }
    
    .nav-button {
      padding: 12px 24px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 25px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.3s ease;
      white-space: nowrap;
    }
    
    .nav-button:hover {
      background: #0056b3;
      transform: translateY(-2px);
    }
    
    .nav-button.active {
      background: #28a745;
      box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
    }
    
    .carousel-content {
      position: relative;
      min-height: 600px;
    }
    
    .template-slide {
      display: none;
      animation: fadeIn 0.5s ease-in-out;
    }
    
    .template-slide.active {
      display: block;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .template-frame {
      width: 100%;
      height: 80vh;
      border: 2px solid #ddd;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.1);
      background: white;
    }
    
    .template-frame iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
    
    .angle-info {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .angle-title {
      font-size: 1.5rem;
      color: #333;
      margin-bottom: 10px;
    }
    
    .angle-description {
      color: #666;
      line-height: 1.6;
    }
    
    .carousel-controls {
      display: flex;
      justify-content: center;
      gap: 15px;
      margin-top: 20px;
    }
    
    .control-button {
      padding: 10px 20px;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 20px;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.3s ease;
    }
    
    .control-button:hover {
      background: #545b62;
    }
    
    .control-button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    
    @media (max-width: 768px) {
      .carousel-nav {
        flex-direction: column;
        align-items: center;
      }
      
      .nav-button {
        width: 100%;
        max-width: 300px;
      }
      
      .template-frame {
        height: 60vh;
      }
    }
  </style>
</head>
<body>
  <div class="carousel-container">
    <div class="carousel-header">
      <h1 class="carousel-title">Marketing Angles</h1>
      <p class="carousel-subtitle">Choose from ${templates.length} different marketing approaches</p>
    </div>
    
    <div class="carousel-nav" id="nav-${carouselId}">
      ${templates.map((template, index) => `
        <button class="nav-button ${index === 0 ? 'active' : ''}" 
                onclick="showSlide(${carouselId}, ${index})">
          ${template.angle}
        </button>
      `).join('')}
    </div>
    
    <div class="carousel-content">
      ${templates.map((template, index) => `
        <div class="template-slide ${index === 0 ? 'active' : ''}" id="slide-${carouselId}-${index}">
          <div class="angle-info">
            <h2 class="angle-title">${template.angle}</h2>
            <p class="angle-description">This template focuses on the "${template.angle}" marketing approach.</p>
          </div>
          <div class="template-frame">
            <iframe srcdoc="${template.html.replace(/"/g, '&quot;')}"></iframe>
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="carousel-controls">
      <button class="control-button" onclick="previousSlide(${carouselId})" id="prev-${carouselId}">← Previous</button>
      <button class="control-button" onclick="nextSlide(${carouselId})" id="next-${carouselId}">Next →</button>
    </div>
  </div>

  <script>
    let currentSlide = 0;
    const totalSlides = ${templates.length};
    
    function showSlide(carouselId, slideIndex) {
      // Hide all slides
      for (let i = 0; i < totalSlides; i++) {
        const slide = document.getElementById(\`slide-\${carouselId}-\${i}\`);
        const button = document.querySelector(\`#nav-\${carouselId} .nav-button:nth-child(\${i + 1})\`);
        
        if (slide) slide.classList.remove('active');
        if (button) button.classList.remove('active');
      }
      
      // Show selected slide
      const activeSlide = document.getElementById(\`slide-\${carouselId}-\${slideIndex}\`);
      const activeButton = document.querySelector(\`#nav-\${carouselId} .nav-button:nth-child(\${slideIndex + 1})\`);
      
      if (activeSlide) activeSlide.classList.add('active');
      if (activeButton) activeButton.classList.add('active');
      
      currentSlide = slideIndex;
      updateControls(carouselId);
    }
    
    function nextSlide(carouselId) {
      const next = (currentSlide + 1) % totalSlides;
      showSlide(carouselId, next);
    }
    
    function previousSlide(carouselId) {
      const prev = (currentSlide - 1 + totalSlides) % totalSlides;
      showSlide(carouselId, prev);
    }
    
    function updateControls(carouselId) {
      const prevBtn = document.getElementById(\`prev-\${carouselId}\`);
      const nextBtn = document.getElementById(\`next-\${carouselId}\`);
      
      if (prevBtn) prevBtn.disabled = currentSlide === 0;
      if (nextBtn) nextBtn.disabled = currentSlide === totalSlides - 1;
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowLeft') previousSlide(${carouselId});
      if (e.key === 'ArrowRight') nextSlide(${carouselId});
    });
    
    // Initialize
    updateControls(${carouselId});
  </script>
</body>
</html>
  `.trim()
}

export async function processJobResults(
  results: any,
  advertorialType: 'listicle' | 'advertorial',
  getRandomInjectableTemplate: (type: 'listicle' | 'advertorial') => Promise<InjectableTemplate | null>
): Promise<{ templates: Array<{ angle: string, html: string }>, combinedHtml: string }> {
  try {
    // Get a random template for the specified type
    const template = await getRandomInjectableTemplate(advertorialType)

    if (!template) {

      // Create fallback content and return it
      const fallbackContent = extractContentFromResults(results)
      const fallbackHtml = createFallbackTemplate(fallbackContent)

      return {
        templates: [{ angle: 'Fallback', html: fallbackHtml }],
        combinedHtml: fallbackHtml
      }
    }


    // Process each marketing angle separately
    const swipeResults = results.swipe_results || []
    const generatedTemplates: Array<{ angle: string, html: string }> = []

    if (swipeResults.length === 0) {
      // Fallback: generate one template with basic content
      const content = extractContentFromResults(results)
      const finalHtml = injectContentIntoTemplate(template, content)
      return {
        templates: [{ angle: 'Default', html: finalHtml }],
        combinedHtml: finalHtml
      }
    }

    // Generate one HTML file for each marketing angle
    for (let i = 0; i < swipeResults.length; i++) {
      const swipe = swipeResults[i]

      try {
        // Extract content for this specific angle
        const content = extractContentFromAngle(results, swipe, i)

        // Inject content into template
        const angleHtml = injectContentIntoTemplate(template, content)
        generatedTemplates.push({
          angle: swipe.angle || `Angle ${i + 1}`,
          html: angleHtml
        })

      } catch (error) {
        // Continue with other angles even if one fails
      }
    }

    // Ensure we always have at least one template
    if (generatedTemplates.length === 0) {
      const fallbackContent = extractContentFromResults(results)
      const fallbackHtml = createFallbackTemplate(fallbackContent)
      generatedTemplates.push({ angle: 'Fallback', html: fallbackHtml })
    }

    // Create carousel HTML that displays all templates
    const carouselHtml = createCarouselHtml(generatedTemplates)

    return {
      templates: generatedTemplates,
      combinedHtml: carouselHtml
    }

  } catch (error) {

    // Always return a fallback template even on error
    try {
      const fallbackContent = extractContentFromResults(results)
      const fallbackHtml = createFallbackTemplate(fallbackContent)

      return {
        templates: [{ angle: 'Error Fallback', html: fallbackHtml }],
        combinedHtml: fallbackHtml
      }
    } catch (fallbackError) {
      // Last resort - return a basic HTML template
      const basicHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Template Error</title></head>
        <body>
          <h1>Template Generation Error</h1>
          <p>There was an error generating the template. Please try again.</p>
        </body>
        </html>
      `
      return {
        templates: [{ angle: 'Error', html: basicHtml }],
        combinedHtml: basicHtml
      }
    }
  }
}