#!/usr/bin/env node

/**
 * WebSocket Notification Fix Test Script
 * Tests the complete Gmail notification → Email triage → WebSocket notification flow
 */

const axios = require('axios');
const io = require('socket.io-client');

const BASE_URL = process.env.API_BASE_URL || 'https://ffdf-2-201-41-78.ngrok-free.app';
const JWT_TOKEN = process.argv[2];

if (!JWT_TOKEN) {
  console.error('❌ Please provide JWT token as argument');
  console.error('Usage: node test-websocket-fix-flow.js YOUR_JWT_TOKEN');
  process.exit(1);
}

class WebSocketFixTester {
  constructor() {
    this.authToken = JWT_TOKEN;
    this.socket = null;
    this.events = [];
  }

  async runTest() {
    console.log('🧪 WEBSOCKET NOTIFICATION FIX TEST');
    console.log('=====================================');
    console.log(`🔗 API Base URL: ${BASE_URL}`);
    console.log(`🔑 JWT Token: ${this.authToken.substring(0, 20)}...`);
    console.log('');

    try {
      // Step 1: Check system health
      await this.checkSystemHealth();

      // Step 2: Connect WebSocket
      await this.connectWebSocket();

      // Step 3: Check Gmail status
      await this.checkGmailStatus();

      // Step 4: Force process pending messages
      await this.forceProcessPending();

      // Step 5: Test push notification simulation
      await this.testPushNotification();

      // Step 6: Test email triage
      await this.testEmailTriage();

      // Step 7: Wait for WebSocket events
      await this.waitForEvents();

      // Final results
      this.showResults();

    } catch (error) {
      console.error('❌ Test failed:', error.message);
      console.error('Stack:', error.stack);
    } finally {
      if (this.socket) {
        this.socket.disconnect();
      }
    }
  }

  async checkSystemHealth() {
    console.log('1️⃣ Checking system health...');
    
    try {
      const response = await axios.get(`${BASE_URL}/gmail/client/health`);
      const health = response.data;
      
      console.log(`✅ System Status: ${health.status}`);
      console.log(`📊 Active Watches: ${health.watches?.totalActive || 0}`);
      console.log(`📬 Total Notifications: ${health.watches?.totalNotifications || 0}`);
      console.log(`🔗 Pub/Sub Connected: ${health.pubsub ? '✅' : '❌'}`);
      
      return health;
    } catch (error) {
      console.error('❌ Health check failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async connectWebSocket() {
    console.log('\n2️⃣ Connecting to WebSocket...');
    
    return new Promise((resolve, reject) => {
      this.socket = io(`${BASE_URL}/gmail-notifications`, {
        auth: { token: this.authToken },
        transports: ['websocket']
      });

      this.socket.on('connect', () => {
        console.log('✅ WebSocket connected:', this.socket.id);
        
        // Subscribe to notifications
        this.socket.emit('subscribe', {
          userId: this.getUserIdFromToken(),
        });
      });

      this.socket.on('connected', (data) => {
        console.log('📡 Connection confirmed:', data.message);
        this.events.push({ type: 'connected', data, timestamp: new Date() });
      });

      this.socket.on('subscribed', (data) => {
        console.log('✅ Subscribed to notifications:', data.rooms);
        this.events.push({ type: 'subscribed', data, timestamp: new Date() });
        resolve();
      });

      this.socket.on('triage.started', (data) => {
        console.log('🚀 TRIAGE STARTED:', {
          sessionId: data.sessionId,
          emailId: data.emailId,
          emailAddress: data.emailAddress
        });
        this.events.push({ type: 'triage.started', data, timestamp: new Date() });
      });

      this.socket.on('triage.completed', (data) => {
        console.log('✅ TRIAGE COMPLETED:', {
          sessionId: data.sessionId,
          emailId: data.emailId,
          classification: data.result?.classification?.category,
          priority: data.result?.classification?.priority
        });
        this.events.push({ type: 'triage.completed', data, timestamp: new Date() });
      });

      this.socket.on('triage.failed', (data) => {
        console.log('❌ TRIAGE FAILED:', {
          emailId: data.emailId,
          error: data.error
        });
        this.events.push({ type: 'triage.failed', data, timestamp: new Date() });
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection failed:', error.message);
        reject(error);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.socket.connected) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  }

  async checkGmailStatus() {
    console.log('\n3️⃣ Checking Gmail status...');
    
    try {
      const response = await axios.get(`${BASE_URL}/gmail/client/status`, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });
      
      const status = response.data;
      
      console.log(`🔗 OAuth Connected: ${status.oauth?.isConnected ? '✅' : '❌'}`);
      console.log(`📧 Gmail: ${status.oauth?.userInfo?.googleEmail || 'Not found'}`);
      console.log(`📬 Notifications: ${status.notifications?.isEnabled ? '✅' : '❌'}`);
      
      if (status.notifications?.watchInfo) {
        console.log(`🆔 Watch ID: ${status.notifications.watchInfo.watchId}`);
        console.log(`📊 History ID: ${status.notifications.watchInfo.historyId}`);
      }
      
      return status;
    } catch (error) {
      console.error('❌ Gmail status check failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async forceProcessPending() {
    console.log('\n4️⃣ Force processing pending messages...');
    
    try {
      const response = await axios.post(`${BASE_URL}/gmail/client/force-process-pending`, {}, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });
      
      const result = response.data;
      
      console.log(`✅ Force processing completed`);
      console.log(`📬 Messages processed: ${result.result?.pullProcessed || 0}`);
      console.log(`📧 Notifications found: ${result.result?.notifications?.length || 0}`);
      
      return result;
    } catch (error) {
      console.error('❌ Force processing failed:', error.response?.data || error.message);
      // Don't throw - this is optional
      return null;
    }
  }

  async testPushNotification() {
    console.log('\n5️⃣ Testing push notification simulation...');
    
    try {
      const response = await axios.post(`${BASE_URL}/gmail/client/test-push-notification`, {}, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });
      
      const result = response.data;
      
      console.log(`✅ Push notification test completed`);
      console.log(`📧 Email Address: ${result.result?.emailAddress}`);
      console.log(`🆔 Watch ID: ${result.result?.watchId}`);
      console.log(`📬 Messages processed: ${result.result?.pullProcessed || 0}`);
      
      return result;
    } catch (error) {
      console.error('❌ Push notification test failed:', error.response?.data || error.message);
      // Don't throw - this is optional
      return null;
    }
  }

  async testEmailTriage() {
    console.log('\n6️⃣ Testing email triage...');
    
    const testEmail = {
      subject: 'URGENT: System Down - Customer Impact',
      from: 'operations@company.com',
      body: `Hi team,

We have a critical system outage affecting our main application. 
Customers are unable to access their accounts since 2 PM EST.

Current impact:
- 500+ customers affected
- Revenue loss estimated at $50K/hour
- Support tickets increasing rapidly

Immediate action required:
1. Investigate root cause
2. Deploy emergency fix
3. Communicate with customers
4. Prepare incident report

This is blocking our biggest client's quarterly review meeting.
Please prioritize this as P0 and escalate to leadership.

Best regards,
Operations Team`
    };

    try {
      const response = await axios.post(`${BASE_URL}/gmail/client/test-triage`, testEmail, {
        headers: { 
          Authorization: `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = response.data;
      
      console.log(`✅ Email triage test initiated`);
      console.log(`🆔 Session ID: ${result.sessionId}`);
      console.log(`📧 Test Email ID: ${result.testEmail?.id}`);
      
      return result;
    } catch (error) {
      console.error('❌ Email triage test failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async waitForEvents() {
    console.log('\n7️⃣ Waiting for WebSocket events...');
    console.log('⏳ Waiting 30 seconds for triage completion...');
    
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('⏰ Wait period completed');
        resolve();
      }, 30000);
    });
  }

  getUserIdFromToken() {
    try {
      const payload = JSON.parse(Buffer.from(this.authToken.split('.')[1], 'base64').toString());
      return payload.sub;
    } catch (error) {
      console.warn('⚠️ Could not extract user ID from token');
      return 'unknown';
    }
  }

  showResults() {
    console.log('\n📊 TEST RESULTS');
    console.log('================');
    
    const eventTypes = {
      connected: this.events.filter(e => e.type === 'connected').length,
      subscribed: this.events.filter(e => e.type === 'subscribed').length,
      'triage.started': this.events.filter(e => e.type === 'triage.started').length,
      'triage.completed': this.events.filter(e => e.type === 'triage.completed').length,
      'triage.failed': this.events.filter(e => e.type === 'triage.failed').length,
    };

    console.log('WebSocket Events Received:');
    Object.entries(eventTypes).forEach(([type, count]) => {
      const status = count > 0 ? '✅' : '❌';
      console.log(`  ${status} ${type}: ${count}`);
    });

    console.log(`\nTotal Events: ${this.events.length}`);
    
    // Show event timeline
    if (this.events.length > 0) {
      console.log('\nEvent Timeline:');
      this.events.forEach((event, index) => {
        const time = event.timestamp.toISOString().substr(11, 12);
        console.log(`  ${index + 1}. [${time}] ${event.type}`);
      });
    }

    // Determine if test passed
    const hasTriageEvents = eventTypes['triage.started'] > 0 || eventTypes['triage.completed'] > 0;
    const isWebSocketWorking = eventTypes.connected > 0 && eventTypes.subscribed > 0;

    console.log('\n🎯 FINAL VERDICT:');
    console.log(`WebSocket Connection: ${isWebSocketWorking ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`Triage Notifications: ${hasTriageEvents ? '✅ WORKING' : '❌ NOT RECEIVED'}`);
    
    if (isWebSocketWorking && hasTriageEvents) {
      console.log('🎉 SUCCESS: WebSocket notification system is working!');
    } else {
      console.log('⚠️ ISSUES DETECTED: WebSocket notification system needs investigation');
    }
  }
}

// Run the test
const tester = new WebSocketFixTester();
tester.runTest(); 