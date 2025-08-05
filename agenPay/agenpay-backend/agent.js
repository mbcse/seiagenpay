#!/usr/bin/env node

/**
 * AgenPay AI Payment Processing Agent
 * Built with LangGraph.js for sophisticated payment automation
 * 
 * Features:
 * - AI-powered payment extraction and processing
 * - X402Pay integration for crypto payments
 * - Email automation with HTML templates
 * - Notion database monitoring
 * - Memory persistence across conversations
 * - Continuous payment monitoring
 */

import { config } from 'dotenv';
import { z } from 'zod';
import { StateGraph, MemorySaver } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import axios from 'axios';
import nodemailer from 'nodemailer';
import { Client } from '@notionhq/client';

// Load environment variables
config();

// 🎯 LangGraph State Schema using Zod
const AgentState = z.object({
  messages: z.array(z.any()).default([]),
  paymentData: z.object({
    amount: z.string().optional(),
    currency: z.string().optional().default('SEI'),
    description: z.string().optional(),
    recipientEmail: z.string().optional(),
    dueDate: z.string().optional(),
  }).optional(),
  paymentLink: z.string().optional(),
  emailSent: z.boolean().default(false),
  lastAction: z.string().optional(),
});

// 🔧 Configuration
const CONFIG = {
  openaiApiKey: process.env.OPENAI_API_KEY,
  x402payApiKey: process.env.X402PAY_API_KEY || 'mock-api-key',
  x402payBaseUrl: process.env.X402PAY_BASE_URL || 'https://api.x402pay.com/v1',
  notionApiKey: process.env.NOTION_API_KEY || 'mock-notion-key',
  notionDatabaseId: process.env.NOTION_DATABASE_ID || 'mock-database-id',
  emailService: process.env.EMAIL_SERVICE || 'gmail',
  emailUser: process.env.EMAIL_USER || 'test@example.com',
  emailPass: process.env.EMAIL_PASS || 'mock-password',
  emailFrom: process.env.EMAIL_FROM || 'AgenPay <noreply@agenpay.com>',
  agentName: process.env.AGENT_NAME || 'AgenPay AI',
  defaultCurrency: process.env.DEFAULT_CURRENCY || 'SEI',
  debug: process.env.DEBUG === 'true',
};

// 📧 Email transporter setup
const emailTransporter = nodemailer.createTransporter({
  service: CONFIG.emailService,
  auth: {
    user: CONFIG.emailUser,
    pass: CONFIG.emailPass,
  },
});

// 🗃️ Notion client setup
const notion = new Client({
  auth: CONFIG.notionApiKey,
});

// 🛠️ Tool 1: Extract Payment Details
const extractPaymentDetails = tool({
  name: 'extractPaymentDetails',
  description: 'Parse payment information from natural language input',
  schema: z.object({
    input: z.string().describe('Natural language payment request'),
  }),
  func: async ({ input }) => {
    try {
      console.log('🔍 Extracting payment details from:', input);
      
      // Simple regex-based extraction (could be enhanced with more AI)
      const amountMatch = input.match(/(\$?[\d,]+\.?\d*)\s*(ETH|BTC|USD|EUR)?/i);
      const emailMatch = input.match(/[\w\.-]+@[\w\.-]+\.\w+/);
      const descriptionMatch = input.match(/for\s+(.+?)(?:\s+to\s+|$)/i);
      
      const result = {
        amount: amountMatch ? amountMatch[1].replace(/[\$,]/g, '') : null,
        currency: amountMatch ? (amountMatch[2] || CONFIG.defaultCurrency) : CONFIG.defaultCurrency,
        recipientEmail: emailMatch ? emailMatch[0] : null,
        description: descriptionMatch ? descriptionMatch[1].trim() : 'Payment request',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
      };
      
      console.log('✅ Extracted payment data:', result);
      return result;
    } catch (error) {
      console.error('❌ Error extracting payment details:', error);
      throw error;
    }
  },
});

// 🛠️ Tool 2: Create Payment Link
const createPaymentLink = tool({
  name: 'createPaymentLink',
  description: 'Generate X402Pay payment URLs for crypto payments',
  schema: z.object({
    amount: z.string().describe('Payment amount'),
    currency: z.string().describe('Payment currency (ETH, BTC, etc.)'),
    description: z.string().describe('Payment description'),
    recipientEmail: z.string().optional().describe('Recipient email address'),
  }),
  func: async ({ amount, currency, description, recipientEmail }) => {
    try {
      console.log('💳 Creating payment link:', { amount, currency, description, recipientEmail });
      
      // Mock X402Pay API integration (replace with real API calls)
      if (CONFIG.x402payApiKey === 'mock-api-key') {
        const mockPaymentId = Math.random().toString(36).substr(2, 9);
        const mockPaymentLink = `https://pay.x402pay.com/invoice/${mockPaymentId}`;
        
        console.log('🔗 Mock payment link created:', mockPaymentLink);
        return {
          success: true,
          paymentId: mockPaymentId,
          paymentLink: mockPaymentLink,
          amount,
          currency,
          description,
          recipientEmail,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };
      }
      
      // Real X402Pay API call
      const response = await axios.post(`${CONFIG.x402payBaseUrl}/invoices`, {
        amount: parseFloat(amount),
        currency: currency.toUpperCase(),
        description,
        recipient_email: recipientEmail,
        expires_in: 86400, // 24 hours
      }, {
        headers: {
          'Authorization': `Bearer ${CONFIG.x402payApiKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('✅ X402Pay payment link created:', response.data.payment_url);
      return {
        success: true,
        paymentId: response.data.id,
        paymentLink: response.data.payment_url,
        amount,
        currency,
        description,
        recipientEmail,
        expiresAt: response.data.expires_at,
      };
    } catch (error) {
      console.error('❌ Error creating payment link:', error.message);
      throw error;
    }
  },
});

// 🛠️ Tool 3: Send Email
const sendEmail = tool({
  name: 'sendEmail',
  description: 'Send payment request emails with HTML template',
  schema: z.object({
    recipientEmail: z.string().describe('Recipient email address'),
    paymentLink: z.string().describe('Payment link URL'),
    amount: z.string().describe('Payment amount'),
    currency: z.string().describe('Payment currency'),
    description: z.string().describe('Payment description'),
  }),
  func: async ({ recipientEmail, paymentLink, amount, currency, description }) => {
    try {
      console.log('📧 Sending payment email to:', recipientEmail);
      
      const htmlTemplate = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Payment Request - AgenPay</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .payment-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
            .pay-button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💰 Payment Request</h1>
              <p>Secure crypto payment powered by AgenPay</p>
            </div>
            <div class="content">
              <h2>Hello!</h2>
              <p>You have received a payment request:</p>
              
              <div class="payment-details">
                <h3>💳 Payment Details</h3>
                <p><strong>Amount:</strong> ${amount} ${currency}</p>
                <p><strong>Description:</strong> ${description}</p>
                <p><strong>Due Date:</strong> ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
              </div>
              
              <div style="text-align: center;">
                <a href="${paymentLink}" class="pay-button">💳 Pay Now</a>
              </div>
              
              <p><strong>Why AgenPay?</strong></p>
              <ul>
                <li>🔒 Secure crypto payments</li>
                <li>⚡ Fast transaction processing</li>
                <li>📱 Mobile-friendly interface</li>
                <li>🌍 Global accessibility</li>
              </ul>
              
              <p>If you have any questions, please reply to this email.</p>
            </div>
            <div class="footer">
              <p>Powered by <strong>AgenPay</strong> - The Stripe for Web3</p>
              <p>This email was sent automatically by our AI payment agent.</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      // Mock email sending (replace with real email service)
      if (CONFIG.emailUser === 'test@example.com') {
        console.log('📨 Mock email sent successfully to:', recipientEmail);
        console.log('📧 Email content preview:');
        console.log(`Subject: Payment Request - ${amount} ${currency}`);
        console.log(`Payment Link: ${paymentLink}`);
        
        return {
          success: true,
          recipientEmail,
          subject: `Payment Request - ${amount} ${currency}`,
          sentAt: new Date().toISOString(),
          paymentLink,
        };
      }
      
      // Real email sending
      const mailOptions = {
        from: CONFIG.emailFrom,
        to: recipientEmail,
        subject: `💰 Payment Request - ${amount} ${currency}`,
        html: htmlTemplate,
      };
      
      const result = await emailTransporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', result.messageId);
      
      return {
        success: true,
        messageId: result.messageId,
        recipientEmail,
        subject: mailOptions.subject,
        sentAt: new Date().toISOString(),
        paymentLink,
      };
    } catch (error) {
      console.error('❌ Error sending email:', error.message);
      throw error;
    }
  },
});

// 🛠️ Tool 4: Check Notion Database
const checkNotionDatabase = tool({
  name: 'checkNotionDatabase',
  description: 'Monitor Notion database for scheduled payments',
  schema: z.object({
    databaseId: z.string().optional().describe('Notion database ID'),
  }),
  func: async ({ databaseId = CONFIG.notionDatabaseId }) => {
    try {
      console.log('🗃️ Checking Notion database:', databaseId);
      
      // Mock Notion API integration (replace with real API calls)
      if (CONFIG.notionApiKey === 'mock-notion-key') {
        const mockPayments = [
          {
            id: 'payment_1',
            client: 'Acme Corp',
            amount: '0.15',
            currency: 'ETH',
            status: 'pending',
            dueDate: '2024-01-20',
            email: 'client@acmecorp.com',
            description: 'Consulting services',
          },
          {
            id: 'payment_2',
            client: 'TechStart Inc',
            amount: '0.08',
            currency: 'ETH',
            status: 'scheduled',
            dueDate: new Date().toISOString().split('T')[0],
            email: 'billing@techstart.com',
            description: 'Monthly subscription',
          },
        ];
        
        console.log('📋 Mock Notion payments found:', mockPayments.length);
        return {
          success: true,
          payments: mockPayments,
          total: mockPayments.length,
          checkedAt: new Date().toISOString(),
        };
      }
      
      // Real Notion API call
      const response = await notion.databases.query({
        database_id: databaseId,
        filter: {
          or: [
            {
              property: 'Status',
              select: {
                equals: 'scheduled',
              },
            },
            {
              property: 'Status',
              select: {
                equals: 'pending',
              },
            },
          ],
        },
      });
      
      const payments = response.results.map(page => ({
        id: page.id,
        client: page.properties.Client?.title?.[0]?.plain_text || 'Unknown',
        amount: page.properties.Amount?.number || 0,
        currency: page.properties.Currency?.select?.name || 'ETH',
        status: page.properties.Status?.select?.name || 'unknown',
        dueDate: page.properties['Due Date']?.date?.start || null,
        email: page.properties.Email?.email || null,
        description: page.properties.Description?.rich_text?.[0]?.plain_text || '',
      }));
      
      console.log('✅ Notion payments retrieved:', payments.length);
      return {
        success: true,
        payments,
        total: payments.length,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Error checking Notion database:', error.message);
      throw error;
    }
  },
});

// 🤖 Initialize LLM
const llm = new ChatOpenAI({
  model: 'gpt-4o',
  apiKey: CONFIG.openaiApiKey,
  temperature: 0.3,
});

// 📋 Available tools
const tools = [extractPaymentDetails, createPaymentLink, sendEmail, checkNotionDatabase];

// 🎯 Agent Node Function
async function callAgent(state) {
  console.log('🤖 Agent processing request...');
  
  const systemPrompt = `You are ${CONFIG.agentName}, a sophisticated AI payment processing agent that specializes in:

🎯 CORE CAPABILITIES:
- Extract payment details from natural language
- Generate X402Pay crypto payment links
- Send professional payment request emails
- Monitor Notion databases for scheduled payments
- Process Web3 payments efficiently

💡 BEHAVIOR:
- Always use tools to complete tasks
- Be concise and efficient in responses
- Provide clear confirmation of actions taken
- Handle payment amounts, cryptocurrencies, and email addresses accurately
- Maintain professional tone throughout interactions

🔧 WORKFLOW:
1. Extract payment details from user input
2. Create payment links via X402Pay
3. Send formatted email notifications
4. Confirm successful completion

📝 EXAMPLE INTERACTIONS:
User: "Charge $150 to john@email.com for consulting"
→ Extract details → Create payment link → Send email → Confirm

Always use the available tools and provide step-by-step confirmation of actions.`;

  const messages = [
    new SystemMessage(systemPrompt),
    ...state.messages,
  ];

  const llmWithTools = llm.bindTools(tools);
  const response = await llmWithTools.invoke(messages);

  return {
    ...state,
    messages: [...state.messages, response],
    lastAction: 'agent_response',
  };
}

// 🔄 Should Continue Function
function shouldContinue(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  
  if (lastMessage?.tool_calls && lastMessage.tool_calls.length > 0) {
    return 'tools';
  }
  return '__end__';
}

// 🏗️ Build LangGraph
const workflow = new StateGraph({
  channels: AgentState,
});

// Add nodes
workflow.addNode('agent', callAgent);
workflow.addNode('tools', new ToolNode(tools));

// Add edges
workflow.setEntryPoint('agent');
workflow.addConditionalEdges('agent', shouldContinue);
workflow.addEdge('tools', 'agent');

// Initialize memory
const memory = new MemorySaver();

// Compile graph
const graph = workflow.compile({
  checkpointer: memory,
});

// 🚀 Main Processing Function
export async function processPayment(input, threadId = 'default-thread') {
  try {
    console.log(`\n🎯 Processing payment request: "${input}"`);
    console.log(`📱 Thread ID: ${threadId}`);
    
    const config = {
      configurable: {
        thread_id: threadId,
      },
    };
    
    const result = await graph.invoke({
      messages: [new HumanMessage(input)],
    }, config);
    
    console.log('✅ Payment processing completed');
    return result;
  } catch (error) {
    console.error('❌ Error processing payment:', error);
    throw error;
  }
}

// 📡 Continuous Monitoring Function
export async function startPaymentMonitoring(notionDatabaseId = CONFIG.notionDatabaseId, intervalMinutes = 10) {
  console.log(`\n🔄 Starting payment monitoring...`);
  console.log(`📋 Database ID: ${notionDatabaseId}`);
  console.log(`⏱️ Interval: ${intervalMinutes} minutes`);
  
  const monitor = async () => {
    try {
      console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Checking for scheduled payments...`);
      
      const result = await checkNotionDatabase.func({ databaseId: notionDatabaseId });
      
      if (result.payments && result.payments.length > 0) {
        console.log(`📋 Found ${result.payments.length} payments to process`);
        
        for (const payment of result.payments) {
          if (payment.status === 'scheduled' && payment.dueDate === new Date().toISOString().split('T')[0]) {
            console.log(`💰 Processing scheduled payment: ${payment.client} - ${payment.amount} ${payment.currency}`);
            
            try {
              // Create payment link
              const paymentLinkResult = await createPaymentLink.func({
                amount: payment.amount,
                currency: payment.currency,
                description: payment.description,
                recipientEmail: payment.email,
              });
              
              // Send email if payment link created successfully
              if (paymentLinkResult.success && payment.email) {
                await sendEmail.func({
                  recipientEmail: payment.email,
                  paymentLink: paymentLinkResult.paymentLink,
                  amount: payment.amount,
                  currency: payment.currency,
                  description: payment.description,
                });
                
                console.log(`✅ Scheduled payment processed for ${payment.client}`);
              }
            } catch (paymentError) {
              console.error(`❌ Error processing payment for ${payment.client}:`, paymentError.message);
            }
          }
        }
      } else {
        console.log('📋 No scheduled payments found');
      }
    } catch (error) {
      console.error('❌ Error in payment monitoring:', error.message);
    }
  };
  
  // Run initial check
  await monitor();
  
  // Set up interval
  const intervalId = setInterval(monitor, intervalMinutes * 60 * 1000);
  
  console.log(`✅ Payment monitoring started. Press Ctrl+C to stop.`);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping payment monitoring...');
    clearInterval(intervalId);
    process.exit(0);
  });
  
  return intervalId;
}

// 🎮 Main Demo Function
async function main() {
  console.log(`
🚀 AgenPay AI Payment Processing Agent
=======================================
Built with LangGraph.js for sophisticated payment automation

🔧 Configuration:
- OpenAI Model: GPT-4o
- Memory: MemorySaver (persistent conversations)
- Tools: 4 (extractPaymentDetails, createPaymentLink, sendEmail, checkNotionDatabase)
- X402Pay Integration: ${CONFIG.x402payApiKey !== 'mock-api-key' ? '✅ Live' : '🧪 Mock'}
- Email Service: ${CONFIG.emailUser !== 'test@example.com' ? '✅ Live' : '🧪 Mock'}
- Notion Integration: ${CONFIG.notionApiKey !== 'mock-notion-key' ? '✅ Live' : '🧪 Mock'}

💡 Example Commands:
- "Create payment for $200 USD for web development, send to client@email.com"
- "Charge 0.15 ETH to john@doe.com for consulting services"
- "Process payment of 500 EUR for monthly subscription to startup@tech.com"
  `);

  try {
    // Demo: Direct payment processing
    console.log('\n📝 Demo 1: Direct Payment Processing');
    console.log('=====================================');
    
    const demoInput = "Create payment for $200 USD for web development services, send to client@acmecorp.com";
    await processPayment(demoInput, 'demo-thread-1');
    
    // Demo: Continuous monitoring
    console.log('\n📡 Demo 2: Starting Continuous Monitoring');
    console.log('=========================================');
    
    // Start monitoring (runs indefinitely)
    await startPaymentMonitoring(CONFIG.notionDatabaseId, 1); // Check every minute for demo
    
  } catch (error) {
    console.error('❌ Error in main demo:', error);
    process.exit(1);
  }
}

// 🎯 Export functions for external use
export {
  processPayment,
  startPaymentMonitoring,
  graph as agentGraph,
  CONFIG as agentConfig,
};

// 🚀 Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}