#!/usr/bin/env node

/**
 * Debug X402 Network Parameter
 * Test to see exactly what happens with network configuration
 */

import { paymentMiddleware } from 'x402-express';
import { config } from 'dotenv';

// Load environment variables
config();

async function debugNetwork() {
  console.log('🔍 Debugging X402 Network Parameter...\n');

  const testWalletAddress = '0x1234567890123456789012345678901234567890';
  const facilitatorConfig = {
    url: process.env.X402_FACILITATOR_URL || "http://localhost:3002"
  };

  console.log('📋 Configuration:');
  console.log('Wallet Address:', testWalletAddress);
  console.log('Facilitator URL:', facilitatorConfig.url);
  console.log('');

  // Test with explicit Sei testnet configuration
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
    console.log('📦 Middleware type:', typeof middleware);
    console.log('📦 Middleware function:', middleware.name || 'anonymous');

    // Try to inspect the middleware function
    console.log('\n🔍 Middleware function details:');
    console.log('toString():', middleware.toString().substring(0, 200) + '...');

  } catch (error) {
    console.error('❌ Error:', error);
  }

  console.log('\n🎯 Debug completed');
}

// Run debug
debugNetwork().catch(console.error);
