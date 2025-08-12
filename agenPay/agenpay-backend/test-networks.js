#!/usr/bin/env node

/**
 * Test X402 Network Support
 * Debug script to test different network configurations
 */

import { paymentMiddleware } from 'x402-express';
import { config } from 'dotenv';

// Load environment variables
config();

async function testNetworks() {
  console.log('🧪 Testing X402 Network Support...\n');

  const testWalletAddress = '0x1234567890123456789012345678901234567890';
  const facilitatorConfig = {
    url: process.env.X402_FACILITATOR_URL || "http://localhost:3002"
  };

  // Test different network configurations
  const networks = [
    'sei-testnet',
    'sei',
    'base-sepolia',
    'base',
    'avalanche-fuji',
    'avalanche'
  ];

  for (const network of networks) {
    console.log(`\n🔍 Testing network: ${network}`);
    
    const testConfig = {
      "/": {
        price: "$0.1",
        network: network,
        config: {
          description: `Test payment for ${network}`,
          maxTimeoutSeconds: 300,
        }
      }
    };

    try {
      const middleware = paymentMiddleware(
        testWalletAddress,
        testConfig,
        facilitatorConfig
      );

      console.log(`✅ ${network}: Middleware created successfully`);
      console.log(`   Type: ${typeof middleware}`);
      console.log(`   Function: ${middleware.name || 'anonymous'}`);
      
    } catch (error) {
      console.log(`❌ ${network}: Failed - ${error.message}`);
    }
  }

  console.log('\n🎯 Network test completed');
}

// Run test
testNetworks().catch(console.error);
