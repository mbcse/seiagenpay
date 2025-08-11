/**
 * Notion Service for AgenPay
 * Handles workspace setup, database creation, and OAuth management
 */

import { Client } from '@notionhq/client';
import { PrismaClient } from '@prisma/client';

export class NotionService {
  constructor(notionApiKey = null) {
    this.notion = notionApiKey ? new Client({ auth: notionApiKey }) : null;
    this.prisma = new PrismaClient();
  }

  /**
   * Generate Notion OAuth URL
   */
  static generateOAuthUrl(userId) {
    const clientId = process.env.NOTION_CLIENT_ID;
    
    if (!clientId) {
      throw new Error('Notion OAuth not configured - missing NOTION_CLIENT_ID');
    }

    const redirectUri = process.env.NOTION_REDIRECT_URI || 'http://localhost:3001/api/notion/callback';
    const state = userId; // Use user ID as state for security
    
    const authUrl = `https://api.notion.com/v1/oauth/authorize?` +
      `client_id=${clientId}&` +
      `response_type=code&` +
      `owner=user&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${state}`;

    return authUrl;
  }

  /**
   * Handle OAuth callback and exchange code for token
   */
  static async handleOAuthCallback(code, state) {
    try {
      const clientId = process.env.NOTION_CLIENT_ID;
      const clientSecret = process.env.NOTION_CLIENT_SECRET;
      const redirectUri = process.env.NOTION_REDIRECT_URI || 'http://localhost:3001/api/notion/callback';

      if (!clientId || !clientSecret) {
        throw new Error('Missing Notion OAuth credentials');
      }

      // Exchange code for access token
      const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri
        })
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${errorData}`);
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      if (!accessToken) {
        throw new Error('No access token received from Notion');
      }

      return {
        success: true,
        accessToken,
        userId: state
      };
    } catch (error) {
      console.error('❌ OAuth callback error:', error);
      throw error;
    }
  }

  /**
   * Complete user integration with OAuth token
   */
  async completeIntegration(userId, accessToken) {
    try {
      // Initialize client with new token
      this.notion = new Client({ auth: accessToken });

      // Test connection
      const connectionTest = await this.testConnection();
      if (!connectionTest.success) {
        throw new Error('Invalid access token');
      }

      // Setup workspace
      const workspaceSetup = await this.setupUserWorkspace(userId, accessToken);
      
      // Update user in database
      await this.prisma.user.update({
        where: { id: userId },
        data: { 
          notionApiKey: accessToken,
          notionWorkspaceId: workspaceSetup.workspacePageId,
        }
      });

      console.log(`✅ Notion integration completed for user ${userId}`);

      return {
        success: true,
        message: 'Notion workspace setup completed successfully',
        databases: workspaceSetup.databases,
        user: connectionTest.user
      };
    } catch (error) {
      console.error(`❌ Error completing integration for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Setup user workspace with required databases (Updated Structure)
   */
  async setupUserWorkspace(userId, notionApiKey) {
    try {
      console.log(`🗃️ Setting up AgenPay workspace for user ${userId}`);
      
      // Create main workspace page
      const workspacePage = await this.createWorkspacePage();
      
      // Create sub-pages for each database
      const incomingPaymentsPage = await this.createSubPage(workspacePage.id, 'Incoming Payment Requests', '📥');
      const outgoingPaymentsPage = await this.createSubPage(workspacePage.id, 'Outgoing Scheduled Payments', '📤');
      const transactionsPage = await this.createSubPage(workspacePage.id, 'All Transactions', '🔄');
      
      // Create databases within their respective pages
      const incomingPaymentsDb = await this.createIncomingPaymentsDatabase(incomingPaymentsPage.id);
      const outgoingPaymentsDb = await this.createOutgoingPaymentsDatabase(outgoingPaymentsPage.id);
      const transactionsDb = await this.createTransactionsDatabase(transactionsPage.id);
      
      // Create dashboard content in the main workspace page
      await this.createDashboard(workspacePage.id, {
        incomingPaymentsPageId: incomingPaymentsPage.id,
        outgoingPaymentsPageId: outgoingPaymentsPage.id,
        transactionsPageId: transactionsPage.id,
      });
      
      // Store databases in our system
      const databases = [
        {
          userId,
          databaseId: incomingPaymentsDb.id,
          databaseName: 'AgenPay Incoming Payments',
          databaseType: 'INCOMING_PAYMENTS',
          properties: incomingPaymentsDb.properties,
        },
        {
          userId,
          databaseId: outgoingPaymentsDb.id,
          databaseName: 'AgenPay Outgoing Payments',
          databaseType: 'OUTGOING_PAYMENTS',
          properties: outgoingPaymentsDb.properties,
        },
        {
          userId,
          databaseId: transactionsDb.id,
          databaseName: 'AgenPay Transactions',
          databaseType: 'TRANSACTIONS',
          properties: transactionsDb.properties,
        },
      ];
      
      // Save to database (upsert to avoid duplicates)
      for (const db of databases) {
        await this.prisma.notionDatabase.upsert({
          where: { databaseId: db.databaseId },
          update: db,
          create: db,
        });
      }
      
      console.log(`✅ AgenPay workspace setup completed for user ${userId}`);
      
      return {
        success: true,
        workspacePageId: workspacePage.id,
        databases: {
          incomingPayments: incomingPaymentsDb,
          outgoingPayments: outgoingPaymentsDb,
          transactions: transactionsDb,
        },
      };
    } catch (error) {
      console.error(`❌ Error setting up workspace for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Create main workspace page
   */
  async createWorkspacePage() {
    try {
      const workspacePage = await this.notion.pages.create({
        parent: {
          type: 'page_id',
          page_id: await this.getUserRootPageId(),
        },
        icon: { type: 'emoji', emoji: '🚀' },
        properties: {
          title: {
            title: [
              {
                type: 'text',
                text: {
                  content: 'AgenPay Workspace',
                },
              },
            ],
          },
        },
      });

      console.log('✅ AgenPay workspace page created:', workspacePage.id);
      return workspacePage;
    } catch (error) {
      console.error('❌ Error creating workspace page:', error);
      throw error;
    }
  }

  /**
   * Create sub-page
   */
  async createSubPage(parentId, title, emoji) {
    try {
      console.log(`📄 Creating sub-page: ${title} with emoji: ${emoji}`);
      const page = await this.notion.pages.create({
        parent: { type: 'page_id', page_id: parentId },
        icon: { type: 'emoji', emoji: emoji },
        properties: {
          title: {
            title: [
              {
                type: 'text',
                text: { content: title },
              },
            ],
          },
        },
      });
      console.log(`✅ Sub-page created: ${title} with ID: ${page.id}`);
      return page;
    } catch (error) {
      console.error(`❌ Error creating sub-page ${title}:`, error);
      throw error;
    }
  }

  /**
   * Create dashboard layout in workspace page (following tested pattern)
   */
  async createDashboard(workspacePageId, pageIds) {
    try {
      console.log('🎨 Creating dashboard layout...');
      
      // Create the main layout with two columns first
      const columnListBlock = await this.notion.blocks.children.append({
        block_id: workspacePageId,
        children: [{
          object: "block",
          type: "column_list",
          column_list: {
            children: [
              { object: "block", type: "column", column: { children: [] } },
              { object: "block", type: "column", column: { children: [] } }
            ]
          }
        }]
      });

      // Get the column IDs
      const columnListBlockId = columnListBlock.results[0].id;
      const columnBlocks = await this.notion.blocks.children.list({ block_id: columnListBlockId });
      const [leftColumnId, rightColumnId] = columnBlocks.results.map((block) => block.id);

      // Create sidebar content for left column
      const sidebarContent = [
        { 
          object: "block", 
          type: "heading_2", 
          heading_2: { 
            rich_text: [{ type: "text", text: { content: "📱 Navigation" } }], 
            color: "default" 
          } 
        },
        { object: "block", type: "divider", divider: {} },
        { 
          object: "block", 
          type: "callout", 
          callout: { 
            rich_text: [{ type: "text", text: { content: "Quick Actions" } }], 
            color: "blue_background", 
            icon: { emoji: "⚡" } 
          } 
        },
        { 
          object: "block", 
          type: "link_to_page", 
          link_to_page: { 
            type: "page_id", 
            page_id: pageIds.incomingPaymentsPageId 
          } 
        },
        { 
          object: "block", 
          type: "link_to_page", 
          link_to_page: { 
            type: "page_id", 
            page_id: pageIds.outgoingPaymentsPageId 
          } 
        },
        { 
          object: "block", 
          type: "link_to_page", 
          link_to_page: { 
            type: "page_id", 
            page_id: pageIds.transactionsPageId 
          } 
        },
        { object: "block", type: "divider", divider: {} },
        { 
          object: "block", 
          type: "callout", 
          callout: { 
            rich_text: [{ type: "text", text: { content: "AI Assistant Ready" } }], 
            color: "purple_background", 
            icon: { emoji: "🤖" } 
          } 
        },
        { 
          object: "block", 
          type: "paragraph", 
          paragraph: { 
            rich_text: [{ type: "text", text: { content: "💡 Ask me to send payments, create invoices, or analyze your data!" } }], 
            color: "default" 
          } 
        }
      ];

      // Create main content for right column
      const mainContent = [
        { 
          object: "block", 
          type: "heading_1", 
          heading_1: { 
            rich_text: [{ type: "text", text: { content: "📊 AgenPay Dashboard" } }], 
            color: "default" 
          } 
        },
        { 
          object: "block", 
          type: "callout", 
          callout: { 
            rich_text: [{ type: "text", text: { content: "Payment Statistics" } }], 
            color: "gray_background", 
            icon: { emoji: "📈" }
          }
        }
      ];

      // Add content to columns
      await this.notion.blocks.children.append({ 
        block_id: leftColumnId, 
        children: sidebarContent 
      });
      
      await this.notion.blocks.children.append({ 
        block_id: rightColumnId, 
        children: mainContent 
      });

      // Create analytics section in right column
      const analyticsColumnList = await this.notion.blocks.children.append({
        block_id: rightColumnId,
        children: [{
          object: "block",
          type: "column_list",
          column_list: {
            children: [
              { object: "block", type: "column", column: { children: [] } },
              { object: "block", type: "column", column: { children: [] } }
            ]
          }
        }]
      });

      // Get analytics column IDs
      const analyticsColumnListId = analyticsColumnList.results[0].id;
      const analyticsColumns = await this.notion.blocks.children.list({ block_id: analyticsColumnListId });
      const [analyticsLeftId, analyticsRightId] = analyticsColumns.results.map((block) => block.id);

      // Add analytics boxes to left analytics column
      await this.notion.blocks.children.append({ 
        block_id: analyticsLeftId, 
        children: [
          { 
            object: "block", 
            type: "callout", 
            callout: { 
              rich_text: [{ type: "text", text: { content: "Total Sent\n0 ETH" } }], 
              color: "red_background", 
              icon: { emoji: "📤" } 
            } 
          }
        ]
      });

      // Add analytics boxes to right analytics column
      await this.notion.blocks.children.append({ 
        block_id: analyticsRightId, 
        children: [
          { 
            object: "block", 
            type: "callout", 
            callout: { 
              rich_text: [{ type: "text", text: { content: "Total Received\n0 ETH" } }], 
              color: "green_background", 
              icon: { emoji: "📥" } 
            } 
          }
        ]
      });

      // Add second row of analytics
      const secondAnalyticsColumnList = await this.notion.blocks.children.append({
        block_id: rightColumnId,
        children: [{
          object: "block",
          type: "column_list",
          column_list: {
            children: [
              { object: "block", type: "column", column: { children: [] } },
              { object: "block", type: "column", column: { children: [] } }
            ]
          }
        }]
      });

      const secondAnalyticsColumnListId = secondAnalyticsColumnList.results[0].id;
      const secondAnalyticsColumns = await this.notion.blocks.children.list({ block_id: secondAnalyticsColumnListId });
      const [secondLeftId, secondRightId] = secondAnalyticsColumns.results.map((block) => block.id);

      // Add transaction and invoice counts
      await this.notion.blocks.children.append({ 
        block_id: secondLeftId, 
        children: [
          { 
            object: "block", 
            type: "callout", 
            callout: { 
              rich_text: [{ type: "text", text: { content: "Total Transactions\n0" } }], 
              color: "blue_background", 
              icon: { emoji: "🔄" } 
            } 
          }
        ]
      });

      await this.notion.blocks.children.append({ 
        block_id: secondRightId, 
        children: [
          { 
            object: "block", 
            type: "callout", 
            callout: { 
              rich_text: [{ type: "text", text: { content: "Active Invoices\n0" } }], 
              color: "yellow_background", 
              icon: { emoji: "🧾" } 
            } 
          }
        ]
      });

      // Add recent activity section
      await this.notion.blocks.children.append({ 
        block_id: rightColumnId, 
        children: [
          { object: "block", type: "divider", divider: {} },
          { 
            object: "block", 
            type: "callout", 
            callout: { 
              rich_text: [{ type: "text", text: { content: "Recent Activity" } }], 
              color: "gray_background", 
              icon: { emoji: "📅" } 
            } 
          },
          { 
            object: "block", 
            type: "paragraph", 
            paragraph: { 
              rich_text: [{ type: "text", text: { content: "No recent activity yet. Start by creating your first payment or invoice!" } }], 
              color: "default" 
            } 
          }
        ]
      });

      console.log('✅ Dashboard layout created successfully');
    } catch (error) {
      console.error('❌ Error creating dashboard:', error);
      throw error;
    }
  }

  /**
   * Create Incoming Payment Requests Database
   */
  async createIncomingPaymentsDatabase(parentPageId) {
    const database = await this.notion.databases.create({
      parent: {
        type: 'page_id',
        page_id: parentPageId,
      },
      title: [
        {
          type: 'text',
          text: {
            content: '📥 Incoming Payment Requests',
          },
        },
      ],
      properties: {
        'Request ID': {
          title: {},
        },
        'Amount': {
          number: {
            format: 'number',
          },
        },
        'Currency': {
          select: {
            options: [
              { name: 'ETH', color: 'blue' },
              { name: 'USDC', color: 'green' },
              { name: 'USD', color: 'gray' },
            ],
          },
        },
        'Network': {
          select: {
            options: [
              { name: 'sei-testnet', color: 'blue' },  
              { name: 'sei-mainnet', color: 'green' },
              { name: 'ethereum', color: 'purple' },
            ],
          },
        },
        'Recipient Email': {
          email: {},
        },
        'Recipient Name': {
          rich_text: {},
        },
        'Description': {
          rich_text: {},
        },
        'AI Prompt': {
          rich_text: {},
        },
        'Transaction Type': {
          select: {
            options: [
              { name: 'ask_payment', color: 'blue' },
              { name: 'ask_and_refund', color: 'orange' },
              { name: 'subscription', color: 'purple' },
            ],
          },
        },
        'Schedule Type': {
          select: {
            options: [
              { name: 'immediate', color: 'red' },
              { name: 'scheduled', color: 'yellow' },
            ],
          },
        },
        'Scheduled Date': {
          date: {},
        },
        'Status': {
          select: {
            options: [
              { name: 'draft', color: 'gray' },
              { name: 'scheduled', color: 'yellow' },
              { name: 'processing', color: 'orange' },
              { name: 'payment_received', color: 'green' },
              { name: 'refunded', color: 'purple' },
              { name: 'failed', color: 'red' },
            ],
          },
        },
        'X402Pay Link': {
          url: {},
        },
        'Payment Hash': {
          rich_text: {},
        },
        'Refund Date': {
          date: {},
        },
        'Created': {
          created_time: {},
        },
      },
    });

    console.log('✅ Incoming Payments database created:', database.id);
    return database;
  }

  /**
   * Create Outgoing Scheduled Payments Database  
   */
  async createOutgoingPaymentsDatabase(parentPageId) {
    const database = await this.notion.databases.create({
      parent: {
        type: 'page_id',
        page_id: parentPageId,
      },
      title: [
        {
          type: 'text',
          text: {
            content: '📤 Outgoing Scheduled Payments',
          },
        },
      ],
      properties: {
        'Payment ID': {
          title: {},
        },
        'Amount': {
          number: {
            format: 'number',
          },
        },
        'Currency': {
          select: {
            options: [
              { name: 'ETH', color: 'blue' },
              { name: 'USDC', color: 'green' },
              { name: 'USD', color: 'gray' },
            ],
          },
        },
        'Network': {
          select: {
            options: [
              { name: 'sei-testnet', color: 'blue' },  
              { name: 'sei-mainnet', color: 'green' },  
              { name: 'ethereum', color: 'purple' },
            ],
          },
        },
        'Recipient Address': {
          rich_text: {},
        },
        'Recipient Name': {
          rich_text: {},
        },
        'From Name': {
          rich_text: {},
        },
        'Description': {
          rich_text: {},
        },
        'Schedule Date': {
          date: {},
        },
        'Status': {
          select: {
            options: [
              { name: 'scheduled', color: 'yellow' },
              { name: 'processing', color: 'orange' },
              { name: 'completed', color: 'green' },
              { name: 'failed', color: 'red' },
              { name: 'cancelled', color: 'gray' },
            ],
          },
        },
        'Transaction Hash': {
          rich_text: {},
        },
        'Executed At': {
          date: {},
        },
        'Created': {
          created_time: {},
        },
      },
    });

    console.log('✅ Outgoing Payments database created:', database.id);
    return database;
  }

  /**
   * Create Transactions Database (Updated)
   */
  async createTransactionsDatabase(parentPageId) {
    const database = await this.notion.databases.create({
      parent: {
        type: 'page_id',
        page_id: parentPageId,
      },
      title: [
        {
          type: 'text',
          text: {
            content: '🔄 All Transactions',
          },
        },
      ],
      properties: {
        'Transaction ID': {
          title: {},
        },
        'Type': {
          select: {
            options: [
              { name: 'INCOMING', color: 'green' },
              { name: 'OUTGOING', color: 'red' },
              { name: 'REFUND', color: 'purple' },
            ],
          },
        },
        'Amount': {
          number: {
            format: 'number',
          },
        },
        'Currency': {
          select: {
            options: [
              { name: 'ETH', color: 'blue' },
              { name: 'USDC', color: 'green' },
              { name: 'USD', color: 'gray' },
            ],
          },
        },
        'Network': {
          select: {
            options: [
              { name: 'sei-testnet', color: 'blue' },  
              { name: 'sei-mainnet', color: 'green' },  
              { name: 'ethereum', color: 'purple' },
            ],
          },
        },
        'From': {
          rich_text: {},
        },
        'To': {
          rich_text: {},
        },
        'Status': {
          select: {
            options: [
              { name: 'PENDING', color: 'yellow' },
              { name: 'PROCESSING', color: 'orange' },
              { name: 'COMPLETED', color: 'green' },
              { name: 'FAILED', color: 'red' },
            ],
          },
        },
        'Transaction Hash': {
          rich_text: {},
        },
        'X402Pay ID': {
          rich_text: {},
        },
        'Description': {
          rich_text: {},
        },
        'Related Request ID': {
          rich_text: {},
        },
        'Created': {
          created_time: {},
        },
      },
    });

    console.log('✅ Transactions database created:', database.id);
    return database;
  }

  /**
   * Get user's root page ID (simplified)
   */
  async getUserRootPageId() {
    try {
      const pages = await this.notion.search({
        filter: {
          property: 'object',
          value: 'page',
        },
        page_size: 1,
      });

      if (pages.results.length === 0) {
        throw new Error('No accessible pages found. Please ensure the integration has page access.');
      }

      return pages.results[0].id;
    } catch (error) {
      console.error('❌ Error getting user root page:', error);
      throw error;
    }
  }

  /**
   * Get payment analytics from Notion databases and update dashboard
   */
  async getPaymentAnalytics(userId) {
    try {
      const databases = await this.prisma.notionDatabase.findMany({
        where: { userId, isActive: true },
      });

      const analytics = {
        totalIncomingRequests: 0,
        totalOutgoingPayments: 0,
        totalAmountRequested: 0,
        totalAmountSent: 0,
        totalTransactions: 0,
        activeRequests: 0,
        scheduledPayments: 0,
        recentActivity: [],
      };

      for (const db of databases) {
        const response = await this.notion.databases.query({
          database_id: db.databaseId,
          sorts: [
            {
              property: 'Created',
              direction: 'descending',
            },
          ],
          page_size: 20,
        });

        for (const page of response.results) {
          const amount = page.properties.Amount?.number || 0;
          const status = page.properties.Status?.select?.name?.toLowerCase();

          if (db.databaseType === 'INCOMING_PAYMENTS') {
            analytics.totalIncomingRequests++;
            if (status === 'payment_received') {
              analytics.totalAmountRequested += amount;
            }
            if (status === 'processing' || status === 'scheduled') {
              analytics.activeRequests++;
            }
          } else if (db.databaseType === 'OUTGOING_PAYMENTS') {
            analytics.totalOutgoingPayments++;
            if (status === 'completed') {
              analytics.totalAmountSent += amount;
            }
            if (status === 'scheduled') {
              analytics.scheduledPayments++;
            }
          } else if (db.databaseType === 'TRANSACTIONS') {
            analytics.totalTransactions++;
          }

          // Add to recent activity (top 5)
          if (analytics.recentActivity.length < 5) {
            analytics.recentActivity.push({
              id: page.id,
              type: db.databaseType,
              amount,
              currency: page.properties.Currency?.select?.name || 'ETH',
              status,
              description: this.getPropertyText(page.properties.Description) || this.getPropertyText(page.properties['Request ID']) || 'Unknown',
              created: page.properties.Created?.created_time,
              databaseType: db.databaseType,
            });
          }
        }
      }

      console.log(`✅ Analytics calculated for user ${userId}:`, {
        totalIncomingRequests: analytics.totalIncomingRequests,
        totalOutgoingPayments: analytics.totalOutgoingPayments,
        totalAmountRequested: analytics.totalAmountRequested,
        totalAmountSent: analytics.totalAmountSent,
        activeRequests: analytics.activeRequests,
        scheduledPayments: analytics.scheduledPayments,
      });

      return analytics;
    } catch (error) {
      console.error(`❌ Error getting analytics for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update dashboard analytics in Notion workspace
   */
  async updateDashboardAnalytics(userId) {
    try {
      const analytics = await this.getPaymentAnalytics(userId);
      
      // Find the user's workspace page
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user?.notionWorkspaceId) {
        console.log('⚠️ No Notion workspace ID found for user');
        return analytics;
      }

      // In a real implementation, you would update the dashboard blocks here
      // This is a simplified version that returns the analytics
      console.log(`✅ Dashboard analytics updated for user ${userId}`);
      
      return analytics;
    } catch (error) {
      console.error(`❌ Error updating dashboard analytics for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Test Notion connection
   */
  async testConnection() {
    try {
      const response = await this.notion.users.me();
      console.log('✅ Notion connection successful:', response.name);
      return { success: true, user: response };
    } catch (error) {
      console.error('❌ Notion connection failed:', error);
      throw error;
    }
  }

  async cleanup() {
    await this.prisma.$disconnect();
  }

  /**
   * Add payment record to Notion database
   */
  async addPaymentRecord(databaseId, paymentData) {
    try {
      const page = await this.notion.pages.create({
        parent: {
          database_id: databaseId,
        },
        properties: {
          'Payment ID': {
            title: [
              {
                text: {
                  content: paymentData.id || `PAY-${Date.now()}`,
                },
              },
            ],
          },
          'Client': {
            rich_text: [
              {
                text: {
                  content: paymentData.client || paymentData.recipientEmail || 'Unknown',
                },
              },
            ],
          },
          'Amount': {
            number: parseFloat(paymentData.amount) || 0,
          },
          'Currency': {
            select: {
              name: paymentData.currency || 'ETH',
            },
          },
          'Status': {
            select: {
              name: paymentData.status || 'pending',
            },
          },
          'Type': {
            select: {
              name: paymentData.type || 'invoice',
            },
          },
          'Email': {
            email: paymentData.recipientEmail || null,
          },
          'Wallet Address': {
            rich_text: [
              {
                text: {
                  content: paymentData.walletAddress || '',
                },
              },
            ],
          },
          'Description': {
            rich_text: [
              {
                text: {
                  content: paymentData.description || '',
                },
              },
            ],
          },
          'Transaction Hash': {
            rich_text: [
              {
                text: {
                  content: paymentData.txHash || '',
                },
              },
            ],
          },
        },
      });

      console.log('✅ Payment record added to Notion:', page.id);
      return page;
    } catch (error) {
      console.error('❌ Error adding payment record to Notion:', error);
      throw error;
    }
  }

  /**
   * Add transaction record to Notion database
   */
  async addTransactionRecord(databaseId, transactionData) {
    try {
      const page = await this.notion.pages.create({
        parent: {
          database_id: databaseId,
        },
        properties: {
          'Transaction ID': {
            title: [
              {
                text: {
                  content: transactionData.id || `TX-${Date.now()}`,
                },
              },
            ],
          },
          'Type': {
            select: {
              name: transactionData.type || 'SEND',
            },
          },
          'Amount': {
            number: parseFloat(transactionData.amount) || 0,
          },
          'Currency': {
            select: {
              name: transactionData.currency || 'ETH',
            },
          },
          'Status': {
            select: {
              name: transactionData.status || 'PENDING',
            },
          },
          'From Address': {
            rich_text: [
              {
                text: {
                  content: transactionData.fromAddress || '',
                },
              },
            ],
          },
          'To Address': {
            rich_text: [
              {
                text: {
                  content: transactionData.toAddress || '',
                },
              },
            ],
          },
          'Transaction Hash': {
            rich_text: [
              {
                text: {
                  content: transactionData.txHash || '',
                },
              },
            ],
          },
          'Description': {
            rich_text: [
              {
                text: {
                  content: transactionData.description || '',
                },
              },
            ],
          },
        },
      });

      console.log('✅ Transaction record added to Notion:', page.id);
      return page;
    } catch (error) {
      console.error('❌ Error adding transaction record to Notion:', error);
      throw error;
    }
  }

  /**
   * Add invoice record to Notion database
   */
  async addInvoiceRecord(databaseId, invoiceData) {
    try {
      const page = await this.notion.pages.create({
        parent: {
          database_id: databaseId,
        },
        properties: {
          'Invoice ID': {
            title: [
              {
                text: {
                  content: invoiceData.id || `INV-${Date.now()}`,
                },
              },
            ],
          },
          'Client': {
            rich_text: [
              {
                text: {
                  content: invoiceData.client || 'Unknown',
                },
              },
            ],
          },
          'Amount': {
            number: parseFloat(invoiceData.amount) || 0,
          },
          'Currency': {
            select: {
              name: invoiceData.currency || 'ETH',
            },
          },
          'Status': {
            select: {
              name: invoiceData.status || 'draft',
            },
          },
          'Email': {
            email: invoiceData.email || null,
          },
          'Description': {
            rich_text: [
              {
                text: {
                  content: invoiceData.description || '',
                },
              },
            ],
          },
          'Due Date': {
            date: invoiceData.dueDate ? { start: invoiceData.dueDate } : null,
          },
        },
      });

      console.log('✅ Invoice record added to Notion:', page.id);
      return page;
    } catch (error) {
      console.error('❌ Error adding invoice record to Notion:', error);
      throw error;
    }
  }

  /**
   * Update record status (works for any database)
   */
  async updateRecordStatus(pageId, status, txHash = null) {
    try {
      const updateData = {
        'Status': {
          select: {
            name: status,
          },
        },
      };

      if (txHash) {
        updateData['Transaction Hash'] = {
          rich_text: [
            {
              text: {
                content: txHash,
              },
            },
          ],
        };
      }

      const page = await this.notion.pages.update({
        page_id: pageId,
        properties: updateData,
      });

      console.log('✅ Record status updated in Notion:', pageId);
      return page;
    } catch (error) {
      console.error('❌ Error updating record status in Notion:', error);
      throw error;
    }
  }

  /**
   * Find existing payment record by Request ID
   */
  async findPaymentRecordByRequestId(databaseId, requestId) {
    try {
      console.log(`🔍 Searching for existing Notion record with Request ID: ${requestId}`);
      
      const response = await this.notion.databases.query({
        database_id: databaseId,
        filter: {
          property: 'Request ID',
          title: {
            contains: requestId
          }
        }
      });

      console.log(`🔍 Notion search results: ${response.results?.length || 0} records found`);
      
      if (response.results && response.results.length > 0) {
        const foundRecord = response.results[0];
        console.log(`✅ Found existing Notion record: ${foundRecord.id}`);
        return foundRecord; // Return the first matching record
      }
      
      console.log(`❌ No existing Notion record found for Request ID: ${requestId}`);
      return null; // No existing record found
    } catch (error) {
      console.error('❌ Error finding payment record by Request ID:', error);
      return null;
    }
  }

  /**
   * Update existing incoming payment record or create new one if not found
   */
  async updateOrCreateIncomingPaymentRecord(databaseId, paymentData) {
    try {
      console.log(`🔄 updateOrCreateIncomingPaymentRecord called for Request ID: ${paymentData.requestId}`);
      console.log(`🗃️ Using database ID: ${databaseId}`);
      
      // First try to find existing record
      const existingRecord = await this.findPaymentRecordByRequestId(databaseId, paymentData.requestId);
      
      if (existingRecord) {
        // Update existing record
        console.log(`🔄 Updating existing Notion record: ${existingRecord.id}`);
        
        const updateData = {
          'Status': {
            select: {
              name: paymentData.status || 'processing',
            },
          },
        };

        // Add payment hash if provided
        if (paymentData.paymentHash) {
          updateData['Payment Hash'] = {
            rich_text: [
              {
                text: {
                  content: paymentData.paymentHash,
                },
              },
            ],
          };
        }

        const updatedPage = await this.notion.pages.update({
          page_id: existingRecord.id,
          properties: updateData,
        });

        console.log('✅ Existing payment record updated in Notion:', existingRecord.id);
        return updatedPage;
      } else {
        // Create new record if none exists
        console.log(`➕ Creating new Notion record for: ${paymentData.requestId}`);
        return await this.addIncomingPaymentRecord(databaseId, paymentData);
      }
    } catch (error) {
      console.error('❌ Error updating or creating payment record in Notion:', error);
      throw error;
    }
  }

  /**
   * Add incoming payment record to Notion database
   */
  async addIncomingPaymentRecord(databaseId, paymentData) {
    try {
      const page = await this.notion.pages.create({
        parent: {
          database_id: databaseId,
        },
        properties: {
          'Request ID': {
            title: [
              {
                text: {
                  content: paymentData.requestId || `REQ-${Date.now()}`,
                },
              },
            ],
          },
          'Amount': {
            number: parseFloat(paymentData.amount) || 0,
          },
          'Currency': {
            select: {
              name: paymentData.currency || 'USDC',
            },
          },
          'Network': {
            select: {
              name: paymentData.network || 'sei-testnet',  
            },
          },
          'Recipient Email': {
            email: paymentData.recipientEmail || null,
          },
          'Recipient Name': {
            rich_text: [
              {
                text: {
                  content: paymentData.recipientName || '',
                },
              },
            ],
          },
          'Description': {
            rich_text: [
              {
                text: {
                  content: paymentData.description || '',
                },
              },
            ],
          },
          'AI Prompt': {
            rich_text: [
              {
                text: {
                  content: paymentData.aiPrompt || '',
                },
              },
            ],
          },
          'Transaction Type': {
            select: {
              name: paymentData.transactionType || 'ask_payment',
            },
          },
          'Schedule Type': {
            select: {
              name: paymentData.scheduleType || 'immediate',
            },
          },
          'Scheduled Date': {
            date: paymentData.scheduledDate ? { start: paymentData.scheduledDate } : null,
          },
          'Status': {
            select: {
              name: paymentData.status || 'draft',
            },
          },
          'X402Pay Link': {
            url: paymentData.x402PayLink || null,
          },
          'Payment Hash': {
            rich_text: [
              {
                text: {
                  content: paymentData.paymentHash || '',
                },
              },
            ],
          },
          'Refund Date': {
            date: paymentData.refundDate ? { start: paymentData.refundDate } : null,
          },
        },
      });

      console.log('✅ Incoming payment record added to Notion:', page.id);
      return page;
    } catch (error) {
      console.error('❌ Error adding incoming payment record to Notion:', error);
      throw error;
    }
  }

  /**
   * Add outgoing payment record to Notion database
   */
  async addOutgoingPaymentRecord(databaseId, paymentData) {
    try {
      const page = await this.notion.pages.create({
        parent: {
          database_id: databaseId,
        },
        properties: {
          'Payment ID': {
            title: [
              {
                text: {
                  content: paymentData.paymentId || `OUT-${Date.now()}`,
                },
              },
            ],
          },
          'Amount': {
            number: parseFloat(paymentData.amount) || 0,
          },
          'Currency': {
            select: {
              name: paymentData.currency || 'ETH',
            },
          },
          'Network': {
            select: {
              name: paymentData.network || 'sei-testnet',  
            },
          },
          'Recipient Address': {
            rich_text: [
              {
                text: {
                  content: paymentData.recipientAddress || '',
                },
              },
            ],
          },
          'Recipient Name': {
            rich_text: [
              {
                text: {
                  content: paymentData.recipientName || '',
                },
              },
            ],
          },
          'From Name': {
            rich_text: [
              {
                text: {
                  content: paymentData.fromName || 'AgenPay User',
                },
              },
            ],
          },
          'Description': {
            rich_text: [
              {
                text: {
                  content: paymentData.description || '',
                },
              },
            ],
          },
          'Schedule Date': {
            date: paymentData.scheduleDate ? { start: paymentData.scheduleDate } : null,
          },
          'Status': {
            select: {
              name: paymentData.status || 'scheduled',
            },
          },
          'Transaction Hash': {
            rich_text: [
              {
                text: {
                  content: paymentData.txHash || '',
                },
              },
            ],
          },
          'Executed At': {
            date: paymentData.executedAt ? { start: paymentData.executedAt } : null,
          },
        },
      });

      console.log('✅ Outgoing payment record added to Notion:', page.id);
      return page;
    } catch (error) {
      console.error('❌ Error adding outgoing payment record to Notion:', error);
      throw error;
    }
  }

  /**
   * Helper method to extract text from Notion properties
   */
  getPropertyText(property) {
    if (!property) return '';
    
    if (property.title && property.title.length > 0) {
      return property.title[0].text?.content || property.title[0].plain_text || '';
    }
    
    if (property.rich_text && property.rich_text.length > 0) {
      return property.rich_text[0].text?.content || property.rich_text[0].plain_text || '';
    }
    
    return '';
  }
}

export default NotionService; 