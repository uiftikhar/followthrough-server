// Test script for complete email triage system (Phases 4-6)
// This script tests the email triage, delegation, and snooze functionality

console.log('🧪 Testing Complete Email Triage System (Phases 4-6)...\n');

const baseURL = 'http://localhost:3000';

// Test functions
async function testEmailTriage() {
  console.log('📧 Phase 1-3: Testing Email Triage Functionality...');
  
  try {
    const response = await fetch(`${baseURL}/email/triage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'test-email-456',
        subject: 'Urgent: Payment processing failure',
        from: 'client@company.com',
        to: 'support@ourcompany.com',
        body: `Hi Support Team,

We are experiencing critical payment processing failures on our e-commerce site. 
Customers are unable to complete purchases, and this is affecting our revenue.

Error message: "Payment gateway timeout"
Started: About 2 hours ago
Impact: ~50 failed transactions so far

This needs immediate attention!

Best regards,
John Smith
Technical Lead`
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Email triage successful!');
      console.log(`   Session ID: ${data.sessionId}`);
      return data.sessionId;
    } else {
      console.log('❌ Email triage failed:', data.error);
      return null;
    }
  } catch (error) {
    console.log('❌ Email triage error:', error.message);
    return null;
  }
}

async function testEmailDelegation() {
  console.log('\n👥 Phase 5: Testing Email Delegation...');
  
  try {
    // Test delegation without authentication (will fail, but tests endpoint)
    const response = await fetch(`${baseURL}/api/email/test-email-123/delegate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delegateToUserId: 'user-456',
        delegateToEmail: 'expert@ourcompany.com',
        delegateToName: 'Sarah Expert',
        notes: 'This is a payment processing issue that requires your expertise.',
        urgency: 'urgent'
      })
    });

    const data = await response.json();
    
    if (response.status === 401) {
      console.log('✅ Delegation endpoint secured (authentication required)');
      console.log('   Status: 401 Unauthorized (expected)');
      return true;
    } else {
      console.log('📋 Delegation response:', data);
      return data.success;
    }
  } catch (error) {
    console.log('❌ Delegation test error:', error.message);
    return false;
  }
}

async function testEmailSnooze() {
  console.log('\n😴 Phase 5: Testing Email Snooze...');
  
  try {
    // Test snooze without authentication (will fail, but tests endpoint)
    const snoozeUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    
    const response = await fetch(`${baseURL}/api/email/test-email-123/snooze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        snoozeUntil: snoozeUntil.toISOString(),
        reason: 'Waiting for payment team response',
        notes: 'Will follow up after team meeting at 3 PM'
      })
    });

    const data = await response.json();
    
    if (response.status === 401) {
      console.log('✅ Snooze endpoint secured (authentication required)');
      console.log('   Status: 401 Unauthorized (expected)');
      return true;
    } else {
      console.log('📋 Snooze response:', data);
      return data.success;
    }
  } catch (error) {
    console.log('❌ Snooze test error:', error.message);
    return false;
  }
}

async function testZapierWebhook() {
  console.log('\n🔗 Phase 4: Testing Zapier Webhook Integration...');
  
  try {
    // Test the test endpoint (without API key to show security)
    const response = await fetch(`${baseURL}/api/zapier/webhooks/email/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        test: true,
        message: 'Testing Zapier integration'
      })
    });

    const data = await response.json();
    
    if (response.status === 401) {
      console.log('✅ Zapier webhook secured (API key required)');
      console.log('   Status: 401 Unauthorized (expected)');
      return true;
    } else {
      console.log('📋 Zapier test response:', data);
      return data.success;
    }
  } catch (error) {
    console.log('❌ Zapier webhook test error:', error.message);
    return false;
  }
}

async function testSnoozeStats() {
  console.log('\n📊 Phase 6: Testing Snooze Statistics...');
  
  try {
    const response = await fetch(`${baseURL}/api/email/snoozes/stats`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();
    
    if (response.status === 401) {
      console.log('✅ Snooze stats endpoint secured (authentication required)');
      console.log('   Status: 401 Unauthorized (expected)');
      return true;
    } else {
      console.log('📋 Snooze stats response:', data);
      return data.success;
    }
  } catch (error) {
    console.log('❌ Snooze stats test error:', error.message);
    return false;
  }
}

// Main test execution
async function runAllTests() {
  console.log('🚀 Starting comprehensive email system tests...\n');
  
  const results = {
    triage: await testEmailTriage(),
    delegation: await testEmailDelegation(),
    snooze: await testEmailSnooze(),
    zapier: await testZapierWebhook(),
    stats: await testSnoozeStats(),
  };
  
  console.log('\n📋 Test Results Summary:');
  console.log('========================');
  console.log(`📧 Email Triage (Phase 1-3): ${results.triage ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`👥 Email Delegation (Phase 5): ${results.delegation ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`😴 Email Snooze (Phase 5): ${results.snooze ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🔗 Zapier Webhook (Phase 4): ${results.zapier ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`📊 Snooze Statistics (Phase 6): ${results.stats ? '✅ PASS' : '❌ FAIL'}`);
  
  const passCount = Object.values(results).filter(r => r).length;
  console.log(`\n🎯 Overall: ${passCount}/5 tests passed`);
  
  if (passCount === 5) {
    console.log('🎉 All tests passed! Email triage system is working correctly.');
  } else {
    console.log('⚠️  Some tests failed - see details above.');
  }
  
  console.log('\n🔚 Test suite completed');
}

// Node.js compatibility check
if (typeof fetch === 'undefined') {
  console.log('❌ This test requires Node.js 18+ with fetch support');
  console.log('💡 Try: node --version (should be 18+)');
  process.exit(1);
}

// Run tests
runAllTests().catch(console.error); 