#!/usr/bin/env node

/**
 * Test X402 Middleware Configuration
 * Debug script to test X402 middleware with Sei testnet
 */

import { paymentMiddleware } from 'x402-express';
import { config } from 'dotenv';

// Load environment variables
config();

async function testX402Configuration() {
  console.log('🧪 Testing X402 Middleware Configuration...\n');

  // Test configuration
  const testWalletAddress = '0x1234567890123456789012345678901234567890';
  const testConfig = {
    "/": {
      price: "$0.1",
      network: "sei-testnet",
      config: {
        description: "Test payment for Sei testnet",
        maxTimeoutSeconds: 300,
      }
    }
  };

  const facilitatorConfig = {
    url: process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator"
  };

  console.log('📋 Test Configuration:');
  console.log('Wallet Address:', testWalletAddress);
  console.log('Network:', testConfig["/"].network);
  console.log('Price:', testConfig["/"].price);
  console.log('Facilitator URL:', facilitatorConfig.url);
  console.log('');

  try {
    // Create middleware
    console.log('🔧 Creating X402 middleware...');
    const middleware = paymentMiddleware(
      testWalletAddress,
      testConfig,
      facilitatorConfig
    );

    console.log('✅ X402 middleware created successfully');
    console.log('📦 Middleware type:', typeof middleware);
    console.log('📦 Middleware function:', middleware.name || 'anonymous');

    // Test if middleware is callable
    if (typeof middleware === 'function') {
      console.log('✅ Middleware is a function and can be called');
    } else {
      console.log('❌ Middleware is not a function');
    }

  } catch (error) {
    console.error('❌ Error creating X402 middleware:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  }

  console.log('\n🎯 Test completed');
}

// Run test
testX402Configuration().catch(console.error);
