/**
 * Extracts all images with data-image-role attributes from HTML
 * Enhanced to extract actual section headings and body text
 */

export interface TaggedImage {
  role: string
  alt: string
  currentSrc: string
  surroundingContent?: string
  sectionTitle?: string  // Actual section heading (h2)
  sectionBody?: string   // Actual section body text
}

export function extractTaggedImages(html: string): TaggedImage[] {
  const images: TaggedImage[] = []
  
  // Regex to find img tags with data-image-role attribute
  const imgRegex = /<img[^>]*data-image-role=["']([^"']+)["'][^>]*>/gi
  let match
  
  while ((match = imgRegex.exec(html)) !== null) {
    const fullTag = match[0]
    const role = match[1]
    const tagIndex = match.index || 0
    
    // Extract alt text
    const altMatch = fullTag.match(/alt=["']([^"']*)["']/i)
    const alt = altMatch ? altMatch[1] : ''
    
    // Extract current src
    const srcMatch = fullTag.match(/src=["']([^"']*)["']/i)
    const currentSrc = srcMatch ? srcMatch[1] : ''
    
    // For section images, extract the actual section heading and body
    let sectionTitle: string | undefined
    let sectionBody: string | undefined
    
    if (role.startsWith('section-')) {
      // Find the parent <section> element
      // Look backwards to find the opening <section> tag
      let sectionStart = tagIndex
      let foundSectionStart = false
      
      // Search backwards for opening section tag
      for (let i = tagIndex; i >= 0; i--) {
        const substr = html.substring(i, i + 8)
        if (substr === '<section') {
          // Found opening section tag, now find where it starts
          sectionStart = i
          foundSectionStart = true
          break
        }
      }
      
      if (foundSectionStart) {
        // Find the closing </section> tag
        let sectionEnd = html.length
        let depth = 0
        for (let i = sectionStart; i < html.length; i++) {
          if (html.substring(i, i + 8) === '<section') {
            depth++
          } else if (html.substring(i, i + 10) === '</section>') {
            depth--
            if (depth === 0) {
              sectionEnd = i + 10
              break
            }
          }
        }
        
        const sectionHtml = html.substring(sectionStart, sectionEnd)
        
        // Extract h2 heading (the section title)
        const h2Match = sectionHtml.match(/<h2[^>]*>.*?<span[^>]*>(.*?)<\/span>.*?<\/h2>/is)
        if (h2Match && h2Match[1]) {
          sectionTitle = h2Match[1]
            .replace(/{{content\.section\d+\.title}}/g, '') // Remove template variables
            .replace(/<[^>]+>/g, ' ') // Remove any HTML tags
            .replace(/\s+/g, ' ')
            .trim()
        }
        
        // Extract body text (the span after the image)
        const imgPosInSection = sectionHtml.indexOf(fullTag)
        if (imgPosInSection >= 0) {
          // Get text after the image tag
          const afterImage = sectionHtml.substring(imgPosInSection + fullTag.length)
          // Look for span with body content (usually comes after the image)
          const bodyMatch = afterImage.match(/<span[^>]*>(.*?)<\/span>/is)
          if (bodyMatch && bodyMatch[1]) {
            sectionBody = bodyMatch[1]
              .replace(/{{content\.section\d+\.body}}/g, '') // Remove template variables
              .replace(/<[^>]+>/g, ' ') // Remove any remaining HTML tags
              .replace(/\s+/g, ' ') // Normalize whitespace
              .trim()
              .substring(0, 500) // Limit length
          }
        }
      }
    }
    
    // Fallback: Extract surrounding content if section extraction didn't work
    const beforeContext = html.substring(Math.max(0, tagIndex - 200), tagIndex)
    const afterContext = html.substring(tagIndex, Math.min(html.length, tagIndex + 200))
    const surroundingContent = (beforeContext + afterContext)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 300)
    
    images.push({
      role,
      alt,
      currentSrc,
      surroundingContent,
      sectionTitle,
      sectionBody,
    })
  }
  
  return images
}


