#!/usr/bin/env node

/**
 * Email Triage Flow Test Script
 * Tests the complete Gmail push notification → Email triage → Real-time notification flow
 */

const axios = require('axios');
const io = require('socket.io-client');

const BASE_URL = 'http://localhost:3000';
const WEBSOCKET_URL = 'http://localhost:3000/gmail-notifications';

class EmailTriageFlowTester {
  constructor() {
    this.socket = null;
    this.notifications = [];
  }

  /**
   * Connect to WebSocket for real-time notifications
   */
  async connectWebSocket() {
    console.log('🔌 Connecting to WebSocket...');
    
    this.socket = io(WEBSOCKET_URL, {
      transports: ['websocket'],
    });

    return new Promise((resolve, reject) => {
      this.socket.on('connect', () => {
        console.log('✅ WebSocket connected:', this.socket.id);
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection failed:', error.message);
        reject(error);
      });

      // Listen for various notification types
      this.socket.on('connected', (data) => {
        console.log('📱 Server connection confirmed:', data);
      });

      this.socket.on('triage.started', (data) => {
        console.log('🚀 Triage started:', data);
        this.notifications.push({ type: 'started', data, timestamp: new Date() });
      });

      this.socket.on('triage.completed', (data) => {
        console.log('✅ Triage completed:', data);
        this.notifications.push({ type: 'completed', data, timestamp: new Date() });
      });

      this.socket.on('triage.failed', (data) => {
        console.log('❌ Triage failed:', data);
        this.notifications.push({ type: 'failed', data, timestamp: new Date() });
      });

      this.socket.on('notification', (data) => {
        console.log('🔔 General notification:', data);
        this.notifications.push({ type: 'general', data, timestamp: new Date() });
      });
    });
  }

  /**
   * Subscribe to notifications for specific email
   */
  async subscribeToNotifications() {
    console.log('📬 Subscribing to email notifications...');
    
    this.socket.emit('subscribe', {
      userId: '67d589416cf318717e74dd55',
      emailAddress: 'umer229@gmail.com',
    });

    return new Promise((resolve) => {
      this.socket.on('subscribed', (data) => {
        console.log('✅ Subscribed to notifications:', data);
        resolve(data);
      });
    });
  }

  /**
   * Test system health
   */
  async testSystemHealth() {
    console.log('\n1️⃣ Testing system health...');
    
    try {
      const response = await axios.get(`${BASE_URL}/gmail/client/health`);
      console.log('✅ Health Status:', response.data.status);
      console.log('📊 Active Watches:', response.data.watches.totalActive);
      console.log('📨 Notifications Received:', response.data.watches.totalNotifications);
      return response.data;
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      throw error;
    }
  }

  /**
   * Test email triage processing
   */
  async testEmailTriage() {
    console.log('\n2️⃣ Testing email triage...');
    
    const testEmail = {
      subject: 'Urgent: Login Issues After Update',
      from: 'john.doe@example.com',
      body: 'Hello, I am having trouble logging into my account after the recent update. Can you please help me? This is quite urgent as I need to access important documents for tomorrow\'s meeting.',
    };

    try {
      const response = await axios.post(`${BASE_URL}/gmail/client/test-triage`, testEmail, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('✅ Triage Response:', response.data.success ? 'SUCCESS' : 'FAILED');
      console.log('🆔 Session ID:', response.data.sessionId);
      
      if (response.data.result) {
        console.log('📊 Result Status:', response.data.result.status);
        console.log('📧 Test Email Subject:', response.data.testEmail?.metadata?.subject);
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Email triage test failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Test pull messages (pending notifications)
   */
  async testPullMessages() {
    console.log('\n3️⃣ Testing pull messages...');
    
    try {
      const response = await axios.post(`${BASE_URL}/gmail/client/process-pull-messages`);
      console.log('✅ Pull Messages:', response.data.processed, 'processed');
      
      if (response.data.notifications) {
        console.log('📨 Pending Notifications:', response.data.notifications.length);
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Pull messages test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test WebSocket functionality
   */
  async testWebSocketFunctionality() {
    console.log('\n4️⃣ Testing WebSocket functionality...');
    
    // Test connection status
    this.socket.emit('status');
    
    return new Promise((resolve) => {
      this.socket.on('status.response', (data) => {
        console.log('✅ WebSocket Status:', data);
        resolve(data);
      });
    });
  }

  /**
   * Wait for notifications and analyze results
   */
  async waitForNotifications(timeoutMs = 30000) {
    console.log(`\n5️⃣ Waiting for notifications (${timeoutMs/1000}s timeout)...`);
    
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const checkNotifications = () => {
        const elapsed = Date.now() - startTime;
        
        if (this.notifications.length > 0) {
          console.log(`✅ Received ${this.notifications.length} notifications in ${elapsed}ms`);
          resolve(this.notifications);
        } else if (elapsed >= timeoutMs) {
          console.log('⏰ Timeout reached, no notifications received');
          resolve([]);
        } else {
          setTimeout(checkNotifications, 1000);
        }
      };
      
      checkNotifications();
    });
  }

  /**
   * Generate test report
   */
  generateReport(results) {
    console.log('\n📋 TEST REPORT');
    console.log('==============');
    
    const { health, triage, pullMessages, notifications } = results;
    
    console.log('🏥 System Health:', health?.status || 'Unknown');
    console.log('📊 Active Gmail Watches:', health?.watches?.totalActive || 0);
    console.log('🧪 Email Triage Test:', triage?.success ? 'PASSED' : 'FAILED');
    console.log('📨 Pending Messages:', pullMessages?.processed || 0);
    console.log('🔔 Real-time Notifications:', notifications?.length || 0);
    
    if (notifications?.length > 0) {
      console.log('\n📱 Notification Details:');
      notifications.forEach((notif, index) => {
        console.log(`  ${index + 1}. ${notif.type.toUpperCase()} - ${notif.data.type || 'general'}`);
      });
    }
    
    console.log('\n🎯 RECOMMENDATIONS:');
    if (health?.watches?.totalActive === 0) {
      console.log('❗ No active Gmail watches - ensure user has completed OAuth + setup-notifications');
    }
    if (pullMessages?.processed > 0) {
      console.log('❗ Pending messages found - configure push subscription endpoint in Google Cloud Console');
    }
    if (notifications?.length === 0 && triage?.success) {
      console.log('❗ No real-time notifications - check WebSocket connection and event emission');
    }
    if (triage?.success && notifications?.length > 0) {
      console.log('✅ Complete email triage flow working correctly!');
    }
  }

  /**
   * Cleanup and disconnect
   */
  cleanup() {
    if (this.socket) {
      console.log('\n🧹 Cleaning up WebSocket connection...');
      this.socket.disconnect();
    }
  }

  /**
   * Run complete test suite
   */
  async runCompleteTest() {
    try {
      console.log('🚀 Starting Gmail Push Notification Flow Test');
      console.log('=============================================\n');
      
      // Connect to WebSocket
      await this.connectWebSocket();
      await this.subscribeToNotifications();
      
      // Run tests
      const health = await this.testSystemHealth();
      const pullMessages = await this.testPullMessages();
      const triage = await this.testEmailTriage();
      const wsStatus = await this.testWebSocketFunctionality();
      
      // Wait for real-time notifications
      const notifications = await this.waitForNotifications(10000);
      
      // Generate report
      this.generateReport({ health, triage, pullMessages, notifications });
      
    } catch (error) {
      console.error('\n💥 Test suite failed:', error.message);
    } finally {
      this.cleanup();
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  const tester = new EmailTriageFlowTester();
  tester.runCompleteTest().then(() => {
    console.log('\n✅ Test suite completed');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = EmailTriageFlowTester; 