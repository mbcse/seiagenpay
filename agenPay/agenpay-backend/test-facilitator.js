#!/usr/bin/env node

/**
 * Test Local X402 Facilitator
 * Debug script to test local facilitator capabilities
 */

import axios from 'axios';
import { config } from 'dotenv';

// Load environment variables
config();

async function testFacilitator() {
  console.log('🧪 Testing Local X402 Facilitator...\n');

  const facilitatorUrl = process.env.X402_FACILITATOR_URL || "http://localhost:3002";
  console.log(`🔗 Facilitator URL: ${facilitatorUrl}`);

  try {
    // Test if facilitator is reachable
    console.log('🔍 Testing facilitator connectivity...');
    const response = await axios.get(facilitatorUrl, {
      timeout: 5000,
      validateStatus: () => true // Accept any status code
    });

    console.log(`✅ Facilitator is reachable`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Content-Type: ${response.headers['content-type']}`);
    console.log(`   Response length: ${response.data?.length || 'N/A'}`);

    // Try to get facilitator info
    try {
      const infoResponse = await axios.get(`${facilitatorUrl}/info`, {
        timeout: 5000,
        validateStatus: () => true
      });
      
      if (infoResponse.status === 200) {
        console.log('📋 Facilitator info:', infoResponse.data);
      } else {
        console.log('⚠️ No /info endpoint available');
      }
    } catch (infoError) {
      console.log('⚠️ Could not fetch facilitator info:', infoError.message);
    }

    // Test network support
    console.log('\n🔍 Testing network support...');
    const testNetworks = ['sei-testnet', 'base-sepolia', 'base'];
    
    for (const network of testNetworks) {
      try {
        const networkResponse = await axios.post(`${facilitatorUrl}/verify`, {
          network: network,
          test: true
        }, {
          timeout: 5000,
          validateStatus: () => true
        });
        
        console.log(`✅ ${network}: ${networkResponse.status}`);
      } catch (networkError) {
        console.log(`❌ ${network}: ${networkError.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Facilitator connectivity failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure your local X402 facilitator is running on port 3002');
    }
  }

  console.log('\n🎯 Facilitator test completed');
}

// Run test
testFacilitator().catch(console.error);
