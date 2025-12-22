// lib/services/klaviyo.ts
import { logger } from '@/lib/utils/logger'

interface KlaviyoProfile {
  email: string
  first_name?: string
  phone_number?: string
  [key: string]: any // For custom properties
}

interface KlaviyoEvent {
  profile: { email: string }
  metric: { name: string }
  properties?: Record<string, any>
}

export class KlaviyoService {
  private apiKey: string
  private baseUrl = 'https://a.klaviyo.com/api'

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Klaviyo API key is required')
    }
    this.apiKey = apiKey
  }

  /**
   * Create or update a profile in Klaviyo
   */
  async createOrUpdateProfile(data: KlaviyoProfile): Promise<void> {
    try {
      // Extract top-level fields
      const { email, first_name, phone_number, ...customProperties } = data

      // Build properties object, filtering out undefined/null values
      const properties: Record<string, any> = {}
      Object.keys(customProperties).forEach(key => {
        if (customProperties[key] !== undefined && customProperties[key] !== null && customProperties[key] !== '') {
          properties[key] = customProperties[key]
        }
      })

      const response = await fetch(`${this.baseUrl}/profiles/`, {
        method: 'POST',
        headers: {
          'Authorization': `Klaviyo-API-Key ${this.apiKey}`,
          'revision': '2024-02-15',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            type: 'profile',
            attributes: {
              email: email,
              ...(first_name && { first_name }),
              ...(phone_number && { phone_number }),
              properties: properties,
            },
          },
        }),
      })

      const responseText = await response.text()
      
      if (!response.ok) {
        logger.error(`Klaviyo profile creation error: ${response.status} - ${responseText}`)
        throw new Error(`Klaviyo API error: ${response.status} - ${responseText}`)
      }

      let responseData: any = {}
      try {
        responseData = JSON.parse(responseText)
      } catch {
        responseData = { raw: responseText }
      }
      
      logger.log('Successfully created/updated Klaviyo profile:', email)
      logger.log('Klaviyo profile response:', JSON.stringify(responseData, null, 2))
    } catch (error) {
      logger.error('Error creating Klaviyo profile:', error)
      throw error
    }
  }

  /**
   * Subscribe a profile to a list with proper subscription status
   * Uses profile-subscription-bulk-create-jobs which:
   * 1. Adds profile to the list
   * 2. Sets subscription status to SUBSCRIBED (with single opt-in enabled)
   * This is the recommended Klaviyo method for subscribing profiles with consent
   */
  async subscribeToList(email: string, listId: string): Promise<void> {
    try {
      // Use profile-subscription-bulk-create-jobs as the primary method
      // This endpoint handles both adding to list AND setting subscription status to SUBSCRIBED
      // Since the list is set to single opt-in, profiles will be immediately subscribed
      const response = await fetch(`${this.baseUrl}/profile-subscription-bulk-create-jobs/`, {
        method: 'POST',
        headers: {
          'Authorization': `Klaviyo-API-Key ${this.apiKey}`,
          'revision': '2024-02-15',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            type: 'profile-subscription-bulk-create-job',
            attributes: {
              profiles: {
                data: [
                  {
                    type: 'profile',
                    attributes: {
                      email: email,
                    },
                  },
                ],
              },
            },
            relationships: {
              list: {
                data: {
                  type: 'list',
                  id: listId,
                },
              },
            },
          },
        }),
      })

      const responseText = await response.text()
      
      if (!response.ok) {
        logger.error(`Klaviyo subscription error: ${response.status} - ${responseText}`)
        return
      }

      let responseData: any = {}
      try {
        responseData = JSON.parse(responseText)
      } catch {
        responseData = { raw: responseText }
      }
      
      logger.log('Successfully created subscription job for Klaviyo list:', email)
      logger.log('Klaviyo subscription job response:', JSON.stringify(responseData, null, 2))
      logger.log('Note: Profile will be added to list and subscribed with SUBSCRIBED status')
      logger.log('The bulk job processes asynchronously - profile should appear in list within 10-30 seconds')
    } catch (error) {
      logger.error('Error subscribing to Klaviyo list:', error)
    }
  }




  /**
   * Track an event (e.g., "Joined Waitlist")
   */
  async trackEvent(event: KlaviyoEvent): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/events/`, {
        method: 'POST',
        headers: {
          'Authorization': `Klaviyo-API-Key ${this.apiKey}`,
          'revision': '2024-02-15',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            type: 'event',
            attributes: {
              properties: event.properties || {},
              metric: {
                data: {
                  type: 'metric',
                  attributes: {
                    name: event.metric.name,
                  },
                },
              },
              profile: {
                data: {
                  type: 'profile',
                  attributes: {
                    email: event.profile.email,
                  },
                },
              },
            },
          },
        }),
      })

      const responseText = await response.text()
      
      if (!response.ok) {
        logger.warn(`Klaviyo event tracking error (non-critical): ${response.status} - ${responseText}`)
        return
      }

      let responseData: any = {}
      try {
        responseData = JSON.parse(responseText)
      } catch {
        responseData = { raw: responseText }
      }
      
      logger.log('Successfully tracked Klaviyo event:', event.metric.name)
      logger.log('Klaviyo event response:', JSON.stringify(responseData, null, 2))
    } catch (error) {
      logger.error('Error tracking Klaviyo event:', error)
      // Don't throw - event tracking is less critical than profile creation
    }
  }
}

// Singleton instance - will be initialized with env var
let klaviyoServiceInstance: KlaviyoService | null = null

export function getKlaviyoService(): KlaviyoService | null {
  const apiKey = process.env.KLAVIYO_API_KEY
  if (!apiKey) {
    return null
  }
  
  if (!klaviyoServiceInstance) {
    klaviyoServiceInstance = new KlaviyoService(apiKey)
  }
  
  return klaviyoServiceInstance
}

