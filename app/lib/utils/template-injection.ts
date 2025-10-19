import { InjectableTemplate } from '@/lib/db/types'
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

// Extract content data from individual swipe result - EXACT field mapping
export function extractContentFromSwipeResult(swipeResult: any, templateType: 'listicle' | 'advertorial'): ContentData {
  // Parse the swipe result content - this contains the rich JSON data for this specific angle
  const swipeContent = swipeResult.content ? JSON.parse(swipeResult.content) : {}
  
  // Create content data using EXACT field names from API - NO DUPLICATES
  const content: ContentData = {
    // Hero section - exact field mapping with fallback images
    hero: {
      headline: swipeContent.hero?.headline || 'Transform Your Daily Routine',
      subheadline: swipeContent.hero?.subheadline || 'Discover the solution that thousands are already using',
      image: swipeContent.hero?.image || 'https://placehold.co/600x400?text=Hero+Image',
      imageAlt: swipeContent.hero?.imageAlt || 'Hero Image'
    },
    
    // Author section - exact field mapping with fallback images
    author: {
      name: swipeContent.author?.name || 'Health Expert',
      image: swipeContent.author?.image || 'https://placehold.co/100x100?text=Author',
      date: swipeContent.author?.date || new Date().toLocaleDateString(),
      verifiedIcon: 'https://placehold.co/20x20?text=✓' // Not in API, keep default
    },
    
    // Topbar - exact field mapping
    topbar: {
      label: swipeContent.topbar?.label || 'Featured',
      image: swipeContent.topbar?.image || 'https://placehold.co/50x50?text=Icon'
    },
    
    // Alert banner - exact field mapping
    alert: {
      banner: swipeContent.alert?.banner || 'Limited Time Offer'
    },
    
    // Breadcrumbs - exact field mapping
    breadcrumbs: {
      text: swipeContent.breadcrumbs?.text || 'Home > Health > Products'
    },
    
    // Story intro - exact field mapping
    story: {
      intro: swipeContent.story?.intro || 'Here\'s what you need to know about this breakthrough solution...'
    },
    
    // Sections 1-12 - use real API data, only fallback to meaningful content
    section1: {
      title: swipeContent.section1?.title || swipeContent.section1?.headline || 'The Problem You Face',
      body: swipeContent.section1?.body || swipeContent.section1?.description || 'Many people struggle with this issue daily, affecting their quality of life.',
      image: swipeContent.section1?.image || 'https://placehold.co/600x400?text=Problem+Image',
      imageAlt: swipeContent.section1?.imageAlt || 'Problem illustration'
    },
    section2: {
      title: swipeContent.section2?.title || swipeContent.section2?.headline || 'The Science Behind It',
      body: swipeContent.section2?.body || swipeContent.section2?.description || 'Research shows that this approach has been proven effective in clinical studies.',
      image: swipeContent.section2?.image || 'https://placehold.co/600x400?text=Science+Image',
      imageAlt: swipeContent.section2?.imageAlt || 'Scientific research'
    },
    section3: {
      title: swipeContent.section3?.title || swipeContent.section3?.headline || 'How It Works',
      body: swipeContent.section3?.body || swipeContent.section3?.description || 'Our solution works by targeting the root cause of the problem.',
      image: swipeContent.section3?.image || 'https://placehold.co/600x400?text=How+It+Works',
      imageAlt: swipeContent.section3?.imageAlt || 'Process illustration'
    },
    section4: {
      title: swipeContent.section4?.title || swipeContent.section4?.headline || 'Real Results',
      body: swipeContent.section4?.body || swipeContent.section4?.description || 'Thousands of users have experienced significant improvements.',
      image: swipeContent.section4?.image || 'https://placehold.co/600x400?text=Results+Image',
      imageAlt: swipeContent.section4?.imageAlt || 'Success results'
    },
    section5: {
      title: swipeContent.section5?.title || swipeContent.section5?.headline || 'What Makes Us Different',
      body: swipeContent.section5?.body || swipeContent.section5?.description || 'Our unique approach sets us apart from other solutions.',
      image: swipeContent.section5?.image || 'https://placehold.co/600x400?text=Difference+Image',
      imageAlt: swipeContent.section5?.imageAlt || 'Unique features'
    },
    section6: {
      title: swipeContent.section6?.title || swipeContent.section6?.headline || 'Easy to Use',
      body: swipeContent.section6?.body || swipeContent.section6?.description || 'Simple application process that fits into your daily routine.',
      image: swipeContent.section6?.image || 'https://placehold.co/600x400?text=Easy+Use',
      imageAlt: swipeContent.section6?.imageAlt || 'Easy application'
    },
    section7: {
      title: swipeContent.section7?.title || swipeContent.section7?.headline || 'Safety First',
      body: swipeContent.section7?.body || swipeContent.section7?.description || 'Made with high-quality, safe ingredients you can trust.',
      image: swipeContent.section7?.image || 'https://placehold.co/600x400?text=Safety+Image',
      imageAlt: swipeContent.section7?.imageAlt || 'Safety assurance'
    },
    section8: {
      title: swipeContent.section8?.title || swipeContent.section8?.headline || 'Customer Stories',
      body: swipeContent.section8?.body || swipeContent.section8?.description || 'Hear from real customers who have transformed their lives.',
      image: swipeContent.section8?.image || 'https://placehold.co/600x400?text=Testimonials',
      imageAlt: swipeContent.section8?.imageAlt || 'Customer testimonials'
    },
    section9: {
      title: swipeContent.section9?.title || swipeContent.section9?.headline || 'Expert Endorsement',
      body: swipeContent.section9?.body || swipeContent.section9?.description || 'Recommended by healthcare professionals and experts.',
      image: swipeContent.section9?.image || 'https://placehold.co/600x400?text=Expert+Endorsement',
      imageAlt: swipeContent.section9?.imageAlt || 'Expert recommendation'
    },
    section10: {
      title: swipeContent.section10?.title || swipeContent.section10?.headline || 'Risk-Free Trial',
      body: swipeContent.section10?.body || swipeContent.section10?.description || 'Try it risk-free with our satisfaction guarantee.',
      image: swipeContent.section10?.image || 'https://placehold.co/600x400?text=Risk+Free',
      imageAlt: swipeContent.section10?.imageAlt || 'Risk-free guarantee'
    },
    section11: {
      title: swipeContent.section11?.title || swipeContent.section11?.headline || 'Limited Time Offer',
      body: swipeContent.section11?.body || swipeContent.section11?.description || 'Special pricing available for a limited time only.',
      image: swipeContent.section11?.image || 'https://placehold.co/600x400?text=Special+Offer',
      imageAlt: swipeContent.section11?.imageAlt || 'Special offer'
    },
    section12: {
      title: swipeContent.section12?.title || swipeContent.section12?.headline || 'Get Started Today',
      body: swipeContent.section12?.body || swipeContent.section12?.description || 'Don\'t wait - start your journey to better health today.',
      image: swipeContent.section12?.image || 'https://placehold.co/600x400?text=Get+Started',
      imageAlt: swipeContent.section12?.imageAlt || 'Call to action'
    },
    
    // CTA section - exact field mapping
    cta: {
      primary: swipeContent.cta?.primary || swipeContent.cta || swipeContent.hero?.cta || 'Get Started Now',
      primaryUrl: swipeContent.cta?.primaryUrl || swipeContent.hero?.ctaUrl || '#order',
      secondary: swipeContent.cta?.secondary || 'Learn More',
      secondaryUrl: swipeContent.cta?.secondaryUrl || '#learn'
    },
    
    // Sidebar section - exact field mapping with comprehensive fallbacks
    sidebar: {
      ctaHeadline: swipeContent.sidebar?.ctaHeadline || swipeContent.cta?.primary || 'Special Offer',
      ctaButton: swipeContent.sidebar?.ctaButton || swipeContent.cta?.primary || 'Get Started',
      ctaUrl: swipeContent.sidebar?.ctaUrl || swipeContent.cta?.primaryUrl || '#order',
      productImage: swipeContent.sidebar?.productImage || swipeContent.product?.image || 'https://placehold.co/300x300?text=Product+Image',
      ratingImage: swipeContent.sidebar?.ratingImage || 'https://placehold.co/20x20?text=★'
    },
    
    // Sticky CTA - use real data from API with comprehensive fallbacks
    sticky: {
      cta: swipeContent.sticky?.cta || swipeContent.cta?.primary || swipeContent.cta || 'Get Started Now',
      ctaUrl: swipeContent.sticky?.ctaUrl || swipeContent.cta?.primaryUrl || '#order'
    },
    
    // Reactions section - use real API data with meaningful fallbacks
    reactions: {
      title: swipeContent.reactions?.title || 'What People Are Saying',
      r1: {
        text: swipeContent.reactions?.r1?.text || 'This really works! I\'ve seen amazing results.',
        name: swipeContent.reactions?.r1?.name || 'Sarah M.',
        image: swipeContent.reactions?.r1?.avatar || swipeContent.reactions?.r1?.image || 'https://placehold.co/40x40?text=SM',
        likes: swipeContent.reactions?.r1?.likes || '12',
        time: swipeContent.reactions?.r1?.time || '2h',
        reply: 'Reply' // Not in API, keep default
      },
      r2: {
        text: swipeContent.reactions?.r2?.text || 'Highly recommend this to anyone struggling with this issue.',
        name: swipeContent.reactions?.r2?.name || 'Mike R.',
        image: swipeContent.reactions?.r2?.avatar || swipeContent.reactions?.r2?.image || 'https://placehold.co/40x40?text=MR',
        likes: swipeContent.reactions?.r2?.likes || '8',
        time: swipeContent.reactions?.r2?.time || '4h',
        reply: 'Reply' // Not in API, keep default
      },
      r3: {
        text: swipeContent.reactions?.r3?.text || 'Finally found something that actually works for me.',
        name: swipeContent.reactions?.r3?.name || 'Jennifer L.',
        image: swipeContent.reactions?.r3?.avatar || swipeContent.reactions?.r3?.image || 'https://placehold.co/40x40?text=JL',
        likes: swipeContent.reactions?.r3?.likes || '15',
        time: swipeContent.reactions?.r3?.time || '6h',
        reply: 'Reply' // Not in API, keep default
      },
      r4: {
        text: swipeContent.reactions?.r4?.text || 'Worth every penny. Life-changing results!',
        name: swipeContent.reactions?.r4?.name || 'David K.',
        image: swipeContent.reactions?.r4?.avatar || swipeContent.reactions?.r4?.image || 'https://placehold.co/40x40?text=DK',
        likes: swipeContent.reactions?.r4?.likes || '20',
        time: swipeContent.reactions?.r4?.time || '1d',
        reply: 'Reply' // Not in API, keep default
      },
      r5: {
        text: swipeContent.reactions?.r5?.text || 'Amazing product! Highly recommended.',
        name: swipeContent.reactions?.r5?.name || 'Lisa P.',
        image: swipeContent.reactions?.r5?.avatar || swipeContent.reactions?.r5?.image || 'https://placehold.co/40x40?text=LP',
        likes: swipeContent.reactions?.r5?.likes || '10',
        time: swipeContent.reactions?.r5?.time || '10h',
        reply: 'Reply'
      },
      r6: {
        text: swipeContent.reactions?.r6?.text || 'This changed my life completely.',
        name: swipeContent.reactions?.r6?.name || 'Tom W.',
        image: swipeContent.reactions?.r6?.avatar || swipeContent.reactions?.r6?.image || 'https://placehold.co/40x40?text=TW',
        likes: swipeContent.reactions?.r6?.likes || '18',
        time: swipeContent.reactions?.r6?.time || '12h',
        reply: 'Reply'
      },
      r7: {
        text: swipeContent.reactions?.r7?.text || 'Best investment I\'ve made for my health.',
        name: swipeContent.reactions?.r7?.name || 'Emma S.',
        image: swipeContent.reactions?.r7?.avatar || swipeContent.reactions?.r7?.image || 'https://placehold.co/40x40?text=ES',
        likes: swipeContent.reactions?.r7?.likes || '14',
        time: swipeContent.reactions?.r7?.time || '14h',
        reply: 'Reply'
      }
    },
    
    // Footer section - use real API data with meaningful fallbacks
    footer: {
      copyright: swipeContent.footer?.copyright || '© 2024 All Rights Reserved',
      disclaimer: (() => {
        const apiDisclaimer = swipeContent.footer?.disclaimer || 'Results may vary. Consult your healthcare provider.'
        // Limit disclaimer to reasonable length and only show once
        if (apiDisclaimer.length > 200) {
          return 'Results may vary. Individual results are not guaranteed. Consult your healthcare provider.'
        }
        return apiDisclaimer
      })(),
      contactUrl: '#', // Not in API, keep default
      privacyUrl: '#', // Not in API, keep default
      termsUrl: '#', // Not in API, keep default
      cookieUrl: '#' // Not in API, keep default
    },
    
    // Brands section - not in API, keep defaults with descriptive fallback images
    brands: {
      brand1: {
        name: 'Trusted Partner',
        logo: 'https://placehold.co/100x50?text=Brand+Logo'
      }
    },
    
    // Product section - not in API, keep defaults with descriptive fallback images
    product: {
      name: 'Premium Solution',
      image: 'https://placehold.co/400x400?text=Product+Image'
    },
    
    // Guarantee section - not in API, keep defaults with descriptive fallback images
    guarantee: {
      badge: 'https://placehold.co/80x80?text=Guarantee+Badge'
    },
    
    // Assurances section - use real API data with meaningful fallback
    assurances: {
      blurb: swipeContent.assurances?.blurb || 'Backed by our satisfaction guarantee'
    },
    
    // Shipping section - not in API, keep defaults
    shipping: {
      threshold: 'Free shipping on orders over $50'
    },
    
    // Info section - not in API, keep defaults with descriptive fallback images
    info: {
      icon: 'https://placehold.co/20x20?text=Info+Icon'
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

// Comprehensive deduplication function to remove ALL duplicate content
function removeDuplicateContent(htmlContent: string, content: ContentData): string {
  // Get all content values that might appear multiple times
  const contentValues = [
    content.hero.headline,
    content.hero.subheadline,
    content.hero.cta,
    content.hero.ctaUrl,
    content.footer.disclaimer,
    content.footer.copyright,
    content.assurances.blurb,
    content.guarantee.text,
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
    /Legal notice:.*?Merit Relief.*?(?=Legal notice:|$)/gs,
    /Results may vary.*?senior concerns\./gs,
    /This product is not intended to diagnose.*?healthcare provider\./gs
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
  const paragraphRegex = /<p[^>]*>.*?<\/p>/gs
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
    '{{content.shipping.threshold}}': content.shipping.threshold
  }

  // Apply all replacements
  let replacementCount = 0
  for (const [placeholder, value] of Object.entries(replacements)) {
    if (htmlContent.includes(placeholder)) {
      htmlContent = htmlContent.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value)
      replacementCount++
    }
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
}

// Aggressive deduplication function to remove all duplicates
function aggressiveDeduplication(htmlContent: string): string {
  console.log('🧹 Starting aggressive deduplication...')
  
  let cleanedContent = htmlContent
  
  // 1. Remove duplicate legal notices/disclaimers (most common issue)
  const disclaimerPatterns = [
    /Legal notice:.*?senior concerns\./gs,
    /Results may vary.*?healthcare provider\./gs,
    /This product is not intended to diagnose.*?healthcare provider\./gs,
    /Individual results vary.*?senior concerns\./gs,
    /Merit Relief is an over.*?senior concerns\./gs,
    /The statements on this page.*?senior concerns\./gs,
    /The Mineral Delivery System.*?complete details\./gs
  ]
  
  for (const pattern of disclaimerPatterns) {
    const matches = cleanedContent.match(pattern)
    if (matches && matches.length > 1) {
      console.log(`🗑️ Removing ${matches.length - 1} duplicate disclaimers`)
      // Keep only the first occurrence
      cleanedContent = cleanedContent.replace(pattern, (match, offset) => {
        return offset === cleanedContent.indexOf(match) ? match : ''
      })
    }
  }
  
  // 2. Remove duplicate CTAs
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
      console.log(`🗑️ Removing ${matches.length - 1} duplicate CTAs`)
      // Keep only the first occurrence
      cleanedContent = cleanedContent.replace(pattern, (match, offset) => {
        return offset === cleanedContent.indexOf(match) ? match : ''
      })
    }
  }
  
  // 3. Remove duplicate paragraphs (same content appearing multiple times)
  const paragraphs = cleanedContent.split(/\n\s*\n/).filter(p => p.trim().length > 50)
  const uniqueParagraphs = []
  const seenParagraphs = new Set()
  
  for (const paragraph of paragraphs) {
    const normalized = paragraph.trim().toLowerCase().replace(/\s+/g, ' ')
    if (!seenParagraphs.has(normalized)) {
      seenParagraphs.add(normalized)
      uniqueParagraphs.push(paragraph)
    } else {
      console.log('🗑️ Removing duplicate paragraph')
    }
  }
  
  cleanedContent = uniqueParagraphs.join('\n\n')
  
  // 4. Remove duplicate sections
  const sections = cleanedContent.split(/<section|<div class="section"|<div class="content"/gi)
  const uniqueSections = []
  const seenSections = new Set()
  
  for (const section of sections) {
    if (section.trim().length > 100) {
      const normalized = section.trim().toLowerCase().replace(/\s+/g, ' ')
      if (!seenSections.has(normalized)) {
        seenSections.add(normalized)
        uniqueSections.push(section)
      } else {
        console.log('🗑️ Removing duplicate section')
      }
    }
  }
  
  cleanedContent = uniqueSections.join('')
  
  // 5. Remove duplicate buttons/CTAs in HTML
  const buttonPattern = /<button[^>]*>.*?<\/button>/gi
  const buttons = cleanedContent.match(buttonPattern) || []
  const uniqueButtons = [...new Set(buttons)]
  
  if (buttons.length !== uniqueButtons.length) {
    console.log(`🗑️ Removing ${buttons.length - uniqueButtons.length} duplicate buttons`)
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
  
  console.log('✅ Aggressive deduplication completed')
  return cleanedContent
}


// Add image fallback handling to prevent broken image symbols
function addImageFallbacks(htmlContent: string): string {
  
  // Replace all <img> tags with versions that have onerror fallbacks
  htmlContent = htmlContent.replace(
    /<img([^>]*?)\s+src\s*=\s*["']([^"']*)["']([^>]*?)>/gi,
    (match, beforeSrc, src, afterSrc) => {
      // Extract alt text if present
      const altMatch = match.match(/alt\s*=\s*["']([^"']*)["']/i)
      const altText = altMatch ? altMatch[1] : 'Image'
      
      // Create fallback image URL with descriptive text and appropriate dimensions
      const fallbackUrl = createFallbackImageUrl(altText, src)
      
      // Return img tag with onerror handler
      return `<img${beforeSrc} src="${src}"${afterSrc} onerror="this.src='${fallbackUrl}'; this.onerror=null;" style="object-fit: cover;">`
    }
  )
  
  // Also handle img tags without explicit src attributes (in case of template placeholders)
  htmlContent = htmlContent.replace(
    /<img([^>]*?)>/gi,
    (match, attributes) => {
      // Check if src is already handled
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
      
      // Add onerror handler
      return match.replace('>', ` onerror="this.src='${fallbackUrl}'; this.onerror=null;" style="object-fit: cover;">`)
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
  
  // Add pointer-events: none to all links via inline styles
  htmlContent = htmlContent.replace(/<a([^>]*)>/gi, '<a$1 style="pointer-events: none; cursor: default;">')
  
  // Also disable buttons that might have click handlers
  htmlContent = htmlContent.replace(/<button([^>]*)>/gi, '<button$1 style="pointer-events: none; cursor: default;">')
  
  return htmlContent
}

function createCarouselHtml(templates: Array<{angle: string, html: string}>): string {
  
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