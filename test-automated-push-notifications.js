#!/usr/bin/env node

/**
 * Test Automated Push Notifications End-to-End
 * Verifies Gmail → Google Pub/Sub → WebSocket pipeline
 */

const WebSocket = require('ws');
const { spawn } = require('child_process');

const WS_URL = 'wss://ffdf-2-201-41-78.ngrok-free.app/gmail-notifications';

class AutomatedPushTest {
  constructor() {
    this.ws = null;
    this.events = [];
    this.receivedEmails = [];
  }

  async runTest() {
    console.log('🚀 AUTOMATED PUSH NOTIFICATION TEST');
    console.log('====================================');
    console.log('Testing: Gmail → Google Pub/Sub → Webhook → WebSocket');
    console.log('');

    try {
      // Step 1: Connect WebSocket
      await this.connectWebSocket();

      // Step 2: Publish test message to trigger push notification
      console.log('📢 Publishing test message to Gmail topic...');
      await this.publishTestMessage();

      // Step 3: Wait for WebSocket notifications
      console.log('⏱️  Waiting 10 seconds for push notification...');
      await this.waitForNotifications(10000);

      // Step 4: Results
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
        
        // Subscribe to notifications (assuming no auth needed for this test)
        const subscribeMessage = {
          type: 'subscribe',
          userId: 'test-user' // For testing
        };
        
        this.ws.send(JSON.stringify(subscribeMessage));
        console.log('📡 Subscribed to notifications');
        resolve();
      });
      
      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('📨 WebSocket message received:', message.type || 'unknown');
          
          this.events.push({
            timestamp: new Date().toISOString(),
            type: message.type,
            data: message
          });

          if (message.type === 'email.received') {
            this.receivedEmails.push(message);
            console.log(`✅ EMAIL RECEIVED: "${message.subject}" from ${message.from}`);
          }
        } catch (error) {
          console.log('📨 Raw WebSocket message:', data.toString());
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

  async publishTestMessage() {
    return new Promise((resolve, reject) => {
      const testMessage = JSON.stringify({
        emailAddress: 'umer229@gmail.com',
        historyId: `${Date.now()}` // Unique history ID
      });

      console.log(`📝 Publishing message: ${testMessage}`);

      const gcloud = spawn('gcloud', [
        'pubsub', 'topics', 'publish', 'gmail-notifications',
        '--message', testMessage
      ]);

      let output = '';
      let error = '';

      gcloud.stdout.on('data', (data) => {
        output += data.toString();
      });

      gcloud.stderr.on('data', (data) => {
        error += data.toString();
      });

      gcloud.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Message published successfully');
          console.log('📋 Output:', output.trim());
          resolve();
        } else {
          console.error('❌ Failed to publish message');
          console.error('Error:', error);
          reject(new Error(`gcloud command failed with code ${code}`));
        }
      });
    });
  }

  async waitForNotifications(timeout) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, timeout);
    });
  }

  displayResults() {
    console.log('');
    console.log('📊 TEST RESULTS');
    console.log('===============');
    console.log(`Events received: ${this.events.length}`);
    console.log(`Emails received: ${this.receivedEmails.length}`);
    console.log('');

    if (this.events.length > 0) {
      console.log('📋 Event Timeline:');
      this.events.forEach((event, index) => {
        console.log(`  ${index + 1}. [${event.timestamp}] ${event.type}`);
      });
      console.log('');
    }

    if (this.receivedEmails.length > 0) {
      console.log('📧 Email Notifications:');
      this.receivedEmails.forEach((email, index) => {
        console.log(`  ${index + 1}. "${email.subject}" from ${email.from}`);
        console.log(`     Body preview: ${(email.body || '').substring(0, 100)}...`);
      });
      console.log('');
    }

    // Overall assessment
    if (this.receivedEmails.length > 0) {
      console.log('🎉 SUCCESS: Push notifications are working!');
      console.log('   Gmail → Pub/Sub → Webhook → WebSocket pipeline is operational');
    } else if (this.events.length > 0) {
      console.log('⚠️  PARTIAL: WebSocket events received but no emails');
      console.log('   Check if email processing is working correctly');
    } else {
      console.log('❌ FAILED: No WebSocket events received');
      console.log('   Possible issues:');
      console.log('   - Push subscription not configured correctly');
      console.log('   - Webhook endpoint not receiving requests');
      console.log('   - WebSocket gateway not emitting events');
      console.log('   - Google Cloud delivery issues');
    }
  }
}

// Run the test
const test = new AutomatedPushTest();
test.runTest().catch(console.error); 