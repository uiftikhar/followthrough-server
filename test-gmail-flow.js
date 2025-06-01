#!/usr/bin/env node

/**
 * Gmail Push Notification Flow Test Script
 * 
 * This script helps debug the complete Gmail push notification flow
 * by testing each component and providing detailed diagnostics.
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const JWT_TOKEN = process.env.JWT_TOKEN || 'your-jwt-token-here';

async function testGmailFlow() {
  console.log('🔍 Testing Gmail Push Notification Flow...\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing system health...');
    const healthResponse = await axios.get(`${BASE_URL}/gmail/client/health`);
    console.log('✅ Health Status:', healthResponse.data.status);
    console.log('📊 Active Watches:', healthResponse.data.watches.totalActive);
    console.log('📨 Notifications Received:', healthResponse.data.watches.totalNotifications);
    console.log('📧 Emails Processed:', healthResponse.data.watches.totalEmailsProcessed);
    console.log('');

    // Test 2: OAuth Status
    console.log('2️⃣ Testing OAuth status...');
    const statusResponse = await axios.get(`${BASE_URL}/gmail/client/status`, {
      headers: { Authorization: `Bearer ${JWT_TOKEN}` }
    });
    console.log('✅ OAuth Connected:', statusResponse.data.oauth.isConnected);
    console.log('📧 Google Email:', statusResponse.data.oauth.userInfo?.googleEmail);
    console.log('👀 Watch Active:', statusResponse.data.notifications.isEnabled);
    console.log('🆔 Watch ID:', statusResponse.data.notifications.watchInfo?.watchId);
    console.log('');

    // Test 3: Pub/Sub Connection
    console.log('3️⃣ Testing Pub/Sub connection...');
    const pubsubResponse = await axios.post(`${BASE_URL}/gmail/client/test-pubsub`);
    console.log('✅ Pub/Sub Connected:', pubsubResponse.data.pubsub.connected);
    console.log('📤 Push Subscription:', pubsubResponse.data.pubsub.subscriptions.pushSubscription?.exists);
    console.log('📥 Pull Subscription:', pubsubResponse.data.pubsub.subscriptions.pullSubscription?.exists);
    console.log('');

    // Test 4: Check for pending messages
    console.log('4️⃣ Checking for pending messages in pull subscription...');
    const pullResponse = await axios.post(`${BASE_URL}/gmail/client/process-pull-messages`);
    console.log('📨 Pending Messages:', pullResponse.data.processed);
    if (pullResponse.data.processed > 0) {
      console.log('🎉 Found pending messages! This means Gmail is sending notifications to Pub/Sub.');
      console.log('💡 Issue: Push subscription is not configured to send to your webhook.');
      console.log('🔧 Solution: Configure push subscription endpoint in Google Cloud Console.');
    } else {
      console.log('📭 No pending messages found.');
    }
    console.log('');

    // Test 5: Webhook Health
    console.log('5️⃣ Testing webhook endpoint health...');
    const webhookHealthResponse = await axios.get(`${BASE_URL}/api/gmail/webhooks/health`);
    console.log('✅ Webhook Status:', webhookHealthResponse.data.status);
    console.log('📊 Watch Stats:', webhookHealthResponse.data.watchStats);
    console.log('');

    // Test 6: Email Triage Test
    console.log('6️⃣ Testing email triage processing...');
    const triageResponse = await axios.post(`${BASE_URL}/gmail/client/test-triage`, {
      subject: 'Test Gmail Flow',
      from: 'test@example.com',
      body: 'This is a test email to verify the triage processing works correctly.'
    }, {
      headers: { 
        Authorization: `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Triage Test:', triageResponse.data.success ? 'PASSED' : 'FAILED');
    console.log('🆔 Session ID:', triageResponse.data.sessionId);
    console.log('');

    // Diagnosis and recommendations
    console.log('🔬 DIAGNOSIS & RECOMMENDATIONS:');
    console.log('================================');
    
    if (healthResponse.data.watches.totalActive > 0) {
      console.log('✅ Gmail watch is properly configured');
    } else {
      console.log('❌ No active Gmail watches found');
    }

    if (pubsubResponse.data.pubsub.connected) {
      console.log('✅ Pub/Sub connection is working');
    } else {
      console.log('❌ Pub/Sub connection issues detected');
    }

    if (pullResponse.data.processed > 0) {
      console.log('📨 Gmail is sending notifications to Pub/Sub');
      console.log('🔧 ACTION NEEDED: Configure push subscription endpoint');
      console.log('   - Go to Google Cloud Console → Pub/Sub → Subscriptions');
      console.log('   - Edit gmail-push-subscription');
      console.log('   - Set endpoint to: https://your-domain.com/api/gmail/webhooks/push');
      console.log('   - For local testing, use ngrok: https://your-id.ngrok.io/api/gmail/webhooks/push');
    } else {
      console.log('📭 No pending messages detected');
      console.log('💡 Try sending another email and run this test again');
    }

    console.log('\n📧 To test real Gmail flow:');
    console.log('1. Send an email to: umer229@gmail.com');
    console.log('2. Wait 1-2 minutes');
    console.log('3. Run this test script again');
    console.log('4. Check server logs for webhook calls');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testGmailFlow(); 