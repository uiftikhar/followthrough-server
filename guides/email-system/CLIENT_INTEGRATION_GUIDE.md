# 📧 **Email System Client Integration Guide**

## **🔐 Cross-Contamination Prevention & Proper Integration**

This guide provides complete instructions for integrating with the email triage system while preventing cross-user contamination and ensuring proper session management.

---

## **📡 WebSocket Connection & Notifications**

### **1. Connect to WebSocket Server**

```javascript
import { io } from 'socket.io-client';

// ✅ CORRECT: Use wss:// protocol and include the namespace
const socket = io('wss://followthrough-server-production.up.railway.app/gmail-notifications', {
  transports: ['websocket'],
  credentials: true,
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Handle connection
socket.on('connected', (data) => {
  console.log('🟢 Connected to Gmail notifications:', data);
  
  // Subscribe to notifications for your user
  socket.emit('subscribe', {
    userId: '67d589416cf318717e74dd55',
    emailAddress: 'bund9876@gmail.com'
  });
});

// Handle subscription confirmation
socket.on('subscribed', (data) => {
  console.log('✅ Subscribed successfully:', data);
});
```

### **2. Listen for Real-Time Events**

```javascript
// Email received notification (immediate)
socket.on('email.received', (data) => {
  console.log('📧 New email received:', data);
  // {
  //   emailId: string,
  //   emailAddress: string,
  //   subject: string,
  //   from: string,
  //   to: string,
  //   body: string, // preview
  //   timestamp: string,
  //   fullEmail: { id, threadId, metadata, bodyLength }
  // }
  
  updateEmailList(data);
  showNotification(`New email: ${data.subject}`);
});

// Triage started
socket.on('triage.started', (data) => {
  console.log('🚀 Email triage started:', data);
  showTriageProgress(data.emailId, 'started');
});

// Triage processing
socket.on('triage.processing', (data) => {
  console.log('⚡ Email triage processing:', data);
  updateTriageProgress(data.sessionId, data.status);
});

// Triage completed
socket.on('triage.completed', (data) => {
  console.log('✅ Email triage completed:', data);
  displayTriageResults(data.result);
});

// Triage failed
socket.on('triage.failed', (data) => {
  console.error('❌ Email triage failed:', data);
  handleTriageError(data.error);
});
```

---

## **⚙️ Gmail Watch Management**

### **1. Setup Gmail Notifications**

```javascript
// POST /oauth/google/setup-email-notifications
const setupResponse = await fetch('https://followthrough-server-production.up.railway.app/oauth/google/setup-email-notifications', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json',
  },
});

const setupResult = await setupResponse.json();
console.log('Setup result:', setupResult);
// {
//   "success": true,
//   "message": "Gmail notifications enabled successfully",
//   "watchInfo": {
//     "watchId": "110651",
//     "historyId": "110651",
//     "expiresAt": "2025-06-13T12:40:08.790Z",
//     "isActive": true,
//     "googleEmail": "bund9876@gmail.com",
//     "notificationsReceived": 0,
//     "emailsProcessed": 0,
//     "errorCount": 0,
//     "userId": "67d589416cf318717e74dd55"
//   }
// }
```

### **2. Debug Gmail Notifications (NEW)**

```javascript
// GET /api/gmail/webhooks/debug/:emailAddress
const debugResponse = await fetch('https://followthrough-server-production.up.railway.app/api/gmail/webhooks/debug/bund9876@gmail.com', {
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
  },
});

const debugInfo = await debugResponse.json();
console.log('Debug info:', debugInfo);
// Shows:
// - Current watch historyId vs Gmail's current historyId
// - History entries found
// - Messages in those entries
// - Recommendations for fixing issues
```

### **3. Force Refresh (NEW)**

```javascript
// POST /api/gmail/webhooks/force-refresh/:emailAddress
const refreshResponse = await fetch('https://followthrough-server-production.up.railway.app/api/gmail/webhooks/force-refresh/bund9876@gmail.com', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
  },
});

const refreshResult = await refreshResponse.json();
console.log('Force refresh result:', refreshResult);
// Manually processes any pending emails and updates history IDs
```

---

## **🔄 Complete Integration Example**

```javascript
class GmailIntegration {
  constructor(config) {
    this.config = config;
    this.socket = null;
    this.isConnected = false;
  }

  async initialize() {
    try {
      // 1. Setup Gmail notifications
      await this.setupGmailWatch();
      
      // 2. Connect to WebSocket
      await this.connectWebSocket();
      
      // 3. Subscribe to events
      this.setupEventHandlers();
      
      console.log('✅ Gmail integration initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Gmail integration failed:', error);
      return false;
    }
  }

  async setupGmailWatch() {
    const response = await fetch(`${this.config.apiUrl}/oauth/google/setup-email-notifications`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.jwtToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to setup Gmail watch');
    }

    const result = await response.json();
    this.watchInfo = result.watchInfo;
    console.log('📧 Gmail watch setup complete:', this.watchInfo);
  }

  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      this.socket = io(`${this.config.serverUrl}/gmail-notifications`, {
        transports: ['websocket'],
        credentials: true,
      });

      this.socket.on('connected', (data) => {
        console.log('🔌 WebSocket connected:', data);
        this.isConnected = true;
        
        // Subscribe to notifications
        this.socket.emit('subscribe', {
          userId: this.config.userId,
          emailAddress: this.config.emailAddress
        });
        
        resolve();
      });

      this.socket.on('subscribed', (data) => {
        console.log('✅ Subscribed to notifications:', data);
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection failed:', error);
        this.isConnected = false;
        reject(error);
      });
    });
  }

  setupEventHandlers() {
    // Email received
    this.socket.on('email.received', (data) => {
      this.onEmailReceived(data);
    });

    // Triage events
    this.socket.on('triage.started', (data) => {
      this.onTriageStarted(data);
    });

    this.socket.on('triage.completed', (data) => {
      this.onTriageCompleted(data);
    });

    this.socket.on('triage.failed', (data) => {
      this.onTriageFailed(data);
    });
  }

  onEmailReceived(emailData) {
    console.log('📧 New email received:', emailData.subject);
    
    // Update UI
    this.updateEmailList(emailData);
    this.showNotification(`New email: ${emailData.subject}`);
    
    // Show loading state for triage
    this.showTriageLoading(emailData.emailId);
  }

  onTriageStarted(triageData) {
    console.log('🚀 Triage started for:', triageData.subject);
    this.updateTriageStatus(triageData.emailId, 'processing');
  }

  onTriageCompleted(triageData) {
    console.log('✅ Triage completed:', triageData.result);
    
    // Display results
    this.displayTriageResults(triageData.emailId, {
      classification: triageData.result.classification,
      summary: triageData.result.summary,
      replyDraft: triageData.result.replyDraft,
    });
    
    this.updateTriageStatus(triageData.emailId, 'completed');
  }

  onTriageFailed(errorData) {
    console.error('❌ Triage failed:', errorData.error);
    this.updateTriageStatus(errorData.emailId, 'failed');
    this.showErrorMessage(`Triage failed: ${errorData.error.message}`);
  }

  // Debug methods
  async debugGmailIssues() {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/gmail/webhooks/debug/${this.config.emailAddress}`, {
        headers: {
          'Authorization': `Bearer ${this.config.jwtToken}`,
        },
      });
      
      const debugInfo = await response.json();
      console.log('🔍 Debug info:', debugInfo);
      return debugInfo;
    } catch (error) {
      console.error('❌ Debug failed:', error);
    }
  }

  async forceRefresh() {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/gmail/webhooks/force-refresh/${this.config.emailAddress}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.jwtToken}`,
        },
      });
      
      const result = await response.json();
      console.log('🔄 Force refresh result:', result);
      return result;
    } catch (error) {
      console.error('❌ Force refresh failed:', error);
    }
  }

  // UI helper methods
  updateEmailList(emailData) {
    // Add email to your email list UI
  }

  showNotification(message) {
    // Show browser/app notification
  }

  showTriageLoading(emailId) {
    // Show loading spinner for this email
  }

  updateTriageStatus(emailId, status) {
    // Update UI to show triage status
  }

  displayTriageResults(emailId, results) {
    // Display classification, summary, and reply draft
  }

  showErrorMessage(message) {
    // Show error to user
  }
}

// Usage
const gmailIntegration = new GmailIntegration({
  apiUrl: 'https://followthrough-server-production.up.railway.app',
  serverUrl: 'wss://followthrough-server-production.up.railway.app',
  jwtToken: 'your-jwt-token',
  userId: '67d589416cf318717e74dd55',
  emailAddress: 'bund9876@gmail.com',
});

await gmailIntegration.initialize();
```

---

## **🐛 Troubleshooting**

### **1. No Emails Being Processed**

```javascript
// Check debug info
const debugInfo = await gmailIntegration.debugGmailIssues();

if (debugInfo.recommendation.includes('No history entries')) {
  // Force refresh to sync history IDs
  await gmailIntegration.forceRefresh();
}
```

### **2. WebSocket Connection Issues**

```javascript
// Common fixes:
// 1. Use wss:// instead of ws://
// 2. Don't include port number
// 3. Include /gmail-notifications namespace
// 4. Ensure credentials: true

const socket = io('wss://followthrough-server-production.up.railway.app/gmail-notifications', {
  transports: ['websocket'],
  credentials: true,
});
```

### **3. Authentication Errors**

```javascript
// Ensure JWT token is valid and not expired
const headers = {
  'Authorization': `Bearer ${validJwtToken}`,
  'Content-Type': 'application/json',
};
```

---

## **📊 Event Data Structures**

### **Email Received Event**
```typescript
interface EmailReceivedEvent {
  emailId: string;
  emailAddress: string;
  subject: string;
  from: string;
  to: string;
  body: string; // preview
  timestamp: string;
  fullEmail: {
    id: string;
    threadId: string;
    metadata: EmailMetadata;
    bodyLength: number;
  };
}
```

### **Triage Completed Event**
```typescript
interface TriageCompletedEvent {
  sessionId: string;
  emailId: string;
  emailAddress: string;
  subject: string;
  from: string;
  result: {
    classification: string;
    summary: string;
    replyDraft: string;
    processingTime: number;
  };
  timestamp: string;
  source: string;
}
```

This guide should help you properly integrate with the fixed Gmail notification system! 