#!/usr/bin/env node

/**
 * Test Real Gmail Push Notifications
 * Monitors WebSocket for actual Gmail push notifications
 */

const WebSocket = require('ws');

const WS_URL = 'wss://ffdf-2-201-41-78.ngrok-free.app/gmail-notifications';

class RealGmailPushTest {
  constructor() {
    this.ws = null;
    this.events = [];
    this.receivedEmails = [];
    this.startTime = new Date();
  }

  async runTest() {
    console.log('📧 REAL GMAIL PUSH NOTIFICATION TEST');
    console.log('====================================');
    console.log('Monitoring for real Gmail push notifications...');
    console.log('');
    console.log('🔔 INSTRUCTIONS:');
    console.log('1. Send an email to umer229@gmail.com');
    console.log('2. Subject: "Test Push Notification"');
    console.log('3. Body: "Testing automatic push notifications"');
    console.log('4. This script will monitor for 60 seconds');
    console.log('');

    try {
      // Connect WebSocket and monitor
      await this.connectWebSocket();
      
      // Monitor for 60 seconds
      console.log('⏱️  Monitoring for 60 seconds...');
      console.log('📨 Send an email now to umer229@gmail.com');
      console.log('');
      
      await this.monitorForNotifications(60000);
      
      // Display results
      this.displayResults();

    } catch (error) {
      console.error('❌ Test failed:', error.message);
    } finally {
      if (this.ws) {
        this.ws.close();
      }
    }
  }

  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      console.log('🔌 Connecting to WebSocket...');
      
      this.ws = new WebSocket(WS_URL);
      
      this.ws.on('open', () => {
        console.log('✅ WebSocket connected');
        
        // Subscribe to notifications
        const subscribeMessage = {
          type: 'subscribe',
          userId: 'test-user'
        };
        
        this.ws.send(JSON.stringify(subscribeMessage));
        console.log('📡 Subscribed to notifications');
        console.log('');
        resolve();
      });
      
      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          const timestamp = new Date().toISOString();
          
          console.log(`📨 [${timestamp}] WebSocket message: ${message.type || 'unknown'}`);
          
          this.events.push({
            timestamp,
            type: message.type,
            data: message
          });

          if (message.type === 'email.received') {
            this.receivedEmails.push(message);
            console.log(`🎉 EMAIL RECEIVED: "${message.subject}" from ${message.from}`);
            console.log(`   Preview: ${(message.body || '').substring(0, 100)}...`);
            console.log('');
          }
        } catch (error) {
          console.log(`📨 Raw message: ${data.toString()}`);
        }
      });
      
      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        reject(error);
      });
      
      this.ws.on('close', () => {
        console.log('🔌 WebSocket disconnected');
      });
    });
  }

  async monitorForNotifications(timeout) {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const elapsed = Date.now() - this.startTime.getTime();
        const remaining = Math.max(0, timeout - elapsed);
        const seconds = Math.ceil(remaining / 1000);
        
        if (seconds > 0) {
          process.stdout.write(`\r⏱️  Monitoring... ${seconds}s remaining (${this.receivedEmails.length} emails received)`);
        }
      }, 1000);
      
      setTimeout(() => {
        clearInterval(interval);
        console.log(''); // New line after countdown
        resolve();
      }, timeout);
    });
  }

  displayResults() {
    console.log('');
    console.log('📊 TEST RESULTS');
    console.log('===============');
    console.log(`Total events: ${this.events.length}`);
    console.log(`Emails received: ${this.receivedEmails.length}`);
    console.log(`Test duration: ${Math.round((Date.now() - this.startTime.getTime()) / 1000)}s`);
    console.log('');

    if (this.events.length > 0) {
      console.log('📋 Event Timeline:');
      this.events.forEach((event, index) => {
        const time = new Date(event.timestamp).toLocaleTimeString();
        console.log(`  ${index + 1}. [${time}] ${event.type}`);
      });
      console.log('');
    }

    if (this.receivedEmails.length > 0) {
      console.log('📧 Email Notifications:');
      this.receivedEmails.forEach((email, index) => {
        console.log(`  ${index + 1}. "${email.subject}" from ${email.from}`);
        console.log(`     To: ${email.to}`);
        console.log(`     Time: ${email.timestamp}`);
        console.log(`     Body: ${(email.body || '').substring(0, 200)}...`);
        console.log('');
      });
    }

    // Assessment
    if (this.receivedEmails.length > 0) {
      console.log('🎉 SUCCESS: Real Gmail push notifications are working!');
      console.log('   The complete pipeline is operational:');
      console.log('   Gmail → Google Pub/Sub → Webhook → WebSocket');
    } else if (this.events.length > 0) {
      console.log('⚠️  PARTIAL: WebSocket events received but no emails');
      console.log('   Check if emails are being filtered or processed differently');
    } else {
      console.log('❌ NO NOTIFICATIONS: No events received');
      console.log('   Possible issues:');
      console.log('   - Gmail watch not configured for the correct email');
      console.log('   - Gmail not sending push notifications');
      console.log('   - Push subscription delivery issues');
      console.log('   - Webhook processing errors');
      console.log('');
      console.log('💡 Next steps:');
      console.log('   1. Check server logs for webhook calls');
      console.log('   2. Verify Gmail watch is active and correct');
      console.log('   3. Test with manual pull: POST /gmail/client/process-pull-messages');
    }
  }
}

// Run the test
const test = new RealGmailPushTest();
test.runTest().catch(console.error); 