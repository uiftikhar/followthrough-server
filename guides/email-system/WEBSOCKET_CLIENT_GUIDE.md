# WebSocket Client Connection Guide

## 🔌 Connecting to Gmail Notifications WebSocket

This guide shows exactly how clients can connect to and subscribe to the WebSocket for real-time Gmail notifications and email triage updates.

## 🚀 Quick Start

### 1. Installation

First, install the Socket.IO client library:

```bash
npm install socket.io-client
# or
yarn add socket.io-client
```

### 2. Basic Connection

```javascript
import { io } from 'socket.io-client';

// Connect to the Gmail notifications namespace
const socket = io('https://your-domain.com/gmail-notifications', {
  // Optional: Include authentication
  auth: {
    token: 'YOUR_JWT_TOKEN'
  },
  // Use WebSocket transport for best performance
  transports: ['websocket'],
  // Enable auto-reconnection
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
```

### 3. Subscribe to Notifications

```javascript
// Wait for connection
socket.on('connected', (data) => {
  console.log('✅ Connected:', data);
  
  // Subscribe to notifications for specific user and email
  socket.emit('subscribe', {
    userId: 'your-user-id',
    emailAddress: 'user@gmail.com'
  });
});

// Confirm subscription
socket.on('subscribed', (data) => {
  console.log('🔔 Subscribed:', data);
  // You're now subscribed to real-time notifications!
});
```

## 📡 Complete TypeScript Integration

### WebSocket Client Class

```typescript
import { io, Socket } from 'socket.io-client';

interface GmailNotificationEvents {
  // Connection events
  connected: (data: { message: string; clientId: string; timestamp: string }) => void;
  subscribed: (data: { message: string; userId: string; emailAddress: string; rooms: string[] }) => void;
  unsubscribed: (data: { message: string; userId: string; emailAddress: string }) => void;
  
  // Email events
  'email.received': (data: EmailReceivedEvent) => void;
  'triage.started': (data: TriageStartedEvent) => void;
  'triage.processing': (data: TriageProcessingEvent) => void;
  'triage.completed': (data: TriageCompletedEvent) => void;
  'triage.failed': (data: TriageFailedEvent) => void;
  
  // Status events
  'status.response': (data: StatusResponse) => void;
  'test.notification': (data: { message: string; timestamp: string }) => void;
  
  // System events
  'system.notification': (data: { type: string; message: string; timestamp: string }) => void;
  'user.notification': (data: any) => void;
}

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
    metadata: any;
    bodyLength: number;
  };
}

interface TriageStartedEvent {
  type: 'triage.started';
  sessionId: string;
  emailId: string;
  emailAddress: string;
  subject: string;
  from: string;
  timestamp: string;
  source: string;
}

interface TriageCompletedEvent {
  type: 'triage.completed';
  sessionId: string;
  emailId: string;
  emailAddress: string;
  result: {
    classification: {
      category: string;
      priority: string;
      confidence: number;
    };
    summary: string;
    replyDraft: string;
  };
  timestamp: string;
  source: string;
}

class GmailWebSocketClient {
  private socket: Socket | null = null;
  private isConnected = false;
  private subscriptions = new Set<string>();

  constructor(
    private serverUrl: string,
    private jwtToken?: string
  ) {}

  /**
   * Connect to the WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(`${this.serverUrl}/gmail-notifications`, {
        auth: this.jwtToken ? { token: this.jwtToken } : undefined,
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      // Connection established
      this.socket.on('connected', (data) => {
        console.log('🔌 WebSocket connected:', data);
        this.isConnected = true;
        resolve();
      });

      // Connection error
      this.socket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection failed:', error);
        this.isConnected = false;
        reject(error);
      });

      // Disconnection
      this.socket.on('disconnect', (reason) => {
        console.log('🔌 WebSocket disconnected:', reason);
        this.isConnected = false;
      });

      // Reconnection
      this.socket.on('reconnect', (attemptNumber) => {
        console.log('🔄 WebSocket reconnected after', attemptNumber, 'attempts');
        this.isConnected = true;
        this.resubscribeAll();
      });
    });
  }

  /**
   * Subscribe to notifications for a user
   */
  subscribe(userId: string, emailAddress: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const subscriptionKey = `${userId}:${emailAddress}`;
      
      // Listen for subscription confirmation
      const onSubscribed = (data: any) => {
        if (data.userId === userId && data.emailAddress === emailAddress) {
          console.log('✅ Subscribed to notifications:', data);
          this.subscriptions.add(subscriptionKey);
          this.socket!.off('subscribed', onSubscribed);
          resolve();
        }
      };

      this.socket.on('subscribed', onSubscribed);

      // Send subscription request
      this.socket.emit('subscribe', {
        userId,
        emailAddress
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        this.socket!.off('subscribed', onSubscribed);
        reject(new Error('Subscription timeout'));
      }, 5000);
    });
  }

  /**
   * Unsubscribe from notifications
   */
  unsubscribe(userId: string, emailAddress: string): void {
    if (!this.socket) return;

    this.socket.emit('unsubscribe', {
      userId,
      emailAddress
    });

    const subscriptionKey = `${userId}:${emailAddress}`;
    this.subscriptions.delete(subscriptionKey);
  }

  /**
   * Set up event listeners
   */
  on<K extends keyof GmailNotificationEvents>(
    event: K,
    listener: GmailNotificationEvents[K]
  ): void {
    if (!this.socket) return;
    this.socket.on(event, listener);
  }

  /**
   * Remove event listeners
   */
  off<K extends keyof GmailNotificationEvents>(
    event: K,
    listener?: GmailNotificationEvents[K]
  ): void {
    if (!this.socket) return;
    this.socket.off(event, listener);
  }

  /**
   * Send test notification
   */
  sendTest(): void {
    if (!this.socket) return;
    this.socket.emit('test');
  }

  /**
   * Get connection status
   */
  getStatus(): void {
    if (!this.socket) return;
    this.socket.emit('status');
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.subscriptions.clear();
    }
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Get active subscriptions
   */
  get activeSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  /**
   * Re-subscribe to all previous subscriptions (used after reconnection)
   */
  private resubscribeAll(): void {
    for (const subscription of this.subscriptions) {
      const [userId, emailAddress] = subscription.split(':');
      this.socket!.emit('subscribe', { userId, emailAddress });
    }
  }
}

export { GmailWebSocketClient, type GmailNotificationEvents };
```

## ⚛️ React Hook Integration

```typescript
import { useEffect, useState, useCallback, useRef } from 'react';
import { GmailWebSocketClient } from './GmailWebSocketClient';

interface UseGmailWebSocketOptions {
  serverUrl: string;
  jwtToken?: string;
  userId: string;
  emailAddress: string;
  autoConnect?: boolean;
}

interface EmailNotification {
  emailId: string;
  subject: string;
  from: string;
  timestamp: string;
  status: 'received' | 'processing' | 'completed' | 'failed';
}

export const useGmailWebSocket = ({
  serverUrl,
  jwtToken,
  userId,
  emailAddress,
  autoConnect = true
}: UseGmailWebSocketOptions) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [notifications, setNotifications] = useState<EmailNotification[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const clientRef = useRef<GmailWebSocketClient | null>(null);

  // Initialize WebSocket client
  const connect = useCallback(async () => {
    try {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }

      const client = new GmailWebSocketClient(serverUrl, jwtToken);
      clientRef.current = client;

      // Set up event listeners
      client.on('connected', () => {
        setIsConnected(true);
        setConnectionError(null);
      });

      client.on('email.received', (data) => {
        setNotifications(prev => [...prev, {
          emailId: data.emailId,
          subject: data.subject,
          from: data.from,
          timestamp: data.timestamp,
          status: 'received'
        }]);
      });

      client.on('triage.started', (data) => {
        setNotifications(prev => 
          prev.map(n => 
            n.emailId === data.emailId 
              ? { ...n, status: 'processing' as const }
              : n
          )
        );
      });

      client.on('triage.completed', (data) => {
        setNotifications(prev => 
          prev.map(n => 
            n.emailId === data.emailId 
              ? { ...n, status: 'completed' as const }
              : n
          )
        );
      });

      client.on('triage.failed', (data) => {
        setNotifications(prev => 
          prev.map(n => 
            n.emailId === data.emailId 
              ? { ...n, status: 'failed' as const }
              : n
          )
        );
      });

      // Connect to WebSocket
      await client.connect();
      
      // Subscribe to notifications
      await client.subscribe(userId, emailAddress);
      setIsSubscribed(true);

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      setConnectionError(error instanceof Error ? error.message : 'Connection failed');
      setIsConnected(false);
      setIsSubscribed(false);
    }
  }, [serverUrl, jwtToken, userId, emailAddress]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setIsConnected(false);
    setIsSubscribed(false);
  }, []);

  // Send test notification
  const sendTest = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.sendTest();
    }
  }, []);

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect, autoConnect]);

  return {
    // Connection state
    isConnected,
    isSubscribed,
    connectionError,
    
    // Data
    notifications,
    
    // Actions
    connect,
    disconnect,
    sendTest,
    clearNotifications,
    
    // Client reference for advanced usage
    client: clientRef.current
  };
};
```

## 🎯 Usage Examples

### Basic Usage

```javascript
import { GmailWebSocketClient } from './GmailWebSocketClient';

const client = new GmailWebSocketClient('https://your-api.com', 'your-jwt-token');

async function setupNotifications() {
  try {
    // Connect to WebSocket
    await client.connect();
    console.log('✅ Connected to WebSocket');

    // Subscribe to notifications
    await client.subscribe('user123', 'user@gmail.com');
    console.log('✅ Subscribed to notifications');

    // Listen for email events
    client.on('email.received', (data) => {
      console.log('📧 New email:', data.subject);
      showNotification(`New email: ${data.subject}`);
    });

    client.on('triage.completed', (data) => {
      console.log('✅ Email triage completed:', data.result);
      updateEmailStatus(data.emailId, 'completed', data.result);
    });

  } catch (error) {
    console.error('Failed to setup notifications:', error);
  }
}

setupNotifications();
```

### React Component Example

```jsx
import React from 'react';
import { useGmailWebSocket } from './useGmailWebSocket';

const EmailNotifications = ({ userId, emailAddress, jwtToken }) => {
  const {
    isConnected,
    isSubscribed,
    notifications,
    connectionError,
    sendTest,
    clearNotifications
  } = useGmailWebSocket({
    serverUrl: 'https://your-api.com',
    jwtToken,
    userId,
    emailAddress
  });

  return (
    <div className="email-notifications">
      <div className="status">
        <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
        {isSubscribed && <span className="subscribed">✅ Subscribed</span>}
        {connectionError && <span className="error">❌ {connectionError}</span>}
      </div>

      <div className="controls">
        <button onClick={sendTest}>Send Test</button>
        <button onClick={clearNotifications}>Clear Notifications</button>
      </div>

      <div className="notifications">
        <h3>Recent Notifications ({notifications.length})</h3>
        {notifications.map((notification) => (
          <div key={notification.emailId} className="notification">
            <div className="subject">{notification.subject}</div>
            <div className="from">From: {notification.from}</div>
            <div className="status">Status: {notification.status}</div>
            <div className="timestamp">{notification.timestamp}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Vue.js Example

```vue
<template>
  <div class="gmail-notifications">
    <div class="connection-status">
      <span :class="['status', { connected: isConnected }]">
        {{ isConnected ? '🟢 Connected' : '🔴 Disconnected' }}
      </span>
    </div>

    <div class="notifications">
      <div 
        v-for="notification in notifications" 
        :key="notification.emailId"
        class="notification"
      >
        <h4>{{ notification.subject }}</h4>
        <p>From: {{ notification.from }}</p>
        <span class="status">{{ notification.status }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { GmailWebSocketClient } from './GmailWebSocketClient';

export default {
  name: 'GmailNotifications',
  props: {
    userId: String,
    emailAddress: String,
    jwtToken: String
  },
  data() {
    return {
      client: null,
      isConnected: false,
      notifications: []
    };
  },
  async mounted() {
    await this.setupWebSocket();
  },
  beforeUnmount() {
    if (this.client) {
      this.client.disconnect();
    }
  },
  methods: {
    async setupWebSocket() {
      this.client = new GmailWebSocketClient('https://your-api.com', this.jwtToken);
      
      this.client.on('connected', () => {
        this.isConnected = true;
      });

      this.client.on('email.received', (data) => {
        this.notifications.push({
          emailId: data.emailId,
          subject: data.subject,
          from: data.from,
          status: 'received'
        });
      });

      await this.client.connect();
      await this.client.subscribe(this.userId, this.emailAddress);
    }
  }
};
</script>
```

## 🔧 Configuration Options

### Connection Options

```javascript
const socket = io('https://your-domain.com/gmail-notifications', {
  // Authentication
  auth: {
    token: 'YOUR_JWT_TOKEN'
  },
  
  // Transport settings
  transports: ['websocket'], // Prefer WebSocket
  upgrade: true,
  
  // Reconnection settings
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxReconnectionAttempts: 5,
  
  // Timeout settings
  timeout: 20000,
  
  // Other options
  autoConnect: true,
  forceNew: false
});
```

### Environment Configuration

```bash
# WebSocket server settings
WEBSOCKET_PORT=3001
WEBSOCKET_CORS_ORIGINS=http://localhost:3000,https://your-domain.com

# Gmail notification settings
GMAIL_NOTIFICATIONS_NAMESPACE=/gmail-notifications
GMAIL_WEBSOCKET_AUTH_REQUIRED=true

# JWT settings for WebSocket auth
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h
```

## 🛠️ Troubleshooting

### Common Connection Issues

#### 1. CORS Errors
```javascript
// Make sure your domain is added to the server's CORS origins
const allowedOrigins = [
  'http://localhost:3000',
  'https://your-domain.com'
];
```

#### 2. Authentication Failures
```javascript
// Ensure JWT token is valid and not expired
const socket = io('https://your-domain.com/gmail-notifications', {
  auth: {
    token: 'valid-jwt-token-here'
  }
});
```

#### 3. Connection Timeouts
```javascript
// Increase timeout for slow connections
const socket = io('https://your-domain.com/gmail-notifications', {
  timeout: 30000, // 30 seconds
  reconnectionDelay: 2000 // 2 seconds between attempts
});
```

### Debug Mode

```javascript
// Enable debug logging
localStorage.debug = 'socket.io-client:socket';

// Or set debug in Node.env
process.env.DEBUG = 'socket.io-client:socket';
```

## 📊 Health Monitoring

### Connection Health Check

```javascript
class ConnectionMonitor {
  constructor(client) {
    this.client = client;
    this.healthCheckInterval = null;
  }

  startMonitoring() {
    this.healthCheckInterval = setInterval(() => {
      if (this.client.connected) {
        this.client.getStatus();
      } else {
        console.warn('⚠️ WebSocket connection lost, attempting reconnection...');
        this.client.connect();
      }
    }, 30000); // Check every 30 seconds
  }

  stopMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}
```

## 🎉 Complete Integration Example

```javascript
import { GmailWebSocketClient } from './GmailWebSocketClient';

class GmailIntegration {
  constructor(config) {
    this.config = config;
    this.client = new GmailWebSocketClient(config.serverUrl, config.jwtToken);
    this.setupEventHandlers();
  }

  async initialize() {
    try {
      // Connect to WebSocket
      await this.client.connect();
      console.log('✅ WebSocket connected');

      // Subscribe to notifications
      await this.client.subscribe(this.config.userId, this.config.emailAddress);
      console.log('✅ Subscribed to notifications');

      return true;
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      return false;
    }
  }

  setupEventHandlers() {
    // Email received
    this.client.on('email.received', (data) => {
      this.onEmailReceived(data);
    });

    // Triage started
    this.client.on('triage.started', (data) => {
      this.onTriageStarted(data);
    });

    // Triage completed
    this.client.on('triage.completed', (data) => {
      this.onTriageCompleted(data);
    });

    // Connection events
    this.client.on('connected', () => {
      this.onConnected();
    });
  }

  onEmailReceived(data) {
    console.log('📧 New email received:', data.subject);
    // Update UI, show notification, etc.
  }

  onTriageStarted(data) {
    console.log('🔄 Triage started for:', data.subject);
    // Show processing indicator
  }

  onTriageCompleted(data) {
    console.log('✅ Triage completed:', data.result);
    // Update UI with results
  }

  onConnected() {
    console.log('🔌 WebSocket connected successfully');
    // Update connection status in UI
  }

  disconnect() {
    this.client.disconnect();
  }
}

// Usage
const gmail = new GmailIntegration({
  serverUrl: 'https://your-api.com',
  jwtToken: 'your-jwt-token',
  userId: 'user123',
  emailAddress: 'user@gmail.com'
});

gmail.initialize();
```

This comprehensive guide covers everything you need to connect to and subscribe to the WebSocket connection for Gmail notifications! 