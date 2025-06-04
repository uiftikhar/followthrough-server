# 📧 **Email System Client Integration Guide**

## **🔐 Cross-Contamination Prevention & Proper Integration**

This guide provides complete instructions for integrating with the email triage system while preventing cross-user contamination and ensuring proper session management.

---

## **📡 WebSocket Connection & Notifications**

### **1. Connect to WebSocket Server**

```javascript
// Connect to the Gmail notifications namespace
const socket = io('https://your-server.com/gmail-notifications', {
  transports: ['websocket'],
  credentials: true,
});

// Handle connection
socket.on('connected', (data) => {
  console.log('🟢 Connected to Gmail notifications:', data);
});
```

### **2. Subscribe to User Notifications**

```javascript
// Subscribe to notifications for specific user
socket.emit('subscribe', {
  userId: 'user123',
  emailAddress: 'user@example.com'
});

socket.on('subscribed', (data) => {
  console.log('✅ Subscribed successfully:', data);
});
```

### **3. Listen for Email Triage Events**

```javascript
// Triage started
socket.on('triage.started', (data) => {
  console.log('🚀 Email triage started:', data);
  showTriageProgress(data.sessionId, 'started');
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

### **1. Create Gmail Watch**

```javascript
// POST /api/gmail/watch
const createWatch = async () => {
  try {
    const response = await fetch('/api/gmail/watch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        labelIds: ['INBOX'],
        labelFilterBehavior: 'INCLUDE'
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Gmail watch created:', result.watch);
      return result.watch;
    } else {
      console.error('❌ Failed to create watch:', result.message);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};
```

### **2. Check Watch Status**

```javascript
// GET /api/gmail/watch
const getWatchStatus = async () => {
  try {
    const response = await fetch('/api/gmail/watch', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const result = await response.json();
    
    if (result.success) {
      if (result.watch) {
        console.log('📊 Watch status:', result.watch);
        console.log('👥 Active sessions:', result.activeSessions);
        return result.watch;
      } else {
        console.log('ℹ️ No active watch found');
        return null;
      }
    }
  } catch (error) {
    console.error('Failed to get watch status:', error);
  }
};
```

### **3. Stop/Remove Gmail Watch**

```javascript
// DELETE /api/gmail/watch
const stopWatch = async () => {
  try {
    const response = await fetch('/api/gmail/watch', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('🛑 Gmail watch stopped successfully');
      return true;
    } else {
      console.log('ℹ️ No active watch to stop');
      return false;
    }
  } catch (error) {
    console.error('Failed to stop watch:', error);
    return false;
  }
};
```

### **4. Renew Gmail Watch**

```javascript
// POST /api/gmail/watch/renew
const renewWatch = async () => {
  try {
    const response = await fetch('/api/gmail/watch/renew', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('🔄 Gmail watch renewed:', result.watch);
      return result.watch;
    } else {
      console.error('❌ Failed to renew watch:', result.message);
    }
  } catch (error) {
    console.error('Failed to renew watch:', error);
  }
};
```

---

## **🛡️ Cross-Contamination Prevention**

### **Best Practices**

1. **Always Unsubscribe on Disconnect**
```javascript
// Proper cleanup when user logs out or window closes
window.addEventListener('beforeunload', () => {
  socket.emit('unsubscribe', {
    userId: currentUser.id,
    emailAddress: currentUser.email
  });
});

// On user logout
const logout = async () => {
  // Unsubscribe from notifications
  socket.emit('unsubscribe', {
    userId: currentUser.id,
    emailAddress: currentUser.email
  });
  
  // Stop Gmail watch
  await stopWatch();
  
  // Disconnect socket
  socket.disconnect();
  
  // Clear auth token
  localStorage.removeItem('authToken');
};
```

2. **Handle Connection Errors Gracefully**
```javascript
socket.on('disconnect', () => {
  console.log('🔴 Disconnected from Gmail notifications');
  // Attempt reconnection or show user notification
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error);
  // Handle connection failure
});
```

3. **Session Validation**
```javascript
// Regularly validate session is still active
const validateSession = async () => {
  try {
    const status = await getWatchStatus();
    if (!status) {
      console.log('⚠️ No active watch - user may need to reconnect');
      // Prompt user to reconnect or create new watch
    }
  } catch (error) {
    console.error('Session validation failed:', error);
  }
};

// Check session every 5 minutes
setInterval(validateSession, 5 * 60 * 1000);
```

---

## **🔄 Complete Integration Flow**

### **Application Startup**
```javascript
class EmailSystemClient {
  constructor(authToken, userInfo) {
    this.authToken = authToken;
    this.userInfo = userInfo;
    this.socket = null;
  }

  async initialize() {
    try {
      // 1. Connect to WebSocket
      await this.connectWebSocket();
      
      // 2. Check existing watch status
      const watchStatus = await this.getWatchStatus();
      
      // 3. Create watch if none exists
      if (!watchStatus) {
        await this.createWatch();
      }
      
      // 4. Subscribe to notifications
      await this.subscribeToNotifications();
      
      console.log('✅ Email system initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize email system:', error);
      throw error;
    }
  }

  async cleanup() {
    try {
      // 1. Unsubscribe from notifications
      if (this.socket) {
        this.socket.emit('unsubscribe', {
          userId: this.userInfo.id,
          emailAddress: this.userInfo.email
        });
      }
      
      // 2. Stop Gmail watch (optional - keeps for next session)
      // await this.stopWatch();
      
      // 3. Disconnect WebSocket
      if (this.socket) {
        this.socket.disconnect();
      }
      
      console.log('✅ Email system cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }
}
```

### **Usage Example**
```javascript
// Initialize when user logs in
const emailClient = new EmailSystemClient(authToken, userInfo);
await emailClient.initialize();

// Cleanup when user logs out or page unloads
window.addEventListener('beforeunload', () => {
  emailClient.cleanup();
});
```

---

## **🔍 Monitoring & Debugging**

### **Admin Endpoints** (Require admin privileges)

1. **View Active Sessions**
```javascript
// GET /api/gmail/watch/sessions
const getActiveSessions = async () => {
  const response = await fetch('/api/gmail/watch/sessions', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  return response.json();
};
```

2. **Force Cleanup**
```javascript
// POST /api/gmail/watch/cleanup
const forceCleanup = async () => {
  const response = await fetch('/api/gmail/watch/cleanup', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  return response.json();
};
```

---

## **⚠️ Important Security Notes**

1. **Never share auth tokens** between users
2. **Always unsubscribe** when switching users
3. **Validate user sessions** regularly
4. **Handle errors gracefully** to prevent system instability
5. **Use HTTPS** for all communications
6. **Implement proper CORS** policies

---

## **🚨 Troubleshooting Cross-Contamination**

If you see notifications for other users:

1. **Immediately unsubscribe** from all notifications
2. **Stop current Gmail watch**
3. **Clear browser storage** (localStorage, sessionStorage)
4. **Refresh the page** and re-authenticate
5. **Contact system administrator** if issue persists

The system now automatically prevents cross-contamination by:
- Validating active sessions before processing notifications
- Automatically cleaning up inactive watches
- Rejecting notifications for users without active sessions
- Providing comprehensive monitoring and cleanup tools

Follow this guide to ensure secure and reliable integration with the email triage system. 