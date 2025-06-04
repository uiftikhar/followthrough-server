# Gmail System Client Integration Guide

## 📋 Overview

This guide provides complete integration details for the Gmail email triage system, including all available endpoints, response formats, WebSocket connections, and real-world usage examples.

## 🔐 Authentication

All protected endpoints require JWT authentication via the `Authorization` header:

```bash
Authorization: Bearer <JWT_TOKEN>
```

### Webhook Authentication

**Note**: The webhook endpoints (`/api/gmail/webhooks/*`) use **Google Cloud Pub/Sub authentication** and do not require JWT tokens. These endpoints validate that requests come from Google's servers automatically.

**Fixed**: Previous versions incorrectly required a `GMAIL_WEBHOOK_SECRET`. This has been **removed** and replaced with proper Google authentication. See the [Webhook Authentication Guide](./WEBHOOK_AUTHENTICATION_GUIDE.md) for details.

## 📡 API Endpoints

### Base URL
```
https://your-domain.com
```

---

## 🚀 Core Gmail Endpoints

### 1. OAuth Authorization

#### Get OAuth URL
```http
GET /gmail/client/auth-url
Authorization: Bearer <JWT_TOKEN>
```

**Response DTO:**
```typescript
interface AuthUrlResponse {
  success: boolean;
  authUrl: string;
  message: string;
  instructions: string;
}
```

**Example Response:**
```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/oauth/authorize?...",
  "message": "Redirect user to this URL to authorize Google access",
  "instructions": "After user completes OAuth, call /gmail/client/status to verify connection"
}
```

---

### 2. Status Endpoints

#### Lightweight Status Check (Optimized)
```http
GET /gmail/client/status
Authorization: Bearer <JWT_TOKEN>
```

**Response DTO:**
```typescript
interface StatusResponse {
  success: boolean;
  status: {
    user: {
      userId: string;
      isConnectedToGoogle: boolean;
      authenticationStatus: 'not_connected' | 'connected' | 'auth_failed';
    };
    gmail: {
      authenticatedAs: string | null;
      monitoringAccount: string | null;
      accountsMatch: boolean;
      watchActive: boolean;
      watchDetails?: {
        watchId: string;
        expiresAt: string;
        notificationsReceived: number;
        emailsProcessed: number;
        errorCount: number;
      };
    };
    infrastructure: {
      pubsubConfigured: boolean;
      note: string;
    };
    health: {
      overall: 'healthy' | 'issues_detected';
      issues: string[];
      recommendations: string[];
    };
  };
  nextSteps: string[];
}
```

**Example Response:**
```json
{
  "success": true,
  "status": {
    "user": {
      "userId": "67d589416cf318717e74dd55",
      "isConnectedToGoogle": true,
      "authenticationStatus": "connected"
    },
    "gmail": {
      "authenticatedAs": "user@gmail.com",
      "monitoringAccount": "user@gmail.com",
      "accountsMatch": true,
      "watchActive": true,
      "watchDetails": {
        "watchId": "12345",
        "expiresAt": "2025-01-10T10:00:00.000Z",
        "notificationsReceived": 15,
        "emailsProcessed": 12,
        "errorCount": 0
      }
    },
    "infrastructure": {
      "pubsubConfigured": true,
      "note": "Use /gmail/client/infrastructure-health for detailed testing"
    },
    "health": {
      "overall": "healthy",
      "issues": [],
      "recommendations": [
        "✅ Your Gmail notifications are correctly configured"
      ]
    }
  },
  "nextSteps": [
    "Send an email to your monitored account to test notifications"
  ]
}
```

#### Infrastructure Health Check (Detailed)
```http
GET /gmail/client/infrastructure-health
Authorization: Bearer <JWT_TOKEN>
```

**Response DTO:**
```typescript
interface InfrastructureHealthResponse {
  success: boolean;
  user: {
    userId: string;
    requestedAt: string;
  };
  infrastructure: {
    pubsub: {
      connected: boolean;
      subscriptions: {
        pushSubscription: { exists: boolean; messageCount?: number };
        pullSubscription: { exists: boolean; messageCount?: number };
      };
    };
    watches: {
      totalActive: number;
      expiringSoon: number;
      withErrors: number;
      totalNotifications: number;
      totalEmailsProcessed: number;
    };
  };
  status: 'healthy' | 'unhealthy';
  timestamp: string;
}
```

---

### 3. Gmail Setup & Management

#### Setup Gmail Notifications
```http
POST /gmail/client/setup-notifications
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "labelIds": ["INBOX"],
  "labelFilterBehavior": "INCLUDE"
}
```

**Response DTO:**
```typescript
interface SetupNotificationsResponse {
  success: boolean;
  message: string;
  status: 'setup_complete' | 'already_active';
  watchInfo: {
    watchId: string;
    email: string;
    expiresAt: string;
    historyId: string;
  };
  important: {
    note: string;
    authenticatedAccount: string;
    monitoringAccount: string;
    guidance: string;
  };
}
```

#### Disable Gmail Notifications
```http
DELETE /gmail/client/disable-notifications
Authorization: Bearer <JWT_TOKEN>
```

**Response DTO:**
```typescript
interface DisableNotificationsResponse {
  success: boolean;
  message: string;
  nextSteps?: string[];
}
```

---

### 4. Testing Endpoints

#### Test Email Triage
```http
POST /gmail/client/test-triage
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "subject": "Test Support Request",
  "from": "customer@example.com",
  "body": "I need help with my account setup. This is urgent.",
  "to": "support@company.com"
}
```

**Response DTO:**
```typescript
interface TestTriageResponse {
  success: boolean;
  message: string;
  sessionId: string;
  result: {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    sessionId: string;
    isProcessing: boolean;
  };
  testEmail: {
    id: string;
    body: string;
    metadata: EmailMetadata;
  };
  note: string;
}

interface EmailMetadata {
  subject: string;
  from: string;
  to: string;
  date: string;
  messageId: string;
  gmailSource: boolean;
  userId: string;
  headers?: Record<string, string>;
  labels?: string[];
}
```

#### Test Pub/Sub Connection
```http
POST /gmail/client/test-pubsub
Authorization: Bearer <JWT_TOKEN>
```

**Response DTO:**
```typescript
interface PubSubTestResponse {
  success: boolean;
  user: {
    userId: string;
    testedAt: string;
  };
  pubsub: {
    connected: boolean;
    subscriptions: {
      pushSubscription: { exists: boolean; messageCount?: number };
      pullSubscription: { exists: boolean; messageCount?: number };
    };
    error?: string;
  };
  message: string;
}
```

---

### 5. Health & Monitoring

#### System Health
```http
GET /gmail/client/health
```

**Response DTO:**
```typescript
interface HealthResponse {
  success: boolean;
  status: 'healthy' | 'unhealthy';
  pubsub: {
    connected: boolean;
    subscriptions: any;
  };
  watches: {
    totalActive: number;
    expiringSoon: number;
    withErrors: number;
    totalNotifications: number;
    totalEmailsProcessed: number;
  };
  timestamp: string;
}
```

#### Webhook Health
```http
GET /api/gmail/webhooks/health
```

**Response DTO:**
```typescript
interface WebhookHealthResponse {
  status: 'healthy' | 'unhealthy';
  pubsub: boolean;
  subscriptions: any;
  watchStats: {
    totalActive: number;
    contextNote: string;
  };
  timestamp: string;
}
```

---

## 🔌 WebSocket Integration

### Connection Setup

```javascript
import { io } from 'socket.io-client';

const socket = io('https://your-domain.com/gmail-notifications', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  },
  transports: ['websocket']
});
```

### WebSocket Events

#### Client → Server Events

```typescript
// Subscribe to notifications for a specific user
socket.emit('subscribe', {
  userId: 'your-user-id',
  emailAddress: 'user@gmail.com'
});

// Unsubscribe from notifications
socket.emit('unsubscribe', {
  userId: 'your-user-id',
  emailAddress: 'user@gmail.com'
});

// Send test notification
socket.emit('test', {});

// Get connection status
socket.emit('status', {});
```

#### Server → Client Events

```typescript
// Connection confirmed
socket.on('connected', (data) => {
  console.log('Connected:', data);
  // { message: string, clientId: string, timestamp: string }
});

// Subscription confirmed
socket.on('subscribed', (data) => {
  console.log('Subscribed:', data);
  // { message: string, userId: string, emailAddress: string, rooms: string[] }
});

// Email received notification
socket.on('email.received', (data) => {
  console.log('Email received:', data);
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
});

// Triage started
socket.on('triage.started', (data) => {
  console.log('Triage started:', data);
  // {
  //   sessionId: string,
  //   emailId: string,
  //   emailAddress: string,
  //   subject: string,
  //   from: string,
  //   timestamp: string,
  //   source: string
  // }
});

// Triage processing
socket.on('triage.processing', (data) => {
  console.log('Triage processing:', data);
  // {
  //   sessionId: string,
  //   emailId: string,
  //   emailAddress: string,
  //   subject: string,
  //   status: string,
  //   timestamp: string,
  //   source: string
  // }
});

// Triage completed
socket.on('triage.completed', (data) => {
  console.log('Triage completed:', data);
  // {
  //   sessionId: string,
  //   emailId: string,
  //   result: {
  //     classification: { category: string, priority: string, confidence: number },
  //     summary: string,
  //     replyDraft: string
  //   },
  //   timestamp: string
  // }
});

// Triage failed
socket.on('triage.failed', (data) => {
  console.log('Triage failed:', data);
  // {
  //   emailId: string,
  //   emailAddress: string,
  //   error: string,
  //   timestamp: string,
  //   source: string
  // }
});

// Connection status response
socket.on('status.response', (data) => {
  console.log('Status:', data);
  // {
  //   clientId: string,
  //   connectedClients: number,
  //   rooms: string[],
  //   timestamp: string
  // }
});
```

---

## 🔄 Integration Examples

### Complete Integration Flow

```javascript
class GmailIntegrationClient {
  constructor(apiUrl, jwtToken) {
    this.apiUrl = apiUrl;
    this.jwtToken = jwtToken;
    this.socket = null;
  }

  // Step 1: Get OAuth URL
  async getOAuthUrl() {
    const response = await fetch(`${this.apiUrl}/gmail/client/auth-url`, {
      headers: {
        'Authorization': `Bearer ${this.jwtToken}`,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  }

  // Step 2: Check connection status
  async checkStatus() {
    const response = await fetch(`${this.apiUrl}/gmail/client/status`, {
      headers: {
        'Authorization': `Bearer ${this.jwtToken}`
      }
    });
    return response.json();
  }

  // Step 3: Setup Gmail notifications
  async setupNotifications() {
    const response = await fetch(`${this.apiUrl}/gmail/client/setup-notifications`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        labelIds: ['INBOX'],
        labelFilterBehavior: 'INCLUDE'
      })
    });
    return response.json();
  }

  // Step 4: Setup WebSocket connection
  setupWebSocket(userId, emailAddress) {
    this.socket = io(`${this.apiUrl}/gmail-notifications`, {
      auth: { token: this.jwtToken },
      transports: ['websocket']
    });

    this.socket.on('connected', (data) => {
      console.log('🔌 Connected to WebSocket:', data);
      
      // Subscribe to notifications
      this.socket.emit('subscribe', {
        userId,
        emailAddress
      });
    });

    this.socket.on('subscribed', (data) => {
      console.log('✅ Subscribed to notifications:', data);
    });

    this.socket.on('email.received', (data) => {
      console.log('📧 New email received:', data);
      this.handleEmailReceived(data);
    });

    this.socket.on('triage.completed', (data) => {
      console.log('🎯 Triage completed:', data);
      this.handleTriageCompleted(data);
    });

    this.socket.on('triage.failed', (data) => {
      console.error('❌ Triage failed:', data);
      this.handleTriageFailed(data);
    });
  }

  // Handle email received
  handleEmailReceived(emailData) {
    // Update UI with new email notification
    this.updateEmailList(emailData);
    this.showNotification(`New email: ${emailData.subject}`);
  }

  // Handle triage completion
  handleTriageCompleted(triageData) {
    // Update UI with triage results
    this.updateTriageResults(triageData.sessionId, triageData.result);
    
    // Show classification and summary
    console.log('Classification:', triageData.result.classification);
    console.log('Summary:', triageData.result.summary);
    console.log('Reply Draft:', triageData.result.replyDraft);
  }

  // Test email triage
  async testTriage() {
    const response = await fetch(`${this.apiUrl}/gmail/client/test-triage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subject: 'Test Support Request',
        from: 'customer@example.com',
        body: 'I need help with my account setup. This is urgent.'
      })
    });
    return response.json();
  }

  // Test infrastructure
  async testInfrastructure() {
    const response = await fetch(`${this.apiUrl}/gmail/client/infrastructure-health`, {
      headers: {
        'Authorization': `Bearer ${this.jwtToken}`
      }
    });
    return response.json();
  }
}
```

### Usage Example

```javascript
const client = new GmailIntegrationClient(
  'https://your-api-domain.com',
  'your-jwt-token'
);

// Complete setup flow
async function setupGmailIntegration() {
  try {
    // 1. Check current status
    const status = await client.checkStatus();
    console.log('Current status:', status);

    if (!status.status.user.isConnectedToGoogle) {
      // 2. Get OAuth URL if not connected
      const oauthResponse = await client.getOAuthUrl();
      console.log('Redirect user to:', oauthResponse.authUrl);
      return;
    }

    if (!status.status.gmail.watchActive) {
      // 3. Setup notifications if not active
      const setupResponse = await client.setupNotifications();
      console.log('Notifications setup:', setupResponse);
    }

    // 4. Setup WebSocket for real-time notifications
    client.setupWebSocket(
      status.status.user.userId,
      status.status.gmail.authenticatedAs
    );

    console.log('✅ Gmail integration setup complete!');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

// Run setup
setupGmailIntegration();
```

---

## 🚨 Error Handling

### Common Error Responses

```typescript
interface ErrorResponse {
  success: false;
  message: string;
  error?: string;
  guidance?: string[];
  troubleshooting?: {
    step1: string;
    step2: string;
    step3: string;
    step4: string;
  };
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (missing parameters, invalid data)
- `401` - Unauthorized (invalid JWT token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

### Error Handling Example

```javascript
async function handleApiCall(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.jwtToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Handle authentication error
        this.handleAuthError();
        return null;
      }
      
      const errorData = await response.json();
      console.error('API Error:', errorData);
      
      if (errorData.guidance) {
        console.log('Guidance:', errorData.guidance);
      }
      
      throw new Error(errorData.message || 'API request failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
}
```

---

## 📊 Performance Considerations

### Endpoint Performance

| Endpoint | Expected Response Time | Notes |
|----------|----------------------|-------|
| `/gmail/client/status` | < 100ms | Lightweight, no network calls |
| `/gmail/client/infrastructure-health` | 2-5 seconds | Heavy network testing |
| `/gmail/client/setup-notifications` | 3-10 seconds | Creates Gmail watch |
| `/gmail/client/test-triage` | 1-3 seconds | Initiates async processing |

### Best Practices

1. **Use status endpoint for frequent checks** (every 30-60 seconds)
2. **Use infrastructure-health sparingly** (only when detailed testing needed)
3. **Implement exponential backoff** for failed requests
4. **Cache status responses** for 30-60 seconds
5. **Use WebSocket for real-time updates** instead of polling

### Rate Limiting

- **Status endpoint**: 120 requests/minute
- **Infrastructure health**: 10 requests/minute
- **Setup/management**: 20 requests/minute
- **WebSocket connections**: 5 concurrent per user

---

## 🔍 Debugging & Monitoring

### Debug Headers

Add these headers to get additional debug information:

```javascript
{
  'X-Debug-Mode': 'true',
  'X-Correlation-ID': 'unique-request-id'
}
```

### Log Monitoring

Monitor server logs for user-context information:

```
INFO: 📊 Getting Gmail status for user: 67d589416cf318717e74dd55
INFO: ✅ User 67d589416cf318717e74dd55 authenticated as Gmail: user@gmail.com
INFO: 🧪 Pub/Sub test completed for user 67d589416cf318717e74dd55: healthy
```

### Health Check URLs

- **API Health**: `GET /gmail/client/health`
- **WebSocket Health**: `GET /api/gmail/webhooks/health`
- **Infrastructure Health**: `GET /gmail/client/infrastructure-health` (auth required)

This comprehensive guide covers all aspects of integrating with the improved Gmail system, including optimized endpoints, enhanced security, and real-time WebSocket notifications. 