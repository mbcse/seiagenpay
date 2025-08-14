"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { authService } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Send,
  CreditCard,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  LogOut,
  Wallet,
  TrendingUp,
  TrendingDown,
  Activity,
  Plus,
  Play,
  Square,
} from "lucide-react"

interface DashboardData {
  user: {
    id: string
    email: string
    name: string
    hasNotionIntegration: boolean
    hasWallet: boolean
  }
  wallet?: {
    address: string
    balance: {
      ETH: string
      USD: string
    }
  }
  agent: {
    isRunning: boolean
    totalProcessed: number
    lastActivity?: string
    threadId?: string
  }
  transactions: Array<{
    id: string
    type: string
    amount: string
    currency: string
    status: string
    createdAt: string
    description?: string
  }>
  analytics: {
    totalSent: number
    totalReceived: number
    totalTransactions: number
    successRate: number
  }
}

export default function Dashboard() {
  const { user, logout, refreshUser } = useAuth()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [chatHistory, setChatHistory] = useState<Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
  }>>([])
  const [chatThreadId, setChatThreadId] = useState<string | undefined>(undefined)

  // Load dashboard data
  const loadDashboardData = async () => {
    try {
      setIsLoading(true)
      const response = await authService.getDashboard()
      
      if (response.success && response.data) {
        setDashboardData(response.data as DashboardData)
        await refreshUser()
      } else {
        setError(response.error || "Failed to load dashboard data")
      }
    } catch (err) {
      setError("Failed to load dashboard data")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  // Load initial data
  useEffect(() => {
    loadDashboardData()
  }, [])

  // Handle message processing
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || isProcessing) return

    setIsProcessing(true)
    setError("")

    const userMessage = message.trim()
    setMessage("")

    // Add user message to history
    setChatHistory(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }])

    try {
      const response = await authService.processPayment(
        userMessage, 
        chatThreadId || dashboardData?.agent.threadId
      )

      if (response.success && response.data) {
        const data = response.data as { response: string; threadId?: string }
        
        // Store threadId for conversation continuity
        if (data.threadId) {
          setChatThreadId(data.threadId)
          console.log('💬 Updated chat threadId:', data.threadId)
        }
        
        // Add AI response to history
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: data.response,
          timestamp: new Date()
        }])

        // No need to refresh dashboard for chat - it's just a conversation!
      } else {
        setError(response.error || "Failed to process message")
      }
    } catch (err) {
      setError("Failed to process message")
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle agent start/stop
  const handleAgentToggle = async () => {
    try {
      if (dashboardData?.agent.isRunning) {
        await authService.stopAgent()
      } else {
        await authService.startAgent(10) // 10 minute intervals
      }
      await loadDashboardData()
    } catch (err) {
      setError("Failed to toggle agent")
      console.error(err)
    }
  }

  // Handle wallet creation
  const handleCreateWallet = async () => {
    try {
      const response = await authService.createWallet()
      if (response.success) {
        await authService.requestFaucet() // Get some testnet tokens
        await loadDashboardData()
      } else {
        setError(response.error || "Failed to create wallet")
      }
    } catch (err) {
      setError("Failed to create wallet")
      console.error(err)
    }
  }

  // Handle faucet request
  const handleRequestFaucet = async () => {
    try {
      const response = await authService.requestFaucet()
      if (response.success) {
        await loadDashboardData()
      } else {
        setError(response.error || "Faucet request failed")
      }
    } catch (err) {
      setError("Faucet request failed")
      console.error(err)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "success":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "failed":
      case "error":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />
      case "failed":
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">Failed to load dashboard</p>
              <Button onClick={loadDashboardData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* User Info */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{user?.name}</h2>
              <p className="text-sm text-gray-600">{user?.email}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Status Indicators */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Notion</span>
              {dashboardData.user.hasNotionIntegration ? (
                <Badge className="bg-green-100 text-green-800">Connected</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">Not Connected</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Wallet</span>
              {dashboardData.user.hasWallet ? (
                <Badge className="bg-green-100 text-green-800">Created</Badge>
              ) : (
                <Badge className="bg-yellow-100 text-yellow-800">Not Created</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Agent</span>
              {dashboardData.agent.isRunning ? (
                <Badge className="bg-blue-100 text-blue-800">Running</Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800">Stopped</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Wallet Info */}
        {dashboardData.wallet ? (
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">Wallet</h3>
              <Button variant="outline" size="sm" onClick={handleRequestFaucet}>
                <Plus className="h-4 w-4 mr-1" />
                Faucet
              </Button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">ETH</span>
                <span className="text-sm font-mono">{dashboardData.wallet.balance.ETH}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">USD</span>
                <span className="text-sm font-mono">${dashboardData.wallet.balance.USD}</span>
              </div>
              <div className="text-xs text-gray-500 truncate">
                {dashboardData.wallet.address}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 border-b border-gray-200">
            <div className="text-center">
              <Wallet className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-3">No wallet created</p>
              <Button onClick={handleCreateWallet} size="sm" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Create Wallet
              </Button>
            </div>
          </div>
        )}

        {/* Analytics */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Analytics</h3>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3">
              <div className="flex items-center">
                <TrendingUp className="h-4 w-4 text-green-500 mr-2" />
                <div>
                  <div className="text-xs text-gray-600">Sent</div>
                  <div className="text-sm font-semibold">${dashboardData?.analytics?.totalSent}</div>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center">
                <TrendingDown className="h-4 w-4 text-blue-500 mr-2" />
                <div>
                  <div className="text-xs text-gray-600">Received</div>
                  <div className="text-sm font-semibold">${dashboardData?.analytics?.totalReceived}</div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Recent Transactions */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Recent Transactions</h3>
            <div className="space-y-2">
              {dashboardData.transactions.length > 0 ? (
                dashboardData.transactions.slice(0, 5).map((tx) => (
                  <Card key={tx.id} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium capitalize">{tx.type}</span>
                      {getStatusIcon(tx.status)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{tx.amount} {tx.currency}</span>
                      <Badge variant="secondary" className={getStatusColor(tx.status)}>
                        {tx.status}
                      </Badge>
                    </div>
                    {tx.description && (
                      <div className="text-xs text-gray-500 mt-1 truncate">{tx.description}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </div>
                  </Card>
                ))
              ) : (
                <div className="text-center py-4">
                  <Activity className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No transactions yet</p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AgenPay Dashboard</h1>
              <p className="text-sm text-gray-600">AI-powered Web3 payment agent</p>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant={dashboardData.agent.isRunning ? "destructive" : "default"}
                size="sm"
                onClick={handleAgentToggle}
              >
                {dashboardData.agent.isRunning ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Stop Agent
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Agent
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={loadDashboardData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {chatHistory.length === 0 && (
              <div className="text-center py-12">
                <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to AgenPay</h3>
                <p className="text-gray-600 mb-6">Start by typing a command like:</p>
                <div className="space-y-2 text-sm text-gray-500">
                  <div>&quot;Create an invoice for Acme Corp for 0.15 ETH&quot;</div>
                  <div>&quot;Send 0.1 ETH to 0x1234...&quot;</div>
                  <div>&quot;Show my payment analytics&quot;</div>
                  <div>&quot;Check my Notion database&quot;</div>
                </div>
              </div>
            )}

            {chatHistory.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-3xl rounded-lg px-4 py-2 ${
                    msg.role === "user" 
                      ? "bg-blue-600 text-white" 
                      : "bg-white border border-gray-200"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  <div className={`text-xs mt-2 ${
                    msg.role === "user" ? "text-blue-100" : "text-gray-500"
                  }`}>
                    {msg.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>AgenPay AI is processing...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Error Alert */}
        {error && (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-4">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto">
            <div className="flex space-x-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your command... (e.g., 'Create an invoice for Acme Corp for 0.15 ETH')"
                className="flex-1"
                disabled={isProcessing}
              />
              <Button type="submit" disabled={isProcessing || !message.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
