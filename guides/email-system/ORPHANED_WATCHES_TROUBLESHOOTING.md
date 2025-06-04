# Orphaned Gmail Watches Troubleshooting Guide

## 🚨 Issue: Receiving Notifications for Inactive Users

If you're seeing logs like:

```
WARN: ⚠️ No active watch found for email: umer229@gmail.com
INFO: ℹ️ Push notification processed but no new emails found for umer229@gmail.com
```

This indicates **orphaned Gmail watches** - Google is sending notifications for watches that no longer exist in your database.

## 🔍 What Are Orphaned Watches?

**Orphaned watches** occur when:
- Gmail API watches exist in Google's system
- But no corresponding active record exists in your database
- Google continues sending push notifications for these watches

### Common Causes:
1. **Server crashes** during watch cleanup
2. **Manual database cleanup** without calling Google API
3. **Development/testing** without proper cleanup
4. **Improper server shutdown** without graceful cleanup

## 📊 How to Identify Orphaned Watches

### 1. Check Server Logs

Look for these warning patterns:
```bash
# Check recent logs for orphaned watch warnings
grep "No active watch found for email" logs/application.log

# Check for webhook notifications from unwanted emails
grep "Push notification for:" logs/application.log
```

### 2. Use Built-in Debug Endpoints

```bash
# Check active watches in database
curl http://localhost:3000/api/gmail/debug/watch-status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Check for account mismatches
curl http://localhost:3000/api/gmail/debug/account-mismatch \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Monitor Webhook Health

```bash
# Check overall webhook health
curl http://localhost:3000/api/gmail/webhooks/health

# Look for discrepancies between active sessions and notifications
```

## 🧹 Cleanup Solutions

### Automated Solution: Use the Cleanup Script

```bash
# Run the comprehensive cleanup script
./scripts/cleanup-orphaned-gmail-watches.sh

# Follow the interactive prompts to clean up orphaned watches
```

### Manual Solutions

#### Option 1: Force Stop All Watches (Recommended)

```bash
# Stop all active Gmail watches (requires admin token)
curl -X POST http://localhost:3000/api/gmail/debug/force-stop-all \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

#### Option 2: Cleanup Inactive Sessions

```bash
# Clean up inactive sessions and associated watches
curl -X POST http://localhost:3000/api/gmail/watch/cleanup \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

#### Option 3: Google Cloud Console Manual Cleanup

1. **Access Google Cloud Console**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to your project

2. **Check Pub/Sub Subscriptions**
   - Go to **Pub/Sub** > **Subscriptions**
   - Look for subscriptions like:
     - `gmail-push-notification-subscription`
     - `gmail-pull-notification-subscription`

3. **Delete Old Subscriptions**
   - Delete any old or inactive subscriptions
   - This will stop orphaned notifications

4. **Check Topics**
   - Go to **Pub/Sub** > **Topics**
   - Check the `gmail-notifications` topic
   - Remove any old subscriptions attached to it

## 🛡️ Prevention Strategies

### 1. Enable Graceful Shutdown Cleanup

Add to your `.env` file:
```bash
# Enable automatic cleanup on server shutdown
GOOGLE_REMOVE_ACTIVE_WATCHERS=true
```

This will automatically clean up all Gmail watches when the server shuts down.

### 2. Implement Regular Cleanup

Add to your application startup or cron jobs:

```javascript
// Clean up inactive watches every hour
setInterval(async () => {
  try {
    await gmailNotificationService.comprehensiveCleanup();
  } catch (error) {
    console.error('Scheduled cleanup failed:', error);
  }
}, 60 * 60 * 1000); // 1 hour
```

### 3. Proper Session Management

Ensure WebSocket disconnections trigger watch cleanup:

```javascript
// In your client application
window.addEventListener('beforeunload', async () => {
  // Properly disconnect from WebSocket
  socket.disconnect();
  
  // Call cleanup endpoint
  await fetch('/api/gmail/watch/cleanup', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
});
```

## 🔧 Environment Configuration

### Required Settings

```bash
# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GMAIL_PUBSUB_TOPIC=gmail-notifications
GMAIL_PUSH_SUBSCRIPTION=gmail-push-notification-subscription
GMAIL_PULL_SUBSCRIPTION=gmail-pull-notification-subscription

# Cleanup Configuration
GOOGLE_REMOVE_ACTIVE_WATCHERS=true
```

### Optional Settings

```bash
# Webhook authentication (optional)
GMAIL_WEBHOOK_TOKEN=your-webhook-token

# Webhook base URL for reference
WEBHOOK_BASE_URL=https://your-domain.com
```

## 📊 Monitoring and Alerting

### 1. Set Up Log Monitoring

Monitor for these log patterns:
- `No active watch found for email`
- `ORPHANED WATCH DETECTED`
- `Push notification processed but no new emails found`

### 2. Health Check Endpoint

Regularly check the health endpoint:
```bash
# Automated health monitoring
curl http://localhost:3000/api/gmail/webhooks/health | jq '.watchStats'
```

### 3. Event-Based Monitoring

The system emits events for orphaned watches:
```javascript
// Listen for orphaned watch events
eventEmitter.on('gmail.orphaned_watch_detected', (data) => {
  console.warn('Orphaned watch detected:', data);
  // Send alert to monitoring system
  alertingService.sendAlert('orphaned_gmail_watch', data);
});
```

## 🚀 Quick Diagnostic Commands

### Check Current Status

```bash
# 1. Check webhook health
curl http://localhost:3000/api/gmail/webhooks/health

# 2. Check active watches in database
curl http://localhost:3000/api/gmail/debug/active-watches \
  -H "Authorization: Bearer $JWT_TOKEN"

# 3. Check for account mismatches
curl http://localhost:3000/api/gmail/debug/account-mismatch \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Emergency Cleanup

```bash
# Stop all watches immediately
curl -X POST http://localhost:3000/api/gmail/debug/force-stop-all \
  -H "Authorization: Bearer $JWT_TOKEN"

# Clean up inactive sessions
curl -X POST http://localhost:3000/api/gmail/watch/cleanup \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## 📝 Understanding the Logs

### Normal Behavior Logs

```
INFO: 🔔 PUSH NOTIFICATION RECEIVED: 15019499800999736
INFO: ✅ Google Pub/Sub request verification passed
INFO: 📧 Push notification for: current-user@gmail.com, historyId: 18261044
INFO: ✅ Found active watch: watch-id for email: current-user@gmail.com
```

### Orphaned Watch Logs

```
WARN: ⚠️ No active watch found for email: orphaned-user@gmail.com
INFO: 🧹 Handling orphaned watch notification for: orphaned-user@gmail.com
WARN: 📊 ORPHANED WATCH DETECTED:
  - Email: orphaned-user@gmail.com
  - Action: Google is sending notifications for a watch not in our database
```

### Successful Cleanup Logs

```
INFO: 🛑 Stopping watch for: orphaned-user@gmail.com
INFO: ✅ Successfully stopped watch for: orphaned-user@gmail.com
INFO: 🧹 Cleanup completed: 1 cleaned, 0 failed
```

## ❓ Frequently Asked Questions

### Q: Is it safe to have orphaned watch notifications?

**A:** While not dangerous, orphaned watches:
- Waste server resources
- Create log noise
- May indicate configuration issues
- Should be cleaned up for optimal performance

### Q: Will orphaned watches stop automatically?

**A:** Yes, Gmail watches expire within **7 days** automatically. However, it's better to clean them up immediately.

### Q: How do I prevent orphaned watches in development?

**A:** 
1. Always use proper shutdown procedures
2. Enable `GOOGLE_REMOVE_ACTIVE_WATCHERS=true` in development
3. Use the cleanup script after development sessions
4. Implement proper error handling in watch creation/deletion

### Q: Can I ignore orphaned watch warnings?

**A:** You can ignore them temporarily, but it's recommended to clean them up:
- They indicate potential issues in your cleanup logic
- They create unnecessary log noise
- They waste Google API quotas

## 🎯 Best Practices

1. **Always enable graceful shutdown cleanup** in production
2. **Monitor logs regularly** for orphaned watch patterns
3. **Test cleanup procedures** in development environments
4. **Implement proper error handling** for all watch operations
5. **Use the provided cleanup tools** regularly
6. **Document your cleanup procedures** for your team

## 📞 Getting Help

If you continue to experience orphaned watch issues:

1. **Check the logs** for specific error patterns
2. **Run the diagnostic commands** to gather information
3. **Use the cleanup script** to resolve immediate issues
4. **Review your watch creation/deletion logic** for bugs
5. **Consider implementing additional monitoring** for early detection

Remember: Orphaned watches are a common issue in development environments and can be easily resolved with the provided tools and procedures! 