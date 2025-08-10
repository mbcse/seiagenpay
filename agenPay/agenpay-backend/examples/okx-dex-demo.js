#!/usr/bin/env node

/**
 * OKX DEX Integration Demo
 * Demonstrates multi-token payment capabilities with automatic swapping
 */

import { config } from 'dotenv';
import OKXDexService from '../lib/OKXDexService.js';
import X402PayService from '../lib/X402PayService.js';

// Load environment variables
config();

async function demoOKXDexIntegration() {
  console.log(`
🚀 AgenPay × Sei Testnet Integration Demo
========================================
Multi-token payment system (OKX DEX disabled)

🎯 Features Demonstrated:
- Accept payments in SEI and USDC on Sei testnet
- Standard payment processing (OKX DEX disabled)
- Testnet-safe mock mode for development
- Sei network integration
  `);

  try {
    // Initialize services
    console.log('🔧 Initializing services...');
    const okxDexService = new OKXDexService();
    const x402PayService = new X402PayService();

    // Demo 1: Get supported chains and tokens
    console.log('\n📊 Demo 1: Sei Testnet Capabilities');
    console.log('===================================');
    
    const supportedChains = await okxDexService.getSupportedChains();
    console.log(`✅ Supported chains: ${supportedChains.data?.length || 0}`);
    console.log(`⚠️ OKX DEX Service is disabled - using Sei testnet only`);
    
    const supportedTokens = await okxDexService.getTokensForChain('sei-testnet');
    console.log(`✅ Sei Testnet tokens: ${supportedTokens.data?.length || 0}`);
    
    if (supportedTokens.success && supportedTokens.data.length > 0) {
      console.log('🪙 Sample tokens:');
      supportedTokens.data.slice(0, 3).forEach(token => {
        console.log(`   - ${token.tokenSymbol}: ${token.tokenName} (${token.tokenUnitPrice || 'N/A'} USD)`);
      });
    }

    // Demo 2: Get swap quote (disabled)
    console.log('\n💱 Demo 2: Swap Quote Calculation (Disabled)');
    console.log('============================================');
    console.log('⚠️ OKX DEX Service is disabled - swap quotes not available');
    console.log('✅ Using standard payment processing instead');

    // Demo 3: Payment route calculation (disabled)
    console.log('\n🧮 Demo 3: Payment Route Calculation (Disabled)');
    console.log('==============================================');
    console.log('⚠️ OKX DEX Service is disabled - payment routes not available');
    console.log('✅ Using direct payment processing instead');

    // Demo 4: Multi-token payment request (disabled)
    console.log('\n💳 Demo 4: Multi-Token Payment Request (Disabled)');
    console.log('===============================================');
    console.log('⚠️ OKX DEX Service is disabled - multi-token not available');
    console.log('✅ Using standard payment request instead');
    
    const mockUserId = 'demo-user-123';
    
    try {
      const standardPayment = await x402PayService.createPaymentRequest({
        userId: mockUserId,
        amount: '100',
        currency: 'USDC',
        network: 'sei-testnet',
        recipientEmail: 'demo@example.com',
        recipientName: 'Demo User',
        description: 'Sei Testnet Demo Payment - Standard mode',
        transactionType: 'ask_payment',
        aiPrompt: 'Demo payment request with Sei testnet integration'
      });

      console.log('✅ Standard payment request created:');
      console.log(`   Payment ID: ${standardPayment.paymentId}`);
      console.log(`   Payment URL: ${standardPayment.x402PayLink}`);
      console.log(`   Network: ${standardPayment.request.network}`);
      console.log(`   Currency: ${standardPayment.request.currency}`);

    } catch (paymentError) {
      console.log('⚠️ Payment creation failed (expected without proper user setup):');
      console.log(`   Error: ${paymentError.message}`);
    }

    // Demo 5: Service statistics
    console.log('\n📈 Demo 5: Service Statistics');
    console.log('=============================');
    
    const stats = await okxDexService.getServiceStats();
    console.log('✅ OKX DEX Service stats:');
    console.log(`   Total swaps: ${stats.totalSwaps}`);
    console.log(`   Completed swaps: ${stats.completedSwaps}`);
    console.log(`   Success rate: ${stats.successRate}%`);
    console.log(`   Supported chains: ${stats.supportedChains}`);
    console.log(`   Testnet mode: ${stats.testnetMode ? '🧪 ENABLED' : '🌐 DISABLED'}`);
    console.log(`   Service status: ${stats.disabled ? '❌ DISABLED' : '✅ ENABLED'}`);
    if (stats.message) {
      console.log(`   Message: ${stats.message}`);
    }

    console.log('\n🎉 Demo completed successfully!');
    console.log('\n📝 Key Integration Points:');
    console.log('- Sei Testnet: Primary network for payments');
    console.log('- X402PayService: Enhanced with Sei testnet support');
    console.log('- AgentPayAgent: New tools for Sei testnet workflow');
    console.log('- Testnet safe: All operations use mock data in development');
    console.log('- OKX DEX: Disabled as requested');

    // Cleanup
    await okxDexService.cleanup();
    await x402PayService.cleanup();

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Usage examples
function printUsageExamples() {
  console.log(`
💡 Usage Examples with AgenPay AI Agent:
========================================

1. Standard payment request:
   "Create a payment request for $100 USDC on Sei testnet"
   
2. Sei token payment:
   "I want to request 50 SEI for consulting services"
   
3. Check payment options:
   "What are the payment options for payment ID x402_..."

🔧 Environment Setup:
====================
# Sei testnet configuration
NODE_ENV=development
DEFAULT_NETWORK=sei-testnet
DEFAULT_CURRENCY=SEI

# OKX DEX is disabled as requested
# No OKX API credentials needed
  `);
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Starting OKX DEX Integration Demo...\n');
  
  demoOKXDexIntegration()
    .then(() => {
      printUsageExamples();
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Demo execution failed:', error);
      process.exit(1);
    });
}

export { demoOKXDexIntegration };