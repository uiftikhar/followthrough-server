# Gmail Watch Management Guide

## Overview

This guide explains how to manage Gmail watches, including the new admin endpoints for comprehensive cleanup and fresh starts. This is essential for resolving stale historyId issues and maintaining a healthy email notification system.

## Watch Management Endpoints

### 1. Health Check (Check System Status)

```bash
GET /api/gmail/webhooks/admin/watch-health
```

**Purpose**: Get comprehensive health report of all Gmail watches

**Example Response**:
```json
{
  "success": true,
  "overallHealth": {
    "status": "warning",
    "healthPercentage": 75
  },
  "healthStats": {
    "totalWatches": 4,
    "expiredWatches": 1,
    "expiringIn24h": 0,
    "watchesWithErrors": 1,
    "staleWatches": 1,
    "healthyWatches": 3
  },
  "recommendations": [
    "❌ 1 watches have expired - recreate them immediately",
    "🚨 1 watches have errors - investigate and fix",
    "🕰️ 1 watches may have stale historyId - reset them"
  ],
  "watchDetails": [
    {
      "watchId": "110700",
      "googleEmail": "bund9876@gmail.com",
      "historyId": "110700",
      "hoursToExpiry": -24.5,
      "isExpired": true,
      "isExpiringSoon": false,
      "hasErrors": true,
      "errorCount": 5,
      "lastError": "404 Not Found",
      "isStale": true,
      "notificationsReceived": 15,
      "emailsProcessed": 0
    }
  ]
}
```

### 2. List All Active Watches

```bash
GET /api/gmail/webhooks/admin/watches
```

**Purpose**: Get detailed list of all active Gmail watches

**Example Response**:
```json
{
  "success": true,
  "message": "Found 2 active watches",
  "totalWatches": 2,
  "watches": [
    {
      "watchId": "110700",
      "googleEmail": "bund9876@gmail.com",
      "historyId": "110700",
      "expiresAt": "2024-01-01T00:00:00.000Z",
      "isActive": true,
      "notificationsReceived": 15,
      "emailsProcessed": 0,
      "errorCount": 5,
      "lastError": "404 Not Found",
      "userId": "67d589416cf318717e74dd55"
    }
  ]
}
```

### 3. Nuclear Reset (Delete All Watches)

```bash
POST /api/gmail/webhooks/admin/reset-all-watches
```

**⚠️ WARNING**: This is the **NUCLEAR OPTION** - it will delete ALL active Gmail watches for ALL users.

**Purpose**: Clean slate - remove all watches to start fresh

**Example Response**:
```json
{
  "success": true,
  "message": "Reset completed: 2 stopped, 0 failed",
  "totalWatches": 2,
  "stoppedWatches": 2,
  "failedWatches": 0,
  "successRate": 100,
  "errors": [],
  "results": [
    {
      "success": true,
      "email": "bund9876@gmail.com",
      "watchId": "110700",
      "action": "stopped"
    },
    {
      "success": true,
      "email": "user2@gmail.com",
      "watchId": "110701",
      "action": "stopped"
    }
  ]
}
```

### 4. Recreation Instructions

```bash
POST /api/gmail/webhooks/admin/recreate-all-watches
```

**Purpose**: Get instructions for recreating watches after reset

**Response**:
```json
{
  "success": true,
  "message": "Use individual user endpoints to recreate watches",
  "instructions": [
    "1. Each user should call POST /api/gmail/watch to create new watch",
    "2. Or use POST /gmail/client/setup-notifications endpoint",
    "3. New watches will be created with current historyId",
    "4. This ensures no stale historyId issues"
  ],
  "nextSteps": {
    "manualRecreation": "POST /api/gmail/watch (per user)",
    "clientSetup": "POST /gmail/client/setup-notifications (per user)"
  }
}
```

## Complete Fresh Start Process

### Step 1: Check Current Status

```bash
curl -X GET "https://followthrough-server-production.up.railway.app/api/gmail/webhooks/admin/watch-health" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Step 2: Nuclear Reset (Delete All Watches)

```bash
curl -X POST "https://followthrough-server-production.up.railway.app/api/gmail/webhooks/admin/reset-all-watches" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Step 3: Verify Cleanup

```bash
curl -X GET "https://followthrough-server-production.up.railway.app/api/gmail/webhooks/admin/watches" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Should return: `"totalWatches": 0`

### Step 4: Recreate Watches (Per User)

Each user needs to recreate their watch:

```bash
# Option 1: Direct watch creation
curl -X POST "https://followthrough-server-production.up.railway.app/api/gmail/watch" \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "labelIds": ["INBOX"],
    "labelFilterBehavior": "INCLUDE"
  }'

# Option 2: Client setup (recommended)
curl -X POST "https://followthrough-server-production.up.railway.app/gmail/client/setup-notifications" \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Step 5: Verify New Watches

```bash
curl -X GET "https://followthrough-server-production.up.railway.app/api/gmail/webhooks/admin/watch-health" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Should show:
- New watches with current historyId
- No stale watches
- Overall health: "healthy"

## Benefits of Fresh Start

### ✅ Eliminates Stale HistoryId Issues
- New watches created with current Gmail historyId
- No more 404 errors from outdated history references
- Immediate email processing for new emails

### ✅ Cleans Up Orphaned Watches
- Removes watches for users who are no longer active
- Eliminates cross-contamination between user sessions
- Reduces unnecessary Google API calls

### ✅ Resets Error Counters
- All watches start with errorCount: 0
- Fresh start for reliability metrics
- Clean slate for monitoring

### ✅ Synchronizes Expiration Times
- All watches expire at the same time (7 days)
- Easier to manage renewals
- Batch renewal operations

## Monitoring After Fresh Start

### Daily Health Checks
Set up automated health monitoring:

```bash
# Add to cron job or monitoring system
curl -X GET "https://followthrough-server-production.up.railway.app/api/gmail/webhooks/admin/watch-health" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  | jq '.overallHealth.status'
```

### Alerts for Issues
Monitor for:
- `overallHealth.status` != "healthy"
- `healthStats.staleWatches` > 0
- `healthStats.watchesWithErrors` > 0
- `healthStats.expiredWatches` > 0

## Best Practices

### 1. Regular Health Checks
- Run health check daily
- Monitor for stale historyId issues
- Address problems before they impact users

### 2. Proactive Renewals
- Renew watches before they expire
- Monitor expiration dates
- Batch renewal operations

### 3. Clean User Management
- Remove watches for inactive users
- Prevent cross-contamination
- Regular cleanup of orphaned sessions

### 4. Error Monitoring
- Track error counts per watch
- Investigate recurring errors
- Reset watches with persistent issues

## Troubleshooting Common Issues

### Stale HistoryId (Most Common)
**Symptoms**: 404 errors, "No new emails found"
**Solution**: Nuclear reset + fresh start

### Expired Watches
**Symptoms**: No notifications received
**Solution**: Individual watch renewal or recreation

### Cross-Contamination
**Symptoms**: Wrong user receiving notifications
**Solution**: Stop specific watch, recreate properly

### Authentication Errors
**Symptoms**: 401/403 errors in logs
**Solution**: User needs to re-authenticate OAuth

## Security Considerations

### Admin Endpoints Protection
- All admin endpoints should require admin authentication
- Monitor access to nuclear reset functionality
- Log all admin operations

### User Data Privacy
- Watch reset removes user notification preferences
- Users need to opt-in again after reset
- Inform users about data impacts

## Production Deployment

### Environment Variables
Ensure these are set:
```bash
GOOGLE_REMOVE_ACTIVE_WATCHERS=true  # Enable graceful shutdown cleanup
GMAIL_WEBHOOK_SECRET=your_secret    # Webhook verification
```

### Monitoring Integration
- Integrate health checks with monitoring system
- Set up alerts for critical issues
- Dashboard for watch statistics

### Backup Strategy
- Document current watch configurations
- Export user preferences before reset
- Plan for user re-onboarding after reset

## Emergency Procedures

### If System is Completely Broken
1. **Nuclear Reset**: Delete all watches
2. **Verify Cleanup**: Confirm no active watches remain
3. **User Communication**: Notify users about reset
4. **Guided Recreation**: Help users recreate watches
5. **Health Monitoring**: Monitor new watches closely

### If Individual User Issues
1. **Stop User Watch**: Use individual stop endpoint
2. **Debug User Auth**: Check OAuth token validity
3. **Recreate Watch**: User recreates with fresh historyId
4. **Monitor User**: Watch for recurring issues

This comprehensive approach ensures a healthy, synchronized Gmail watch system that eliminates stale historyId issues and provides a fresh start for email notifications. 