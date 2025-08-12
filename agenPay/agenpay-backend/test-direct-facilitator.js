#!/usr/bin/env node

/**
 * Test Direct Facilitator Call
 * Test calling the local facilitator directly with X402 format
 */

import axios from 'axios';

async function testDirectFacilitator() {
  console.log('🧪 Testing Direct Facilitator Call...\n');

  const facilitatorUrl = "http://localhost:3002";

  try {
    // Test the supported endpoint
    console.log('🔍 Testing /supported endpoint...');
    const supportedResponse = await axios.get(`${facilitatorUrl}/supported`);
    console.log('✅ Supported response:', supportedResponse.data);

    // Test the verify endpoint with a mock X402 request
    console.log('\n🔍 Testing /verify endpoint...');
    
    const mockVerifyRequest = {
      paymentRequirements: {
        x402Version: 1,
        scheme: "exact",
        network: "sei-testnet",
        maxAmountRequired: "100000", // 0.1 USDC in atomic units
        resource: "test-resource",
        description: "Test payment"
      },
      paymentPayload: {
        x402Version: 1,
        scheme: "exact",
        network: "sei-testnet",
        amount: "100000",
        resource: "test-resource",
        signature: "0x1234567890abcdef",
        signer: "0x1234567890123456789012345678901234567890"
      }
    };

    console.log('📤 Sending verify request:', JSON.stringify(mockVerifyRequest, null, 2));

    const verifyResponse = await axios.post(`${facilitatorUrl}/verify`, mockVerifyRequest, {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true
    });

    console.log('📥 Verify response status:', verifyResponse.status);
    console.log('📥 Verify response data:', verifyResponse.data);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }

  console.log('\n🎯 Test completed');
}

// Run test
testDirectFacilitator().catch(console.error);
