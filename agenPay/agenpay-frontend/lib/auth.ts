export interface User {
  id: string
  email: string
  name: string
  hasNotionIntegration?: boolean
  hasWallet?: boolean
}

export interface AuthResponse {
  success: boolean
  token?: string
  user?: User
  error?: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface NotionOAuthResponse {
  success: boolean
  authUrl?: string
  error?: string
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

class AuthService {
  private token: string | null = null
  private initialized = false

  constructor() {
    // Don't initialize token on server side to prevent hydration issues
    // Token will be initialized when first accessed on client side
  }

  private initializeToken() {
    if (this.initialized || typeof window === 'undefined') return
    
    this.token = this.getTokenFromCookie()
    this.initialized = true
    console.log('🔧 Auth service initialized on client side')
  }

  private getTokenFromCookie(): string | null {
    if (typeof document === 'undefined') return null
    
    try {
      const cookies = document.cookie.split(';')
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=')
        if (name === 'token' && value) {
          console.log('🍪 Token found in cookie')
          return decodeURIComponent(value)
        }
      }
      console.log('🍪 No token found in cookies')
      return null
    } catch (error) {
      console.error('❌ Error reading token from cookie:', error)
      return null
    }
  }

  private setTokenCookie(token: string) {
    if (typeof document === 'undefined') return
    
    try {
      // Set cookie with 7 days expiry
      const expires = new Date()
      expires.setDate(expires.getDate() + 7)
      const cookieValue = `token=${encodeURIComponent(token)}; expires=${expires.toUTCString()}; path=/; SameSite=Strict; Secure=${window.location.protocol === 'https:'}`
      document.cookie = cookieValue
      console.log('🍪 Token cookie set successfully')
    } catch (error) {
      console.error('❌ Error setting token cookie:', error)
    }
  }

  private removeTokenCookie() {
    if (typeof document === 'undefined') return
    
    try {
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict'
      console.log('🍪 Token cookie removed successfully')
    } catch (error) {
      console.error('❌ Error removing token cookie:', error)
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Initialize token if not already done
    this.initializeToken()
    
    const url = `${API_BASE_URL}${endpoint}`
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`)
      }

      return data
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error)
      throw error
    }
  }

  async register(email: string, password: string, name: string): Promise<AuthResponse> {
    try {
      const response = await this.request<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      })

      if (response.success && response.token) {
        this.token = response.token
        this.setTokenCookie(response.token)
        this.initialized = true // Mark as initialized after successful registration
      }

      return response
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      }
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await this.request<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      if (response.success && response.token) {
        this.token = response.token
        this.setTokenCookie(response.token)
        this.initialized = true // Mark as initialized after successful login
      }

      return response
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }
    }
  }

  async getNotionAuthUrl(): Promise<NotionOAuthResponse> {
    try {
      const response = await this.request<NotionOAuthResponse>('/api/notion/auth-url', {
        method: 'GET',
      })

      return response
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get Notion auth URL',
      }
    }
  }

  async checkNotionIntegration(): Promise<ApiResponse> {
    try {
      // Check if Notion integration is complete by fetching dashboard
      const response = await this.request<ApiResponse>('/api/dashboard')
      return response
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check Notion integration',
      }
    }
  }

  // Legacy method for backwards compatibility
  async connectNotion(notionApiKey: string): Promise<ApiResponse> {
    try {
      const response = await this.request<ApiResponse>('/api/notion/login', {
        method: 'POST',
        body: JSON.stringify({ notionApiKey }),
      })

      return response
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Notion connection failed',
      }
    }
  }

  async createWallet(): Promise<ApiResponse> {
    try {
      const response = await this.request<ApiResponse>('/api/wallet/create', {
        method: 'POST',
      })

      return response
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Wallet creation failed',
      }
    }
  }

  async getWallet(): Promise<ApiResponse> {
    try {
      const response = await this.request<ApiResponse>('/api/wallet')
      return response
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get wallet',
      }
    }
  }

  async requestFaucet(): Promise<ApiResponse> {
    try {
      const response = await this.request<ApiResponse>('/api/wallet/faucet', {
        method: 'POST',
      })

      return response
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Faucet request failed',
      }
    }
  }

  async getDashboard(): Promise<ApiResponse> {
    try {
      const response = await this.request<ApiResponse>('/api/dashboard')
      return response
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get dashboard data',
      }
    }
  }

  async startAgent(intervalMinutes: number = 10): Promise<ApiResponse> {
    try {
      const response = await this.request<ApiResponse>('/api/agent/start', {
        method: 'POST',
        body: JSON.stringify({ intervalMinutes }),
      })

      return response
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start agent',
      }
    }
  }

  async stopAgent(): Promise<ApiResponse> {
    try {
      const response = await this.request<ApiResponse>('/api/agent/stop', {
        method: 'POST',
      })

      return response
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop agent',
      }
    }
  }

  async processPayment(message: string, threadId?: string): Promise<ApiResponse> {
    try {
      const response = await this.request<ApiResponse>('/api/agent/process', {
        method: 'POST',
        body: JSON.stringify({ message, threadId }),
      })

      return response
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment processing failed',
      }
    }
  }

  async getAgentStatus(): Promise<ApiResponse> {
    try {
      const response = await this.request<ApiResponse>('/api/agent/status')
      return response
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get agent status',
      }
    }
  }

  async getTransactions(limit: number = 20, type?: string, status?: string): Promise<ApiResponse> {
    try {
      const params = new URLSearchParams()
      params.append('limit', limit.toString())
      if (type) params.append('type', type)
      if (status) params.append('status', status)

      const response = await this.request<ApiResponse>(`/api/transactions?${params}`)
      return response
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get transactions',
      }
    }
  }

  async sendCrypto(toAddress: string, amount: string, currency: string = 'ETH'): Promise<ApiResponse> {
    try {
      const response = await this.request<ApiResponse>('/api/wallet/send', {
        method: 'POST',
        body: JSON.stringify({ toAddress, amount, currency }),
      })

      return response
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send crypto',
      }
    }
  }

  setToken(token: string) {
    this.token = token
    this.setTokenCookie(token)
    this.initialized = true
  }

  getToken(): string | null {
    // Initialize token if not already done
    this.initializeToken()
    return this.token
  }

  removeToken() {
    console.log('🗑️ Removing auth token')
    this.token = null
    this.removeTokenCookie()
    this.initialized = true // Keep initialized but with null token
    console.log('✅ Token removed successfully')
  }

  isAuthenticated(): boolean {
    // Initialize token if not already done
    this.initializeToken()
    return !!this.token
  }

  logout() {
    console.log('🚪 Logging out and redirecting')
    this.removeToken()
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login'
    }
  }
}

export const authService = new AuthService()
export default authService 