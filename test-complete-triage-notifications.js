#!/usr/bin/env node

/**
 * Test Complete Triage Notification Pipeline
 * Monitors WebSocket for all triage-related events
 */

const WebSocket = require('ws');

const WS_URL = 'wss://ffdf-2-201-41-78.ngrok-free.app/gmail-notifications';

class CompleteTriageTest {
  constructor() {
    this.ws = null;
    this.events = [];
    this.emailsReceived = [];
    this.triageStarted = [];
    this.triageProcessing = [];
    this.triageCompleted = [];
    this.triageFailed = [];
    this.startTime = new Date();
  }

  async runTest() {
    console.log('🧠 COMPLETE TRIAGE NOTIFICATION TEST');
    console.log('=====================================');
    console.log('Monitoring for complete triage workflow notifications...');
    console.log('');
    console.log('📋 Events monitored:');
    console.log('  • email.received - Email detected');
    console.log('  • triage.started - Triage process initiated');
    console.log('  • triage.processing - Triage in progress');
    console.log('  • triage.completed - Triage finished with results');
    console.log('  • triage.failed - Triage failed with error');
    console.log('');
    console.log('🔔 INSTRUCTIONS:');
    console.log('1. Send an email to umer229@gmail.com OR');
    console.log('2. Use manual pull: POST /gmail/client/process-pull-messages');
    console.log('3. This script will monitor for 90 seconds');
    console.log('');

    try {
      // Connect WebSocket and monitor
      await this.connectWebSocket();
      
      // Monitor for 90 seconds
      console.log('⏱️  Monitoring for 90 seconds...');
      console.log('📨 Send an email now or trigger manual processing');
      console.log('');
      
      await this.monitorForNotifications(90000);
      
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
        console.log('📡 Subscribed to triage notifications');
        console.log('');
        resolve();
      });
      
      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          const timestamp = new Date().toISOString();
          
          console.log(`📨 [${new Date().toLocaleTimeString()}] ${message.type || 'unknown'}`);
          
          this.events.push({
            timestamp,
            type: message.type,
            data: message
          });

          // Categorize events
          switch (message.type) {
            case 'email.received':
              this.emailsReceived.push(message);
              console.log(`   📧 Email: "${message.subject}" from ${message.from}`);
              break;
            
            case 'triage.started':
              this.triageStarted.push(message);
              console.log(`   🚀 Triage started for: ${message.subject}`);
              break;
            
            case 'triage.processing':
              this.triageProcessing.push(message);
              console.log(`   ⚙️  Processing session: ${message.sessionId} (${message.status})`);
              break;
            
            case 'triage.completed':
              this.triageCompleted.push(message);
              console.log(`   ✅ Triage completed for: ${message.emailId}`);
              if (message.result) {
                console.log(`   📝 Result: ${JSON.stringify(message.result).substring(0, 100)}...`);
              }
              break;
            
            case 'triage.failed':
              this.triageFailed.push(message);
              console.log(`   ❌ Triage failed: ${message.error}`);
              break;
            
            default:
              console.log(`   ℹ️  Raw: ${JSON.stringify(message).substring(0, 100)}...`);
          }
          console.log('');
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
          const total = this.emailsReceived.length + this.triageStarted.length + this.triageCompleted.length;
          process.stdout.write(`\r⏱️  Monitoring... ${seconds}s remaining (${total} events received)`);
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
    console.log('📊 COMPLETE TRIAGE TEST RESULTS');
    console.log('================================');
    console.log(`Test duration: ${Math.round((Date.now() - this.startTime.getTime()) / 1000)}s`);
    console.log('');
    
    // Event counts
    console.log('📋 Event Summary:');
    console.log(`  📧 Emails received: ${this.emailsReceived.length}`);
    console.log(`  🚀 Triage started: ${this.triageStarted.length}`);
    console.log(`  ⚙️  Triage processing: ${this.triageProcessing.length}`);
    console.log(`  ✅ Triage completed: ${this.triageCompleted.length}`);
    console.log(`  ❌ Triage failed: ${this.triageFailed.length}`);
    console.log(`  📈 Total events: ${this.events.length}`);
    console.log('');

    // Timeline
    if (this.events.length > 0) {
      console.log('⏰ Event Timeline:');
      this.events.forEach((event, index) => {
        const time = new Date(event.timestamp).toLocaleTimeString();
        const data = event.data;
        let description = '';
        
        switch (event.type) {
          case 'email.received':
            description = `"${data.subject}" from ${data.from}`;
            break;
          case 'triage.started':
            description = `Email: ${data.emailId} (${data.subject})`;
            break;
          case 'triage.processing':
            description = `Session: ${data.sessionId} (${data.status})`;
            break;
          case 'triage.completed':
            description = `Session: ${data.sessionId}`;
            break;
          case 'triage.failed':
            description = `Email: ${data.emailId} - ${data.error}`;
            break;
          default:
            description = 'Unknown event';
        }
        
        console.log(`  ${index + 1}. [${time}] ${event.type} - ${description}`);
      });
      console.log('');
    }

    // Detailed results
    if (this.triageCompleted.length > 0) {
      console.log('🎯 Triage Results:');
      this.triageCompleted.forEach((result, index) => {
        console.log(`  ${index + 1}. Session: ${result.sessionId}`);
        console.log(`     Email: ${result.emailId}`);
        if (result.result) {
          console.log(`     Result: ${JSON.stringify(result.result, null, 2)}`);
        }
        console.log('');
      });
    }

    // Assessment
    if (this.triageCompleted.length > 0) {
      console.log('🎉 SUCCESS: Complete triage pipeline is working!');
      console.log('   ✅ Email detection working');
      console.log('   ✅ Triage processing working');
      console.log('   ✅ Results delivery working');
      console.log('   ✅ WebSocket notifications working');
    } else if (this.triageStarted.length > 0) {
      console.log('⚠️  PARTIAL SUCCESS: Triage started but no completions');
      console.log('   ✅ Email detection working');
      console.log('   ✅ Triage initiation working');
      console.log('   ❓ Check if triage processing completes successfully');
    } else if (this.emailsReceived.length > 0) {
      console.log('⚠️  PARTIAL SUCCESS: Emails received but no triage');
      console.log('   ✅ Email detection working');
      console.log('   ❌ Triage not starting - check email processing logic');
    } else {
      console.log('❌ NO ACTIVITY: No events received');
      console.log('   Possible issues:');
      console.log('   - No emails sent during test period');
      console.log('   - Gmail watch not active');
      console.log('   - Push notifications not working');
      console.log('   - WebSocket connection issues');
      console.log('');
      console.log('💡 Next steps:');
      console.log('   1. Try manual processing: POST /gmail/client/process-pull-messages');
      console.log('   2. Send a test email to umer229@gmail.com');
      console.log('   3. Check server logs for processing activity');
    }
  }
}

// Run the test
const test = new CompleteTriageTest();
test.runTest().catch(console.error); 