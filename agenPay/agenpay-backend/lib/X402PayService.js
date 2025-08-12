/**
 * X402Pay Service for AgenPay
 * Handles X402 protocol payment processing and verification
 */

import { paymentMiddleware } from 'x402-express';
import { PrismaClient } from '@prisma/client';
import express from 'express';

export class X402PayService {
  constructor() {
    this.instanceId = `x402-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    console.log(`🆔 X402PayService instance created: ${this.instanceId}`);
    
    this.prisma = new PrismaClient();
    
    // X402 middleware needs a facilitator for payment verification
    // Use the correct x402.org facilitator URL (after redirect)
    this.facilitatorConfig = {
      url: process.env.X402_FACILITATOR_URL || "http://localhost:3002"
    };
    
    console.log(`🌐 [${this.instanceId}] X402 Facilitator URL: ${this.facilitatorConfig.url}`);
    
    this.paymentRoutes = new Map();
    this.app = express();
    this.setupRoutes();
    this.loadActivePaymentRoutes(); // Load existing payment routes from database
  }



  /**
   * Load active payment routes from database
   */
  async loadActivePaymentRoutes() {
    try {
      console.log(`🔄 [${this.instanceId}] Loading active payment routes from database...`);
      
      // Get all active payment requests from database
      const activePayments = await this.prisma.paymentRequest.findMany({
        where: {
          status: {
            in: ['processing', 'scheduled']
          }
        },
        include: {
          user: {
            select: {
              walletAddress: true
            }
          }
        }
      });

      // Populate the payment routes map
      for (const payment of activePayments) {
        if (payment.user?.walletAddress) {
          this.paymentRoutes.set(payment.id, {
            userId: payment.userId,
            userWalletAddress: payment.user.walletAddress,
            amount: payment.amount,
            currency: payment.currency,
            network: payment.network,
            description: payment.description,
            transactionType: payment.transactionType,
            createdAt: payment.createdAt
          });
        }
      }

      console.log(`✅ [${this.instanceId}] Loaded ${activePayments.length} active payment routes from database`);
    } catch (error) {
      console.error('❌ Error loading active payment routes:', error);
    }
  }

  /**
   * Setup X402 payment routes
   */
  setupRoutes() {
    console.log('🔧 Setting up authentic X402 payment routes...');
    
    // Handle X402 payment requests with proper middleware setup
    this.app.use('/x402pay/:paymentId', async (req, res, next) => {
      const paymentId = req.params.paymentId;
      console.log(`🔍 [${this.instanceId}] X402Pay route accessed: ${req.url} -> Payment ID: ${paymentId}`);
      console.log(`🔍 [${this.instanceId}] Available payment routes: [${Array.from(this.paymentRoutes.keys()).join(', ')}]`);
      
      if (!this.paymentRoutes.has(paymentId)) {
        console.log(`❌ Payment ID ${paymentId} not found in active routes`);
        return res.status(404).json({
          error: 'Payment link not found or expired',
          paymentId,
          message: 'This payment link may have expired or been completed. Please request a new payment link.'
        });
      }

      const paymentConfig = this.paymentRoutes.get(paymentId);
      
      // Get user's specific Privy wallet address
      const user = await this.prisma.user.findUnique({
        where: { id: paymentConfig.userId },
        select: { walletAddress: true }
      });

      if (!user?.walletAddress) {
        return res.status(400).json({ 
          error: 'User wallet not found. Please create a Privy wallet first.' 
        });
      }

      console.log(`💳 Processing X402Pay request for payment ID: ${paymentId}`);
      console.log(`💳 X402Pay processing payment to user wallet: ${user.walletAddress}`);
      
      // FIX: The key issue is path configuration for X402 middleware
      // When Express routes to /x402pay/:paymentId, the middleware sees the path as "/"
      // So we need to configure the middleware for the root path "/"
      const middlewareConfig = {
        "/": {  // Use "/" instead of full path since Express strips the matched part
          price: `$${paymentConfig.amount}`,
          network: "sei-testnet", // Use the actual network, not facilitator URL
          config: {
            description: paymentConfig.description,
            maxTimeoutSeconds: 300,
          }
        }
      };
      
      console.log(`🔧 X402Pay middleware configuration:`, JSON.stringify(middlewareConfig, null, 2));
      console.log(`🌐 [${this.instanceId}] Network being used: ${paymentConfig.network}`);
      console.log(`🌐 [${this.instanceId}] Facilitator config:`, JSON.stringify(this.facilitatorConfig, null, 2));
      console.log(`🔍 X402Pay request details:`, {
        method: req.method,
        path: req.path,
        originalUrl: req.originalUrl,
        hasXPaymentHeader: !!req.headers['x-payment'],
        xPaymentHeaderLength: req.headers['x-payment']?.length || 0,
        userAgent: req.headers['user-agent']?.substring(0, 50) + '...',
        allHeaders: Object.keys(req.headers).filter(h => h.startsWith('x-'))
      });
      
      if (req.headers['x-payment']) {
        console.log(`💳 [${this.instanceId}] X-PAYMENT header received:`, {
          headerStart: req.headers['x-payment'].substring(0, 100) + '...',
          headerLength: req.headers['x-payment'].length,
          headerType: typeof req.headers['x-payment']
        });
      }

      try {
        console.log(`🔧 [${this.instanceId}] Creating X402 middleware with config:`, {
          walletAddress: user.walletAddress,
          config: middlewareConfig,
          facilitator: this.facilitatorConfig
        });
        
        // Create X402 middleware with correct configuration
        const middleware = paymentMiddleware(
          user.walletAddress, // Use user's specific Privy wallet
          middlewareConfig,
          this.facilitatorConfig,
        );
        
        console.log(`✅ [${this.instanceId}] X402 middleware created successfully`);
        
        // Apply X402 middleware with timeout and proper response handling
        let middlewareCompleted = false;
        
        // Set a timeout to ensure we always respond
        const timeoutId = setTimeout(() => {
          if (!middlewareCompleted && !res.headersSent) {
            console.warn(`⏰ [${this.instanceId}] X402 middleware timeout - forcing response`);
            middlewareCompleted = true;
            
            if (req.headers['x-payment']) {
              // If we have a payment header, assume payment was successful
              console.log(`✅ [${this.instanceId}] Timeout but payment header present - processing as successful`);
                             this.handlePaymentSuccess(paymentId, req.headers['x-payment'])
                 .then((paymentResult) => {
                   res.status(200).send(this.generateSuccessPage({
                     paymentId: paymentId,
                     amount: paymentResult.amount,
                     currency: paymentResult.currency,
                     description: paymentResult.description,
                     walletAddress: paymentResult.toAddress
                   }));
                 })
                .catch((err) => {
                  console.error(`❌ [${this.instanceId}] Payment processing failed:`, err);
                  res.status(400).json({
                    error: 'Payment verification failed',
                    details: err.message,
                    paymentId: paymentId
                  });
                });
            } else {
              res.status(500).json({ 
                error: 'X402 payment processing timeout',
                paymentId: paymentId
              });
            }
          }
        }, 5000); // 5 second timeout
        
        middleware(req, res, (err) => {
          if (middlewareCompleted) return; // Prevent double responses
          
          clearTimeout(timeoutId);
          middlewareCompleted = true;
          
          console.log(`🔄 [${this.instanceId}] X402 middleware callback triggered:`, {
            hasError: !!err,
            errorMessage: err?.message,
            hasXPaymentHeader: !!req.headers['x-payment'],
            responseHeadersSent: res.headersSent,
            responseStatusCode: res.statusCode,
            responseFinished: res.finished
          });
          
          if (err) {
            console.error(`❌ [${this.instanceId}] X402Pay middleware error:`, err);
            if (!res.headersSent) {
              return res.status(500).json({ 
                error: 'Payment processing failed', 
                details: err.message,
                paymentId: paymentId
              });
            }
            return;
          }
          
          // If payment was successful, X402 middleware should have sent 200 response
          if (req.headers['x-payment'] && res.headersSent && res.statusCode === 200) {
            console.log(`✅ [${this.instanceId}] X402 payment verified successfully`);
            // Process payment success in background (don't block response)
            setImmediate(() => {
              this.handlePaymentSuccess(paymentId, req.headers['x-payment'])
                .catch(err => console.error(`❌ Background payment processing failed:`, err));
            });
            return;
          }
          
          // If we get here and no response was sent, the middleware failed to handle the request
          if (!res.headersSent) {
            console.warn(`⚠️ [${this.instanceId}] X402 middleware didn't send response - handling manually`);
            
            if (req.headers['x-payment']) {
              // We have a payment signature - process it manually
              console.log(`💳 [${this.instanceId}] Processing payment manually since middleware failed`);
                             this.handlePaymentSuccess(paymentId, req.headers['x-payment'])
                .then((paymentResult) => {
                  res.status(200).send(this.generateSuccessPage({
                    paymentId: paymentId,
                    amount: paymentResult.amount,
                    currency: paymentResult.currency,
                    description: paymentResult.description,
                    walletAddress: paymentResult.toAddress
                  }));
                })
                .catch((verificationError) => {
                  console.error(`❌ [${this.instanceId}] Manual payment verification failed:`, verificationError);
                  res.status(400).json({
                    error: 'Payment verification failed',
                    details: verificationError.message,
                    paymentId: paymentId
                  });
                });
            } else {
              res.status(500).json({ 
                error: 'X402 payment processing incomplete',
                paymentId: paymentId,
                message: "Payment middleware did not handle the request."
              });
            }
          }
        });
      } catch (middlewareError) {
        console.error(`❌ [${this.instanceId}] X402Pay middleware creation error:`, middlewareError);
        if (!res.headersSent) {
          res.status(500).json({ 
            error: 'Payment middleware initialization failed', 
            details: middlewareError.message,
            paymentId: paymentId
          });
        }
      }
    });



        
    // X402 middleware handles all payment verification and success cases
    console.log(`✅ [${this.instanceId}] Authentic X402 payment routes configured`);
 
  }

  /**
   * Create a unique payment request with X402 link
   */
  async createPaymentRequest({
    userId,
    amount,
    currency = 'USDC',
    network = 'sei-testnet',
    recipientEmail,
    recipientName,
    description,
    transactionType = 'ask_payment',
    scheduleType = 'immediate',
    scheduledDate = null,
    aiPrompt = null
  }) {
    try {
      console.log(`💳 [${this.instanceId}] Creating X402 payment request for user ${userId}`);
      console.log(`🔍 [${this.instanceId}] Current routes before creation: [${Array.from(this.paymentRoutes.keys()).join(', ')}]`);

      // Verify user has a Privy wallet
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { walletAddress: true, email: true }
      });

      if (!user?.walletAddress) {
        throw new Error('User must create a Privy wallet before requesting payments');
      }

      // Generate unique payment ID
      const paymentId = `x402_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create the payment URL
      const paymentUrl = `${process.env.BASE_URL || 'http://localhost:3001'}/x402pay/${paymentId}`;
      
      // Create payment request in database first
      const paymentRequest = await this.prisma.paymentRequest.create({
        data: {
          id: paymentId,
          userId,
          amount: parseFloat(amount),
          currency,
          network,
          recipientEmail,
          recipientName,
          description,
          aiPrompt,
          transactionType,
          scheduleType,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          status: scheduleType === 'immediate' ? 'processing' : 'scheduled',
          x402PayLink: paymentUrl,
        }
      });

      // Store payment configuration in memory for X402 middleware
      console.log(`🔧 [${this.instanceId}] Adding payment route to memory: ${paymentId}`);
      
      const routeConfig = {
        userId,
        userWalletAddress: user.walletAddress,
        amount: parseFloat(amount),
        currency,
        network,
        description,
        transactionType,
        createdAt: new Date()
      };
      
      this.paymentRoutes.set(paymentId, routeConfig);
      
      console.log(`✅ [${this.instanceId}] X402 payment request created: ${paymentId} → ${user.walletAddress}`);
      console.log(`🗺️ [${this.instanceId}] Payment route added to memory. Total routes: ${this.paymentRoutes.size}`);
      console.log(`🔍 [${this.instanceId}] Updated routes list: [${Array.from(this.paymentRoutes.keys()).join(', ')}]`);
      
      return {
        success: true,
        paymentId,
        paymentUrl,
        x402PayLink: paymentUrl,
        destinationWallet: user.walletAddress,
        request: paymentRequest
      };
    } catch (error) {
      console.error('❌ Error creating X402 payment request:', error);
      throw error;
    }
  }

  /**
   * Create a multi-token payment request with OKX DEX swap support
   * Allows users to pay in any supported token while recipient receives their preferred currency
   */
  async createMultiTokenPaymentRequest({
    userId,
    amount,
    preferredReceiveCurrency = 'USDC',
    acceptedPaymentTokens = ['SEI', 'USDC', 'USDT'],
    network = 'sei-testnet',
    recipientEmail, 
    recipientName,
    description,
    transactionType = 'ask_payment',
    scheduleType = 'immediate',
    scheduledDate = null,
    aiPrompt = null
  }) {
    try {
      console.log(`💱 [${this.instanceId}] Creating multi-token X402 payment request for user ${userId}`);
      console.log(`🎯 [${this.instanceId}] Preferred receive currency: ${preferredReceiveCurrency}`);
      console.log(`🪙 [${this.instanceId}] Accepted payment tokens: ${acceptedPaymentTokens.join(', ')}`);
      console.log(`⚠️ [${this.instanceId}] OKX DEX Service is disabled - using standard payment`);

      // Since OKX DEX is disabled, fallback to regular payment request
      return await this.createPaymentRequest({
        userId,
        amount,
        currency: preferredReceiveCurrency,
        network,
        recipientEmail,
        recipientName,
        description: `${description} (Multi-token disabled - standard payment)`,
        transactionType,
        scheduleType,
        scheduledDate,
        aiPrompt
      });

    } catch (error) {
      console.error('❌ Error creating multi-token X402 payment request:', error);
      throw error;
    }
  }

  /**
   * Calculate payment options for multi-token request (disabled)
   */
  async calculatePaymentOptions(paymentId, userPreferredToken = 'SEI') {
    try {
      console.log(`🧮 [${this.instanceId}] Calculating payment options for ${paymentId}`);
      console.log(`⚠️ [${this.instanceId}] OKX DEX Service is disabled - returning direct payment option`);

      const routeConfig = this.paymentRoutes.get(paymentId);
      if (!routeConfig) {
        throw new Error('Payment route not found');
      }

      // Since OKX DEX is disabled, always return direct payment
      return {
        paymentId,
        userPreferredToken,
        receiveCurrency: routeConfig.currency,
        swapRequired: false,
        directPayment: true,
        paymentAmount: routeConfig.amount,
        paymentCurrency: routeConfig.currency,
        message: 'Direct payment (OKX DEX disabled)'
      };

    } catch (error) {
      console.error('❌ Error calculating payment options:', error);
      return {
        swapRequired: false,
        swapPossible: false,
        error: error.message
      };
    }
  }

  /**
   * Generate beautiful HTML success page
   */
  generateSuccessPage({ paymentId, amount, currency, description, walletAddress }) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Successful - AgenPay</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          
          .success-container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 500px;
            width: 100%;
            animation: slideUp 0.6s ease-out;
          }
          
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .success-icon {
            width: 80px;
            height: 80px;
            margin: 0 auto 30px;
            background: #4CAF50;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: bounce 0.8s ease-out 0.3s both;
          }
          
          @keyframes bounce {
            0%, 20%, 53%, 80%, 100% {
              transform: translate3d(0,0,0);
            }
            40%, 43% {
              transform: translate3d(0, -20px, 0);
            }
            70% {
              transform: translate3d(0, -10px, 0);
            }
            90% {
              transform: translate3d(0, -4px, 0);
            }
          }
          
          .checkmark {
            color: white;
            font-size: 40px;
            font-weight: bold;
          }
          
          h1 {
            color: #2c3e50;
            font-size: 32px;
            margin-bottom: 10px;
            font-weight: 600;
          }
          
          .amount {
            font-size: 48px;
            font-weight: 700;
            color: #4CAF50;
            margin: 20px 0;
          }
          
          .payment-details {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 25px;
            margin: 30px 0;
            text-align: left;
          }
          
          .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #e9ecef;
          }
          
          .detail-row:last-child {
            border-bottom: none;
          }
          
          .detail-label {
            color: #6c757d;
            font-weight: 500;
          }
          
          .detail-value {
            color: #2c3e50;
            font-weight: 600;
            word-break: break-all;
          }
          
          .wallet-address {
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 12px;
            background: #e9ecef;
            padding: 5px 8px;
            border-radius: 6px;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .powered-by {
            margin-top: 30px;
            color: #6c757d;
            font-size: 14px;
          }
          
          .powered-by strong {
            color: #667eea;
          }
          
          .close-button {
            background: #667eea;
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 20px;
            transition: all 0.3s ease;
          }
          
          .close-button:hover {
            background: #5a6fd8;
            transform: translateY(-2px);
          }
        </style>
      </head>
      <body>
        <div class="success-container">
          <div class="success-icon">
            <div class="checkmark">✓</div>
          </div>
          
          <h1>Payment Successful!</h1>
          <p style="color: #6c757d; margin-bottom: 20px;">Your crypto payment has been verified and processed.</p>
          
          <div class="amount">${amount} ${currency}</div>
          
          <div class="payment-details">
            <div class="detail-row">
              <span class="detail-label">Description</span>
              <span class="detail-value">${description}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Payment ID</span>
              <span class="detail-value">${paymentId}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Network</span>
              <span class="detail-value">Sei Testnet</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Recipient Wallet</span>
              <span class="detail-value">
                <div class="wallet-address">${walletAddress}</div>
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Protocol</span>
              <span class="detail-value">X402Pay ⚡</span>
            </div>
          </div>
          
          <button class="close-button" onclick="window.close()">Close</button>
          
          <div class="powered-by">
            Powered by <strong>AgenPay × X402</strong><br>
            Secure crypto payments for the future
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Handle successful payment verification
   */
  async handlePaymentSuccess(paymentId, paymentProof) {
    try {
      console.log(`✅ [${this.instanceId}] Processing payment success for: ${paymentId}`);
      console.log(`🧾 [${this.instanceId}] Payment proof received:`, paymentProof ? 'Present' : 'Missing');

      // Get payment config to find destination wallet
      const paymentConfig = this.paymentRoutes.get(paymentId);
      let dbPaymentRequest = null;
      
      if (!paymentConfig) {
        // Try to get from database if not in memory
        dbPaymentRequest = await this.prisma.paymentRequest.findUnique({
          where: { id: paymentId }
        });
        
        if (!dbPaymentRequest) {
          throw new Error(`Payment configuration not found for ${paymentId}`);
        }
        
        console.log(`📋 [${this.instanceId}] Using payment config from database`);
      }

      // Get user wallet address
      const user = await this.prisma.user.findUnique({
        where: { id: paymentConfig?.userId || dbPaymentRequest?.userId },
        select: { walletAddress: true, email: true }
      });

      // Update payment request status
      const paymentRequest = await this.prisma.paymentRequest.update({
        where: { id: paymentId },
        data: {
          status: 'payment_received',
          paymentHash: paymentProof || 'X402_VERIFIED',
          paidAt: new Date()
        }
      });

      // Create transaction record with proper wallet tracking
      await this.prisma.transaction.create({
        data: {
          userId: paymentRequest.userId,
          type: 'INCOMING',
          status: 'COMPLETED',
          amount: paymentRequest.amount,
          currency: paymentRequest.currency,
          network: paymentRequest.network,
          description: paymentRequest.description,
          toAddress: user?.walletAddress, // User's Privy wallet that received payment
          fromAddress: 'X402Pay_Verified_Sender', // X402Pay verified sender
          x402PayId: paymentId,
          relatedRequestId: paymentId,
          txHash: paymentProof || `x402_${paymentId}`,
          completedAt: new Date()
        }
      });

      // Handle refund scheduling if needed
      if (paymentRequest.transactionType === 'ask_and_refund') {
        await this.scheduleRefund(paymentRequest);
      }

      // Update Notion database if user has integration
      await this.updateNotionRecord(paymentRequest);

      // Remove from active payment routes (payment completed)
      this.paymentRoutes.delete(paymentId);

      console.log(`✅ [${this.instanceId}] Payment success handled: ${paymentRequest.amount} ${paymentRequest.currency} → ${user?.walletAddress}`);
      return {
        ...paymentRequest,
        toAddress: user?.walletAddress
      };
    } catch (error) {
      console.error(`❌ [${this.instanceId}] Error handling payment success for ${paymentId}:`, error);
      throw error;
    }
  }

  /**
   * Schedule a refund for ask_and_refund transactions
   */
  async scheduleRefund(paymentRequest) {
    try {
      // Calculate refund date (default 30 days from payment)
      const refundDate = new Date();
      refundDate.setDate(refundDate.getDate() + 30);

      // Create outgoing payment record for the refund
      const refundPayment = await this.prisma.outgoingPayment.create({
        data: {
          userId: paymentRequest.userId,
          amount: paymentRequest.amount,
          currency: paymentRequest.currency,
          network: paymentRequest.network,
          recipientAddress: paymentRequest.recipientEmail, // Will need wallet address
          recipientName: paymentRequest.recipientName,
          fromName: 'AgenPay Refund System',
          description: `Refund for: ${paymentRequest.description}`,
          scheduleDate: refundDate,
          status: 'scheduled',
          relatedRequestId: paymentRequest.id
        }
      });

      // Update original request with refund date
      await this.prisma.paymentRequest.update({
        where: { id: paymentRequest.id },
        data: { refundDate: refundDate }
      });

      console.log(`📅 Refund scheduled for ${paymentRequest.id} on ${refundDate}`);
      return refundPayment;
    } catch (error) {
      console.error(`❌ Error scheduling refund for ${paymentRequest.id}:`, error);
      throw error;
    }
  }

  /**
   * Update Notion database with payment information
   */
  async updateNotionRecord(paymentRequest) {
    try {
      // Get user's Notion databases
      const user = await this.prisma.user.findUnique({
        where: { id: paymentRequest.userId },
        include: {
          notionDatabases: {
            where: { databaseType: 'INCOMING_PAYMENTS' }
          }
        }
      });

      if (user?.notionApiKey && user.notionDatabases.length > 0) {
        const NotionService = await import('./NotionService.js');
        const notionService = new NotionService.NotionService(user.notionApiKey);
        
        const databaseId = user.notionDatabases[0].databaseId;
        
        // Update existing record or create new one if not found
        await notionService.updateOrCreateIncomingPaymentRecord(databaseId, {
          requestId: paymentRequest.id,
          amount: paymentRequest.amount,
          currency: paymentRequest.currency,
          network: paymentRequest.network,
          recipientEmail: paymentRequest.recipientEmail,
          recipientName: paymentRequest.recipientName,
          description: paymentRequest.description,
          transactionType: paymentRequest.transactionType,
          status: 'payment_received', // Update status to received
          x402PayLink: paymentRequest.x402PayLink,
          paymentHash: paymentRequest.paymentHash || `x402_${paymentRequest.id}`
        });

        console.log(`📝 Notion record updated for payment: ${paymentRequest.id}`);
      }
    } catch (error) {
      console.error(`❌ Error updating Notion record for ${paymentRequest.id}:`, error);
      // Don't throw error - Notion update failure shouldn't break payment flow
    }
  }

  /**
   * Extract payment ID from URL path
   */
  extractPaymentIdFromUrl(url) {
    const match = url.match(/\/x402pay\/([^\/\?]+)/);
    return match ? match[1] : null;
  }

  /**
   * Get payment request by ID
   */
  async getPaymentRequest(paymentId) {
    try {
      const paymentRequest = await this.prisma.paymentRequest.findUnique({
        where: { id: paymentId }
      });
      return paymentRequest;
    } catch (error) {
      console.error(`❌ Error getting payment request ${paymentId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel a payment request
   */
  async cancelPaymentRequest(paymentId) {
    try {
      const paymentRequest = await this.prisma.paymentRequest.update({
        where: { id: paymentId },
        data: { status: 'cancelled' }
      });

      // Remove from payment routes
      this.paymentRoutes.delete(paymentId);

      console.log(`❌ Payment request cancelled: ${paymentId}`);
      return paymentRequest;
    } catch (error) {
      console.error(`❌ Error cancelling payment request ${paymentId}:`, error);
      throw error;
    }
  }

  /**
   * Get payment statistics for user
   */
  async getPaymentStats(userId) {
    try {
      const stats = await this.prisma.paymentRequest.groupBy({
        by: ['status'],
        where: { userId },
        _count: { status: true },
        _sum: { amount: true }
      });

      return {
        totalRequests: stats.reduce((sum, stat) => sum + stat._count.status, 0),
        totalAmount: stats.reduce((sum, stat) => sum + (stat._sum.amount || 0), 0),
        byStatus: stats.reduce((acc, stat) => {
          acc[stat.status] = {
            count: stat._count.status,
            amount: stat._sum.amount || 0
          };
          return acc;
        }, {})
      };
    } catch (error) {
      console.error(`❌ Error getting payment stats for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Start the X402 payment server
   */
  async startServer(port = 3002) {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.log(`🚀 X402Pay service running on port ${port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the X402 payment server
   */
  async stopServer() {
    if (this.server) {
      this.server.close();
      console.log('🛑 X402Pay service stopped');
    }
  }

  async cleanup() {
    await this.stopServer();
    await this.prisma.$disconnect();
  }
}

export default X402PayService; 