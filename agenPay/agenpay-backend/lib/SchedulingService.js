/**
 * Scheduling Service for AgenPay
 * Handles cron jobs for scheduled payments and refunds
 */

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import WalletService from './WalletService.js';
import NotionService from './NotionService.js';

export class SchedulingService {
  constructor() {
    this.prisma = new PrismaClient();
    this.walletService = new WalletService();
    this.jobs = new Map();
    this.isRunning = false;
  }

  /**
   * Start the scheduling service
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Scheduling service already running');
      return;
    }

    this.isRunning = true;
    console.log('🕐 Starting AgenPay Scheduling Service...');

    // Schedule payment processor to run every minute
    this.jobs.set('payment-processor', cron.schedule('* * * * *', async () => {
      await this.processScheduledPayments();
    }, {
      scheduled: true,
      timezone: "UTC"
    }));

    // Schedule refund processor to run every hour
    this.jobs.set('refund-processor', cron.schedule('0 * * * *', async () => {
      await this.processScheduledRefunds();
    }, {
      scheduled: true,
      timezone: "UTC"
    }));

    // Schedule payment request processor to run every 5 minutes
    this.jobs.set('request-processor', cron.schedule('*/5 * * * *', async () => {
      await this.processScheduledRequests();
    }, {
      scheduled: true,
      timezone: "UTC"
    }));

    console.log('✅ Scheduling service started with cron jobs');
  }

  /**
   * Stop the scheduling service
   */
  async stop() {
    if (!this.isRunning) {
      console.log('⚠️ Scheduling service not running');
      return;
    }

    console.log('🛑 Stopping AgenPay Scheduling Service...');
    
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`📴 Stopped job: ${name}`);
    }
    
    this.jobs.clear();
    this.isRunning = false;
    console.log('✅ Scheduling service stopped');
  }

  /**
   * Process scheduled outgoing payments
   */
  async processScheduledPayments() {
    try {
      const now = new Date();
      
      // Find payments that are due
      const duePayments = await this.prisma.outgoingPayment.findMany({
        where: {
          status: 'scheduled',
          scheduleDate: {
            lte: now
          }
        },
        include: {
          user: true
        }
      });

      console.log(`💸 Processing ${duePayments.length} scheduled payments...`);

      for (const payment of duePayments) {
        await this.executeOutgoingPayment(payment);
      }
    } catch (error) {
      console.error('❌ Error processing scheduled payments:', error);
    }
  }

  /**
   * Execute a single outgoing payment
   */
  async executeOutgoingPayment(payment) {
    try {
      console.log(`⚡ Executing payment: ${payment.id}`);

      // Update status to processing
      await this.prisma.outgoingPayment.update({
        where: { id: payment.id },
        data: { status: 'processing' }
      });

      // Send the payment using wallet service
      const result = await this.walletService.sendCrypto(
        payment.userId,
        payment.recipientAddress,
        payment.amount,
        payment.currency,
        payment.network
      );

      if (result.success) {
        // Update payment as completed
        await this.prisma.outgoingPayment.update({
          where: { id: payment.id },
          data: {
            status: 'completed',
            txHash: result.txHash,
            executedAt: new Date()
          }
        });

        // Create transaction record
        await this.prisma.transaction.create({
          data: {
            userId: payment.userId,
            type: 'OUTGOING',
            status: 'COMPLETED',
            amount: payment.amount,
            currency: payment.currency,
            network: payment.network,
            description: payment.description,
            toAddress: payment.recipientAddress,
            fromAddress: payment.user.walletAddress,
            txHash: result.txHash,
            relatedRequestId: payment.relatedRequestId,
            completedAt: new Date()
          }
        });

        // Update Notion if user has integration
        await this.updateNotionOutgoingPayment(payment.userId, payment);

        console.log(`✅ Payment ${payment.id} executed successfully: ${result.txHash}`);
      } else {
        throw new Error(result.error || 'Payment execution failed');
      }
    } catch (error) {
      console.error(`❌ Error executing payment ${payment.id}:`, error);
      
      // Update payment as failed
      await this.prisma.outgoingPayment.update({
        where: { id: payment.id },
        data: {
          status: 'failed',
          executedAt: new Date()
        }
      });
    }
  }

  /**
   * Process scheduled refunds
   */
  async processScheduledRefunds() {
    try {
      const now = new Date();
      
      // Find payment requests that need refunds
      const refundDueRequests = await this.prisma.paymentRequest.findMany({
        where: {
          transactionType: 'ask_and_refund',
          status: 'payment_received',
          refundDate: {
            lte: now
          }
        },
        include: {
          user: true
        }
      });

      console.log(`💰 Processing ${refundDueRequests.length} scheduled refunds...`);

      for (const request of refundDueRequests) {
        await this.executeRefund(request);
      }
    } catch (error) {
      console.error('❌ Error processing scheduled refunds:', error);
    }
  }

  /**
   * Execute a refund
   */
  async executeRefund(paymentRequest) {
    try {
      console.log(`🔄 Executing refund for request: ${paymentRequest.id}`);

      // Send refund using wallet service
      // Note: For refunds, we need the recipient's wallet address
      // This would typically be provided during payment or obtained from the payment proof
      const recipientAddress = paymentRequest.recipientEmail; // This should be updated to use actual wallet address

      const result = await this.walletService.sendCrypto(
        paymentRequest.userId,
        recipientAddress,
        paymentRequest.amount,
        paymentRequest.currency,
        paymentRequest.network
      );

      if (result.success) {
        // Update payment request as refunded
        await this.prisma.paymentRequest.update({
          where: { id: paymentRequest.id },
          data: { status: 'refunded' }
        });

        // Create transaction record for refund
        await this.prisma.transaction.create({
          data: {
            userId: paymentRequest.userId,
            type: 'REFUND',
            status: 'COMPLETED',
            amount: paymentRequest.amount,
            currency: paymentRequest.currency,
            network: paymentRequest.network,
            description: `Refund for: ${paymentRequest.description}`,
            toAddress: recipientAddress,
            fromAddress: paymentRequest.user.walletAddress,
            txHash: result.txHash,
            relatedRequestId: paymentRequest.id,
            completedAt: new Date()
          }
        });

        // Update Notion if user has integration
        await this.updateNotionRefund(paymentRequest.userId, paymentRequest, result.txHash);

        console.log(`✅ Refund for ${paymentRequest.id} executed successfully: ${result.txHash}`);
      } else {
        throw new Error(result.error || 'Refund execution failed');
      }
    } catch (error) {
      console.error(`❌ Error executing refund for ${paymentRequest.id}:`, error);
    }
  }

  /**
   * Process scheduled payment requests (send emails/notifications)
   */
  async processScheduledRequests() {
    try {
      const now = new Date();
      
      // Find payment requests that are scheduled and due
      const dueRequests = await this.prisma.paymentRequest.findMany({
        where: {
          scheduleType: 'scheduled',
          status: 'scheduled',
          scheduledDate: {
            lte: now
          }
        }
      });

      console.log(`📧 Processing ${dueRequests.length} scheduled payment requests...`);

      for (const request of dueRequests) {
        await this.activatePaymentRequest(request);
      }
    } catch (error) {
      console.error('❌ Error processing scheduled requests:', error);
    }
  }

  /**
   * Activate a scheduled payment request
   */
  async activatePaymentRequest(request) {
    try {
      console.log(`📨 Activating payment request: ${request.id}`);

      // Update status to processing
      await this.prisma.paymentRequest.update({
        where: { id: request.id },
        data: { status: 'processing' }
      });

      // Here you could send email notifications or trigger other actions
      // For now, we'll just update the status and log
      console.log(`✅ Payment request ${request.id} activated and ready for payment`);

      // Update Notion if user has integration
      await this.updateNotionIncomingPayment(request.userId, request);
    } catch (error) {
      console.error(`❌ Error activating payment request ${request.id}:`, error);
    }
  }

  /**
   * Update Notion with outgoing payment status
   */
  async updateNotionOutgoingPayment(userId, payment) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          notionDatabases: {
            where: { databaseType: 'OUTGOING_PAYMENTS' }
          }
        }
      });

      if (user?.notionApiKey && user.notionDatabases.length > 0) {
        const notionService = new NotionService(user.notionApiKey);
        const databaseId = user.notionDatabases[0].databaseId;
        
        await notionService.addOutgoingPaymentRecord(databaseId, {
          paymentId: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          network: payment.network,
          recipientAddress: payment.recipientAddress,
          recipientName: payment.recipientName,
          fromName: payment.fromName,
          description: payment.description,
          scheduleDate: payment.scheduleDate.toISOString(),
          status: payment.status,
          txHash: payment.txHash,
          executedAt: payment.executedAt?.toISOString()
        });

        console.log(`📝 Notion updated for outgoing payment: ${payment.id}`);
      }
    } catch (error) {
      console.error(`❌ Error updating Notion for outgoing payment ${payment.id}:`, error);
    }
  }

  /**
   * Update Notion with incoming payment status
   */
  async updateNotionIncomingPayment(userId, request) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          notionDatabases: {
            where: { databaseType: 'INCOMING_PAYMENTS' }
          }
        }
      });

      if (user?.notionApiKey && user.notionDatabases.length > 0) {
        const notionService = new NotionService(user.notionApiKey);
        const databaseId = user.notionDatabases[0].databaseId;
        
        await notionService.addIncomingPaymentRecord(databaseId, {
          requestId: request.id,
          amount: request.amount,
          currency: request.currency,
          network: request.network,
          recipientEmail: request.recipientEmail,
          recipientName: request.recipientName,
          description: request.description,
          aiPrompt: request.aiPrompt,
          transactionType: request.transactionType,
          scheduleType: request.scheduleType,
          scheduledDate: request.scheduledDate?.toISOString(),
          status: request.status,
          x402PayLink: request.x402PayLink,
          paymentHash: request.paymentHash,
          refundDate: request.refundDate?.toISOString()
        });

        console.log(`📝 Notion updated for incoming payment: ${request.id}`);
      }
    } catch (error) {
      console.error(`❌ Error updating Notion for incoming payment ${request.id}:`, error);
    }
  }

  /**
   * Update Notion with refund information
   */
  async updateNotionRefund(userId, request, txHash) {
    try {
      // Update the original payment request status in Notion
      await this.updateNotionIncomingPayment(userId, { ...request, status: 'refunded' });
    } catch (error) {
      console.error(`❌ Error updating Notion for refund ${request.id}:`, error);
    }
  }

  /**
   * Schedule a one-time payment
   */
  async schedulePayment(paymentData) {
    try {
      const payment = await this.prisma.outgoingPayment.create({
        data: {
          userId: paymentData.userId,
          amount: paymentData.amount,
          currency: paymentData.currency || 'ETH',
          network: paymentData.network || 'sei-testnet',  
          recipientAddress: paymentData.recipientAddress,
          recipientName: paymentData.recipientName,
          fromName: paymentData.fromName || 'AgenPay User',
          description: paymentData.description,
          scheduleDate: new Date(paymentData.scheduleDate),
          status: 'scheduled'
        }
      });

      console.log(`📅 Payment scheduled: ${payment.id} for ${paymentData.scheduleDate}`);
      return payment;
    } catch (error) {
      console.error('❌ Error scheduling payment:', error);
      throw error;
    }
  }

  /**
   * Get scheduling statistics
   */
  async getStats() {
    try {
      const stats = await this.prisma.$transaction([
        this.prisma.outgoingPayment.count({
          where: { status: 'scheduled' }
        }),
        this.prisma.paymentRequest.count({
          where: { status: 'scheduled' }
        }),
        this.prisma.paymentRequest.count({
          where: { 
            transactionType: 'ask_and_refund',
            status: 'payment_received',
            refundDate: { lte: new Date() }
          }
        })
      ]);

      return {
        scheduledPayments: stats[0],
        scheduledRequests: stats[1],
        pendingRefunds: stats[2],
        isRunning: this.isRunning,
        activeJobs: this.jobs.size
      };
    } catch (error) {
      console.error('❌ Error getting scheduling stats:', error);
      throw error;
    }
  }

  async cleanup() {
    await this.stop();
    await this.prisma.$disconnect();
  }
}

export default SchedulingService; 