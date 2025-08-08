"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { authService } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  CreditCard, 
  Database, 
  Wallet, 
  AlertCircle,
  Loader2,
  Eye,
  EyeOff
} from "lucide-react"

export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, register, isAuthenticated, user } = useAuth()
  
  // Form states
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState<"auth" | "notion" | "wallet">("auth")
  
  // Form data
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: ""
  })

  // Handle URL parameters to set the correct step
  useEffect(() => {
    const urlStep = searchParams.get('step')
    if (urlStep && ['auth', 'notion', 'wallet'].includes(urlStep)) {
      setStep(urlStep as "auth" | "notion" | "wallet")
    }
  }, [searchParams])

  // Check if user is already authenticated and redirect appropriately
  useEffect(() => {
    if (isAuthenticated && user) {
      const hasNotionIntegration = (user as { hasNotionIntegration?: boolean }).hasNotionIntegration
      const hasWallet = (user as { hasWallet?: boolean }).hasWallet
      
      // If user has completed all steps, redirect to dashboard
      if (hasNotionIntegration && hasWallet) {
        router.push('/dashboard')
      } else if (!hasNotionIntegration && step === 'auth') {
        setStep('notion')
      } else if (hasNotionIntegration && !hasWallet && step === 'auth') {
        setStep('wallet')
      }
    }
  }, [isAuthenticated, user, router, step])

  // Update form data
  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError("")
  }

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await login(formData.email, formData.password)
      if (result.success) {
        // Check if user has Notion integration
        const dashboardResponse = await authService.getDashboard()
        if (dashboardResponse.success && dashboardResponse.data) {
          const data = dashboardResponse.data as { user?: { hasNotionIntegration?: boolean; hasWallet?: boolean } }
          
          if (!data.user?.hasNotionIntegration) {
            setStep("notion")
          } else if (!data.user?.hasWallet) {
            setStep("wallet")
          } else {
            router.push("/dashboard")
          }
        } else {
          setStep("notion") // Default to Notion setup
        }
      } else {
        setError(result.error || "Login failed")
      }
    } catch {
      setError("Login failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters")
      setIsLoading(false)
      return
    }

    try {
      const result = await register(formData.email, formData.password, formData.name)
      if (result.success) {
        setStep("notion") // Force Notion setup for new users
      } else {
        setError(result.error || "Registration failed")
      }
    } catch {
      setError("Registration failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Notion OAuth connection
  const handleNotionConnect = async () => {
    setIsLoading(true)
    setError("")

    try {
      const response = await authService.getNotionAuthUrl()
      if (response.success && response.authUrl) {
        // Redirect to Notion OAuth
        window.location.href = response.authUrl
      } else {
        setError(response.error || "Failed to get Notion auth URL")
        setIsLoading(false)
      }
    } catch {
      setError("Failed to initiate Notion authentication")
      setIsLoading(false)
    }
  }

  // Handle wallet creation
  const handleWalletCreation = async () => {
    setIsLoading(true)
    setError("")

    try {
      const response = await authService.createWallet()
      if (response.success) {
        // Request some testnet tokens
        await authService.requestFaucet()
        router.push("/dashboard")
      } else {
        setError(response.error || "Wallet creation failed")
      }
    } catch {
      setError("Failed to create wallet")
    } finally {
      setIsLoading(false)
    }
  }

  // Render authentication step
  if (step === "auth") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center">
              <CreditCard className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold">Welcome to AgenPay</CardTitle>
            <CardDescription>
              The AI-powered Web3 payment platform
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Tabs defaultValue="login" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={(e) => updateFormData("email", e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => updateFormData("password", e.target.value)}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => updateFormData("name", e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={(e) => updateFormData("email", e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => updateFormData("password", e.target.value)}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">Minimum 6 characters</p>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render Notion setup step
  if (step === "notion") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center">
              <Database className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold">Connect Notion Workspace</CardTitle>
            <CardDescription>
              Notion integration is required to manage your payment databases
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2">What we&apos;ll create:</h3>
                <ul className="space-y-1 text-sm text-blue-800">
                  <li>• 💰 Payments Database - Track all payment requests</li>
                  <li>• 🔄 Transactions Database - Monitor crypto transactions</li>
                  <li>• 🧾 Invoices Database - Manage invoicing workflow</li>
                </ul>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h3 className="font-semibold text-purple-900 mb-2">Secure OAuth Integration</h3>
                <p className="text-sm text-purple-800">
                  We&apos;ll securely connect to your Notion workspace using OAuth. 
                  You&apos;ll be redirected to Notion to authorize access.
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={handleNotionConnect} 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redirecting to Notion...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Connect with Notion
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render wallet setup step
  if (step === "wallet") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-r from-green-600 to-blue-600 rounded-2xl flex items-center justify-center">
              <Wallet className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold">Create Your Wallet</CardTitle>
            <CardDescription>
              Create a secure crypto wallet to send and receive payments
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="font-semibold text-green-900 mb-2">Your wallet will include:</h3>
                <ul className="space-y-1 text-sm text-green-800">
                  <li>• 🔒 Secure private key management</li>
                  <li>• 💰 Multi-currency support (ETH, BTC, USD)</li>
                  <li>• 🧪 Testnet tokens for development</li>
                  <li>• 🚀 Ready for mainnet deployment</li>
                </ul>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <Button 
                  onClick={handleWalletCreation} 
                  className="w-full" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating wallet...
                    </>
                  ) : (
                    <>
                      <Wallet className="mr-2 h-4 w-4" />
                      Create Wallet
                    </>
                  )}
                </Button>

                <Button 
                  variant="outline" 
                  onClick={() => router.push("/dashboard")} 
                  className="w-full"
                  disabled={isLoading}
                >
                  Skip for now
                </Button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                You can create a wallet later from your dashboard
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
} 