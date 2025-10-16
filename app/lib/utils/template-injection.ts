import { InjectableTemplate } from '@/lib/db/types'
export interface ContentData {
  hero: {
    headline: string
    subheadline: string
  }
  author: {
    name: string
    image: string
    date: string
  }
  topbar: {
    label: string
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
    secondary: string
    primaryUrl: string
  }
  sidebar: {
    ctaHeadline: string
    ctaButton: string
  }
  sticky: {
    cta: string
  }
  reactions: {
    title: string
    r1: {
      name: string
      text: string
      time: string
      likes: number
    }
    r2: {
      name: string
      text: string
      time: string
      likes: number
    }
    r3: {
      name: string
      text: string
      time: string
      likes: number
    }
  }
  brands: {
    brand1: {
      name: string
      logo: string
    }
  }
  guarantee: {
    badge: string
    text: string
  }
  assurances: {
    blurb: string
  }
  footer: {
    copyright: string
    disclaimer: string
  }
  shipping: {
    threshold: string
  }
  brand: {
    name: string
    logo: string
  }
}

export function extractContentFromAngle(results: any, swipe: any, angleIndex: number): ContentData {
  // Parse the swipe content for this specific angle
  const swipeContent = swipe.content ? JSON.parse(swipe.content) : {}
  const listicles = swipeContent.listicles || []
  
  console.log(`🔍 Extracting content for angle ${angleIndex + 1}: ${swipe.angle}`)
  console.log('- Swipe content:', swipeContent)
  console.log('- Listicles count:', listicles.length)
  console.log('- First listicle:', listicles[0])
  
  // Extract key information
  const projectName = results.project_name || 'Nerve Relief™'
  const productName = swipeContent.title || projectName
  
  // Create content specific to this angle
  const content: ContentData = {
    hero: {
      headline: swipe.angle || swipeContent.title || productName || 'Finally — real relief for nerve pain',
      subheadline: swipeContent.summary || 'Pharmaceutical-grade transdermal magnesium that targets damaged nerves. Try risk-free for 90 days.'
    },
    author: {
      name: swipeContent.author || 'Nerve Relief Content Team',
      image: 'https://placehold.co/100x100?text=Author',
      date: new Date().toLocaleDateString()
    },
    topbar: {
      label: 'LIMITED TIME OFFER - 50% OFF TODAY ONLY!'
    },
    alert: {
      banner: 'Hurry! Only 47 left in stock. Order now before it\'s too late!'
    },
    breadcrumbs: {
      text: 'Home > Health > Products > Featured'
    },
    story: {
      intro: results.summary?.substring(0, 200) + '...' || 'Here\'s what happened when I tried this revolutionary product...'
    },
    section1: {
      title: listicles[0]?.title || 'Reason #1: Revolutionary Technology',
      body: listicles[0]?.description || 'This breakthrough technology has been proven to work...',
      image: 'https://placehold.co/600x400?text=Product+Image',
      imageAlt: 'Product demonstration'
    },
    section2: {
      title: listicles[1]?.title || 'Reason #2: Scientifically Proven',
      body: listicles[1]?.description || 'Clinical studies show amazing results...',
      image: 'https://placehold.co/600x400?text=Product+Image',
      imageAlt: 'Scientific proof'
    },
    section3: {
      title: listicles[2]?.title || 'Reason #3: Easy to Use',
      body: listicles[2]?.description || 'Simply follow these easy steps...',
      image: 'https://placehold.co/600x400?text=Product+Image',
      imageAlt: 'Easy usage'
    },
    section4: {
      title: listicles[3]?.title || 'Reason #4: Money Back Guarantee',
      body: listicles[3]?.description || 'We\'re so confident you\'ll love it...',
      image: 'https://placehold.co/600x400?text=Product+Image',
      imageAlt: 'Guarantee badge'
    },
    section5: {
      title: listicles[4]?.title || 'Reason #5: Thousands of Happy Customers',
      body: listicles[4]?.description || 'See what our customers are saying...',
      image: 'https://placehold.co/600x400?text=Product+Image',
      imageAlt: 'Happy customers'
    },
    section6: {
      title: listicles[5]?.title || swipeContent.section6_title || 'Reason #6: Limited Time Offer',
      body: listicles[5]?.description || swipeContent.section6_body || 'Don\'t miss out on this special deal...',
      image: 'https://placehold.co/600x400?text=Product+Image',
      imageAlt: 'Limited offer'
    },
    section7: {
      title: listicles[6]?.title || swipeContent.section7_title || 'Reason #7: Free Shipping',
      body: listicles[6]?.description || swipeContent.section7_body || 'Get it delivered right to your door...',
      image: 'https://placehold.co/600x400?text=Product+Image',
      imageAlt: 'Free shipping'
    },
    section8: {
      title: listicles[7]?.title || swipeContent.section8_title || 'Reason #8: Premium Quality',
      body: listicles[7]?.description || swipeContent.section8_body || 'Made with the finest materials...',
      image: 'https://placehold.co/600x400?text=Product+Image',
      imageAlt: 'Premium quality'
    },
    section9: {
      title: listicles[8]?.title || swipeContent.section9_title || 'Reason #9: Doctor Recommended',
      body: listicles[8]?.description || swipeContent.section9_body || 'Trusted by healthcare professionals...',
      image: 'https://placehold.co/600x400?text=Product+Image',
      imageAlt: 'Doctor recommendation'
    },
    section10: {
      title: listicles[9]?.title || swipeContent.section10_title || 'Reason #10: Risk-Free Trial',
      body: listicles[9]?.description || swipeContent.section10_body || 'Try it for 30 days, no questions asked...',
      image: 'https://placehold.co/600x400?text=Product+Image',
      imageAlt: 'Risk-free trial'
    },
    section11: {
      title: swipeContent.section11_title || 'Expert Recommendation',
      body: swipeContent.section11_body || 'Leading experts recommend this product...',
      image: 'https://placehold.co/600x400?text=Expert+Image',
      imageAlt: 'Expert recommendation'
    },
    section12: {
      title: swipeContent.section12_title || 'Final Call to Action',
      body: swipeContent.section12_body || 'Order now and start your journey to better health...',
      image: 'https://placehold.co/600x400?text=CTA+Image',
      imageAlt: 'Call to action'
    },
    cta: {
      primary: swipeContent.cta || 'Get Yours Now - 50% Off!',
      secondary: 'Order Today and Save Big!',
      primaryUrl: '#order'
    },
    sidebar: {
      ctaHeadline: 'Limited Time Offer!',
      ctaButton: 'Order Now - 50% Off!'
    },
    sticky: {
      cta: 'Order Now - 50% Off!'
    },
    reactions: {
      title: 'What Our Customers Are Saying',
      r1: {
        name: 'Sarah M.',
        text: 'This product changed my life! I can\'t believe how well it works.',
        time: '2 hours ago',
        likes: 24
      },
      r2: {
        name: 'Mike R.',
        text: 'Amazing results in just one week. Highly recommended!',
        time: '5 hours ago',
        likes: 18
      },
      r3: {
        name: 'Jennifer L.',
        text: 'Best purchase I\'ve made this year. Worth every penny!',
        time: '1 day ago',
        likes: 31
      }
    },
    brands: {
      brand1: {
        name: 'Trusted Brand',
        logo: 'https://placehold.co/120x40?text=Brand+Logo'
      }
    },
    guarantee: {
      badge: 'https://placehold.co/80x80?text=Badge',
      text: '30-Day Money Back Guarantee'
    },
    assurances: {
      blurb: 'Your satisfaction is our top priority. If you\'re not completely satisfied, we\'ll refund your money, no questions asked.'
    },
    footer: {
      copyright: '© 2024 Your Company. All rights reserved.',
      disclaimer: 'Results may vary. Individual results are not guaranteed.'
    },
    shipping: {
      threshold: '$50'
    },
    brand: {
      name: 'Your Brand',
      logo: 'https://placehold.co/120x40?text=Your+Logo'
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
        console.warn(`Failed to parse swipe content ${index}:`, e)
      }
    }
  })
  
  // Get the first swipe result for main content structure
  const firstSwipe = swipeResults[0] || {}
  const swipeContent = firstSwipe.content ? JSON.parse(firstSwipe.content) : {}
  
  console.log('🔍 Extracting content from API results:')
  console.log('- Summary length:', summary.length)
  console.log('- Swipe results count:', swipeResults.length)
  console.log('- All angles:', allAngles)
  console.log('- Total listicles from all angles:', allListicles.length)
  console.log('- First 3 listicles:', allListicles.slice(0, 3).map(l => ({ title: l.title, number: l.number })))
  console.log('- Using listicles 0-14 for sections 1-15')
  
  // Extract key information
  const projectName = results.project_name || 'Nerve Relief™'
  const productName = swipeContent.title || projectName
  
  // Create rich content from API data
  // Use different angles for variety - mix content from different swipe results
  const heroAngle = swipeResults[1] || swipeResults[0] || {} // Use second angle for hero if available
  const heroContent = heroAngle.content ? JSON.parse(heroAngle.content) : swipeContent
  
  const content: ContentData = {
    hero: {
      headline: heroContent.title || swipeContent.title || productName || 'Finally — real relief for nerve pain',
      subheadline: heroContent.summary || swipeContent.summary || 'Pharmaceutical-grade transdermal magnesium that targets damaged nerves. Try risk-free for 90 days.'
    },
    author: {
      name: swipeContent.author || 'Nerve Relief Content Team',
      image: 'https://placehold.co/100x100?text=Author',
      date: new Date().toLocaleDateString()
    },
    topbar: {
      label: 'LIMITED TIME OFFER - 50% OFF TODAY ONLY!'
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
    section13: {
      title: allListicles[12]?.title || 'Why Choose Nerve Relief™ Over Other Options',
      body: allListicles[12]?.description || 'Unlike generic OTC creams, Nerve Relief™ uses pharmaceutical-grade ingredients with a targeted delivery system designed to reach damaged nerve sites rather than just masking symptoms.',
      image: 'https://placehold.co/600x400?text=Comparison',
      imageAlt: 'Product comparison'
    },
    section14: {
      title: allListicles[13]?.title || 'The Science Behind Nerve Relief™',
      body: allListicles[13]?.description || 'Our proprietary transdermal formula combines magnesium chloride with MSM, arnica, and B6 to create a "repair kit for frayed wiring" that helps nourish damaged peripheral nerves.',
      image: 'https://placehold.co/600x400?text=Science',
      imageAlt: 'Scientific mechanism'
    },
    section15: {
      title: allListicles[14]?.title || 'Start Your Risk-Free Journey Today',
      body: allListicles[14]?.description || 'Don\'t let nerve pain control your life. Try Nerve Relief™ risk-free for 90 days and experience the difference that pharmaceutical-grade, targeted relief can make.',
      image: 'https://placehold.co/600x400?text=Final+CTA',
      imageAlt: 'Final call to action'
    },
    cta: {
      primary: heroContent.cta || swipeContent.cta || 'Try Nerve Relief™ Risk-Free — From $1.30/day. Subscribe & Save 13% — Cancel Anytime',
      secondary: 'Join 90,000+ satisfied users who trust Nerve Relief™',
      primaryUrl: '#order'
    },
    sidebar: {
      ctaHeadline: '4.8/5 from 4,219 reviews • 90-day money-back',
      ctaButton: 'Subscribe & Save 13% — Cancel Anytime'
    },
    sticky: {
      cta: 'Try Risk-Free for 90 Days'
    },
    reactions: {
      title: 'What Our Customers Are Saying',
      r1: {
        name: 'Sarah M.',
        text: 'This cream really helped my nerve pain after just a few days.',
        time: '2 hours ago',
        likes: 24
      },
      r2: {
        name: 'Mike R.',
        text: 'Love the fast absorption with no greasy feel.',
        time: '5 hours ago',
        likes: 18
      },
      r3: {
        name: 'Jennifer L.',
        text: 'Good value compared to prescriptions that just didn\'t work.',
        time: '1 day ago',
        likes: 31
      }
    },
    brands: {
      brand1: {
        name: 'Nerve Relief™',
        logo: 'https://placehold.co/120x40?text=Nerve+Relief'
      }
    },
    guarantee: {
      badge: 'https://placehold.co/80x80?text=90+Day',
      text: '90-Day Money Back Guarantee'
    },
    assurances: {
      blurb: 'Try it risk-free for 90 days. If you\'re not completely satisfied, contact support for a full refund — no hoops.'
    },
    footer: {
      copyright: '© 2024 Nerve Relief™. All rights reserved.',
      disclaimer: 'Results may vary. Individual results are not guaranteed. This product is not intended to diagnose, treat, cure, or prevent any disease.'
    },
    shipping: {
      threshold: 'Free shipping on subscriptions'
    },
    brand: {
      name: 'Nerve Relief™',
      logo: 'https://placehold.co/120x40?text=Nerve+Relief'
    }
  }

  return content
}

export function injectContentIntoTemplate(template: InjectableTemplate, content: ContentData): string {
  
  let htmlContent = template.html_content

  // Replace all placeholders with actual content
  const replacements: { [key: string]: string } = {
    '{{content.hero.headline}}': content.hero.headline,
    '{{content.hero.subheadline}}': content.hero.subheadline,
    '{{content.author.name}}': content.author.name,
    '{{content.author.image}}': content.author.image,
    '{{content.author.date}}': content.author.date,
    '{{content.topbar.label}}': content.topbar.label,
    '{{content.alert.banner}}': content.alert.banner,
    '{{content.breadcrumbs.text}}': content.breadcrumbs.text,
    '{{content.story.intro}}': content.story.intro,
    '{{content.section1.title}}': content.section1.title,
    '{{content.section1.body}}': content.section1.body,
    '{{content.section1.image}}': content.section1.image,
    '{{content.section1.imageAlt}}': content.section1.imageAlt,
    '{{content.section2.title}}': content.section2.title,
    '{{content.section2.body}}': content.section2.body,
    '{{content.section2.image}}': content.section2.image,
    '{{content.section2.imageAlt}}': content.section2.imageAlt,
    '{{content.section3.title}}': content.section3.title,
    '{{content.section3.body}}': content.section3.body,
    '{{content.section3.image}}': content.section3.image,
    '{{content.section3.imageAlt}}': content.section3.imageAlt,
    '{{content.section4.title}}': content.section4.title,
    '{{content.section4.body}}': content.section4.body,
    '{{content.section4.image}}': content.section4.image,
    '{{content.section4.imageAlt}}': content.section4.imageAlt,
    '{{content.section5.title}}': content.section5.title,
    '{{content.section5.body}}': content.section5.body,
    '{{content.section5.image}}': content.section5.image,
    '{{content.section5.imageAlt}}': content.section5.imageAlt,
    '{{content.section6.title}}': content.section6.title,
    '{{content.section6.body}}': content.section6.body,
    '{{content.section6.image}}': content.section6.image,
    '{{content.section6.imageAlt}}': content.section6.imageAlt,
    '{{content.section7.title}}': content.section7.title,
    '{{content.section7.body}}': content.section7.body,
    '{{content.section7.image}}': content.section7.image,
    '{{content.section7.imageAlt}}': content.section7.imageAlt,
    '{{content.section8.title}}': content.section8.title,
    '{{content.section8.body}}': content.section8.body,
    '{{content.section8.image}}': content.section8.image,
    '{{content.section8.imageAlt}}': content.section8.imageAlt,
    '{{content.section9.title}}': content.section9.title,
    '{{content.section9.body}}': content.section9.body,
    '{{content.section9.image}}': content.section9.image,
    '{{content.section9.imageAlt}}': content.section9.imageAlt,
    '{{content.section10.title}}': content.section10.title,
    '{{content.section10.body}}': content.section10.body,
    '{{content.section10.image}}': content.section10.image,
    '{{content.section10.imageAlt}}': content.section10.imageAlt,
    '{{content.section11.title}}': content.section11.title,
    '{{content.section11.body}}': content.section11.body,
    '{{content.section11.image}}': content.section11.image,
    '{{content.section11.imageAlt}}': content.section11.imageAlt,
    '{{content.section12.title}}': content.section12.title,
    '{{content.section12.body}}': content.section12.body,
    '{{content.section12.image}}': content.section12.image,
    '{{content.section12.imageAlt}}': content.section12.imageAlt,
    '{{content.cta.primary}}': content.cta.primary,
    '{{content.cta.secondary}}': content.cta.secondary,
    '{{content.cta.primaryUrl}}': content.cta.primaryUrl,
    '{{content.sidebar.ctaHeadline}}': content.sidebar.ctaHeadline,
    '{{content.sidebar.ctaButton}}': content.sidebar.ctaButton,
    '{{content.sticky.cta}}': content.sticky.cta,
    '{{content.reactions.title}}': content.reactions.title,
    '{{content.reactions.r1.name}}': content.reactions.r1.name,
    '{{content.reactions.r1.text}}': content.reactions.r1.text,
    '{{content.reactions.r1.time}}': content.reactions.r1.time,
    '{{content.reactions.r1.likes}}': content.reactions.r1.likes.toString(),
    '{{content.reactions.r2.name}}': content.reactions.r2.name,
    '{{content.reactions.r2.text}}': content.reactions.r2.text,
    '{{content.reactions.r2.time}}': content.reactions.r2.time,
    '{{content.reactions.r2.likes}}': content.reactions.r2.likes.toString(),
    '{{content.reactions.r3.name}}': content.reactions.r3.name,
    '{{content.reactions.r3.text}}': content.reactions.r3.text,
    '{{content.reactions.r3.time}}': content.reactions.r3.time,
    '{{content.reactions.r3.likes}}': content.reactions.r3.likes.toString(),
    '{{content.brands.brand1.name}}': content.brands.brand1.name,
    '{{content.brands.brand1.logo}}': content.brands.brand1.logo,
    '{{content.guarantee.badge}}': content.guarantee.badge,
    '{{content.guarantee.text}}': content.guarantee.text,
    '{{content.assurances.blurb}}': content.assurances.blurb,
    '{{content.footer.copyright}}': content.footer.copyright,
    '{{content.footer.disclaimer}}': content.footer.disclaimer,
    '{{content.shipping.threshold}}': content.shipping.threshold,
    '{{content.brand.name}}': content.brand.name,
    '{{content.brand.logo}}': content.brand.logo,
  }

  // Apply all replacements
  let replacementCount = 0
  for (const [placeholder, value] of Object.entries(replacements)) {
    if (htmlContent.includes(placeholder)) {
      htmlContent = htmlContent.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value)
      replacementCount++
      console.log(`✅ Replaced: ${placeholder} -> ${value.substring(0, 50)}...`)
    }
  }

  console.log(`🔧 Total replacements made: ${replacementCount}`)
  console.log(`📄 Final HTML length: ${htmlContent.length}`)
  
  return htmlContent
}

function createCarouselHtml(templates: Array<{angle: string, html: string}>): string {
  console.log(`🎠 Creating carousel with ${templates.length} templates`)
  templates.forEach((template, i) => {
    console.log(`  Template ${i + 1}: ${template.angle} (HTML length: ${template.html.length})`)
  })
  
  if (templates.length === 0) {
    console.log('⚠️ No templates provided to carousel')
    return '<div>No templates available</div>'
  }

  if (templates.length === 1) {
    console.log('📄 Single template, returning directly')
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
): Promise<{ templates: Array<{angle: string, html: string}>, combinedHtml: string}> {
  try {
    console.log(`🚀 Processing job results for advertorial type: ${advertorialType}`)
    console.log('📊 Results structure:', {
      hasSummary: !!results.summary,
      hasSwipeResults: !!results.swipe_results,
      swipeResultsCount: results.swipe_results?.length || 0,
      projectName: results.project_name
    })
    
    // Get a random template for the specified type
    const template = await getRandomInjectableTemplate(advertorialType)
    
    if (!template) {
      console.error(`No ${advertorialType} template found in database`)
      throw new Error(`No ${advertorialType} template found`)
    }

    console.log(`✅ Found template: ${template.name} (${template.advertorial_type})`)

    // Process each marketing angle separately
    const swipeResults = results.swipe_results || []
    const generatedTemplates: Array<{angle: string, html: string}> = []
    
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
      console.log(`\n🎯 Processing angle ${i + 1}/${swipeResults.length}: ${swipe.angle}`)
      
      try {
        // Extract content for this specific angle
        const content = extractContentFromAngle(results, swipe, i)
        console.log(`📝 Angle ${i + 1} content keys:`, Object.keys(content))
        console.log(`📝 Angle ${i + 1} hero headline:`, content.hero.headline)
        
        // Inject content into template
        const angleHtml = injectContentIntoTemplate(template, content)
        generatedTemplates.push({
          angle: swipe.angle || `Angle ${i + 1}`,
          html: angleHtml
        })
        console.log(`✅ Angle ${i + 1} HTML generated. Length: ${angleHtml.length}`)
        
      } catch (error) {
        console.error(`❌ Error processing angle ${i + 1}:`, error)
        // Continue with other angles even if one fails
      }
    }

    // Create carousel HTML that displays all templates
    const carouselHtml = createCarouselHtml(generatedTemplates)

    console.log(`🎉 Generated ${generatedTemplates.length} templates with carousel display`)
    return {
      templates: generatedTemplates,
      combinedHtml: carouselHtml
    }

  } catch (error) {
    console.error('❌ Error in processJobResults:', error)
    throw error
  }
}