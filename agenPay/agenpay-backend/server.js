#!/usr/bin/env node

/**
 * AgenPay Multi-User API Server
 * Express.js server with authentication, Notion integration, Privy wallets, and AI agents
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import AgenPayAgent from './lib/AgentPayAgent.js';
import NotionService from './lib/NotionService.js';
import WalletService from './lib/WalletService.js';
import X402PayService from './lib/X402PayService.js';
import SchedulingService from './lib/SchedulingService.js';

// Load environment variables
config();

// Initialize services
const app = express();
const prisma = new PrismaClient();
const walletService = new WalletService();
const x402PayService = new X402PayService();
const schedulingService = new SchedulingService();

// Store active agents for each user
const activeAgents = new Map();

// 🔧 Setup X402Pay routes
console.log('🔧 Setting up X402 payment routes...');
app.use('/', x402PayService.app); // Mount X402Pay routes to main app

// 🔧 Middleware
app.use(helmet());
app.use(cors());
// app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// 🛡️ Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, notionApiKey: true, walletAddress: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// 🏠 Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: 'connected',
      wallet: walletService.initialized ? 'live' : 'mock',
    },
  });
});

// 📝 User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split('@')[0],
      },
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log(`✅ User registered: ${email}`);
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// 🔐 User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    console.log(user);

    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log(`✅ User logged in: ${email}`);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        hasNotionIntegration: !!user.notionApiKey,
        hasWallet: !!user.walletAddress,
      },
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 🗃️ Get Notion OAuth URL
app.get('/api/notion/auth-url', authenticateToken, async (req, res) => {
  try {
    const authUrl = NotionService.generateOAuthUrl(req.user.id);
    res.json({
      success: true,
      authUrl
    });
  } catch (error) {
    console.error('❌ Notion auth URL error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 🔗 Handle Notion OAuth Callback
app.get('/api/notion/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/auth/notion-callback?error=missing_code_or_state`);
    }

    // Handle OAuth callback
    const oauthResult = await NotionService.handleOAuthCallback(code, state);
    
    // Complete integration
    const notionService = new NotionService();
    const result = await notionService.completeIntegration(oauthResult.userId, oauthResult.accessToken);

    console.log(`✅ Notion integration completed for user ${oauthResult.userId}`);
    
    // Redirect to frontend with success
    res.redirect(`${frontendUrl}/auth/notion-callback?success=true`);
  } catch (error) {
    console.error('❌ Notion OAuth callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const errorMessage = encodeURIComponent(error.message);
    res.redirect(`${frontendUrl}/auth/notion-callback?error=${errorMessage}`);
  }
});



// 💳 Create Wallet
app.post('/api/wallet/create', authenticateToken, async (req, res) => {
  try {
    const { network = 'sei-testnet' } = req.body;

    // Check if user already has wallet
    const hasWallet = await walletService.hasWallet(req.user.id);
    if (hasWallet) {
      return res.status(400).json({ error: 'User already has a wallet' });
    }

    // Validate network
    const supportedNetworks = walletService.getSupportedNetworks();
    const isValidNetwork = supportedNetworks.some(n => n.id === network);
    if (!isValidNetwork) {
      return res.status(400).json({ 
        error: 'Invalid network', 
        supportedNetworks: supportedNetworks.map(n => n.id) 
      });
    }

    // Create new wallet
    const walletResult = await walletService.createWallet(req.user.id, network);

    console.log(`✅ Wallet created for user ${req.user.email} on ${network}`);
    
    res.status(201).json({
      success: true,
      data: walletResult,
      message: 'Wallet created successfully'
    });
  } catch (error) {
    console.error('❌ Wallet creation error:', error);
    res.status(500).json({ error: 'Wallet creation failed' });
  }
});

// 💰 Get Wallet Info
app.get('/api/wallet', authenticateToken, async (req, res) => {
  try {
    const walletInfo = await walletService.getWallet(req.user.id);
    res.json({
      success: true,
      data: walletInfo
    });
  } catch (error) {
    console.error('❌ Get wallet error:', error);
    res.status(404).json({ 
      success: false,
      error: 'Wallet not found' 
    });
  }
});

// 🚰 Request Testnet Tokens
app.post('/api/wallet/faucet', authenticateToken, async (req, res) => {
  try {
    const { network = 'sei-testnet' } = req.body;

    // Validate network (only testnet networks support faucet)
    const supportedNetworks = walletService.getSupportedNetworks();
    const targetNetwork = supportedNetworks.find(n => n.id === network);
    
    if (!targetNetwork) {
      return res.status(400).json({ 
        error: 'Invalid network', 
        supportedNetworks: supportedNetworks.map(n => n.id) 
      });
    }

    if (!targetNetwork.isTestnet) {
      return res.status(400).json({ 
        error: 'Faucet only available for testnet networks',
        testnetNetworks: supportedNetworks.filter(n => n.isTestnet).map(n => n.id)
      });
    }

    const faucetResult = await walletService.requestTestnetTokens(req.user.id, network);
    
    console.log(`✅ Testnet tokens requested for user ${req.user.email} on ${network}`);
    res.json({
      success: true,
      data: faucetResult,
      message: 'Testnet tokens requested successfully'
    });
  } catch (error) {
    console.error('❌ Faucet error:', error);
    res.status(500).json({ error: 'Faucet request failed' });
  }
});

// 🌐 Get Supported Networks
app.get('/api/wallet/networks', authenticateToken, async (req, res) => {
  try {
    const networks = walletService.getSupportedNetworks();
    res.json({
      success: true,
      networks,
    });
  } catch (error) {
    console.error('❌ Get networks error:', error);
    res.status(500).json({ error: 'Failed to get supported networks' });
  }
});

// 🪙 Get Supported Tokens
app.get('/api/wallet/tokens', authenticateToken, async (req, res) => {
  try {
    const { network = 'sei-testnet' } = req.query;
    
    const supportedNetworks = walletService.getSupportedNetworks();
    const isValidNetwork = supportedNetworks.some(n => n.id === network);
    if (!isValidNetwork) {
      return res.status(400).json({ 
        error: 'Invalid network', 
        supportedNetworks: supportedNetworks.map(n => n.id) 
      });
    }

    const tokens = walletService.getSupportedTokens(network);
    res.json({
      success: true,
      network,
      tokens,
    });
  } catch (error) {
    console.error('❌ Get tokens error:', error);
    res.status(500).json({ error: 'Failed to get supported tokens' });
  }
});

// 📊 Wallet Status & Privy Info
app.get('/api/wallet/status', authenticateToken, async (req, res) => {
  try {
    const privyStatus = walletService.getStatus();
    const hasWallet = await walletService.hasWallet(req.user.id);
    
    let walletInfo = null;
    if (hasWallet) {
      try {
        walletInfo = await walletService.getWallet(req.user.id);
      } catch (error) {
        console.warn('⚠️ Could not get wallet info:', error.message);
      }
    }

    res.json({
      success: true,
      privy: privyStatus,
      hasWallet,
      wallet: walletInfo,
    });
  } catch (error) {
    console.error('❌ Get wallet status error:', error);
    res.status(500).json({ error: 'Failed to get wallet status' });
  }
});

// 📊 Dashboard Analytics
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    // Get wallet analytics
    const walletAnalytics = await walletService.getWalletAnalytics(req.user.id);
    
    // Get agent status (check if running in memory + database status)
    const isAgentRunning = activeAgents.has(req.user.id);
    const agent = await prisma.agent.findUnique({
      where: { userId: req.user.id },
    });

    // Get recent transactions with proper formatting
    const dbTransactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Format transactions for frontend
    const transactions = dbTransactions.map(tx => ({
      id: tx.id,
      type: tx.type.toLowerCase(), // INCOMING -> incoming, OUTGOING -> outgoing
      amount: tx.amount.toString(),
      currency: tx.currency,
      status: tx.status.toLowerCase(), // COMPLETED -> completed
      createdAt: tx.createdAt.toISOString(),
      description: tx.description || `${tx.type} payment`,
      toAddress: tx.toAddress,
      fromAddress: tx.fromAddress,
      txHash: tx.txHash
    }));

    // Get Notion analytics if available
    let notionAnalytics = null;
    if (req.user.notionApiKey) {
      try {
        const notionService = new NotionService(req.user.notionApiKey);
        notionAnalytics = await notionService.getPaymentAnalytics(req.user.id);
      } catch (error) {
        console.warn('⚠️ Notion analytics failed:', error.message);
      }
    }

    // Calculate analytics from real transaction data
    const analytics = {
      totalSent: transactions.filter(tx => tx.type === 'outgoing' && tx.status === 'completed')
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0),
      totalReceived: transactions.filter(tx => tx.type === 'incoming' && tx.status === 'completed')
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0),
      totalTransactions: transactions.length,
      successRate: transactions.length > 0 
        ? (transactions.filter(tx => tx.status === 'completed').length / transactions.length) * 100 
        : 0
    };

    const dashboard = {
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        hasNotionIntegration: !!req.user.notionApiKey,
        hasWallet: !!req.user.walletAddress,
      },
      wallet: walletAnalytics,
      agent: {
        isRunning: isAgentRunning, // ✅ Fixed: Use isRunning instead of status
        status: isAgentRunning ? 'RUNNING' : 'STOPPED',
        lastActivity: agent?.lastActivity,
        totalProcessed: agent?.totalProcessed || 0,
        totalSent: agent?.totalSent || 0,
        totalReceived: agent?.totalReceived || 0,
        totalAmountSent: agent?.totalAmountSent || 0,
        totalAmountReceived: agent?.totalAmountReceived || 0,
        threadId: `user-${req.user.id}-chat-session` // For conversation continuity
      },
      transactions,
      analytics, // ✅ Added: Real analytics calculated from transactions
      notion: notionAnalytics,
    };

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('❌ Dashboard error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Dashboard data retrieval failed' 
    });
  }
});

// 🤖 Start Agent
app.post('/api/agent/start', authenticateToken, async (req, res) => {
  try {
    const { intervalMinutes = 10 } = req.body;

    // Check if agent already running
    if (activeAgents.has(req.user.id)) {
      return res.status(400).json({ error: 'Agent already running' });
    }

    // Create and start agent with shared services
    const userConfig = {
      notionApiKey: req.user.notionApiKey,
    };

    const sharedServices = {
      x402PayService: x402PayService,  // Pass the shared X402PayService instance
    };

    const agent = new AgenPayAgent(req.user.id, userConfig, sharedServices);
    await agent.startMonitoring(intervalMinutes);

    // Store active agent
    activeAgents.set(req.user.id, agent);

    console.log(`✅ Agent started for user ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'Agent started successfully',
      intervalMinutes,
    });
  } catch (error) {
    console.error('❌ Agent start error:', error);
    res.status(500).json({ error: 'Failed to start agent' });
  }
});

// 🛑 Stop Agent
app.post('/api/agent/stop', authenticateToken, async (req, res) => {
  try {
    const agent = activeAgents.get(req.user.id);
    
    if (!agent) {
      return res.status(400).json({ error: 'Agent not running' });
    }

    await agent.stopMonitoring();
    activeAgents.delete(req.user.id);

    console.log(`✅ Agent stopped for user ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'Agent stopped successfully',
    });
  } catch (error) {
    console.error('❌ Agent stop error:', error);
    res.status(500).json({ error: 'Failed to stop agent' });
  }
});

// 💬 Process Payment (Chat with Agent)
app.post('/api/agent/process', authenticateToken, async (req, res) => {
  try {
    const { message, threadId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    // Get or create agent
    let agent = activeAgents.get(req.user.id);
    
    if (!agent) {
      const userConfig = {
        notionApiKey: req.user.notionApiKey,
      };
      
      const sharedServices = {
        x402PayService: x402PayService,  // Pass the shared X402PayService instance
      };
      
      agent = new AgenPayAgent(req.user.id, userConfig, sharedServices);
      activeAgents.set(req.user.id, agent);
    }

    // Process payment request
    const result = await agent.processPayment(message, threadId);

    // Extract the AI's response from the processed result
    let aiResponse = 'I apologize, but I encountered an issue processing your request. Please try again.';
    
    console.log('🔍 Debug - Agent result structure:', {
      hasMessages: !!result.messages,
      messageCount: result.messages?.length || 0,
      threadId: result.threadId
    });
    
    if (result.messages && Array.isArray(result.messages) && result.messages.length > 0) {
      // Get the last message which should be the AI's response
      const lastMessage = result.messages[result.messages.length - 1];
      console.log('🔍 Last message:', lastMessage);
      
      if (lastMessage && lastMessage.content) {
        aiResponse = typeof lastMessage.content === 'string' 
          ? lastMessage.content 
          : JSON.stringify(lastMessage.content);
        console.log('✅ Found AI response:', aiResponse.substring(0, 100) + '...');
      }
    } else {
      console.log('⚠️ No messages found in result');
    }

    console.log(`✅ Payment processed for user ${req.user.email}: ${aiResponse.substring(0, 100)}...`);
    
    res.json({
      success: true,
      data: {
        response: aiResponse,
        threadId: result.threadId,
        fullResult: result, // Include full result for debugging
      }
    });
  } catch (error) {
    console.error('❌ Payment processing error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Payment processing failed'
    });
  }
});

// 📈 Transaction History
app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, type, status } = req.query;

    const where = { userId: req.user.id };
    if (type) where.type = type;
    if (status) where.status = status;

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    });

    res.json({
      success: true,
      transactions,
      total: transactions.length,
    });
  } catch (error) {
    console.error('❌ Transaction history error:', error);
    res.status(500).json({ error: 'Failed to retrieve transactions' });
  }
});

// 💸 Send Crypto
app.post('/api/wallet/send', authenticateToken, async (req, res) => {
  try {
    const { toAddress, amount, currency = 'ETH', network = 'sei-testnet' } = req.body;

    if (!toAddress || !amount) {
      return res.status(400).json({ error: 'Recipient address and amount required' });
    }

    if (!walletService.validateAddress(toAddress)) {
      return res.status(400).json({ error: 'Invalid recipient address' });
    }

    // Validate network
    const supportedNetworks = walletService.getSupportedNetworks();
    const isValidNetwork = supportedNetworks.some(n => n.id === network);
    if (!isValidNetwork) {
      return res.status(400).json({ 
        error: 'Invalid network', 
        supportedNetworks: supportedNetworks.map(n => n.id) 
      });
    }

    // Validate currency for network
    const supportedTokens = walletService.getSupportedTokens(network);
    const isValidCurrency = supportedTokens.some(t => t.symbol.toUpperCase() === currency.toUpperCase());
    if (!isValidCurrency) {
      return res.status(400).json({ 
        error: 'Invalid currency for network', 
        supportedTokens: supportedTokens.map(t => t.symbol) 
      });
    }

    const result = await walletService.sendCrypto(req.user.id, toAddress, amount, currency, network);

    console.log(`✅ ${amount} ${currency} sent by user ${req.user.email} on ${network}`);
    res.json({
      success: true,
      data: result,
      message: 'Crypto sent successfully'
    });
  } catch (error) {
    console.error('❌ Send crypto error:', error);
    res.status(500).json({ error: 'Failed to send crypto' });
  }
});



// 📊 Agent Status
app.get('/api/agent/status', authenticateToken, async (req, res) => {
  try {
    const isRunning = activeAgents.has(req.user.id);
    
    const agentRecord = await prisma.agent.findUnique({
      where: { userId: req.user.id },
    });

    res.json({
      success: true,
      isRunning,
      status: agentRecord?.status || 'STOPPED',
      lastActivity: agentRecord?.lastActivity,
      stats: agentRecord ? {
        totalProcessed: agentRecord.totalProcessed,
        totalSent: agentRecord.totalSent,
        totalReceived: agentRecord.totalReceived,
        totalAmountSent: agentRecord.totalAmountSent,
        totalAmountReceived: agentRecord.totalAmountReceived,
      } : null,
    });
  } catch (error) {
    console.error('❌ Agent status error:', error);
    res.status(500).json({ error: 'Failed to get agent status' });
  }
});

// 🔄 Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  
  // Stop all active agents
  for (const [userId, agent] of activeAgents) {
    try {
      await agent.cleanup();
      console.log(`✅ Agent cleaned up for user ${userId}`);
    } catch (error) {
      console.error(`❌ Error cleaning up agent for user ${userId}:`, error);
    }
  }
  
  // Disconnect from database
  await prisma.$disconnect();
  await walletService.cleanup();
  
  console.log('✅ Server shutdown complete');
  process.exit(0);
});

// 🚀 Start server
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`
🚀 AgenPay Multi-User API Server
================================
Server running on port ${PORT}
Environment: ${process.env.NODE_ENV || 'development'}

🔧 Services:
- Database: ${prisma ? '✅ Connected' : '❌ Disconnected'}
      - Wallet: ${walletService.initialized ? '✅ Privy Live' : '🧪 Mock Mode'}
- JWT Auth: ${process.env.JWT_SECRET ? '✅ Configured' : '❌ Missing'}

📚 API Endpoints:
- POST /api/auth/register - User registration
- POST /api/auth/login - User login
- POST /api/notion/login - Notion integration
- POST /api/wallet/create - Create Privy wallet
- GET /api/dashboard - Dashboard analytics
- POST /api/agent/start - Start AI agent
- POST /api/agent/process - Process payments
- GET /health - Health check

🎯 Ready for production deployment!
  `);
}); 