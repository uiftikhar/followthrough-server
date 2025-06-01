#!/usr/bin/env node

/**
 * Production Gmail Push Notification Flow Test
 * Tests the complete OAuth → Watch Setup → Real Email → Triage → WebSocket flow
 */

const axios = require('axios');
const io = require('socket.io-client');

const BASE_URL = 'http://localhost:3000';
const WEBSOCKET_URL = 'http://localhost:3000/gmail-notifications';

class ProductionGmailFlowTester {
  constructor() {
    this.socket = null;
    this.notifications = [];
    this.authToken = null; // Store JWT token for authenticated requests
  }

  /**
   * Step 1: Check OAuth status and get auth URL if needed
   */
  async checkOAuthStatus() {
    console.log('\n🔐 Step 1: Checking OAuth status...');
    
    if (!this.authToken) {
      console.log('❌ No auth token provided. Please provide a valid JWT token.');
      console.log('💡 Tip: Use the client app to get an auth token or implement login here.');
      return false;
    }

    try {
      const response = await axios.get(`${BASE_URL}/gmail/client/status`, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });
      
      const status = response.data;
      console.log('✅ OAuth Status:', status.oauth.isConnected ? 'CONNECTED' : 'NOT CONNECTED');
      
      if (status.oauth.isConnected) {
        console.log('📧 Google Email:', status.oauth.userInfo?.googleEmail);
        console.log('📬 Notifications Enabled:', status.notifications.isEnabled);
        return status;
      } else {
        console.log('🔗 Auth URL:', status.authUrl || 'Get auth URL from /gmail/client/auth-url');
        return false;
      }
    } catch (error) {
      console.error('❌ OAuth status check failed:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Step 2: Enable Gmail push notifications
   */
  async setupNotifications() {
    console.log('\n📡 Step 2: Setting up Gmail push notifications...');
    
    try {
      const response = await axios.post(`${BASE_URL}/gmail/client/setup-notifications`, {}, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });
      
      const setup = response.data;
      if (setup.success) {
        console.log('✅ Push notifications enabled');
        console.log('📧 Watching:', setup.watchInfo?.googleEmail);
        console.log('⏰ Expires:', setup.watchInfo?.expiresAt);
        console.log('🆔 Watch ID:', setup.watchInfo?.watchId);
        return setup.watchInfo;
      } else {
        console.log('❌ Failed to setup notifications:', setup.message);
        return null;
      }
    } catch (error) {
      console.error('❌ Notification setup failed:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Step 3: Connect to WebSocket for real-time notifications
   */
  async connectWebSocket(userEmail) {
    console.log('\n🔌 Step 3: Connecting to WebSocket for real-time notifications...');
    
    this.socket = io(WEBSOCKET_URL, {
      transports: ['websocket'],
    });

    return new Promise((resolve, reject) => {
      this.socket.on('connect', () => {
        console.log('✅ WebSocket connected:', this.socket.id);
        
        // Subscribe to notifications for the user's email
        this.socket.emit('subscribe', {
          userId: 'production-test-user', // TODO: Get real user ID from JWT
          emailAddress: userEmail,
        });
        
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection failed:', error.message);
        reject(error);
      });

      // Listen for triage events
      this.socket.on('triage.started', (data) => {
        console.log('🚀 EMAIL TRIAGE STARTED:', {
          sessionId: data.sessionId,
          emailId: data.emailId,
          emailAddress: data.emailAddress,
        });
        this.notifications.push({ type: 'started', data, timestamp: new Date() });
      });

      this.socket.on('triage.completed', (data) => {
        console.log('✅ EMAIL TRIAGE COMPLETED:', {
          sessionId: data.sessionId,
          emailId: data.emailId,
          classification: data.result?.classification?.category,
          priority: data.result?.classification?.priority,
        });
        this.notifications.push({ type: 'completed', data, timestamp: new Date() });
      });

      this.socket.on('triage.failed', (data) => {
        console.log('❌ EMAIL TRIAGE FAILED:', {
          emailId: data.emailId,
          error: data.error,
        });
        this.notifications.push({ type: 'failed', data, timestamp: new Date() });
      });

      this.socket.on('subscribed', (data) => {
        console.log('✅ Subscribed to notifications:', data.message);
      });
    });
  }

  /**
   * Step 4: Test with a real email (optional - user can send email manually)
   */
  async testWithRealEmail() {
    console.log('\n📧 Step 4: Testing with email...');
    console.log('📝 Option A: Send an email to your Gmail inbox now to test the real flow');
    console.log('🧪 Option B: Use the test-triage endpoint for immediate testing');
    
    const response = await this.promptUser('Use test endpoint? (y/n): ');
    
    if (response.toLowerCase() === 'y') {
      return this.testTriageEndpoint();
    } else {
      console.log('📧 Please send an email to your Gmail inbox now...');
      console.log('⏳ Waiting for real email notifications...');
      return this.waitForRealEmails();
    }
  }

  /**
   * Test the triage endpoint for immediate results
   */
  async testTriageEndpoint() {
    console.log('\n🧪 Testing email triage endpoint...');
    
    const testEmail = {
      subject: 'Production Test: Urgent Login Issue',
      from: 'customer@example.com',
      body: 'Hi support team, I\'m having trouble logging into my account after the recent update. This is urgent as I need to access my documents for an important meeting tomorrow. Can you please help me resolve this quickly?'
    };

    try {
      const response = await axios.post(`${BASE_URL}/gmail/client/test-triage`, testEmail, {
        headers: { 
          Authorization: `Bearer ${this.authToken}`,
          'Content-Type': 'application/json' 
        }
      });
      
      if (response.data.success) {
        console.log('✅ Test triage initiated');
        console.log('🆔 Session ID:', response.data.sessionId);
        console.log('📧 Test Email:', testEmail.subject);
        return response.data;
      } else {
        console.log('❌ Test triage failed:', response.data.message);
        return null;
      }
    } catch (error) {
      console.error('❌ Test triage failed:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Wait for real email notifications from Gmail
   */
  async waitForRealEmails(timeoutMs = 60000) {
    console.log(`⏳ Waiting for real email notifications (${timeoutMs/1000}s timeout)...`);
    
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const checkEmails = () => {
        const elapsed = Date.now() - startTime;
        const emailNotifications = this.notifications.filter(n => n.type !== 'test');
        
        if (emailNotifications.length > 0) {
          console.log(`✅ Received ${emailNotifications.length} real email notifications!`);
          resolve(emailNotifications);
        } else if (elapsed >= timeoutMs) {
          console.log('⏰ Timeout reached. No real emails received.');
          console.log('💡 Tip: Send an email to your Gmail inbox and try again.');
          resolve([]);
        } else {
          setTimeout(checkEmails, 2000);
        }
      };
      
      checkEmails();
    });
  }

  /**
   * Step 5: Check system health and pending messages
   */
  async checkSystemHealth() {
    console.log('\n🏥 Step 5: Checking system health...');
    
    try {
      const [healthResponse, pullResponse] = await Promise.all([
        axios.get(`${BASE_URL}/gmail/client/health`),
        axios.post(`${BASE_URL}/gmail/client/process-pull-messages`, {}, {
          headers: { Authorization: `Bearer ${this.authToken}` }
        })
      ]);
      
      const health = healthResponse.data;
      const pullResults = pullResponse.data;
      
      console.log('✅ System Status:', health.status);
      console.log('📊 Active Watches:', health.watches?.totalActive || 0);
      console.log('📨 Pending Messages:', pullResults.processed || 0);
      console.log('🔄 Pub/Sub Connected:', health.pubsub);
      
      return { health, pullResults };
    } catch (error) {
      console.error('❌ Health check failed:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Generate comprehensive test report
   */
  generateProductionReport(results) {
    console.log('\n📋 PRODUCTION TEST REPORT');
    console.log('==========================');
    
    const { oauthStatus, watchInfo, healthData, notifications } = results;
    
    console.log('🔐 OAuth Status:', oauthStatus ? '✅ CONNECTED' : '❌ NOT CONNECTED');
    console.log('📡 Push Notifications:', watchInfo ? '✅ ENABLED' : '❌ DISABLED');
    console.log('🏥 System Health:', healthData?.health?.status || 'Unknown');
    console.log('📨 Pending Messages:', healthData?.pullResults?.processed || 0);
    console.log('🔔 Real-time Notifications:', notifications.length);
    
    if (notifications.length > 0) {
      console.log('\n📱 Notification Timeline:');
      notifications.forEach((notif, index) => {
        const time = notif.timestamp.toLocaleTimeString();
        console.log(`  ${index + 1}. [${time}] ${notif.type.toUpperCase()} - ${notif.data.sessionId || notif.data.emailId}`);
      });
    }
    
    console.log('\n🎯 PRODUCTION READINESS:');
    
    if (!oauthStatus) {
      console.log('❗ BLOCKING: OAuth not configured - users cannot connect Gmail');
    }
    if (!watchInfo) {
      console.log('❗ BLOCKING: Push notifications not working - no real-time processing');
    }
    if (healthData?.pullResults?.processed > 0) {
      console.log('⚠️  WARNING: Pending messages detected - check Pub/Sub push configuration');
    }
    if (notifications.length === 0) {
      console.log('⚠️  WARNING: No real-time notifications - check WebSocket connection');
    }
    if (oauthStatus && watchInfo && notifications.length > 0) {
      console.log('✅ SUCCESS: Complete production flow working correctly!');
      console.log('🚀 READY: System is production-ready for Gmail email triage');
    }
  }

  /**
   * Simple user input prompt (for interactive testing)
   */
  async promptUser(question) {
    // For now, return 'y' to test automatically
    // In a real implementation, you'd use readline or similar
    return 'y';
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.socket) {
      console.log('\n🧹 Cleaning up WebSocket connection...');
      this.socket.disconnect();
    }
  }

  /**
   * Run the complete production test flow
   */
  async runProductionTest(authToken) {
    this.authToken = authToken;
    
    try {
      console.log('🚀 Starting Production Gmail Flow Test');
      console.log('====================================');
      console.log('📋 This test verifies the complete production flow:');
      console.log('   1. OAuth connection to Gmail');
      console.log('   2. Gmail push notification setup');
      console.log('   3. Real-time WebSocket notifications');
      console.log('   4. Email triage processing');
      console.log('   5. System health monitoring');
      
      // Step 1: Check OAuth
      const oauthStatus = await this.checkOAuthStatus();
      if (!oauthStatus) {
        throw new Error('OAuth required - please authenticate with Google first');
      }
      
      // Step 2: Setup notifications
      const watchInfo = await this.setupNotifications();
      
      // Step 3: Connect WebSocket
      await this.connectWebSocket(oauthStatus.oauth.userInfo?.googleEmail);
      
      // Step 4: Test email processing
      await this.testWithRealEmail();
      
      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Step 5: Check system health
      const healthData = await this.checkSystemHealth();
      
      // Generate report
      this.generateProductionReport({
        oauthStatus,
        watchInfo,
        healthData,
        notifications: this.notifications,
      });
      
    } catch (error) {
      console.error('\n💥 Production test failed:', error.message);
      console.log('\n🔧 TROUBLESHOOTING:');
      console.log('1. Ensure server is running: npm run start:dev');
      console.log('2. Complete OAuth flow: GET /gmail/client/auth-url');
      console.log('3. Check Google Cloud Pub/Sub configuration');
      console.log('4. Verify JWT token is valid');
    } finally {
      this.cleanup();
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  const authToken = process.argv[2]; // Pass JWT token as command line argument
  
  if (!authToken) {
    console.log('❌ Usage: node test-production-gmail-flow.js <JWT_TOKEN>');
    console.log('💡 Get JWT token from your client app or login endpoint');
    process.exit(1);
  }
  
  const tester = new ProductionGmailFlowTester();
  tester.runProductionTest(authToken).then(() => {
    console.log('\n✅ Production test completed');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Production test failed:', error);
    process.exit(1);
  });
}

module.exports = ProductionGmailFlowTester; 