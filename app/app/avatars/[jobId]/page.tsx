"use client"

import { Sidebar, SidebarTrigger } from "@/components/dashboard/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { EmptyState } from "@/components/ui/empty-state"
import { useRouter } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import { Users, CheckCircle, Calendar, User, ArrowLeft, Loader2, Globe, Package, MessageSquare, FileText, BarChart, Info, Search } from "lucide-react"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/hooks/use-toast"

interface Avatar {
    persona_name: string
    description: string
    age_range: string
    gender: string
    key_buying_motivation: string
    pain_point?: string
    emotion?: string
    desire?: string
    is_broad_avatar?: boolean
    is_researched?: boolean
    job_id: string
    parent_job_id?: string
    avatar_job_id?: string
    job_title: string
    job_created_at: string
    avatar_index?: number
    avatar_job_status?: string
    avatar_job_progress?: number
}

function JobAvatarsContent({ jobId }: { jobId: string }) {
    const { user, isAuthenticated, isLoading: isAuthLoading } = useAuthStore()
    const router = useRouter()
    const { toast } = useToast()
    const [avatars, setAvatars] = useState<Avatar[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isResearching, setIsResearching] = useState(false)
    const [jobInfo, setJobInfo] = useState<{ title: string; created_at: string } | null>(null)

    // Avatar details modal state
    const [selectedAvatarForDetails, setSelectedAvatarForDetails] = useState<Avatar | null>(null)
    const [showAvatarDetails, setShowAvatarDetails] = useState(false)

    // Research loading modal state
    const [showResearchLoading, setShowResearchLoading] = useState(false)
    const [researchProgress, setResearchProgress] = useState(0)
    const [researchStage, setResearchStage] = useState(0)
    const [currentJobId, setCurrentJobId] = useState<string | null>(null)
    const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null)
    const [sourceStatus, setSourceStatus] = useState({
        webSearch: false,
        amazonReviews: false,
        redditDiscussions: false,
        industryBlogs: false,
        competitorAnalysis: false,
        marketTrends: false,
    })

    useEffect(() => {
        // Don't redirect if we're still loading the auth state (during hydration)
        if (isAuthLoading) return

        if (!isAuthenticated || !user) {
            router.replace("/login")
            return
        }

        fetchAvatars()
    }, [isAuthenticated, user, router, jobId, isAuthLoading])

    // Early return if still loading or not authenticated to prevent skeleton loader
    if (isAuthLoading || !isAuthenticated || !user) {
        return null
    }

    const fetchAvatars = async () => {
        try {
            setIsLoading(true)
            const url = `/api/avatars?jobId=${jobId}`

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${user?.email || ''}`
                }
            })

            if (!response.ok) {
                throw new Error('Failed to fetch avatars')
            }

            const data = await response.json()
            setAvatars(data.avatars || [])

            // Set job info from first avatar
            if (data.avatars && data.avatars.length > 0) {
                setJobInfo({
                    title: data.avatars[0].job_title,
                    created_at: data.avatars[0].job_created_at
                })
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to load avatars. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleAvatarClick = (avatar: Avatar) => {
        // Open avatar details modal
        setSelectedAvatarForDetails(avatar)
        setShowAvatarDetails(true)
    }

    const handleStartResearch = async (avatar: Avatar) => {
        // Close details modal
        setShowAvatarDetails(false)

        if (avatar.is_researched) {
            // If already researched, go to results page - use avatar_job_id if available, otherwise job_id
            const targetJobId = (avatar as any).avatar_job_id || avatar.job_id
            router.push(`/results/${targetJobId}`)
        } else {
            // If not researched, show loading modal first
            setSelectedAvatar(avatar)
            setShowResearchLoading(true)
            setResearchProgress(0)
            setResearchStage(0)
            setCurrentJobId(null)

            // Reset source status
            setSourceStatus({
                webSearch: false,
                amazonReviews: false,
                redditDiscussions: false,
                industryBlogs: false,
                competitorAnalysis: false,
                marketTrends: false,
            })

            // Start progress animation
            const startTime = Date.now()
            const progressInterval = setInterval(() => {
                const elapsed = (Date.now() - startTime) / 1000 // seconds
                const estimatedMaxTime = 480 // 8 minutes in seconds
                const baseProgress = Math.min(85, (elapsed / estimatedMaxTime) * 85)

                setResearchProgress(prev => {
                    return Math.max(prev, Math.floor(baseProgress))
                })

                // Update source status based on elapsed time
                const elapsedMinutes = elapsed / 60
                if (elapsedMinutes >= 0.5) setSourceStatus(prev => ({ ...prev, webSearch: true }))
                if (elapsedMinutes >= 1) setSourceStatus(prev => ({ ...prev, amazonReviews: true }))
                if (elapsedMinutes >= 1.5) setSourceStatus(prev => ({ ...prev, redditDiscussions: true }))
            }, 1000)

            // Update stages based on elapsed time
            setTimeout(() => setResearchStage(1), 30000)   // Stage 1 at 30s
            setTimeout(() => setResearchStage(2), 90000)   // Stage 2 at 1.5min
            setTimeout(() => setResearchStage(3), 180000)  // Stage 3 at 3min
            setTimeout(() => setResearchStage(4), 300000)  // Stage 4 at 5min

            try {
                setIsResearching(true)
                const response = await fetch('/api/avatars/research', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${user?.email || ''}`
                    },
                    body: JSON.stringify({
                        jobId: avatar.job_id,
                        personaName: avatar.persona_name
                    })
                })

                if (!response.ok) {
                    const errorData = await response.json()
                    throw new Error(errorData.error || 'Failed to start research')
                }

                const data = await response.json()
                const avatarJobId = data.job.id // Use avatar job ID (the new job created for this avatar)

                setCurrentJobId(avatarJobId)

                // Refresh avatars to show updated research status
                await fetchAvatars()

                // Poll for job status
                const pollJobStatus = async () => {
                    const maxAttempts = 180 // Max 15 minutes (180 * 5s)
                    const pollInterval = 5000 // Poll every 5 seconds

                    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                        try {
                            const statusResponse = await fetch(`/api/jobs/${avatarJobId}/status`, {
                                method: 'GET',
                                headers: {
                                    'Content-Type': 'application/json',
                                }
                            })

                            if (!statusResponse.ok) {
                                throw new Error(`Status check failed: ${statusResponse.status}`)
                            }

                            const statusData = await statusResponse.json()
                            const status = statusData.status?.toLowerCase()

                            // Update progress and stage based on status
                            if (status === 'submitted') {
                                setResearchStage(1)
                                setResearchProgress(prev => Math.max(prev, 15))
                            } else if (status === 'running' || status === 'processing') {
                                const elapsed = (Date.now() - startTime) / 1000
                                if (elapsed > 180) {
                                    setResearchStage(3)
                                } else if (elapsed > 90) {
                                    setResearchStage(2)
                                }
                                const progressFromTime = Math.min(85, 20 + (elapsed / 480) * 65)
                                setResearchProgress(prev => Math.max(prev, Math.floor(progressFromTime)))
                            } else if (status === 'completed' || status === 'succeeded') {
                                clearInterval(progressInterval)
                                setResearchStage(4)
                                setResearchProgress(100)

                                // Mark all sources as complete
                                setSourceStatus({
                                    webSearch: true,
                                    amazonReviews: true,
                                    redditDiscussions: true,
                                    industryBlogs: true,
                                    competitorAnalysis: true,
                                    marketTrends: true,
                                })

                                // Wait a moment then redirect to results
                                setTimeout(() => {
                                    setShowResearchLoading(false)
                                    setResearchProgress(0)
                                    setResearchStage(0)
                                    setCurrentJobId(null)
                                    setSelectedAvatar(null)
                                    setSelectedAvatarForDetails(null)

                                    // Reset source status
                                    setSourceStatus({
                                        webSearch: false,
                                        amazonReviews: false,
                                        redditDiscussions: false,
                                        industryBlogs: false,
                                        competitorAnalysis: false,
                                        marketTrends: false,
                                    })

                                    // Redirect to avatar job's results page
                                    router.push(`/results/${avatarJobId}`)
                                }, 1000)
                                return
                            } else if (status === 'failed' || status === 'failure') {
                                clearInterval(progressInterval)
                                setShowResearchLoading(false)
                                setResearchProgress(0)
                                setResearchStage(0)
                                setCurrentJobId(null)
                                setSelectedAvatar(null)
                                setSelectedAvatarForDetails(null)

                                setSourceStatus({
                                    webSearch: false,
                                    amazonReviews: false,
                                    redditDiscussions: false,
                                    industryBlogs: false,
                                    competitorAnalysis: false,
                                    marketTrends: false,
                                })

                                toast({
                                    title: "Error",
                                    description: "Job processing failed. Please try again.",
                                    variant: "destructive",
                                })
                                return
                            }

                            // If still processing, wait and try again
                            if (attempt < maxAttempts) {
                                await new Promise(resolve => setTimeout(resolve, pollInterval))
                            }

                        } catch (err) {
                            if (attempt === maxAttempts) {
                                clearInterval(progressInterval)
                                setShowResearchLoading(false)
                                setResearchProgress(0)
                                setResearchStage(0)
                                setCurrentJobId(null)
                                setSelectedAvatar(null)
                                setSelectedAvatarForDetails(null)

                                setSourceStatus({
                                    webSearch: false,
                                    amazonReviews: false,
                                    redditDiscussions: false,
                                    industryBlogs: false,
                                    competitorAnalysis: false,
                                    marketTrends: false,
                                })

                                toast({
                                    title: "Error",
                                    description: "Failed to check job status. Please check your jobs page.",
                                    variant: "destructive",
                                })
                                return
                            }
                            await new Promise(resolve => setTimeout(resolve, pollInterval))
                        }
                    }

                    // Timeout reached
                    clearInterval(progressInterval)
                    setShowResearchLoading(false)
                    setResearchProgress(0)
                    setResearchStage(0)
                    setCurrentJobId(null)
                    setSelectedAvatar(null)
                    setSelectedAvatarForDetails(null)

                    setSourceStatus({
                        webSearch: false,
                        amazonReviews: false,
                        redditDiscussions: false,
                        industryBlogs: false,
                        competitorAnalysis: false,
                        marketTrends: false,
                    })

                    toast({
                        title: "Processing Taking Longer",
                        description: "Your job is still processing. This can take 5-8 minutes or more. Please check your jobs page for updates.",
                        variant: "default",
                    })
                }

                // Start polling
                pollJobStatus()

            } catch (error) {
                clearInterval(progressInterval)
                setShowResearchLoading(false)
                setResearchProgress(0)
                setResearchStage(0)
                setCurrentJobId(null)
                setSelectedAvatar(null)
                setSelectedAvatarForDetails(null)

                setSourceStatus({
                    webSearch: false,
                    amazonReviews: false,
                    redditDiscussions: false,
                    industryBlogs: false,
                    competitorAnalysis: false,
                    marketTrends: false,
                })

                toast({
                    title: "Error",
                    description: error instanceof Error ? error.message : "Failed to start research. Please try again.",
                    variant: "destructive",
                })
            } finally {
                setIsResearching(false)
            }
        }
    }

    // No filtering needed - show all avatars for this job
    const filteredAvatars = avatars

    const getGenderIcon = (gender: string) => {
        switch (gender.toLowerCase()) {
            case 'male': return '👨'
            case 'female': return '👩'
            case 'both': return '👥'
            default: return '👤'
        }
    }

    // Helper function to capitalize first letter of gender
    const capitalizeFirst = (str: string): string => {
        if (!str) return str;
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    if (!user) {
        return (
            <div className="flex h-screen bg-background">
                <div className="w-64 border-r bg-card">
                    <div className="p-6 space-y-4">
                        <div className="h-8 w-32 bg-muted animate-pulse rounded" />
                    </div>
                </div>
                <main className="flex-1 p-6">
                    <div className="space-y-6">
                        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
                    </div>
                </main>
            </div>
        )
    }

    return (
        <>
            <div className="flex h-screen bg-background overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-auto ml-16">
                    <div className="p-4 md:p-6">
                        <div className="mb-6 pb-6 border-b border-border/50">
                            <div className="flex items-center gap-3">
                                <SidebarTrigger />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-4 flex-wrap">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => router.push('/dashboard')}
                                            className="flex items-center gap-2"
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                            Back to Dashboard
                                        </Button>
                                        {jobInfo && (
                                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary">
                                                <span className="text-sm font-medium">
                                                    {jobInfo.title.charAt(0).toUpperCase() + jobInfo.title.slice(1)} • {new Date(jobInfo.created_at).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                        )}
                                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary">
                                            <h1 className="text-sm font-medium">
                                                Customer Avatars
                                            </h1>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Avatars Grid */}
                        {isLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <Card key={i} className="animate-pulse">
                                        <CardHeader>
                                            <div className="h-6 w-3/4 bg-muted rounded" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2">
                                                <div className="h-4 w-full bg-muted rounded" />
                                                <div className="h-4 w-5/6 bg-muted rounded" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : filteredAvatars.length === 0 ? (
                            <EmptyState
                                icon={Users}
                                title="No avatars found"
                                description="This job has no avatars"
                                action={{
                                    label: "Go to Dashboard",
                                    onClick: () => router.push("/dashboard"),
                                }}
                            />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredAvatars.map((avatar, index) => (
                                    <Card
                                        key={`${avatar.job_id}-${index}`}
                                        className={`bg-card border-border shadow-sm hover:shadow-md transition-all cursor-pointer ${avatar.is_researched
                                            ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20'
                                            : ''
                                            }`}
                                        onClick={() => handleAvatarClick(avatar)}
                                    >
                                        <CardContent className="p-4">
                                            <div className="space-y-3">
                                                {/* Header with name and gender icon */}
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <CardTitle className="text-base font-semibold text-foreground line-clamp-1 ">
                                                                <Badge variant="outline" className="text-xs font-semibold bg-muted text-foreground border-border mr-2">
                                                                    #{index + 1}
                                                                </Badge>
                                                                {avatar.persona_name}
                                                            </CardTitle>
                                                            {avatar.is_researched && (
                                                                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {avatar.is_researched ? (
                                                                <Badge className="bg-green-600 text-white text-xs">
                                                                    Researched
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-xs">
                                                                    Not Researched
                                                                </Badge>
                                                            )}
                                                            {avatar.is_broad_avatar && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    Broad
                                                                </Badge>
                                                            )}
                                                            {avatar.age_range && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    {avatar.age_range}
                                                                </Badge>
                                                            )}
                                                            {avatar.gender && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    {capitalizeFirst(avatar.gender)}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-2xl flex-shrink-0">
                                                        {getGenderIcon(avatar.gender)}
                                                    </div>
                                                </div>

                                                {/* Description */}
                                                {avatar.description && (
                                                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                                        {avatar.description}
                                                    </p>
                                                )}

                                                {/* Desire */}
                                                {avatar.desire && (
                                                    <div className="pt-2 border-t border-border/50">
                                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                                            <span className="font-medium text-foreground">Desire: </span>
                                                            {avatar.desire}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Avatar Details Modal */}
            <Dialog open={showAvatarDetails} onOpenChange={setShowAvatarDetails}>
                <DialogContent className="!max-w-[56rem] sm:!max-w-[56rem] max-h-[95vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {selectedAvatarForDetails && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <div className="text-2xl">{getGenderIcon(selectedAvatarForDetails.gender)}</div>
                                    <div>
                                        <div className="text-xl">{selectedAvatarForDetails.persona_name}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            {selectedAvatarForDetails.is_researched ? (
                                                <Badge className="bg-green-600 text-white">
                                                    <CheckCircle className="h-3 w-3 mr-1" />
                                                    Researched
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline">Not Researched</Badge>
                                            )}
                                            {selectedAvatarForDetails.is_broad_avatar && (
                                                <Badge variant="outline">Broad Avatar</Badge>
                                            )}
                                        </div>
                                    </div>
                                </DialogTitle>
                            </DialogHeader>

                            <div className="space-y-6 mt-4">
                                {/* Description */}
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground mb-2">Description</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {selectedAvatarForDetails.description}
                                    </p>
                                </div>

                                {/* Demographics */}
                                <div className="grid grid-cols-3 gap-4">
                                    {selectedAvatarForDetails.age_range && (
                                        <div>
                                            <h3 className="text-sm font-semibold text-foreground mb-2">Age Range</h3>
                                            <Badge variant="outline">{selectedAvatarForDetails.age_range}</Badge>
                                        </div>
                                    )}
                                    {selectedAvatarForDetails.gender && (
                                        <div>
                                            <h3 className="text-sm font-semibold text-foreground mb-2">Gender</h3>
                                            <Badge variant="outline">{capitalizeFirst(selectedAvatarForDetails.gender)}</Badge>
                                        </div>
                                    )}
                                    {/* Emotion */}
                                    {selectedAvatarForDetails.emotion && (
                                        <div>
                                            <h3 className="text-sm font-semibold text-foreground mb-2">Emotion</h3>
                                            <p className="text-sm text-muted-foreground leading-relaxed">
                                                {selectedAvatarForDetails.emotion}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Key Buying Motivation */}
                                {selectedAvatarForDetails.key_buying_motivation && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground mb-2">Key Buying Motivation</h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {selectedAvatarForDetails.key_buying_motivation}
                                        </p>
                                    </div>
                                )}

                                {/* Pain Point */}
                                {selectedAvatarForDetails.pain_point && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground mb-2">Pain Point</h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {selectedAvatarForDetails.pain_point}
                                        </p>
                                    </div>
                                )}

                                {/* Desire */}
                                {selectedAvatarForDetails.desire && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground mb-2">Desire</h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {selectedAvatarForDetails.desire}
                                        </p>
                                    </div>
                                )}

                                {/* Job Info */}
                                <div className="pt-4 border-t border-border">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                        <Calendar className="h-4 w-4" />
                                        <span className="font-medium">Job:</span>
                                        <span>{selectedAvatarForDetails.job_title}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground ml-6">
                                        Created: {new Date(selectedAvatarForDetails.job_created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="mt-6">
                                {selectedAvatarForDetails.is_researched ? (
                                    <Button
                                        onClick={() => {
                                            setShowAvatarDetails(false)
                                            router.push(`/results/${selectedAvatarForDetails.job_id}`)
                                        }}
                                        className="w-full"
                                    >
                                        View Results
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={() => handleStartResearch(selectedAvatarForDetails)}
                                        disabled={isResearching}
                                        className="w-full"
                                    >
                                        {isResearching ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Starting Research...
                                            </>
                                        ) : (
                                            'Start Research'
                                        )}
                                    </Button>
                                )}
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Research Generation Loading Dialog */}
            <Dialog open={showResearchLoading} onOpenChange={(open) => {
                if (!open) {
                    setShowResearchLoading(false)
                }
            }}>
                <DialogContent className="max-w-2xl border-border">
                    <div className="flex flex-col py-6 space-y-6">
                        {/* Selected Marketing Angle and Target Audience */}
                        {selectedAvatar && (
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground">Selected Marketing Angle</p>
                                    <p className="text-base font-semibold text-foreground">
                                        {selectedAvatar.key_buying_motivation
                                            ? selectedAvatar.key_buying_motivation.split('.')[0] || "Before/After Transformation Angle"
                                            : "Before/After Transformation Angle"}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground">Target Audience</p>
                                    <p className="text-base font-semibold text-foreground">
                                        {selectedAvatar.persona_name || "Evidence-seeking fitness enthusiasts"}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Analyzing Sources */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-foreground">Analyzing Sources:</h3>
                            <div className="space-y-2">
                                {/* Web Search */}
                                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                                    <div className="flex items-center gap-3">
                                        <Globe className="w-5 h-5 text-muted-foreground" />
                                        <span className="text-sm font-medium text-foreground">Web Search</span>
                                    </div>
                                    {sourceStatus.webSearch ? (
                                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                            <CheckCircle className="w-4 h-4 text-primary-foreground" />
                                        </div>
                                    ) : (
                                        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                                    )}
                                </div>

                                {/* Amazon Reviews */}
                                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                                    <div className="flex items-center gap-3">
                                        <Package className="w-5 h-5 text-muted-foreground" />
                                        <span className="text-sm font-medium text-foreground">Amazon Reviews</span>
                                    </div>
                                    {sourceStatus.amazonReviews ? (
                                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                            <CheckCircle className="w-4 h-4 text-primary-foreground" />
                                        </div>
                                    ) : (
                                        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                                    )}
                                </div>

                                {/* Reddit Discussions */}
                                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                                    <div className="flex items-center gap-3">
                                        <MessageSquare className="w-5 h-5 text-muted-foreground" />
                                        <span className="text-sm font-medium text-foreground">Reddit Discussions</span>
                                    </div>
                                    {sourceStatus.redditDiscussions ? (
                                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                            <CheckCircle className="w-4 h-4 text-primary-foreground" />
                                        </div>
                                    ) : (
                                        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                                    )}
                                </div>

                                {/* Industry Blogs */}
                                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                                    <div className="flex items-center gap-3">
                                        <FileText className="w-5 h-5 text-muted-foreground" />
                                        <span className="text-sm font-medium text-foreground">Industry Blogs</span>
                                    </div>
                                    {sourceStatus.industryBlogs ? (
                                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                            <CheckCircle className="w-4 h-4 text-primary-foreground" />
                                        </div>
                                    ) : (
                                        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                                    )}
                                </div>

                                {/* Competitor Analysis */}
                                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                                    <div className="flex items-center gap-3">
                                        <Search className="w-5 h-5 text-muted-foreground" />
                                        <span className="text-sm font-medium text-foreground">Competitor Analysis</span>
                                    </div>
                                    {sourceStatus.competitorAnalysis ? (
                                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                            <CheckCircle className="w-4 h-4 text-primary-foreground" />
                                        </div>
                                    ) : (
                                        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                                    )}
                                </div>

                                {/* Market Trends */}
                                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                                    <div className="flex items-center gap-3">
                                        <BarChart className="w-5 h-5 text-muted-foreground" />
                                        <span className="text-sm font-medium text-foreground">Market Trends</span>
                                    </div>
                                    {sourceStatus.marketTrends ? (
                                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                            <CheckCircle className="w-4 h-4 text-primary-foreground" />
                                        </div>
                                    ) : (
                                        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Compiling Message - Show when all sources are complete but job is still processing */}
                        {sourceStatus.webSearch &&
                            sourceStatus.amazonReviews &&
                            sourceStatus.redditDiscussions &&
                            sourceStatus.industryBlogs &&
                            sourceStatus.competitorAnalysis &&
                            sourceStatus.marketTrends &&
                            researchProgress < 100 && (
                                <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg border border-primary/30">
                                    <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">Compiling Your Results</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            All research sources have been analyzed. We're now generating your high-converting landing pages...
                                        </p>
                                    </div>
                                </div>
                            )}

                        {/* Information Message */}
                        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                            <div className="flex items-start gap-2">
                                <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-foreground mb-1">You can close this window</p>
                                    <p className="text-sm text-muted-foreground">
                                        We'll send you an email notification when your landing pages are ready. Feel free to continue working on other things.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}

function JobAvatarsLoading() {
    return (
        <div className="flex h-screen bg-background">
            <Sidebar />
            <main className="flex-1 overflow-auto ml-16">
                <div className="p-4 md:p-6">
                    <div className="space-y-6">
                        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Card key={i} className="animate-pulse">
                                    <CardHeader>
                                        <div className="h-6 w-3/4 bg-muted rounded" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            <div className="h-4 w-full bg-muted rounded" />
                                            <div className="h-4 w-5/6 bg-muted rounded" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}

export default function JobAvatarsPage({ params }: { params: { jobId: string } }) {
    return (
        <ErrorBoundary>
            <Suspense fallback={<JobAvatarsLoading />}>
                <JobAvatarsContent jobId={params.jobId} />
            </Suspense>
        </ErrorBoundary>
    )
}
