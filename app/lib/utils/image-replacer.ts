/**
 * Frontend utility to replace images in DOM based on tags
 */

export interface ImageReplacement {
  tag: string
  url: string
}

/**
 * Replace images in the DOM based on data-image-role attributes
 */
export function replaceImagesInDOM(replacements: ImageReplacement[]): {
  replaced: number
  errors: string[]
} {
  const errors: string[] = []
  let replaced = 0

  replacements.forEach(({ tag, url }) => {
    try {
      // Find all images with this role
      const images = document.querySelectorAll<HTMLImageElement>(
        `img[data-image-role="${tag}"]`
      )

      if (images.length === 0) {
        errors.push(`No images found with role: ${tag}`)
        return
      }

      // Replace src for all matching images
      images.forEach((img) => {
        img.src = url
        replaced++
      })
    } catch (error) {
      errors.push(`Error replacing images for role ${tag}: ${error}`)
    }
  })

  return { replaced, errors }
}

/**
 * Replace images in HTML string (for server-side or preview)
 */
export function replaceImagesInHTML(
  html: string,
  replacements: ImageReplacement[]
): string {
  let updatedHtml = html

  replacements.forEach(({ tag, url }) => {
    // Create regex to match img tags with this data-image-role
    // This handles different attribute orders and empty src values
    const regex = new RegExp(
      `(<img[^>]*data-image-role=["']${tag}["'][^>]*)(src=["'])([^"']*)(["'][^>]*>)`,
      'gi'
    )

    updatedHtml = updatedHtml.replace(regex, (match, before, srcAttr, oldSrc, after) => {
      // Replace the src value while keeping the rest of the tag intact
      return `${before}${srcAttr}${url}${after}`
    })

    // Also handle cases where src comes before data-image-role
    const regexAlt = new RegExp(
      `(<img[^>]*src=["'])([^"']*)(["'][^>]*data-image-role=["']${tag}["'][^>]*>)`,
      'gi'
    )

    updatedHtml = updatedHtml.replace(regexAlt, (match, before, oldSrc, after) => {
      return `${before}${url}${after}`
    })
  })

  return updatedHtml
}


