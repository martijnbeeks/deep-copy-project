"use client"

import { useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"

export default function AdminPage() {
  const [loading, setLoading] = useState(false)
  const [lastRecovery, setLastRecovery] = useState<string | null>(null)
  const [recoveryStats, setRecoveryStats] = useState<{
    checked: number
    completed: number
    failed: number
    stillProcessing: number
  } | null>(null)

  const handleRecoverJobs = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/recover-jobs', {
        method: 'POST'
      })
      
      if (response.ok) {
        const data = await response.json()
        setLastRecovery(new Date().toLocaleString())
        setRecoveryStats(data)
        toast({
          title: "Recovery Successful",
          description: `Checked ${data.checked} jobs: ${data.completed} completed, ${data.failed} failed, ${data.stillProcessing} still processing`
        })
      } else {
        throw new Error('Recovery failed')
      }
    } catch (error) {
      console.error('Recovery error:', error)
      toast({
        title: "Recovery Failed",
        description: "Failed to recover jobs. Check console for details.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground mt-2">
              Manage system operations and job recovery
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Job Recovery
              </CardTitle>
              <CardDescription>
                Recover any jobs that were stuck in processing status due to server restarts.
                This will check all processing jobs and either complete them or resume polling.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button 
                  onClick={handleRecoverJobs} 
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Recovering...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Recover Jobs
                    </>
                  )}
                </Button>
                
                {lastRecovery && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Last recovery: {lastRecovery}
                  </div>
                )}
              </div>

              {recoveryStats && (
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <h4 className="font-medium mb-2 text-green-800 dark:text-green-200">Last Recovery Results:</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Jobs Checked:</span>
                      <span className="ml-2 font-medium">{recoveryStats.checked}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Completed:</span>
                      <span className="ml-2 font-medium text-green-600">{recoveryStats.completed}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Failed:</span>
                      <span className="ml-2 font-medium text-red-600">{recoveryStats.failed}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Still Processing:</span>
                      <span className="ml-2 font-medium text-yellow-600">{recoveryStats.stillProcessing}</span>
                    </div>
                  </div>
                </div>
              )}
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">What this does:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Finds all jobs with "processing" status</li>
                  <li>• Checks their status with DeepCopy API</li>
                  <li>• Completes jobs that are "SUCCEEDED"</li>
                  <li>• Fails jobs that are "FAILED"</li>
                  <li>• Resumes polling for jobs still "RUNNING"</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Cron Job Status:</span>
                  <span className="text-green-600">✓ Running (every 2 minutes)</span>
                </div>
                <div className="flex justify-between">
                  <span>Immediate Status Check:</span>
                  <span className="text-green-600">✓ Enabled on job creation</span>
                </div>
                <div className="flex justify-between">
                  <span>Manual Recovery:</span>
                  <span className="text-green-600">✓ Available</span>
                </div>
                <div className="flex justify-between">
                  <span>Serverless Compatible:</span>
                  <span className="text-green-600">✓ Yes (Vercel Cron)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
