#!/usr/bin/env node

/**
 * Simple WebSocket Email Notification Test
 * Tests that email notifications are sent to WebSocket clients
 */

const WebSocket = require('ws');
const https = require('https');

const API_BASE_URL = 'https://ffdf-2-201-41-78.ngrok-free.app';
const WS_URL = 'wss://ffdf-2-201-41-78.ngrok-free.app/gmail-notifications';

class SimpleWebSocketTest {
  constructor() {
    this.ws = null;
    this.events = [];
  }

  async runTest() {
    console.log('🧪 SIMPLE WEBSOCKET EMAIL NOTIFICATION TEST');
    console.log('============================================');
    console.log(`🔗 WebSocket URL: ${WS_URL}`);
    console.log('');

    try {
      // Step 1: Connect WebSocket
      await this.connectWebSocket();

      // Step 2: Process pending emails
      await this.processPendingEmails();

      // Step 3: Wait for events
      await this.waitForEvents();

      // Show results
      this.showResults();

    } catch (error) {
      console.error('❌ Test failed:', error.message);
    } finally {
      if (this.ws) {
        this.ws.close();
      }
    }
  }

  async connectWebSocket() {
    console.log('1️⃣ Connecting to WebSocket...');
    
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        console.log('✅ WebSocket connected');
        
        // Subscribe to notifications
        this.ws.send(JSON.stringify({
          event: 'subscribe',
          data: {
            userId: '67d589416cf318717e74dd55', // Your user ID from logs
            emailAddress: 'umer229@gmail.com'
          }
        }));
      });

      this.ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          console.log(`📡 WebSocket Event:`, {
            type: parsed.type || 'unknown',
            emailId: parsed.emailId,
            subject: parsed.subject,
            from: parsed.from
          });
          
          this.events.push({
            type: parsed.type || 'message',
            data: parsed,
            timestamp: new Date()
          });
        } catch (error) {
          console.log('📡 WebSocket Message:', data.toString());
          this.events.push({
            type: 'raw_message',
            data: data.toString(),
            timestamp: new Date()
          });
        }
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        reject(error);
      });

      // Resolve after connection is established
      setTimeout(() => {
        if (this.ws.readyState === WebSocket.OPEN) {
          resolve();
        } else {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
    });
  }

  async processPendingEmails() {
    console.log('\n2️⃣ Processing pending emails...');
    
    return new Promise((resolve) => {
      const postData = '';
      
      const options = {
        hostname: 'ffdf-2-201-41-78.ngrok-free.app',
        port: 443,
        path: '/gmail/client/process-pull-messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': postData.length,
          'ngrok-skip-browser-warning': 'any-value'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            console.log(`✅ Processed ${result.processed || 0} emails`);
            console.log(`📧 Message: ${result.message}`);
          } catch (error) {
            console.log('✅ Process request completed');
          }
          resolve();
        });
      });

      req.on('error', (error) => {
        console.error('❌ Process request failed:', error.message);
        resolve(); // Don't fail the test
      });

      req.write(postData);
      req.end();
    });
  }

  async waitForEvents() {
    console.log('\n3️⃣ Waiting for WebSocket events...');
    console.log('⏳ Waiting 15 seconds for email notifications...');
    
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('⏰ Wait period completed');
        resolve();
      }, 15000);
    });
  }

  showResults() {
    console.log('\n📊 TEST RESULTS');
    console.log('================');
    
    const eventTypes = {};
    this.events.forEach(event => {
      eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
    });

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
        const preview = event.data.subject ? ` - "${event.data.subject}"` : '';
        console.log(`  ${index + 1}. [${time}] ${event.type}${preview}`);
      });
    }

    // Determine if test passed
    const hasEmailEvents = eventTypes['email.received'] > 0;
    const hasConnection = eventTypes['connected'] > 0 || this.events.length > 0;

    console.log('\n🎯 FINAL VERDICT:');
    console.log(`WebSocket Connection: ${hasConnection ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`Email Notifications: ${hasEmailEvents ? '✅ WORKING' : '❌ NOT RECEIVED'}`);
    
    if (hasConnection && hasEmailEvents) {
      console.log('🎉 SUCCESS: WebSocket email notification system is working!');
    } else if (hasConnection) {
      console.log('⚠️ PARTIAL: WebSocket connected but no email notifications received');
    } else {
      console.log('❌ FAILED: WebSocket connection issues');
    }
  }
}

// Run the test
const tester = new SimpleWebSocketTest();
tester.runTest(); 