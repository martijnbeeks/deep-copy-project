"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { TrendingUp, Target } from "lucide-react"

interface AnalyticsData {
  qualityScore: number
  readabilityScore: number
  seoScore: number
  toneAccuracy: number
  keywordDensity: Array<{ keyword: string; density: number; target: number }>
  contentMetrics: {
    sentences: number
    paragraphs: number
    avgSentenceLength: number
    fleschScore: number
  }
  performancePredictions: Array<{ metric: string; score: number; benchmark: number }>
}

interface AnalyticsOverviewProps {
  analytics: AnalyticsData
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"]

export function AnalyticsOverview({ analytics }: AnalyticsOverviewProps) {
  const overallScore = Math.round(
    (analytics.qualityScore + analytics.readabilityScore + analytics.seoScore + analytics.toneAccuracy) / 4,
  )

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-100 text-green-800">Excellent</Badge>
    if (score >= 60) return <Badge className="bg-yellow-100 text-yellow-800">Good</Badge>
    return <Badge className="bg-red-100 text-red-800">Needs Work</Badge>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Content Analytics
          </CardTitle>
          <CardDescription>Comprehensive analysis of your generated content</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className={`text-3xl font-bold ${getScoreColor(overallScore)}`}>{overallScore}</div>
              <p className="text-sm text-muted-foreground">Overall Score</p>
              {getScoreBadge(overallScore)}
            </div>
            <div className="text-center">
              <div className={`text-2xl font-semibold ${getScoreColor(analytics.qualityScore)}`}>
                {analytics.qualityScore}
              </div>
              <p className="text-sm text-muted-foreground">Quality</p>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-semibold ${getScoreColor(analytics.readabilityScore)}`}>
                {analytics.readabilityScore}
              </div>
              <p className="text-sm text-muted-foreground">Readability</p>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-semibold ${getScoreColor(analytics.seoScore)}`}>{analytics.seoScore}</div>
              <p className="text-sm text-muted-foreground">SEO</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Score Breakdown</h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Content Quality</span>
                    <span>{analytics.qualityScore}%</span>
                  </div>
                  <Progress value={analytics.qualityScore} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Readability</span>
                    <span>{analytics.readabilityScore}%</span>
                  </div>
                  <Progress value={analytics.readabilityScore} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>SEO Optimization</span>
                    <span>{analytics.seoScore}%</span>
                  </div>
                  <Progress value={analytics.seoScore} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Tone Accuracy</span>
                    <span>{analytics.toneAccuracy}%</span>
                  </div>
                  <Progress value={analytics.toneAccuracy} className="h-2" />
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Content Metrics</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">{analytics.contentMetrics.sentences}</div>
                  <p className="text-sm text-muted-foreground">Sentences</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">{analytics.contentMetrics.paragraphs}</div>
                  <p className="text-sm text-muted-foreground">Paragraphs</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">{analytics.contentMetrics.avgSentenceLength}</div>
                  <p className="text-sm text-muted-foreground">Avg Words/Sentence</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">{analytics.contentMetrics.fleschScore}</div>
                  <p className="text-sm text-muted-foreground">Flesch Score</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Keyword Analysis
            </CardTitle>
            <CardDescription>How well your content targets specified keywords</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.keywordDensity.map((item, index) => (
                <div key={item.keyword}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{item.keyword}</span>
                    <span>
                      {item.density}% (target: {item.target}%)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Progress value={(item.density / item.target) * 100} className="h-2 flex-1" />
                    <Badge variant={item.density >= item.target * 0.8 ? "default" : "secondary"}>
                      {item.density >= item.target * 0.8 ? "Good" : "Low"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Predictions
            </CardTitle>
            <CardDescription>Predicted performance based on content analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.performancePredictions}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="metric" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="score" fill="#10b981" />
                <Bar dataKey="benchmark" fill="#e5e7eb" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
