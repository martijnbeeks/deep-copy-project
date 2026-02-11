/**
 * Utility to replace images in HTML templates based on role and index
 * Works with templates that have consistent IDs/classes:
 * - Hero: id="hero-image"
 * - Sections: class="section-image" (in order)
 * - Product: id="product-image"
 * 
 * For new templates (AD/LD prefixes), updates CONFIG object in script tag
 */

export interface TemplateImageReplacement {
  role: string
  index?: number
  url: string
}

/**
 * Replace images in HTML string based on role and optional index
 * For new templates (AD/LD), updates CONFIG object in script tag
 * For old templates, replaces img tags directly
 */
export function replaceTemplateImagesInHTML(
  html: string,
  replacements: TemplateImageReplacement[],
  templateId?: string
): string {
  let updatedHtml = html
  
  // Check if this is a new template format (AD/LD prefixes)
  const isNewTemplate = templateId && (templateId.startsWith('AD') || templateId.startsWith('LD'))
  
  if (isNewTemplate) {
    // For new templates, update CONFIG object in script tag AND body img tags
    replacements.forEach(({ role, index, url }) => {
      if (role === 'hero') {
        // Update CONFIG.HERO_IMAGE
        const heroImageRegex = /(HERO_IMAGE:\s*["'])([^"']*)(["'])/i
        updatedHtml = updatedHtml.replace(heroImageRegex, (match, before, _oldUrl, after) => {
          return `${before}${url}${after}`
        })
        
        // ALSO update the actual <img> tag in body (for LD0001/AD0001)
        const heroImgRegex = /(<img[^>]*id=["']hero-image["'][^>]*src=["'])([^"']*)(["'][^>]*>)/i
        updatedHtml = updatedHtml.replace(heroImgRegex, (match, before, _oldSrc, after) => {
          return `${before}${url}${after}`
        })
      } else if (role === 'section' && index !== undefined) {
        // Update CONFIG.SECTIONS[index].image
        // Find all image: properties within SECTIONS array and update the one at the specified index
        const sectionsMatch = updatedHtml.match(/SECTIONS:\s*\[([\s\S]*?)\]/i)
        if (sectionsMatch) {
          const sectionsContent = sectionsMatch[1]
          const fullSectionsMatch = sectionsMatch[0]
          
          // Find all image: properties in the sections content
          const imageRegex = /image:\s*["']([^"']*)["']/gi
          let match
          let currentIndex = 0
          
          while ((match = imageRegex.exec(sectionsContent)) !== null) {
            if (currentIndex === index) {
              // This is the image we need to update
              const before = sectionsContent.substring(0, match.index)
              const after = sectionsContent.substring(match.index + match[0].length)
              const newImage = `image: "${url}"`
              const newSectionsContent = before + newImage + after
              
              // Replace the entire SECTIONS array
              updatedHtml = updatedHtml.replace(
                fullSectionsMatch,
                `SECTIONS: [${newSectionsContent}]`
              )
              break
            }
            currentIndex++
          }
        }
      } else if (role === 'product') {
        // Update CONFIG.PRODUCT_IMAGE
        const productImageRegex = /(PRODUCT_IMAGE:\s*["'])([^"']*)(["'])/i
        updatedHtml = updatedHtml.replace(productImageRegex, (match, before, _oldUrl, after) => {
          return `${before}${url}${after}`
        })
        
        // ALSO update the actual <img> tag in body
        const productImgRegex = /(<img[^>]*id=["']product-image["'][^>]*src=["'])([^"']*)(["'][^>]*>)/i
        updatedHtml = updatedHtml.replace(productImgRegex, (match, before, _oldSrc, after) => {
          return `${before}${url}${after}`
        })
      } else if (role === 'reason' && index !== undefined) {
        // Update CONFIG.REASONS[index].image (LD0001 listicle reasons)
        const reasonsMatch = updatedHtml.match(/REASONS:\s*\[([\s\S]*?)\]/i)
        if (reasonsMatch) {
          const reasonsContent = reasonsMatch[1]
          const fullReasonsMatch = reasonsMatch[0]

          const imageRegex = /image:\s*["']([^"']*)["']/gi
          let match
          let currentIndex = 0

          while ((match = imageRegex.exec(reasonsContent)) !== null) {
            if (currentIndex === index) {
              const before = reasonsContent.substring(0, match.index)
              const after = reasonsContent.substring(match.index + match[0].length)
              const newImage = `image: "${url}"`
              const newReasonsContent = before + newImage + after

              updatedHtml = updatedHtml.replace(
                fullReasonsMatch,
                `REASONS: [${newReasonsContent}]`
              )
              break
            }
            currentIndex++
          }
        }
        
        // ALSO update the actual <img> tags in body for this reason index
        // LD0001 generates images dynamically, but after save they're in the HTML
        // Find all listicle-item divs and update the one at the matching index
        // We need to count only actual listicle-item divs (not expert-quote or other divs)
        const listicleItemPattern = /<div[^>]*class=["'][^"']*listicle-item[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class=["'][^"']*listicle-item|<div[^>]*class=["'][^"']*expert-quote|<\/div>\s*<div[^>]*class=["'][^"']*highlight-box|$)/gi
        let itemIndex = 0
        let lastIndex = 0
        
        updatedHtml = updatedHtml.replace(listicleItemPattern, (match, content) => {
          if (itemIndex === index) {
            // Update all images in this listicle item (desktop, mobile, and any alt="Reason X" images)
            const updatedContent = content
              .replace(/(<img[^>]*class=["'][^"']*listicle-image[^"']*["'][^>]*src=["'])([^"']*)(["'][^>]*>)/gi, `$1${url}$3`)
              .replace(/(<img[^>]*class=["'][^"']*listicle-image-mobile[^"']*["'][^>]*src=["'])([^"']*)(["'][^>]*>)/gi, `$1${url}$3`)
              .replace(/(<img[^>]*alt=["']Reason\s+\d+["'][^>]*src=["'])([^"']*)(["'][^>]*>)/gi, `$1${url}$3`)
            return `<div class="listicle-item">${updatedContent}</div>`
          }
          itemIndex++
          lastIndex = match.index + match.length
          return match
        })
        
        // Fallback: if the above didn't work, try a simpler approach - find all images with alt="Reason X" and update by index
        if (itemIndex <= index) {
          const reasonImagePattern = /<img[^>]*alt=["']Reason\s+(\d+)["'][^>]*src=["']([^"']*)["'][^>]*>/gi
          let imgIndex = 0
          updatedHtml = updatedHtml.replace(reasonImagePattern, (match, reasonNum, oldSrc) => {
            // reasonNum is 1-based, index is 0-based
            if (parseInt(reasonNum, 10) - 1 === index) {
              return match.replace(/src=["'][^"']*["']/, `src="${url}"`)
            }
            return match
          })
        }
      }
    })
  } else {
    // For old templates, use existing img tag replacement logic
    replacements.forEach(({ role, index, url }) => {
      if (role === 'hero') {
        // Replace hero image - find by id="hero-image"
        const heroRegex = /(<img[^>]*id=["']hero-image["'][^>]*)(src=["'])([^"']*)(["'][^>]*>)/i
        updatedHtml = updatedHtml.replace(heroRegex, (match, before, srcAttr, oldSrc, after) => {
          return `${before}${srcAttr}${url}${after}`
        })
      } else if (role === 'section' && index !== undefined) {
        // Replace section image by index
        // Find all images with class="section-image" and replace the one at the specified index
        const sectionImageRegex = /<img[^>]*class=["'][^"']*section-image[^"']*["'][^>]*>/gi
        let foundIndex = 0
        updatedHtml = updatedHtml.replace(sectionImageRegex, (match) => {
          if (foundIndex === index) {
            // Replace src while preserving other attributes
            const srcRegex = /(src=["'])([^"']*)(["'])/i
            const updated = match.replace(srcRegex, `$1${url}$3`)
            foundIndex++
            return updated
          }
          foundIndex++
          return match
        })
      } else if (role === 'product') {
        // Replace product image - find by id="product-image"
        const productRegex = /(<img[^>]*id=["']product-image["'][^>]*)(src=["'])([^"']*)(["'][^>]*>)/i
        updatedHtml = updatedHtml.replace(productRegex, (match, before, srcAttr, oldSrc, after) => {
          return `${before}${srcAttr}${url}${after}`
        })
      }
    })
  }

  return updatedHtml
}


