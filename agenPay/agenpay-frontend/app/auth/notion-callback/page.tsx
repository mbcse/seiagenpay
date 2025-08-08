"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { authService } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Database,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ArrowRight
} from "lucide-react"

export default function NotionCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshUser } = useAuth()
  
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [error, setError] = useState("")

  useEffect(() => {
    const handleNotionCallback = async () => {
      try {
        const success = searchParams.get('success')
        const error = searchParams.get('error')

        // Handle OAuth errors
        if (error) {
          setStatus('error')
          setError(`Notion OAuth error: ${decodeURIComponent(error)}`)
          return
        }

        // Handle success
        if (success === 'true') {
          setStatus('success')
          await refreshUser() // Refresh user data to show Notion integration
          
          // Check if user already has a wallet to decide where to redirect
          const response = await authService.checkNotionIntegration()
          const dashboardData = response.data as { user?: { hasWallet?: boolean } }
          
          setTimeout(() => {
            if (dashboardData?.user?.hasWallet) {
              // User has both Notion and wallet - go to dashboard
              router.push('/dashboard')
            } else {
              // User needs wallet setup
              router.push('/auth/login?step=wallet')
            }
          }, 2000)
        } else {
          // No success or error parameter - something went wrong
          setStatus('error')
          setError('Invalid callback parameters')
        }
      } catch (err) {
        setStatus('error')
        setError('An unexpected error occurred during Notion authentication')
        console.error('Notion callback error:', err)
      }
    }

    handleNotionCallback()
  }, [searchParams, router, refreshUser])

  const handleRetry = () => {
    router.push('/auth/login?step=notion')
  }



  if (status === 'processing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center">
                <RefreshCw className="h-8 w-8 text-white animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Connecting Notion Workspace
              </h2>
              <p className="text-gray-600 mb-4">
                Processing your Notion authorization...
              </p>
              <div className="text-sm text-gray-500">
                This may take a few moments
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-r from-green-600 to-blue-600 rounded-2xl flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-green-900">
              Notion Connected Successfully!
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h3 className="font-semibold text-green-900 mb-2">What we created:</h3>
              <ul className="space-y-1 text-sm text-green-800">
                <li>• 💰 Payments Database - Track all payment requests</li>
                <li>• 🔄 Transactions Database - Monitor crypto transactions</li>
                <li>• 🧾 Invoices Database - Manage invoicing workflow</li>
              </ul>
            </div>

            <div className="text-center">
              <p className="text-gray-600 mb-4">
                Redirecting to your dashboard...
              </p>
              <Button onClick={() => router.push('/dashboard')} className="w-full">
                <ArrowRight className="mr-2 h-4 w-4" />
                Continue to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-red-900">
              Connection Failed
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Button onClick={handleRetry} className="w-full">
                <Database className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => router.push('/auth/login')} 
                className="w-full"
              >
                Back to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
} 