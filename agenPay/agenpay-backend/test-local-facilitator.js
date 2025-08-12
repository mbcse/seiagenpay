#!/usr/bin/env node

/**
 * Test Local Facilitator Communication
 * Debug script to see what X402 middleware sends to local facilitator
 */

import { paymentMiddleware } from 'x402-express';
import { config } from 'dotenv';

// Load environment variables
config();

async function testLocalFacilitator() {
  console.log('🧪 Testing Local Facilitator Communication...\n');

  const testWalletAddress = '0x1234567890123456789012345678901234567890';
  const facilitatorConfig = {
    url: "http://localhost:3002"
  };

  console.log('📋 Configuration:');
  console.log('Wallet Address:', testWalletAddress);
  console.log('Facilitator URL:', facilitatorConfig.url);
  console.log('');

  // Test with Sei testnet configuration
  const seiConfig = {
    "/": {
      price: "$0.1",
      network: "sei-testnet",
      config: {
        description: "Sei Testnet Payment",
        maxTimeoutSeconds: 300,
      }
    }
  };

  console.log('🔧 Creating middleware with Sei testnet config...');
  console.log('Config:', JSON.stringify(seiConfig, null, 2));

  try {
    const middleware = paymentMiddleware(
      testWalletAddress,
      seiConfig,
      facilitatorConfig
    );

    console.log('✅ Middleware created successfully');

    // Create a mock request and response to see what happens
    const mockReq = {
      method: 'GET',
      url: '/',
      path: '/',
      originalUrl: '/x402pay/test',
      headers: {
        'user-agent': 'test-agent',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      query: {}
    };

    const mockRes = {
      statusCode: 200,
      headersSent: false,
      finished: false,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        console.log('📤 Response JSON:', JSON.stringify(data, null, 2));
        this.headersSent = true;
        return this;
      },
      send: function(data) {
        console.log('📤 Response Send:', typeof data === 'string' ? data.substring(0, 200) + '...' : JSON.stringify(data, null, 2));
        this.headersSent = true;
        return this;
      },
      setHeader: function(name, value) {
        console.log(`📤 Header Set: ${name} = ${value}`);
        return this;
      }
    };

    console.log('\n🔍 Testing middleware with mock request...');
    
    // Call the middleware
    middleware(mockReq, mockRes, (err) => {
      if (err) {
        console.error('❌ Middleware error:', err);
      } else {
        console.log('✅ Middleware completed without error');
      }
    });

  } catch (error) {
    console.error('❌ Error creating middleware:', error);
  }

  console.log('\n🎯 Test completed');
}

// Run test
testLocalFacilitator().catch(console.error);
