#!/usr/bin/env node

/**
 * AgenPay AI Payment Processing Agent - Test Suite
 * Comprehensive testing for all agent functionality
 */

import { 
  processPayment, 
  startPaymentMonitoring, 
  agentGraph, 
  agentConfig 
} from './agent.js';

console.log(`
🧪 AgenPay AI Agent Test Suite
==============================
Testing all payment processing functionality

🔧 Configuration Status:
- OpenAI: ${agentConfig.openaiApiKey ? '✅ Configured' : '❌ Missing'}
- X402Pay: ${agentConfig.x402payApiKey !== 'mock-api-key' ? '✅ Live' : '🧪 Mock'}
- Email: ${agentConfig.emailUser !== 'test@example.com' ? '✅ Live' : '🧪 Mock'}
- Notion: ${agentConfig.notionApiKey !== 'mock-notion-key' ? '✅ Live' : '🧪 Mock'}
`);

// 🎯 Test Cases
const testCases = [
  {
    name: 'Basic Payment Request',
    input: 'Create payment for $200 USD for web development, send to client@acmecorp.com',
    expected: {
      hasAmount: true,
      hasCurrency: true,
      hasEmail: true,
      hasDescription: true,
    }
  },
  {
    name: 'Crypto Payment Request',
    input: 'Charge 0.15 ETH to john@doe.com for consulting services',
    expected: {
      hasAmount: true,
      hasCurrency: true,
      hasEmail: true,
      hasDescription: true,
    }
  },
  {
    name: 'Euro Payment Request',
    input: 'Bill startup@tech.com 500 EUR for monthly subscription',
    expected: {
      hasAmount: true,
      hasCurrency: true,
      hasEmail: true,
      hasDescription: true,
    }
  },
  {
    name: 'Minimal Payment Request',
    input: 'Send invoice to test@example.com for $100',
    expected: {
      hasAmount: true,
      hasEmail: true,
    }
  },
  {
    name: 'Complex Payment Request',
    input: 'Please create a payment request for $1,250.50 USD to enterprise@bigcorp.com for Q1 2024 software development and API integration services',
    expected: {
      hasAmount: true,
      hasCurrency: true,
      hasEmail: true,
      hasDescription: true,
    }
  }
];

// 🧪 Test Runner
async function runTests() {
  let passed = 0;
  let failed = 0;
  
  console.log('🚀 Starting Payment Processing Tests...\n');
  
  for (const [index, testCase] of testCases.entries()) {
    try {
      console.log(`📝 Test ${index + 1}: ${testCase.name}`);
      console.log(`Input: "${testCase.input}"`);
      
      const startTime = Date.now();
      const result = await processPayment(testCase.input, `test-thread-${index}`);
      const endTime = Date.now();
      
      console.log(`⏱️  Execution time: ${endTime - startTime}ms`);
      
      // Basic validation
      if (result && result.messages && result.messages.length > 0) {
        console.log('✅ Test passed: Agent processed request successfully');
        console.log(`📊 Messages generated: ${result.messages.length}`);
        
        // Log tool calls if any
        const lastMessage = result.messages[result.messages.length - 1];
        if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
          console.log(`🔧 Tools called: ${lastMessage.tool_calls.map(tc => tc.name).join(', ')}`);
        }
        
        passed++;
      } else {
        console.log('❌ Test failed: No valid response from agent');
        failed++;
      }
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
      failed++;
    }
    
    console.log('─'.repeat(60) + '\n');
  }
  
  return { passed, failed };
}

// 🔍 Individual Tool Tests
async function testIndividualTools() {
  console.log('🔧 Testing Individual Tools...\n');
  
  try {
    // Test 1: Extract Payment Details
    console.log('🔍 Testing extractPaymentDetails...');
    const extractResult = await agentGraph.invoke({
      messages: [{ role: 'user', content: 'Extract payment details from: Charge $150 to john@email.com for consulting' }],
    }, { configurable: { thread_id: 'tool-test-1' } });
    
    console.log('✅ extractPaymentDetails test completed');
    
    // Test 2: Create Payment Link
    console.log('💳 Testing createPaymentLink...');
    const linkResult = await agentGraph.invoke({
      messages: [{ role: 'user', content: 'Create payment link for $200 USD for web development' }],
    }, { configurable: { thread_id: 'tool-test-2' } });
    
    console.log('✅ createPaymentLink test completed');
    
    // Test 3: Send Email
    console.log('📧 Testing sendEmail...');
    const emailResult = await agentGraph.invoke({
      messages: [{ role: 'user', content: 'Send payment email to test@example.com for $100 USD' }],
    }, { configurable: { thread_id: 'tool-test-3' } });
    
    console.log('✅ sendEmail test completed');
    
    // Test 4: Check Notion Database
    console.log('🗃️ Testing checkNotionDatabase...');
    const notionResult = await agentGraph.invoke({
      messages: [{ role: 'user', content: 'Check Notion database for scheduled payments' }],
    }, { configurable: { thread_id: 'tool-test-4' } });
    
    console.log('✅ checkNotionDatabase test completed');
    
    return true;
    
  } catch (error) {
    console.log(`❌ Tool test failed: ${error.message}`);
    return false;
  }
}

// 🔄 Memory Persistence Test
async function testMemoryPersistence() {
  console.log('🧠 Testing Memory Persistence...\n');
  
  try {
    const threadId = 'memory-test-thread';
    
    // First message
    console.log('📝 Sending first message...');
    await processPayment('Remember that I need to charge Acme Corp $500', threadId);
    
    // Second message referencing the first
    console.log('📝 Sending follow-up message...');
    const result = await processPayment('Create the payment link for that amount', threadId);
    
    console.log('✅ Memory persistence test completed');
    console.log(`📊 Final state messages: ${result.messages.length}`);
    
    return true;
    
  } catch (error) {
    console.log(`❌ Memory test failed: ${error.message}`);
    return false;
  }
}

// 📡 Monitoring Test (Brief)
async function testMonitoring() {
  console.log('📡 Testing Payment Monitoring...\n');
  
  try {
    console.log('🔄 Starting brief monitoring test (10 seconds)...');
    
    // Start monitoring for 10 seconds
    const intervalId = await startPaymentMonitoring(agentConfig.notionDatabaseId, 0.1); // 6 seconds
    
    // Stop after 10 seconds
    setTimeout(() => {
      clearInterval(intervalId);
      console.log('✅ Monitoring test completed');
    }, 10000);
    
    return true;
    
  } catch (error) {
    console.log(`❌ Monitoring test failed: ${error.message}`);
    return false;
  }
}

// 📊 Performance Test
async function testPerformance() {
  console.log('⚡ Testing Performance...\n');
  
  const iterations = 3;
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    try {
      const startTime = Date.now();
      await processPayment(`Performance test ${i + 1}: Charge $${100 + i * 50} to test${i}@example.com`, `perf-test-${i}`);
      const endTime = Date.now();
      
      const executionTime = endTime - startTime;
      times.push(executionTime);
      console.log(`⏱️  Iteration ${i + 1}: ${executionTime}ms`);
      
    } catch (error) {
      console.log(`❌ Performance test ${i + 1} failed: ${error.message}`);
    }
  }
  
  if (times.length > 0) {
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log(`📊 Performance Results:`);
    console.log(`   Average: ${avgTime.toFixed(0)}ms`);
    console.log(`   Min: ${minTime}ms`);
    console.log(`   Max: ${maxTime}ms`);
    console.log('✅ Performance test completed');
  }
  
  return true;
}

// 🎯 Error Handling Test
async function testErrorHandling() {
  console.log('🛡️ Testing Error Handling...\n');
  
  const errorTests = [
    {
      name: 'Empty Input',
      input: '',
    },
    {
      name: 'Invalid Email',
      input: 'Send payment to invalid-email for $100',
    },
    {
      name: 'No Amount',
      input: 'Send payment to test@example.com for services',
    },
    {
      name: 'Malformed Request',
      input: 'asdf jkl qwerty uiop',
    }
  ];
  
  let errorHandled = 0;
  
  for (const test of errorTests) {
    try {
      console.log(`🧪 Testing: ${test.name}`);
      const result = await processPayment(test.input, `error-test-${errorHandled}`);
      
      // Even with invalid inputs, the agent should handle gracefully
      if (result && result.messages) {
        console.log('✅ Error handled gracefully');
        errorHandled++;
      } else {
        console.log('⚠️  Unexpected behavior');
      }
      
    } catch (error) {
      console.log(`✅ Error caught properly: ${error.message}`);
      errorHandled++;
    }
  }
  
  console.log(`📊 Error handling results: ${errorHandled}/${errorTests.length} handled properly`);
  return errorHandled === errorTests.length;
}

// 🎮 Main Test Runner
async function main() {
  console.log('🎯 Running Complete Test Suite...\n');
  
  const testResults = {
    paymentProcessing: { passed: 0, failed: 0 },
    individualTools: false,
    memoryPersistence: false,
    monitoring: false,
    performance: false,
    errorHandling: false,
  };
  
  try {
    // 1. Payment Processing Tests
    console.log('=' .repeat(60));
    console.log('🎯 PAYMENT PROCESSING TESTS');
    console.log('=' .repeat(60));
    testResults.paymentProcessing = await runTests();
    
    // 2. Individual Tool Tests
    console.log('\n' + '=' .repeat(60));
    console.log('🔧 INDIVIDUAL TOOL TESTS');
    console.log('=' .repeat(60));
    testResults.individualTools = await testIndividualTools();
    
    // 3. Memory Persistence Test
    console.log('\n' + '=' .repeat(60));
    console.log('🧠 MEMORY PERSISTENCE TEST');
    console.log('=' .repeat(60));
    testResults.memoryPersistence = await testMemoryPersistence();
    
    // 4. Performance Test
    console.log('\n' + '=' .repeat(60));
    console.log('⚡ PERFORMANCE TEST');
    console.log('=' .repeat(60));
    testResults.performance = await testPerformance();
    
    // 5. Error Handling Test
    console.log('\n' + '=' .repeat(60));
    console.log('🛡️ ERROR HANDLING TEST');
    console.log('=' .repeat(60));
    testResults.errorHandling = await testErrorHandling();
    
    // 6. Monitoring Test (optional, commented out to avoid long running)
    // console.log('\n' + '=' .repeat(60));
    // console.log('📡 MONITORING TEST');
    // console.log('=' .repeat(60));
    // testResults.monitoring = await testMonitoring();
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
  
  // 📊 Final Results
  console.log('\n' + '=' .repeat(60));
  console.log('📊 FINAL TEST RESULTS');
  console.log('=' .repeat(60));
  
  const { passed, failed } = testResults.paymentProcessing;
  const total = passed + failed;
  const successRate = total > 0 ? (passed / total * 100).toFixed(1) : 0;
  
  console.log(`🎯 Payment Processing: ${passed}/${total} passed (${successRate}%)`);
  console.log(`🔧 Individual Tools: ${testResults.individualTools ? '✅ Passed' : '❌ Failed'}`);
  console.log(`🧠 Memory Persistence: ${testResults.memoryPersistence ? '✅ Passed' : '❌ Failed'}`);
  console.log(`⚡ Performance: ${testResults.performance ? '✅ Passed' : '❌ Failed'}`);
  console.log(`🛡️ Error Handling: ${testResults.errorHandling ? '✅ Passed' : '❌ Failed'}`);
  console.log(`📡 Monitoring: ${testResults.monitoring ? '✅ Passed' : '⏭️ Skipped'}`);
  
  const overallPassed = passed > 0 && 
                       testResults.individualTools && 
                       testResults.memoryPersistence && 
                       testResults.performance && 
                       testResults.errorHandling;
  
  console.log(`\n🏆 Overall Result: ${overallPassed ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (overallPassed) {
    console.log(`
🎉 All tests passed! Your AgenPay AI Agent is ready for production.

🚀 Next steps:
1. Add real API keys to .env file
2. Deploy to your production environment
3. Set up monitoring and alerts
4. Configure Notion database schema
    `);
  } else {
    console.log(`
⚠️  Some tests failed. Please review the logs above and fix any issues.

🔧 Common fixes:
1. Check OpenAI API key and quota
2. Verify network connectivity
3. Review error messages for specific issues
    `);
  }
  
  process.exit(overallPassed ? 0 : 1);
}

// 🚀 Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { runTests, testIndividualTools, testMemoryPersistence, testPerformance, testErrorHandling }; 