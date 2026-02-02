/**
 * Research source status constants
 * Used across avatar research and marketing angle creation
 */

export const INITIAL_SOURCE_STATUS = {
  webSearch: false,
  amazonReviews: false,
  redditDiscussions: false,
  industryBlogs: false,
  competitorAnalysis: false,
  marketTrends: false,
}

export const COMPLETED_SOURCE_STATUS = {
  webSearch: true,
  amazonReviews: true,
  redditDiscussions: true,
  industryBlogs: true,
  competitorAnalysis: true,
  marketTrends: true,
}

export type SourceStatus = {
  webSearch: boolean
  amazonReviews: boolean
  redditDiscussions: boolean
  industryBlogs: boolean
  competitorAnalysis: boolean
  marketTrends: boolean
}

/**
 * Helper functions for source status management
 */
export const resetSourceStatus = (): SourceStatus => ({ ...INITIAL_SOURCE_STATUS })

export const completeSourceStatus = (): SourceStatus => ({ ...COMPLETED_SOURCE_STATUS })

export const updateSourceStatus = (current: SourceStatus, updates: Partial<SourceStatus>): SourceStatus => ({
  ...current,
  ...updates,
})
