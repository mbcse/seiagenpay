"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  ArrowRight,
  CheckCircle,
  Database,
  Globe,
  MessageSquare,
  Zap,
  Users,
  Bot,
  LinkIcon,
  Calendar,
  Send,
  RefreshCw,
  Bell,
  Sparkles,
  LayoutDashboard,
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"

export default function LandingPage() {
  const [email, setEmail] = useState("")
  const { isAuthenticated, user, isLoading } = useAuth()

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-gray-900">AgenPay</h1>
              </div>
              <div className="hidden md:block ml-10">
                <div className="flex items-baseline space-x-8">
                  <a href="#features" className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium">
                    Features
                  </a>
                  <a href="#pricing" className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium">
                    Pricing
                  </a>
                  <a href="#docs" className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium">
                    Docs
                  </a>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {!isLoading && (
                <>
                  {isAuthenticated && user ? (
                    <>
                      <span className="text-sm text-gray-600">Welcome back, {user.name || user.email}!</span>
                      <Button asChild>
                        <Link href="/dashboard">
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          Dashboard
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" asChild>
                        <Link href="/auth/login">Sign In</Link>
                      </Button>
                      <Button asChild>
                        <Link href="/auth/login">Get Started</Link>
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-16 bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge variant="secondary" className="mb-4">
              <Bot className="h-4 w-4 mr-2" />
              Agentic Payment Infrastructure
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Your AI agent handles
              <br />
              <span className="text-blue-600">all crypto payments</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              AgenPay is the first agentic payment infrastructure. An AI agent that automatically schedules, sends,
              receives, and manages all your crypto payments. Powered by X402Pay & Notion.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-lg px-8" asChild>
                <Link href="/auth/login">
                  Start Your Agent Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8">
                Watch Demo
              </Button>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Connect your Notion • Agent handles the rest • Powered by X402Pay
            </p>
          </div>

          {/* Hero Demo */}
          <div className="mt-16 relative">
            <div className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  <span className="text-sm text-gray-600 ml-4">AgenPay Agent • Connected to Notion</span>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2">
                {/* Notion Side */}
                <div className="p-6 border-r border-gray-200">
                  <div className="flex items-center space-x-2 mb-4">
                    <Database className="h-6 w-6 text-gray-700" />
                    <h3 className="font-semibold">Your Notion Database</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded p-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-sm">Acme Corp Invoice</p>
                          <p className="text-xs text-gray-600">Due: Tomorrow</p>
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded p-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-sm">Monthly Subscription</p>
                          <p className="text-xs text-gray-600">Auto-renew: Jan 15</p>
                        </div>
                        <Badge className="bg-blue-100 text-blue-800">Scheduled</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Agent Side */}
                <div className="p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <Bot className="h-6 w-6 text-blue-600" />
                    <h3 className="font-semibold">AgenPay Agent</h3>
                    <div className="flex items-center text-xs text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                      Active
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start space-x-2">
                      <Send className="h-4 w-4 text-blue-500 mt-0.5" />
                      <div>
                        <p className="font-medium">Sent invoice to Acme Corp</p>
                        <p className="text-gray-600 text-xs">Payment link via X402Pay • 2 min ago</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <Calendar className="h-4 w-4 text-purple-500 mt-0.5" />
                      <div>
                        <p className="font-medium">Scheduled subscription renewal</p>
                        <p className="text-gray-600 text-xs">Auto-charge on Jan 15 • 5 min ago</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <Bell className="h-4 w-4 text-orange-500 mt-0.5" />
                      <div>
                        <p className="font-medium">Following up on overdue payment</p>
                        <p className="text-gray-600 text-xs">Automated reminder sent • 10 min ago</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Set it up once, agent handles everything
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Connect your Notion workspace and let AgenPay's AI agent automate your entire crypto payment workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg text-center">
              <CardHeader>
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Database className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle>1. Connect Notion</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Link your existing Notion database or use our template. Your payment data stays in Notion where you
                  already work.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg text-center">
              <CardHeader>
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bot className="h-8 w-8 text-purple-600" />
                </div>
                <CardTitle>2. Agent Activates</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  AgenPay AI monitors your Notion database 24/7, automatically creating invoices, scheduling payments,
                  and handling follow-ups.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg text-center">
              <CardHeader>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle>3. Payments Flow</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  X402Pay processes all crypto transactions while your agent handles scheduling, reminders, refunds, and
                  updates your Notion automatically.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Your AI payment agent capabilities</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              AgenPay's agent doesn't just process payments—it manages your entire payment workflow intelligently.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <Calendar className="h-12 w-12 text-blue-600 mb-4" />
                <CardTitle>Automated Scheduling</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Agent automatically schedules recurring payments, subscription renewals, and invoice due dates based
                  on your Notion data.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <Send className="h-12 w-12 text-purple-600 mb-4" />
                <CardTitle>Smart Payment Sending</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Create payment requests in Notion, agent instantly generates X402Pay links and sends them to clients
                  with personalized messages.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <Bell className="h-12 w-12 text-green-600 mb-4" />
                <CardTitle>Intelligent Follow-ups</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Agent tracks payment status and automatically sends reminders, escalations, and thank you messages at
                  the right time.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <RefreshCw className="h-12 w-12 text-red-600 mb-4" />
                <CardTitle>Automatic Reconciliation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  When payments are received, agent automatically updates your Notion database, marks invoices as paid,
                  and triggers next actions.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <MessageSquare className="h-12 w-12 text-orange-600 mb-4" />
                <CardTitle>Natural Language Control</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Chat with your agent using plain English: "Send invoice to Acme Corp for 0.15 ETH" or "Refund John's
                  deposit."
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <Sparkles className="h-12 w-12 text-indigo-600 mb-4" />
                <CardTitle>Workflow Automation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Agent learns your patterns and automates complex workflows like subscription management, refund
                  processing, and client onboarding.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Notion Integration Showcase */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Works natively with your Notion workspace
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                No need to learn new tools. AgenPay's agent integrates seamlessly with your existing Notion databases,
                turning them into powerful payment management systems.
              </p>
              <div className="space-y-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                  <span>Create invoices directly in Notion</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                  <span>Agent monitors database changes in real-time</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                  <span>Automatic status updates and payment tracking</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                  <span>Custom workflows based on your database structure</span>
                </div>
              </div>
              <Button size="lg" className="mt-8">
                Connect Your Notion
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="bg-white rounded border shadow-sm">
                <div className="border-b p-4">
                  <h3 className="font-semibold flex items-center">
                    <Database className="h-5 w-5 mr-2" />
                    Client Invoices Database
                  </h3>
                </div>
                <div className="p-4">
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-4 text-sm font-medium text-gray-600 border-b pb-2">
                      <div>Client</div>
                      <div>Amount</div>
                      <div>Status</div>
                      <div>Action</div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm items-center">
                      <div>Acme Corp</div>
                      <div>0.15 ETH</div>
                      <Badge className="bg-yellow-100 text-yellow-800 w-fit">Pending</Badge>
                      <div className="text-blue-600 text-xs">Agent: Sent reminder</div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm items-center">
                      <div>TechStart</div>
                      <div>0.25 ETH</div>
                      <Badge className="bg-green-100 text-green-800 w-fit">Paid</Badge>
                      <div className="text-green-600 text-xs">Agent: Updated</div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm items-center">
                      <div>DevCorp</div>
                      <div>0.08 ETH</div>
                      <Badge className="bg-blue-100 text-blue-800 w-fit">Scheduled</Badge>
                      <div className="text-purple-600 text-xs">Agent: Will send Jan 15</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Simple pricing for your payment agent</h2>
            <p className="text-xl text-gray-600">Start free, scale as your automated payments grow</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-2 border-gray-200">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Starter Agent</CardTitle>
                <div className="text-4xl font-bold mt-4">Free</div>
                <p className="text-gray-600 mt-2">Perfect for getting started</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    Up to $1,000/month automated
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    Basic AI agent capabilities
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    Notion integration
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    X402Pay processing
                  </li>
                </ul>
                <Button className="w-full mt-6" variant="outline">
                  Start Free Agent
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-500 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-blue-500">Most Popular</Badge>
              </div>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Pro Agent</CardTitle>
                <div className="text-4xl font-bold mt-4">2.9%</div>
                <p className="text-gray-600 mt-2">Per automated transaction</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    Unlimited automated volume
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    Advanced agent workflows
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    Smart scheduling & follow-ups
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    Custom Notion templates
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    Priority agent support
                  </li>
                </ul>
                <Button className="w-full mt-6">Activate Pro Agent</Button>
              </CardContent>
            </Card>

            <Card className="border-2 border-gray-200">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Enterprise Agent</CardTitle>
                <div className="text-4xl font-bold mt-4">Custom</div>
                <p className="text-gray-600 mt-2">For large-scale automation</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    Volume-based pricing
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    Multi-workspace agents
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    Custom agent training
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    Dedicated agent manager
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    White-label deployment
                  </li>
                </ul>
                <Button className="w-full mt-6" variant="outline">
                  Contact Sales
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Ready to automate your crypto payments?</h2>
          <p className="text-xl text-blue-100 mb-8">
            Connect your Notion workspace and let AgenPay's AI agent handle all your payment operations automatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button size="lg" variant="secondary" className="text-lg px-8" asChild>
              <Link href="/auth/login">
                Start Your Agent Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 text-white border-white hover:bg-white hover:text-blue-600"
            >
              Watch Agent Demo
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Input
              type="email"
              placeholder="Enter your email for agent updates"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="max-w-xs"
            />
            <Button variant="secondary">Get Agent Updates</Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">AgenPay</h3>
              <p className="text-gray-400 mb-4">
                Agentic payment infrastructure. Your AI handles all crypto payments automatically.
              </p>
              <div className="flex space-x-4">
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                  <Globe className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                  <Users className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                  <LinkIcon className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Agent Features</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white">
                    Automated Scheduling
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Smart Follow-ups
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Notion Integration
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    X402Pay Processing
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Developers</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white">
                    Agent API
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Notion Templates
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Webhooks
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Agent Status
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white">
                    About AgenPay
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Agent Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Careers
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 AgenPay. All rights reserved. Powered by X402Pay & Notion.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
