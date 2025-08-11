/**
 * AgenPay AI Agent Class
 * Multi-user LangGraph.js payment processing agent with X402Pay integration
 * Each user gets their own agent instance with personalized configuration
 */

import { z } from 'zod';
import { StateGraph, MemorySaver, Annotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import axios from 'axios';
import nodemailer from 'nodemailer';
import { Client } from '@notionhq/client';
import { PrismaClient } from '@prisma/client';
import { Coinbase, Wallet } from '@coinbase/coinbase-sdk';
import X402PayService from './X402PayService.js';
import SchedulingService from './SchedulingService.js';
import NotionService from './NotionService.js';

// 🎯 LangGraph State Schema with proper message appending
const AgentState = Annotation.Root({
  messages: Annotation({
    reducer: (x, y) => x.concat(y),  // Append messages instead of replacing
    default: () => [],
  }),
  paymentData: Annotation({
    reducer: (x, y) => y ?? x,  // Replace if new value provided
    default: () => ({}),
  }),
  paymentLink: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  emailSent: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
  transactionHash: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  lastAction: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
});

export class AgenPayAgent {
  constructor(userId, userConfig = {}, sharedServices = {}) {
    this.userId = userId;
    this.userConfig = userConfig;
    this.sharedServices = sharedServices;
    this.prisma = new PrismaClient();
    this.isRunning = false;
    this.intervalId = null;
    this.graph = null;
    this.memory = new MemorySaver();
    
    // Initialize configurations
    this.config = {
      openaiApiKey: process.env.OPENAI_API_KEY,
      emailService: process.env.EMAIL_SERVICE || 'gmail',
      emailUser: process.env.EMAIL_USER || 'test@example.com',
      emailPass: process.env.EMAIL_PASS || 'mock-password',
      emailFrom: process.env.EMAIL_FROM || 'AgenPay <noreply@agenpay.com>',
      defaultCurrency: process.env.DEFAULT_CURRENCY || 'USDC',
      defaultNetwork: process.env.DEFAULT_NETWORK || 'sei-testnet',  
      agentName: process.env.AGENT_NAME || 'AgenPay AI',
      monitoringInterval: parseInt(process.env.MONITORING_INTERVAL_MINUTES) || 1,
      ...userConfig
    };

    // Initialize services
    this.setupServices();
  }

  async setupServices() {
    try {
      // Setup email transporter
      this.emailTransporter = nodemailer.createTransport({
        service: this.config.emailService,
        auth: {
          user: this.config.emailUser,
          pass: this.config.emailPass,
        },
      });
      
      // Log email configuration status
      const isRealEmail = this.config.emailUser !== 'test@example.com' && this.config.emailPass !== 'mock-password';
      console.log(`📧 [User ${this.userId}] Email setup: ${isRealEmail ? '✅ REAL Gmail configured' : '🧪 MOCK mode'}`);
      if (isRealEmail) {
        console.log(`📧 [User ${this.userId}] Email from: ${this.config.emailFrom}`);
      }

      // Setup Notion client (if user has API key)
      if (this.userConfig.notionApiKey) {
        this.notion = new Client({
          auth: this.userConfig.notionApiKey,
        });
      }

      // Setup Privy client
      if (process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET) {
        const { PrivyClient } = await import('@privy-io/server-auth');
        this.privy = new PrivyClient(process.env.PRIVY_APP_ID, process.env.PRIVY_APP_SECRET);
      }

      // Setup X402Pay service (use shared instance if provided)
      this.x402PayService = this.sharedServices.x402PayService || new X402PayService();
      if (this.sharedServices.x402PayService) {
        console.log(`✅ [User ${this.userId}] Using shared X402PayService instance`);
      } else {
        console.log(`⚠️ [User ${this.userId}] Creating new X402PayService instance (not recommended)`);
      }

      // Setup Scheduling service
      this.schedulingService = new SchedulingService();

      // Setup OpenAI LLM
      this.llm = new ChatOpenAI({
        model: 'gpt-4o-mini',
        apiKey: this.config.openaiApiKey,
        temperature: 0.3,
      });

      // Setup tools and graph with error handling
      try {
        this.setupTools();
        this.buildGraph();
      } catch (toolError) {
        console.warn(`⚠️ [User ${this.userId}] Tool setup failed, using simplified mode:`, toolError.message);
        this.setupSimplifiedAgent();
      }

      console.log(`✅ Agent services initialized for user ${this.userId}`);
    } catch (error) {
      console.error(`❌ Error setting up agent services for user ${this.userId}:`, error);
      throw error;
    }
  }

  setupTools() {
    // Simplified tools setup to avoid compatibility issues
    console.log(`🔧 [User ${this.userId}] Setting up simplified tools...`);
    
    // Create a simple tool array - if this fails, we'll use the simplified agent
    this.tools = [];
    
    try {
      // Simple tool creation that should work with most LangChain versions
      this.extractPaymentDetails = tool(
        async ({ input }) => {
          console.log(`🔍 [User ${this.userId}] Extracting payment details from:`, input);
          
          // Enhanced regex patterns for better extraction
          const amountMatch = input.match(/(\$?[\d,]+\.?\d*)\s*(ETH|BTC|USD|EUR|USDC|USDT)?/i);
          const emailMatch = input.match(/[\w\.-]+@[\w\.-]+\.\w+/);
          const addressMatch = input.match(/(0x[a-fA-F0-9]{40})/);
          const descriptionMatch = input.match(/for\s+(.+?)(?:\s+to\s+|\s+at\s+|\s+from\s+|$)/i);
          const nameMatch = input.match(/to\s+([\w\s]+?)(?:\s+at\s+|\s+\(|$)/i);
          
          // Transaction type detection
          let transactionType = 'ask_payment';
          if (input.toLowerCase().includes('refund') || input.toLowerCase().includes('ask and refund')) {
            transactionType = 'ask_and_refund';
          } else if (input.toLowerCase().includes('subscription')) {
            transactionType = 'subscription';
          }
          
          // Schedule type detection
          let scheduleType = 'immediate';
          let scheduledDate = null;
          if (input.toLowerCase().includes('schedule') || input.toLowerCase().includes('later')) {
            scheduleType = 'scheduled';
            const dateMatch = input.match(/on\s+([\d\-\/]+)|in\s+(\d+)\s+(days?|weeks?|months?)/i);
            if (dateMatch) {
              if (dateMatch[1]) {
                scheduledDate = new Date(dateMatch[1]).toISOString();
              } else if (dateMatch[2] && dateMatch[3]) {
                const amount = parseInt(dateMatch[2]);
                const unit = dateMatch[3].toLowerCase();
                const future = new Date();
                if (unit.startsWith('day')) future.setDate(future.getDate() + amount);
                else if (unit.startsWith('week')) future.setDate(future.getDate() + amount * 7);
                else if (unit.startsWith('month')) future.setMonth(future.getMonth() + amount);
                scheduledDate = future.toISOString();
              }
            }
          }
          
          const result = {
            amount: amountMatch ? amountMatch[1].replace(/[\$,]/g, '') : null,
            currency: amountMatch ? (amountMatch[2] || this.config.defaultCurrency) : this.config.defaultCurrency,
            network: this.config.defaultNetwork,
            recipientEmail: emailMatch ? emailMatch[0] : null,
            recipientName: nameMatch ? nameMatch[1].trim() : null,
            recipientAddress: addressMatch ? addressMatch[0] : null,
            description: descriptionMatch ? descriptionMatch[1].trim() : 'Payment request',
            transactionType,
            scheduleType,
            scheduledDate,
            aiPrompt: input,
          };
          
          console.log(`✅ [User ${this.userId}] Extracted payment data:`, result);
          return result;
        },
        {
          name: 'extractPaymentDetails',
          description: 'Parse comprehensive payment information from natural language input',
          schema: z.object({
            input: z.string().describe('Natural language payment request'),
          }),
        }
      );

      // Add create payment link tool
      this.createPaymentLink = tool(
        async ({ paymentData }) => {
          console.log(`💳 [User ${this.userId}] Creating X402Pay payment link...`);
          
          try {
            // Create X402Pay payment link
            const paymentLink = await this.x402PayService.createPaymentRequest({
              userId: this.userId,  // Pass the userId
              amount: paymentData.amount,
              currency: paymentData.currency,
              description: paymentData.description,
              recipientEmail: paymentData.recipientEmail,
              network: paymentData.network
            });

            console.log(`✅ [User ${this.userId}] Payment link created:`, paymentLink);
            console.log(`🔗 [User ${this.userId}] PAYMENT LINK: ${paymentLink.url || paymentLink.x402PayLink}`);
            console.log(`💰 [User ${this.userId}] AMOUNT: ${paymentData.amount} ${paymentData.currency}`);
            console.log(`📧 [User ${this.userId}] RECIPIENT: ${paymentData.recipientEmail}`);
            
            return {
              success: true,
              paymentLink: paymentLink.url || paymentLink.x402PayLink,
              paymentId: paymentLink.id,
              message: `Payment link created successfully: ${paymentLink.url || paymentLink.x402PayLink}`
            };
          } catch (error) {
            console.error(`❌ [User ${this.userId}] Payment link creation failed:`, error);
            return {
              success: false,
              error: error.message,
              message: 'Failed to create payment link'
            };
          }
        },
        {
          name: 'createPaymentLink',
          description: 'Create an X402Pay payment link for crypto payments',
          schema: z.object({
            paymentData: z.object({
              amount: z.string(),
              currency: z.string(),
              description: z.string(),
              recipientEmail: z.string(),
              network: z.string()
            })
          })
        }
      );

      // Add create multi-token payment link tool (disabled)
      this.createMultiTokenPaymentLink = tool(
        async ({ paymentData, acceptedTokens = ['SEI', 'USDC', 'USDT'] }) => {
          console.log(`💱 [User ${this.userId}] Creating multi-token X402Pay payment link...`);
          console.log(`⚠️ [User ${this.userId}] OKX DEX Service is disabled - using standard payment`);
          
          try {
            // Since OKX DEX is disabled, fallback to regular payment link
            const fallbackLink = await this.x402PayService.createPaymentRequest({
              userId: this.userId,
              amount: paymentData.amount,
              currency: paymentData.currency,
              description: `${paymentData.description} (Multi-token disabled - standard payment)`,
              recipientEmail: paymentData.recipientEmail,
              network: paymentData.network
            });

            return {
              success: true,
              paymentLink: fallbackLink.x402PayLink,
              paymentId: fallbackLink.paymentId,
              multiTokenEnabled: false,
              okxDexDisabled: true,
              message: `Payment link created (standard mode - OKX DEX disabled): ${fallbackLink.x402PayLink}`
            };
          } catch (fallbackError) {
            return {
              success: false,
              error: fallbackError.message,
              message: 'Failed to create payment link (OKX DEX disabled)'
            };
          }
        },
        {
          name: 'createMultiTokenPaymentLink',
          description: 'Create a multi-token X402Pay payment link (OKX DEX disabled - standard payment only)',
          schema: z.object({
            paymentData: z.object({
              amount: z.string(),
              currency: z.string().describe('Preferred currency to receive (e.g., USDC, SEI)'),
              description: z.string(),
              recipientEmail: z.string(),
              recipientName: z.string().nullable().optional(),
              network: z.string(),
              transactionType: z.string().optional(),
              scheduleType: z.string().optional(),
              scheduledDate: z.string().nullable().optional(),
              aiPrompt: z.string().optional()
            }),
            acceptedTokens: z.array(z.string()).optional().describe('Array of token symbols to accept for payment (default: [SEI, USDC, USDT])')
          })
        }
      );

      // Add get payment options tool
      this.getPaymentOptions = tool(
        async ({ paymentId, userPreferredToken = 'SEI' }) => {
          console.log(`🧮 [User ${this.userId}] Getting payment options for ${paymentId}`);
          
          try {
            const options = await this.x402PayService.calculatePaymentOptions(paymentId, userPreferredToken);
            
            console.log(`📊 [User ${this.userId}] Payment options calculated:`, options);
            
            if (options.swapRequired && options.swapPossible) {
              return {
                success: true,
                swapRequired: true,
                inputAmount: options.inputAmount,
                outputAmount: options.outputAmount,
                estimatedGas: options.estimatedGas,
                tradeFee: options.tradeFee,
                priceImpact: options.priceImpact,
                route: options.route,
                message: `Swap available: ${options.inputAmount} ${userPreferredToken} → ${options.outputAmount} ${options.receiveCurrency}`
              };
            } else if (options.swapRequired && !options.swapPossible) {
              return {
                success: false,
                swapRequired: true,
                swapPossible: false,
                error: options.error,
                message: `Swap not available: ${options.error}`
              };
            } else {
              return {
                success: true,
                swapRequired: false,
                directPayment: true,
                paymentAmount: options.paymentAmount,
                paymentCurrency: options.paymentCurrency,
                message: `Direct payment: ${options.paymentAmount} ${options.paymentCurrency}`
              };
            }
          } catch (error) {
            console.error(`❌ [User ${this.userId}] Error getting payment options:`, error);
            return {
              success: false,
              error: error.message,
              message: 'Failed to get payment options'
            };
          }
        },
        {
          name: 'getPaymentOptions',
          description: 'Get available payment options and swap routes for a multi-token payment',
          schema: z.object({
            paymentId: z.string(),
            userPreferredToken: z.string().optional().describe('Token the user wants to pay with (default: SEI)')
          })
        }
      );

      // Add send email tool
      this.sendPaymentEmail = tool(
        async ({ paymentData, paymentLink }) => {
          console.log(`📧 [User ${this.userId}] Sending payment email...`);
          console.log(`📧 [User ${this.userId}] Payment link received:`, paymentLink);
          console.log(`📧 [User ${this.userId}] Payment data received:`, paymentData);
          
          try {
            const emailContent = this.generateX402PayEmailTemplate({
              amount: paymentData.amount,
              currency: paymentData.currency,
              description: paymentData.description,
              paymentLink: paymentLink,
              recipientName: paymentData.recipientName,
              transactionType: paymentData.transactionType,
              userConfig: this.userConfig
            });

            // Check if we have real email credentials
            const isRealEmail = this.config.emailUser !== 'test@example.com' && this.config.emailPass !== 'mock-password';
            
            if (isRealEmail) {
              // Send real email
              await this.emailTransporter.sendMail({
                from: this.config.emailFrom,
                to: paymentData.recipientEmail,
                subject: `Payment Request - ${paymentData.amount} ${paymentData.currency}`,
                html: emailContent.html || emailContent
              });
              console.log(`📧 [User ${this.userId}] ✅ REAL EMAIL SENT to: ${paymentData.recipientEmail}`);
            } else {
              console.log(`📧 [User ${this.userId}] 🧪 MOCK EMAIL (would be sent to): ${paymentData.recipientEmail}`);
              console.log(`📧 [User ${this.userId}] 📝 Email content preview:`, emailContent.substring(0, 200) + '...');
            }
            
            return {
              success: true,
              message: `Payment request email sent to ${paymentData.recipientEmail}`,
              emailSent: true
            };
          } catch (error) {
            console.error(`❌ [User ${this.userId}] Email sending failed:`, error);
            return {
              success: false,
              error: error.message,
              message: 'Failed to send payment email'
            };
          }
        },
        {
          name: 'sendPaymentEmail',
          description: 'Send payment request email with X402Pay link',
          schema: z.object({
            paymentData: z.object({
              amount: z.string(),
              currency: z.string(),
              description: z.string(),
              recipientEmail: z.string(),
              recipientName: z.string().nullable(),
              transactionType: z.string()
            }),
            paymentLink: z.string()
          })
        }
      );

      // Add save to Notion tool
      this.saveToNotion = tool(
        async ({ paymentData, paymentLink }) => {
          console.log(`🗃️ [User ${this.userId}] Saving to Notion...`);
          
          try {
            if (!this.notion) {
              return {
                success: false,
                message: 'Notion not connected for this user'
              };
            }

            // Find user's incoming payments database
            const database = await this.prisma.notionDatabase.findFirst({
              where: { 
                userId: this.userId, 
                databaseType: 'INCOMING_PAYMENTS',
                isActive: true 
              }
            });

            if (!database) {
              return {
                success: false,
                message: 'Notion database not found for user'
              };
            }

            // Extract payment ID from the payment link
            const paymentId = paymentLink.split('/').pop(); // Get the last part of the URL
            console.log(`🔑 [User ${this.userId}] Using payment ID for Notion: ${paymentId}`);

            // Create Notion service and add record
            const notionService = new NotionService(this.userConfig.notionApiKey);
            const result = await notionService.addIncomingPaymentRecord(database.databaseId, {
              requestId: paymentId, // Use the actual payment ID instead of REQ-timestamp
              amount: paymentData.amount,
              currency: paymentData.currency,
              network: paymentData.network,
              recipientEmail: paymentData.recipientEmail,
              recipientName: paymentData.recipientName,
              description: paymentData.description,
              aiPrompt: paymentData.aiPrompt,
              transactionType: paymentData.transactionType,
              scheduleType: paymentData.scheduleType,
              scheduledDate: paymentData.scheduledDate,
              status: 'processing',
              x402PayLink: paymentLink
            });

            return {
              success: true,
              message: 'Payment request saved to Notion database',
              notionPageId: result.id
            };
          } catch (error) {
            console.error(`❌ [User ${this.userId}] Notion save failed:`, error);
            return {
              success: false,
              error: error.message,
              message: 'Failed to save to Notion'
            };
          }
        },
        {
          name: 'saveToNotion',
          description: 'Save payment request to Notion database',
          schema: z.object({
            paymentData: z.object({
              amount: z.string(),
              currency: z.string(),
              network: z.string(),
              recipientEmail: z.string(),
              recipientName: z.string().nullable(),
              description: z.string(),
              aiPrompt: z.string(),
              transactionType: z.string(),
              scheduleType: z.string(),
              scheduledDate: z.string().nullable()
            }),
            paymentLink: z.string()
          })
        }
      );

      this.tools.push(this.extractPaymentDetails);
      this.tools.push(this.createPaymentLink);
      this.tools.push(this.createMultiTokenPaymentLink);
      this.tools.push(this.getPaymentOptions);
      this.tools.push(this.sendPaymentEmail);
      this.tools.push(this.saveToNotion);
      console.log(`✅ [User ${this.userId}] Tools setup completed with ${this.tools.length} tools`);
      
    } catch (toolError) {
      console.warn(`⚠️ [User ${this.userId}] Tool creation failed:`, toolError.message);
      this.tools = []; // Fallback to no tools
    }
  }

  setupSimplifiedAgent() {
    // Simple agent without tools for fallback
    const callSimpleAgent = async (state) => {
      console.log(`🤖 [User ${this.userId}] Simple agent processing with ${state.messages?.length || 0} messages`);
      
      const systemPrompt = `You are ${this.config.agentName}, an AI payment assistant for user ${this.userId}.

I can help you with:
- Understanding payment requests
- Explaining crypto payment processes
- Providing guidance on scheduling payments
- Basic payment information

Currently running in simplified mode. For full functionality, please ensure all dependencies are properly installed.

Please let me know how I can help with your payment needs!`;

      const messages = [
        new SystemMessage(systemPrompt),
        ...(state.messages || []),
      ];

      const response = await this.llm.invoke(messages);
      
      console.log(`🔍 [User ${this.userId}] Simple agent response:`, response);

      const newState = {
        ...state,
        messages: [...(state.messages || []), response],
        lastAction: 'simple_agent_response',
      };
      
      console.log(`🔍 [User ${this.userId}] Simple agent returning state with ${newState.messages.length} messages`);
      
      return newState;
    };

    // Build simple graph without tools
    const workflow = new StateGraph(AgentState);
    workflow.addNode('agent', callSimpleAgent);
    workflow.setEntryPoint('agent');
    workflow.addEdge('agent', '__end__');

    this.graph = workflow.compile({ checkpointer: this.memory });
    console.log(`✅ [User ${this.userId}] Simplified agent compiled successfully`);
  }

  /**
   * Helper method to extract text from Notion properties
   */
  getNotionProperty(properties, propertyName) {
    const property = properties[propertyName];
    if (!property) return '';
    
    if (property.title && property.title.length > 0) {
      return property.title[0].text?.content || property.title[0].plain_text || '';
    }
    
    if (property.rich_text && property.rich_text.length > 0) {
      return property.rich_text[0].text?.content || property.rich_text[0].plain_text || '';
    }
    
    return '';
  }

  buildGraph() {
    try {
      // Check if we have tools available
      if (!this.tools || this.tools.length === 0) {
        console.log(`⚠️ [User ${this.userId}] No tools available, using simplified agent`);
        this.setupSimplifiedAgent();
        return;
      }

      console.log(`🤖 [User ${this.userId}] Building full payment agent with ${this.tools.length} tools...`);

      // Agent node function with tools
      const callAgent = async (state) => {
        console.log(`🤖 [User ${this.userId}] Agent processing with ${state.messages?.length || 0} messages in context`);
        
        // Debug: Show last few messages and their types
        if (state.messages?.length > 0) {
          const lastFew = state.messages.slice(-3);
          console.log(`📜 [User ${this.userId}] Last messages:`, lastFew.map((m, i) => ({
            index: state.messages.length - 3 + i,
            type: m._getType ? m._getType() : 'unknown',
            hasToolCalls: !!m.tool_calls,
            toolCallCount: m.tool_calls?.length || 0,
            contentPreview: typeof m.content === 'string' ? m.content.substring(0, 50) + '...' : 'non-string'
          })));
        }
        
        const systemPrompt = `You are ${this.config.agentName}, an advanced AI payment agent for user ${this.userId}.

🧠 CONVERSATION CONTINUITY:
You maintain memory of our entire conversation. If we've already discussed payment details, build upon that context instead of starting over.

🎯 WORKFLOW INSTRUCTIONS:
1. If a new payment request needs details extracted, use the extractPaymentDetails tool ONCE
2. If the user confirms or asks to proceed with previously extracted details, START the payment workflow:
   a) FIRST: Choose between createPaymentLink (standard) or createMultiTokenPaymentLink (multi-token with OKX DEX)
   b) AFTER getting the payment link result, use sendPaymentEmail tool with the payment link
   c) AFTER email is sent, use saveToNotion tool to save record to user's Notion database
3. If the user asks questions about previous requests, refer to the conversation history
4. Do NOT call tools repeatedly for the same request
5. Do NOT forget previous conversation context
6. IMPORTANT: Call only ONE tool at a time, then wait for the result before deciding the next action

💱 MULTI-TOKEN PAYMENT FEATURES (NEW!):
- When user mentions "any token", "flexible payment", or wants to accept multiple currencies, use createMultiTokenPaymentLink
- Multi-token payments accept ETH, SEI, USDC, USDT, WETH and automatically swap to the recipient's preferred currency
- Powered by OKX DEX API for optimal swap routes and pricing
- Use getPaymentOptions to show swap calculations and payment routes

💳 AVAILABLE TOOLS:
- extractPaymentDetails: Parse payment info from natural language (amount, currency, email, etc.)
- createPaymentLink: Create standard X402Pay payment link for single crypto currency
- createMultiTokenPaymentLink: Create multi-token X402Pay payment link with OKX DEX swapping (accepts multiple tokens)
- getPaymentOptions: Calculate swap routes and payment options for multi-token payments
- sendPaymentEmail: Send payment request email with X402Pay link
- saveToNotion: Save payment request to Notion database

🔄 PAYMENT LINK DECISION LOGIC:
- Use createMultiTokenPaymentLink when:
  * User wants to accept multiple tokens/currencies
  * User mentions "flexible payment" or "any token"
  * User wants optimal pricing through swapping
- Use createPaymentLink when:
  * User specifies only one specific currency
  * Simple, direct payment is preferred

📋 CONVERSATION-AWARE RESPONSES:
- If new request: Extract details and explain payment options (standard vs multi-token)
- If user confirms: "Great! I'll proceed with the [multi-token/standard] payment request..." then START with appropriate tool
- If you just created a payment link: Use sendPaymentEmail and saveToNotion tools with the link
- If user asks for changes: "I'll update the [specific detail] from our previous discussion..."
- If user asks questions: Reference the conversation history appropriately

🔄 COMPLETE WORKFLOW:
When user confirms payment request, execute ONLY ONE TOOL AT A TIME in this order:
1. FIRST: Call createMultiTokenPaymentLink (preferred) or createPaymentLink with extracted payment data
2. WAIT for result, then call sendPaymentEmail tool with payment data and the link from step 1
3. WAIT for result, then call saveToNotion tool with payment data and link

⚠️ CRITICAL: You MUST call tools ONE AT A TIME, NOT in parallel. Wait for each tool result before calling the next tool.

🚫 CRITICAL RULES: 
- NEVER forget conversation context
- NEVER ask for details already provided
- NEVER call extractPaymentDetails for follow-up questions about the same request
- ALWAYS acknowledge previous context when user responds
- PREFER multi-token payments for better user experience unless user specifically requests single currency

Continue our conversation naturally, building on what we've already discussed.`;

        const messages = [
          new SystemMessage(systemPrompt),
          ...(state.messages || []),
        ];

        // Bind tools to LLM
        const llmWithTools = this.llm.bindTools(this.tools);
        const response = await llmWithTools.invoke(messages);
        
        console.log(`🔍 [User ${this.userId}] Agent response:`, {
          hasToolCalls: response.tool_calls?.length > 0,
          toolCount: response.tool_calls?.length || 0,
          content: response.content?.substring(0, 100) + '...'
        });

        return {
          messages: [response],  // Return only the new response message
          lastAction: 'agent_response',
        };
      };

      // Tool execution node
      const executeTools = async (state) => {
        console.log(`🔧 [User ${this.userId}] ===== TOOL EXECUTION NODE CALLED =====`);
        console.log(`🔧 [User ${this.userId}] State has ${state.messages?.length || 0} messages`);
        
        const lastMessage = state.messages[state.messages.length - 1];
        
        console.log(`🔧 [User ${this.userId}] Last message:`, {
          type: lastMessage?._getType ? lastMessage._getType() : 'unknown',
          hasToolCalls: !!lastMessage?.tool_calls,
          toolCallCount: lastMessage?.tool_calls?.length || 0,
          toolCalls: lastMessage?.tool_calls?.map(tc => ({ id: tc.id, name: tc.name })) || []
        });
        
        if (!lastMessage?.tool_calls || lastMessage.tool_calls.length === 0) {
          console.log(`🔧 [User ${this.userId}] No tool calls found, returning state unchanged`);
          return state;
        }

        const toolResults = [];
        
        for (const toolCall of lastMessage.tool_calls) {
          try {
            const tool = this.tools.find(t => t.name === toolCall.name);
            if (tool) {
              console.log(`🔧 [User ${this.userId}] Executing tool: ${toolCall.name} with ID: ${toolCall.id}`);
              const result = await tool.func(toolCall.args);
              
              const toolMessage = new ToolMessage({
                tool_call_id: toolCall.id,
                content: JSON.stringify(result)
              });
              
              console.log(`✅ [User ${this.userId}] Created tool message:`, {
                tool_call_id: toolMessage.tool_call_id,
                type: toolMessage._getType(),
                contentLength: toolMessage.content.length
              });
              
              toolResults.push(toolMessage);
            }
          } catch (error) {
            console.error(`❌ [User ${this.userId}] Tool execution error:`, error);
            toolResults.push(new ToolMessage({
              tool_call_id: toolCall.id,
              content: `Error: ${error.message}`
            }));
          }
        }

        console.log(`🔧 [User ${this.userId}] Created ${toolResults.length} tool result messages`);

        return {
          ...state,
          messages: toolResults,  // Return only the new tool messages to append
          lastAction: 'tools_executed',
        };
      };

      // Should continue function
      const shouldContinue = (state) => {
        const lastMessage = state.messages[state.messages.length - 1];
        
        console.log(`🔀 [User ${this.userId}] shouldContinue - Last message type:`, {
          type: lastMessage?._getType ? lastMessage._getType() : 'unknown',
          hasToolCalls: !!lastMessage?.tool_calls,
          toolCallCount: lastMessage?.tool_calls?.length || 0
        });
        
        // Continue to tools if there are tool calls
        if (lastMessage?.tool_calls && lastMessage.tool_calls.length > 0) {
          console.log(`🔀 [User ${this.userId}] Routing to tools node`);
          return 'tools';
        }
        
        // Continue to agent if last message was from tools (but only once)
        if (lastMessage?._getType && lastMessage._getType() === 'tool') {
          console.log(`🔀 [User ${this.userId}] Routing to agent after tool`);
          return 'agent';
        }
        
        // Otherwise end
        console.log(`🔀 [User ${this.userId}] Ending conversation`);
        return '__end__';
      };

      // Try using built-in ToolNode instead of custom execution
      const toolNode = new ToolNode(this.tools);
      
      // Build graph with proper tool flow
      const workflow = new StateGraph(AgentState);
      workflow.addNode('agent', callAgent);
      workflow.addNode('tools', toolNode);  // Use built-in ToolNode
      workflow.setEntryPoint('agent');
      workflow.addConditionalEdges('agent', shouldContinue);
      workflow.addConditionalEdges('tools', shouldContinue);

      this.graph = workflow.compile({ 
        checkpointer: this.memory,
        recursionLimit: 10  // Prevent infinite loops
      });
      console.log(`✅ [User ${this.userId}] Full payment agent with tools compiled successfully`);
      
    } catch (error) {
      console.warn(`⚠️ [User ${this.userId}] Graph build failed, falling back to simplified agent:`, error.message);
      this.setupSimplifiedAgent();
    }
  }

  generateX402PayEmailTemplate({ amount, currency, description, paymentLink, recipientName, transactionType, userConfig }) {
    const isRefundable = transactionType === 'ask_and_refund';
    
    return `
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
          .security-info { background: #e8f4f8; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #b3d9e6; }
          .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; }
          .refund-notice { background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffeaa7; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 Payment Request</h1>
            <p>Secure crypto payment powered by AgenPay × X402Pay</p>
          </div>
          <div class="content">
            <h2>Hello${recipientName ? ` ${recipientName}` : ''}!</h2>
            <p>You have received a payment request:</p>
            
            <div class="payment-details">
              <h3>💳 Payment Details</h3>
              <p><strong>Amount:</strong> ${amount} ${currency}</p>
              <p><strong>Description:</strong> ${description}</p>
              <p><strong>Network:</strong> Sei Testnet </p>
              ${isRefundable ? '<p><strong>Type:</strong> ⚡ Auto-refund enabled (funds will be returned after 30 days)</p>' : ''}
            </div>
            
            <div class="security-info">
              <h3>🔒 Powered by X402Pay Protocol</h3>
              <p>This payment uses the X402 HTTP protocol for secure cryptocurrency transactions:</p>
              <ul>
                <li>✅ Cryptographic payment verification</li>
                <li>✅ No account creation required</li>
                <li>✅ Direct wallet-to-wallet transfer</li>
                <li>✅ Instant confirmation</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${paymentLink}" class="pay-button">💳 Pay with X402Pay</a>
            </div>

            ${isRefundable ? `
            <div class="refund-notice">
              <h3>🔄 Automatic Refund Policy</h3>
              <p>This payment includes automatic refund protection. Your payment will be automatically refunded after 30 days if applicable.</p>
            </div>
            ` : ''}
            
            <p><strong>How X402Pay Works:</strong></p>
            <ol>
              <li>Click the payment button above</li>
              <li>Connect your crypto wallet (MetaMask, Coinbase Wallet, etc.)</li>
              <li>Approve the transaction</li>
              <li>Payment is verified instantly via cryptographic proof</li>
            </ol>
          </div>
          <div class="footer">
            <p>Powered by <strong>AgenPay × X402Pay</strong> - The Future of Web3 Payments</p>
            <p>This payment request uses the X402 HTTP protocol for secure, verified crypto transactions.</p>
            <p>Questions? This email was sent automatically by our AI payment agent.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async processPayment(input, threadId = null) {
    try {
      // Use provided threadId or create a consistent one for this user session
      let actualThreadId = threadId;
      if (!actualThreadId) {
        // Create a session-based threadId that persists for this user
        actualThreadId = `user-${this.userId}-chat-session`;
      }
      console.log(`🎯 [User ${this.userId}] Processing: "${input}" (Thread: ${actualThreadId})`);
      
      // Check if graph is available
      if (!this.graph) {
        console.warn(`⚠️ [User ${this.userId}] No graph available, attempting simplified setup...`);
        this.setupSimplifiedAgent();
      }

      if (!this.graph) {
        throw new Error('Agent graph could not be initialized');
      }
      
      const config = {
        configurable: { thread_id: actualThreadId },
      };
      
      // Let LangGraph handle state restoration from checkpointer
      // We just pass the new input message and let it append to existing conversation
      console.log(`📤 [User ${this.userId}] Invoking graph with new message: "${input.substring(0, 50)}..."`);
      
      // Check current state from checkpointer
      try {
        const currentState = await this.graph.getState(config);
        console.log(`🧠 [User ${this.userId}] State before processing:`, {
          messageCount: currentState.values?.messages?.length || 0,
        });
      } catch (stateError) {
        console.log(`⚠️ [User ${this.userId}] Could not get current state:`, stateError.message);
      }
      
      // Revert to original approach with state
      const result = await this.graph.invoke({
        messages: [new HumanMessage(input)],
      }, config);
      
      console.log(`📥 [User ${this.userId}] Conversation now has ${result.messages?.length || 0} total messages`);
      
      // Update agent statistics
      await this.updateAgentStats();
      
      console.log(`✅ [User ${this.userId}] Payment processing completed`);
      return { ...result, threadId: actualThreadId };
    } catch (error) {
      console.error(`❌ [User ${this.userId}] Error processing payment:`, error);
      throw error;
    }
  }

  async startMonitoring(intervalMinutes = null) {
    const interval = intervalMinutes || this.config.monitoringInterval;
    
    if (this.isRunning) {
      console.log(`⚠️ [User ${this.userId}] Agent already running`);
      return;
    }

    console.log(`🔄 [User ${this.userId}] Starting monitoring (${interval} min intervals)`);
    console.log(`🗃️ [User ${this.userId}] Notion database monitoring: Every ${interval} minute${interval === 1 ? '' : 's'}`);
    this.isRunning = true;

    const monitor = async () => {
      if (!this.isRunning) return;
      
      try {
        console.log(`⏰ [User ${this.userId}] Checking scheduled payments and Notion entries...`);
        
        // 1. Check PostgreSQL for scheduled payments
        const scheduledPayments = await this.prisma.paymentRequest.findMany({
          where: { 
            userId: this.userId, 
            status: 'scheduled',
            scheduledDate: {
              lte: new Date() // Due date has passed
            }
          }
        });

        // Process any due payments from database
        for (const payment of scheduledPayments) {
          console.log(`🔔 [User ${this.userId}] Processing scheduled payment: ${payment.id}`);
          
          await this.prisma.paymentRequest.update({
            where: { id: payment.id },
            data: { status: 'processing' }
          });
        }

        if (scheduledPayments.length > 0) {
          console.log(`✅ [User ${this.userId}] Processed ${scheduledPayments.length} scheduled payments from database`);
        }

        // 2. Check Notion databases for new entries
        await this.checkNotionForNewEntries();
        
      } catch (error) {
        console.error(`❌ [User ${this.userId}] Monitoring error:`, error);
      }
    };

    // Run initial check
    await monitor();
    
    // Set up interval
    this.intervalId = setInterval(monitor, interval * 60 * 1000);
    
    // Update agent status
    await this.updateAgentStatus('RUNNING');
  }

  /**
   * Check Notion databases for new payment requests
   */
  async checkNotionForNewEntries() {
    try {
      if (!this.notion || !this.userConfig.notionApiKey) {
        console.log(`⚠️ [User ${this.userId}] No Notion integration available for monitoring`);
        return;
      }

      // Get user's Notion databases
      const databases = await this.prisma.notionDatabase.findMany({
        where: { 
          userId: this.userId, 
          isActive: true,
          databaseType: 'INCOMING_PAYMENTS' // Only monitor incoming payments for now
        },
      });

      for (const database of databases) {
        console.log(`🗃️ [User ${this.userId}] Checking Notion database: ${database.databaseName}`);
        
        try {
          // Query for new or draft entries that need processing
          const response = await this.notion.databases.query({
            database_id: database.databaseId,
            filter: {
              or: [
                {
                  property: 'Status',
                  select: {
                    equals: 'draft'
                  }
                },
                {
                  property: 'Status',
                  select: {
                    equals: 'scheduled'
                  }
                }
              ]
            },
            sorts: [
              {
                property: 'Created',
                direction: 'descending'
              }
            ],
            page_size: 10 // Check last 10 entries
          });

          console.log(`🔍 [User ${this.userId}] Found ${response.results?.length || 0} entries to process in Notion`);

          for (const page of response.results || []) {
            await this.processNotionEntry(page, database);
          }

        } catch (notionError) {
          console.error(`❌ [User ${this.userId}] Error querying Notion database ${database.databaseName}:`, notionError);
        }
      }
    } catch (error) {
      console.error(`❌ [User ${this.userId}] Error checking Notion for new entries:`, error);
    }
  }

  /**
   * Process a single Notion entry
   */
  async processNotionEntry(notionPage, database) {
    try {
      // Extract data from Notion page properties
      const requestId = this.getNotionProperty(notionPage.properties, 'Request ID');
      const amount = notionPage.properties['Amount']?.number;
      const currency = notionPage.properties['Currency']?.select?.name || 'USDC';
      const recipientEmail = notionPage.properties['Recipient Email']?.email;
      const recipientName = this.getNotionProperty(notionPage.properties, 'Recipient Name');
      const description = this.getNotionProperty(notionPage.properties, 'Description');
      const status = notionPage.properties['Status']?.select?.name;
      const x402PayLink = notionPage.properties['X402Pay Link']?.url;

      console.log(`📋 [User ${this.userId}] Processing Notion entry: ${requestId} (${amount} ${currency})`);

      // Skip if essential data is missing
      if (!amount || !recipientEmail) {
        console.log(`⚠️ [User ${this.userId}] Skipping entry ${requestId}: missing amount or email`);
        return;
      }

      // Skip if already has a payment link (already processed)
      if (x402PayLink) {
        console.log(`⚠️ [User ${this.userId}] Skipping entry ${requestId}: already has payment link`);
        return;
      }

      // Check if this entry already exists in our database
      const existingRequest = await this.prisma.paymentRequest.findFirst({
        where: {
          OR: [
            { id: requestId },
            { 
              AND: [
                { userId: this.userId },
                { amount: amount },
                { recipientEmail: recipientEmail },
                { description: description }
              ]
            }
          ]
        }
      });

      if (existingRequest) {
        console.log(`⚠️ [User ${this.userId}] Entry ${requestId} already exists in database, skipping`);
        return;
      }

      console.log(`🔄 [User ${this.userId}] Creating payment request for Notion entry: ${requestId}`);

      // Create payment request using X402PayService
      const paymentResult = await this.x402PayService.createPaymentRequest({
        userId: this.userId,
        amount: amount,
        currency: currency,
        recipientEmail: recipientEmail,
        recipientName: recipientName || '',
        description: description || 'Payment request from Notion',
        transactionType: 'ask_payment',
        scheduleType: 'immediate',
        aiPrompt: `Processed from Notion entry: ${requestId}`
      });

      console.log(`💳 [User ${this.userId}] Payment link created for Notion entry: ${paymentResult.x402PayLink}`);

      // Update the Notion entry with the payment link and new status
      await this.notion.pages.update({
        page_id: notionPage.id,
        properties: {
          'X402Pay Link': {
            url: paymentResult.x402PayLink
          },
          'Status': {
            select: {
              name: 'processing'
            }
          },
          'Request ID': {
            title: [
              {
                text: {
                  content: paymentResult.paymentId
                }
              }
            ]
          }
        }
      });

      // Send email notification
      if (this.config.emailUser !== 'test@example.com') {
        try {
          const emailContent = this.generateX402PayEmailTemplate({
            amount: amount,
            currency: currency,
            description: description,
            paymentLink: paymentResult.x402PayLink,
            recipientName: recipientName,
            transactionType: 'ask_payment',
            userConfig: this.userConfig
          });

          await this.emailTransporter.sendMail({
            from: this.config.emailFrom,
            to: recipientEmail,
            subject: `Payment Request - ${amount} ${currency}`,
            html: emailContent
          });

          console.log(`📧 [User ${this.userId}] Email sent for Notion entry: ${recipientEmail}`);
        } catch (emailError) {
          console.error(`❌ [User ${this.userId}] Email failed for Notion entry:`, emailError);
        }
      }

      console.log(`✅ [User ${this.userId}] Notion entry processed successfully: ${requestId}`);

    } catch (error) {
      console.error(`❌ [User ${this.userId}] Error processing Notion entry:`, error);
    }
  }

  async stopMonitoring() {
    console.log(`🛑 [User ${this.userId}] Stopping monitoring...`);
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    await this.updateAgentStatus('STOPPED');
  }

  async updateAgentStatus(status) {
    try {
      await this.prisma.agent.upsert({
        where: { userId: this.userId },
        update: {
          status,
          lastActivity: new Date(),
        },
        create: {
          userId: this.userId,
          name: `${this.config.agentName} - User ${this.userId}`,
          status,
          threadId: `user-${this.userId}-main`,
          lastActivity: new Date(),
        },
      });
    } catch (error) {
      console.error(`❌ [User ${this.userId}] Error updating agent status:`, error);
    }
  }

  async updateAgentStats() {
    try {
      const stats = await this.prisma.transaction.groupBy({
        by: ['type'],
        where: { userId: this.userId },
        _count: { type: true },
        _sum: { amount: true },
      });

      const totalSent = stats.find(s => s.type === 'SEND')?._count.type || 0;
      const totalReceived = stats.find(s => s.type === 'RECEIVE')?._count.type || 0;
      const totalAmountSent = stats.find(s => s.type === 'SEND')?._sum.amount || 0;
      const totalAmountReceived = stats.find(s => s.type === 'RECEIVE')?._sum.amount || 0;

      await this.prisma.agent.upsert({
        where: { userId: this.userId },
        update: {
          totalSent,
          totalReceived,
          totalAmountSent,
          totalAmountReceived,
          totalProcessed: totalSent + totalReceived,
        },
        create: {
          userId: this.userId,
          name: `${this.config.agentName} - User ${this.userId}`,
          threadId: `user-${this.userId}-main`,
          totalSent,
          totalReceived,
          totalAmountSent,
          totalAmountReceived,
          totalProcessed: totalSent + totalReceived,
        },
      });
    } catch (error) {
      console.error(`❌ [User ${this.userId}] Error updating agent stats:`, error);
    }
  }

  async cleanup() {
    await this.stopMonitoring();
    await this.prisma.$disconnect();
    console.log(`🧹 [User ${this.userId}] Agent cleanup completed`);
  }
}

export default AgenPayAgent;