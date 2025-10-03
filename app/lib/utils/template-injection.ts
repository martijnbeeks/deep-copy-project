import { Listicle, Advertorial } from '@/lib/api/deepcopy-client'

export interface TemplateInjectionResult {
  html: string
  type: 'listicle' | 'advertorial'
  angle: string
}

/**
 * Injects JSON data into HTML templates
 */
export class TemplateInjector {
  private static async loadTemplate(type: 'listicle' | 'advertorial'): Promise<string> {
    try {
      const templatePath = `/templates/${type}_template.html`
      const response = await fetch(templatePath)
      if (!response.ok) {
        throw new Error(`Failed to load template: ${response.statusText}`)
      }
      return await response.text()
    } catch (error) {
      console.error(`Error loading ${type} template:`, error)
      throw error
    }
  }

  /**
   * Inject listicle data into the listicle template
   */
  static async injectListicle(data: Listicle, angle: string): Promise<TemplateInjectionResult> {
    const template = await this.loadTemplate('listicle')
    
    const injectionScript = `
      <script>
        window.LISTICLE_DATA = ${JSON.stringify(data)};
      </script>
    `
    
    const html = template.replace('<body>', `<body>${injectionScript}`)
    
    return {
      html,
      type: 'listicle',
      angle
    }
  }

  /**
   * Inject advertorial data into the advertorial template
   */
  static async injectAdvertorial(data: Advertorial, angle: string): Promise<TemplateInjectionResult> {
    const template = await this.loadTemplate('advertorial')
    
    const injectionScript = `
      <script>
        window.ADVERTORIAL_DATA = ${JSON.stringify(data)};
      </script>
    `
    
    const html = template.replace('<body>', `<body>${injectionScript}`)
    
    return {
      html,
      type: 'advertorial',
      angle
    }
  }

  /**
   * Automatically detect content type and inject accordingly
   */
  static async injectContent(content: Listicle | Advertorial | string, angle: string): Promise<TemplateInjectionResult> {
    let parsedContent: Listicle | Advertorial
    if (typeof content === 'string') {
      try {
        parsedContent = JSON.parse(content)
      } catch (error) {
        throw new Error('Invalid content format')
      }
    } else {
      parsedContent = content
    }
    
    if (parsedContent && typeof parsedContent === 'object' && (parsedContent as any).listicles && Array.isArray((parsedContent as any).listicles)) {
      return this.injectListicle(parsedContent as Listicle, angle)
    }
    
    return this.injectAdvertorial(parsedContent as Advertorial, angle)
  }
}

/**
 * Utility function to escape HTML content
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Utility function to format content for display
 */
export function formatContentForDisplay(content: Listicle | Advertorial | string): {
  title: string
  summary: string
  type: 'listicle' | 'advertorial'
} {
  let parsedContent: Listicle | Advertorial
  if (typeof content === 'string') {
    try {
      parsedContent = JSON.parse(content)
    } catch (error) {
      return {
        title: 'Invalid Content',
        summary: 'Failed to parse content',
        type: 'advertorial'
      }
    }
  } else {
    parsedContent = content
  }
  
  if (parsedContent && typeof parsedContent === 'object' && (parsedContent as any).listicles && Array.isArray((parsedContent as any).listicles)) {
    const listicle = parsedContent as Listicle
    return {
      title: listicle.title,
      summary: listicle.summary,
      type: 'listicle'
    }
  } else {
    const advertorial = parsedContent as Advertorial
    return {
      title: advertorial.title,
      summary: advertorial.subtitle,
      type: 'advertorial'
    }
  }
}
