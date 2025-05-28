#!/usr/bin/env node

/**
 * Test script for Gmail webhook endpoints
 * Run this to verify the Zapier Gmail subscription endpoints are working
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const API_KEY = process.env.ZAPIER_API_KEY || 'zapier_test_key_123456789';

// Test data
const testSubscription = {
  targetUrl: 'https://hooks.zapier.com/hooks/catch/123456/abcdef/',
  query: 'is:unread to:support@company.com',
  labelIds: ['INBOX', 'UNREAD'],
  userId: 'test-user-123',
  triggerType: 'new_email'
};

const testUnsubscription = {
  id: 'gmail-sub-1234567890',
  userId: 'test-user-123'
};

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
    };

    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (error) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test functions
async function testGmailSubscription() {
  console.log('🧪 Testing Gmail webhook subscription...');
  console.log('📧 Subscription data:', JSON.stringify(testSubscription, null, 2));
  
  try {
    const response = await makeRequest('POST', '/api/zapier/webhooks/gmail/subscribe', testSubscription);
    console.log(`✅ Status: ${response.status}`);
    console.log('📄 Response:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 || response.status === 201) {
      console.log('✅ Gmail subscription test PASSED');
      return response.data.subscription?.id;
    } else {
      console.log('❌ Gmail subscription test FAILED');
      return null;
    }
  } catch (error) {
    console.error('❌ Gmail subscription test ERROR:', error.message);
    return null;
  }
}

async function testGmailUnsubscription(subscriptionId) {
  console.log('\n🧪 Testing Gmail webhook unsubscription...');
  
  const unsubData = subscriptionId 
    ? { ...testUnsubscription, id: subscriptionId }
    : testUnsubscription;
    
  console.log('🗑️ Unsubscription data:', JSON.stringify(unsubData, null, 2));
  
  try {
    const response = await makeRequest('POST', '/api/zapier/webhooks/gmail/unsubscribe', unsubData);
    console.log(`✅ Status: ${response.status}`);
    console.log('📄 Response:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 || response.status === 201) {
      console.log('✅ Gmail unsubscription test PASSED');
    } else {
      console.log('❌ Gmail unsubscription test FAILED');
    }
  } catch (error) {
    console.error('❌ Gmail unsubscription test ERROR:', error.message);
  }
}

async function testGmailWebhookTest() {
  console.log('\n🧪 Testing Gmail webhook test endpoint...');
  
  const testData = {
    test: true,
    timestamp: new Date().toISOString(),
    zapierWebhookId: 'test-webhook-123'
  };
  
  try {
    const response = await makeRequest('POST', '/api/zapier/webhooks/gmail/test', testData);
    console.log(`✅ Status: ${response.status}`);
    console.log('📄 Response:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 || response.status === 201) {
      console.log('✅ Gmail webhook test PASSED');
    } else {
      console.log('❌ Gmail webhook test FAILED');
    }
  } catch (error) {
    console.error('❌ Gmail webhook test ERROR:', error.message);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Gmail webhook endpoint tests...');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`🔑 API Key: ${API_KEY.substring(0, 20)}...`);
  console.log('=' * 50);
  
  // Test subscription
  const subscriptionId = await testGmailSubscription();
  
  // Test unsubscription
  await testGmailUnsubscription(subscriptionId);
  
  // Test webhook test endpoint
  await testGmailWebhookTest();
  
  console.log('\n🏁 All tests completed!');
  console.log('\n💡 Next steps:');
  console.log('1. Check your server logs for detailed output');
  console.log('2. Verify the endpoints are working in your Zapier integration');
  console.log('3. Test with real Zapier webhook subscriptions');
}

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testGmailSubscription, testGmailUnsubscription, testGmailWebhookTest }; 