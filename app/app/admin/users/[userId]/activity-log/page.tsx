'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp, ArrowLeft, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ActivityLogItem {
  id: string
  user_id: string
  job_type: 'deep_research' | 'pre_lander_images' | 'template_images' | 'static_ads' | 'avatar_research'
  title?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
  completed_at?: string
  request_body: Record<string, any>
  output?: Record<string, any>
  error_message?: string
  metadata?: Record<string, any>
}

const jobTypeColors = {
  deep_research: 'bg-blue-100 text-blue-800',
  pre_lander_images: 'bg-green-100 text-green-800',
  template_images: 'bg-purple-100 text-purple-800',
  static_ads: 'bg-orange-100 text-orange-800',
  avatar_research: 'bg-pink-100 text-pink-800'
}

const jobTypeLabels = {
  deep_research: 'Deep Research',
  pre_lander_images: 'Pre-lander Images',
  template_images: 'Template Images',
  static_ads: 'Static Ads',
  avatar_research: 'Avatar Research'
}

const statusIcons = {
  pending: <Loader2 className="h-4 w-4 animate-spin" />,
  processing: <Loader2 className="h-4 w-4 animate-spin" />,
  completed: <CheckCircle className="h-4 w-4 text-green-600" />,
  failed: <XCircle className="h-4 w-4 text-red-600" />
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800'
}

export default function UserActivityLogPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [activities, setActivities] = useState<ActivityLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const userId = params.userId as string

  useEffect(() => {
    fetchActivityLog()
  }, [userId])

  const fetchActivityLog = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/users/${userId}/activity-log`)
      if (!response.ok) {
        throw new Error('Failed to fetch activity log')
      }
      const data = await response.json()
      setActivities(data.activities || [])
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load activity log',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedItems(newExpanded)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatJson = (obj: any) => {
    return JSON.stringify(obj, null, 2)
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">User Activity Log</h1>
            <p className="text-muted-foreground">
              User ID: {userId} • {activities.length} activities found
            </p>
          </div>
        </div>
        <Button onClick={fetchActivityLog} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Activity List */}
      <div className="space-y-4">
        {activities.map((activity) => (
          <Card key={activity.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Badge className={jobTypeColors[activity.job_type]}>
                    {jobTypeLabels[activity.job_type]}
                  </Badge>
                  <Badge className={statusColors[activity.status]}>
                    <div className="flex items-center space-x-1">
                      {statusIcons[activity.status]}
                      <span>{activity.status}</span>
                    </div>
                  </Badge>
                  {activity.title && (
                    <span className="font-medium">{activity.title}</span>
                  )}
                </div>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{formatDate(activity.created_at)}</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <Collapsible
                open={expandedItems.has(activity.id)}
                onOpenChange={() => toggleExpanded(activity.id)}
              >
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span>View Details</span>
                    {expandedItems.has(activity.id) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="space-y-4 mt-4">
                  {/* Timestamps */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Created:</span>
                      <div>{formatDate(activity.created_at)}</div>
                    </div>
                    <div>
                      <span className="font-medium">Updated:</span>
                      <div>{formatDate(activity.updated_at)}</div>
                    </div>
                    {activity.completed_at && (
                      <div>
                        <span className="font-medium">Completed:</span>
                        <div>{formatDate(activity.completed_at)}</div>
                      </div>
                    )}
                  </div>

                  {/* Request Body */}
                  <div>
                    <h4 className="font-medium mb-2">Request Body:</h4>
                    <pre className="bg-gray-100 p-3 rounded-md text-xs overflow-auto max-h-64">
                      {formatJson(activity.request_body)}
                    </pre>
                  </div>

                  {/* Output */}
                  {activity.output && (
                    <div>
                      <h4 className="font-medium mb-2">Output:</h4>
                      <pre className="bg-green-50 p-3 rounded-md text-xs overflow-auto max-h-64">
                        {formatJson(activity.output)}
                      </pre>
                    </div>
                  )}

                  {/* Error Message */}
                  {activity.error_message && (
                    <div>
                      <h4 className="font-medium mb-2 text-red-600">Error Message:</h4>
                      <div className="bg-red-50 p-3 rounded-md text-sm">
                        {activity.error_message}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Metadata:</h4>
                      <pre className="bg-gray-50 p-3 rounded-md text-xs overflow-auto max-h-32">
                        {formatJson(activity.metadata)}
                      </pre>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        ))}

        {activities.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">No activities found for this user.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
