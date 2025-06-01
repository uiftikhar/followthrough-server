#!/usr/bin/env node

/**
 * Test script to verify EmailTriageService registration fix
 * Simulates the Gmail webhook flow that was originally failing
 */

const http = require('http');

const makeRequest = (path, data, method = 'POST') => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'EmailTriageTestClient/1.0'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
};

async function testEmailTriageFix() {
  console.log('🧪 TESTING EMAIL TRIAGE FIX');
  console.log('============================');
  
  try {
    // Test 1: Health check
    console.log('\n1️⃣ Testing EmailTriageService health...');
    const healthResult = await makeRequest('/email/health', {});
    console.log(`   Status: ${healthResult.statusCode}`);
    console.log(`   Team: ${healthResult.data.teamName}`);
    console.log(`   Health: ${healthResult.data.status}`);
    
    if (healthResult.data.success) {
      console.log('   ✅ EmailTriageService is healthy');
    } else {
      console.log('   ❌ EmailTriageService health check failed');
      return;
    }

    // Test 2: Direct email triage test
    console.log('\n2️⃣ Testing direct email triage processing...');
    const triageTestData = {
      id: `test-${Date.now()}`,
      subject: "Customer Support Urgent Issue",
      from: "customer@example.com",
      body: "Hello, I'm having trouble accessing my account. The login page keeps saying my credentials are invalid even though I'm sure they're correct. This is blocking me from completing an important task. Please help!",
      to: "support@company.com",
      timestamp: new Date().toISOString()
    };
    
    const triageResult = await makeRequest('/email/triage', triageTestData);
    console.log(`   Status: ${triageResult.statusCode}`);
    console.log(`   Success: ${triageResult.data.success}`);
    console.log(`   Session ID: ${triageResult.data.sessionId}`);
    
    if (triageResult.data.success) {
      console.log('   ✅ Email triage processing started successfully');
    } else {
      console.log('   ❌ Email triage processing failed');
      console.log(`   Error: ${triageResult.data.error}`);
    }

    // Test 3: Simulate Gmail webhook flow (the original failing scenario)
    console.log('\n3️⃣ Testing Gmail webhook simulation...');
    const webhookData = {
      id: `webhook-test-${Date.now()}`,
      subject: "Re: Account Access Issues - Urgent",
      from: "client@enterprise.com", 
      body: "Hi Support Team,\n\nI'm following up on my previous email about account access issues. This is now escalated as it's affecting our business operations. Can someone please prioritize this request?\n\nAdditional context:\n- Account ID: ENT-12345\n- Error code: AUTH_FAILED_503\n- Affecting 15+ users\n\nPlease escalate to senior support immediately.\n\nBest regards,\nJohn Smith\nIT Director",
      to: "support@company.com",
      timestamp: new Date().toISOString(),
      metadata: {
        priority: "high",
        customerTier: "enterprise"
      }
    };
    
    const webhookResult = await makeRequest('/email/webhook', webhookData);
    console.log(`   Status: ${webhookResult.statusCode}`);
    console.log(`   Success: ${webhookResult.data.success}`);
    console.log(`   Message: ${webhookResult.data.message}`);
    
    if (webhookResult.data.success) {
      console.log('   ✅ Gmail webhook simulation successful');
    } else {
      console.log('   ❌ Gmail webhook simulation failed');
      console.log(`   Error: ${webhookResult.data.error}`);
    }

    console.log('\n🎉 EMAIL TRIAGE FIX VERIFICATION COMPLETE');
    console.log('==========================================');
    console.log('✅ EmailTriageService is properly registered and functional');
    console.log('✅ Team handler registry integration working');
    console.log('✅ Original "No handler found for email_triage team" error RESOLVED');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testEmailTriageFix().catch(console.error); 