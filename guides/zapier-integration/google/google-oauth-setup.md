# 🔐 Google OAuth Server-Side Integration Setup Guide

## 📋 Overview

This guide walks you through setting up server-side Google OAuth integration for secure access to Gmail and Calendar APIs. The implementation includes:

- **Encrypted token storage** in MongoDB
- **Automatic token refresh** with background jobs
- **Server-side API proxying** for security
- **Authentication guards** for protected routes

## 🏗️ Architecture Benefits

### Security
- ✅ Client secrets never exposed to browser
- ✅ Tokens encrypted with AES-256-GCM
- ✅ HTTP-only cookies prevent XSS attacks
- ✅ CSRF protection with signed state parameters

### Performance
- ✅ Automatic token refresh in background
- ✅ Optimized MongoDB indexes
- ✅ Connection pooling and reuse
- ✅ Minimal API calls with caching

### Scalability
- ✅ Horizontal scaling with shared database
- ✅ User isolation and multi-tenancy
- ✅ Rate limiting and error handling
- ✅ Background job processing

---

## ⚙️ Configuration Setup

### 1. Google Cloud Console Setup

#### Create OAuth 2.0 Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Gmail API
   - Google Calendar API
   - Google+ API (for user info)

4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Set up consent screen with your application details
6. Configure OAuth client:
   - **Application type**: Web application
   - **Authorized redirect URIs**: 
     ```
     http://localhost:3000/auth/google/callback  # Development
     https://your-domain.com/auth/google/callback  # Production
     ```

#### Required Scopes
The integration uses these Google OAuth scopes:
```
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/calendar.readonly
https://www.googleapis.com/auth/calendar.events
```

### 2. Environment Variables

Add these to your `.env` file:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# Token Encryption (Generate with: openssl rand -hex 32)
GOOGLE_TOKEN_ENCRYPTION_KEY=your_64_character_hex_encryption_key_here

# Client URL for OAuth redirects
CLIENT_URL=http://localhost:3000  # Your frontend URL

# MongoDB (if not already configured)
MONGODB_URI=mongodb://localhost:27017/followthrough
```

### 3. Generate Encryption Key

Generate a secure encryption key for token storage:

```bash
# Generate a 64-character hex key
openssl rand -hex 32

# Example output (use your own):
# a1b2c3d4e5f6789abcdef123456789abcdef123456789abcdef123456789abcdef
```

---

## 📦 Module Integration

### 1. Import GoogleOAuthModule

Add to your main application module:

```typescript
// src/app.module.ts
import { GoogleOAuthModule } from './integrations/google/google-oauth.module';

@Module({
  imports: [
    // ... other modules
    GoogleOAuthModule, // Add Google OAuth module
  ],
  // ...
})
export class AppModule {}
```

### 2. Use in Feature Modules

For email triage or meeting analysis:

```typescript
// src/email/email.module.ts
import { GoogleOAuthModule } from '../integrations/google/google-oauth.module';

@Module({
  imports: [
    GoogleOAuthModule, // Import for Gmail access
    // ... other modules
  ],
  // ...
})
export class EmailModule {}
```

---

## 🔗 Frontend Integration

### 1. OAuth Flow Endpoints

#### Get Authorization URL
```javascript
// GET /auth/google/authorize
// Requires: JWT authentication
const response = await fetch('/auth/google/authorize', {
  headers: {
    'Authorization': `Bearer ${userJwtToken}`,
  },
});

const { authUrl } = await response.json();
// Redirect user to authUrl
window.location.href = authUrl;
```

#### Check Connection Status
```javascript
// GET /auth/google/status
const response = await fetch('/auth/google/status', {
  headers: {
    'Authorization': `Bearer ${userJwtToken}`,
  },
});

const status = await response.json();
// {
//   success: true,
//   isConnected: true,
//   expiresAt: "2024-12-25T10:30:00Z",
//   needsRefresh: false,
//   googleEmail: "user@gmail.com",
//   userInfo: { ... }
// }
```

#### Revoke Access
```javascript
// DELETE /auth/google/revoke
await fetch('/auth/google/revoke', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${userJwtToken}`,
  },
});
```

### 2. Handle OAuth Callback

The OAuth callback is handled server-side. Users will be redirected to:
```
http://localhost:3000/dashboard?google_auth_success=true&email=user@gmail.com
```

Or on error:
```
http://localhost:3000/dashboard?google_auth_error=callback_failed
```

---

## 🔧 Using Google APIs

### 1. Gmail Integration

```typescript
// src/email/email.service.ts
import { GmailService } from '../integrations/google/services/gmail.service';
import { GoogleAuthGuard } from '../integrations/google/guards/google-auth.guard';

@Injectable()
export class EmailService {
  constructor(private gmailService: GmailService) {}

  async getUnreadEmails(userId: string) {
    return this.gmailService.getUnreadEmails(userId, 50);
  }

  async sendReply(userId: string, originalMessageId: string, replyText: string) {
    const originalMessage = await this.gmailService.getMessage(userId, originalMessageId);
    
    return this.gmailService.sendEmail(userId, {
      to: 'recipient@example.com',
      subject: `Re: ${originalMessage.payload.headers.find(h => h.name === 'Subject')?.value}`,
      textBody: replyText,
      inReplyTo: originalMessageId,
    });
  }
}
```

### 2. Protected Routes

```typescript
// src/email/email.controller.ts
import { GoogleAuthGuard } from '../integrations/google/guards/google-auth.guard';

@Controller('api/email')
export class EmailController {
  
  @Get('gmail/messages')
  @UseGuards(AuthGuard('jwt'), GoogleAuthGuard) // Requires both JWT and Google auth
  async getGmailMessages(@Req() req) {
    const userId = req.user.id;
    // req.googleClient is now available (set by GoogleAuthGuard)
    return this.emailService.getGmailMessages(userId);
  }
}
```

---

## ⚡ Background Jobs (Optional)

### 1. Token Refresh Cron Job

```typescript
// src/tasks/google-token-refresh.task.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GoogleOAuthService } from '../integrations/google/services/google-oauth.service';

@Injectable()
export class GoogleTokenRefreshTask {
  constructor(private googleOAuthService: GoogleOAuthService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async refreshExpiringTokens() {
    await this.googleOAuthService.refreshExpiringTokens();
  }
}
```

### 2. Token Cleanup Cron Job

```typescript
// src/tasks/google-token-cleanup.task.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserGoogleTokensRepository } from '../database/repositories/user-google-tokens.repository';

@Injectable()
export class GoogleTokenCleanupTask {
  constructor(private tokenRepository: UserGoogleTokensRepository) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldTokens() {
    await this.tokenRepository.cleanupOldTokens();
  }
}
```

---

## 🧪 Testing

### 1. Basic Connection Test

```bash
# Start your server
npm run start:dev

# Test OAuth flow (requires browser)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/auth/google/authorize

# Test connection status
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/auth/google/status

# Test Google connection
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/auth/google/test
```

### 2. Database Verification

```javascript
// Check MongoDB for encrypted tokens
db.user_google_tokens.find().pretty()

// Should show:
// {
//   userId: ObjectId("..."),
//   accessTokenEncrypted: "encrypted_base64_string",
//   googleEmail: "user@gmail.com",
//   expiresAt: ISODate("..."),
//   isActive: true
// }
```

---

## 🚨 Security Considerations

### Production Checklist
- [ ] Use HTTPS in production
- [ ] Set secure encryption key (never commit to git)
- [ ] Configure proper CORS settings
- [ ] Set up rate limiting
- [ ] Monitor token usage and failures
- [ ] Implement proper error handling
- [ ] Set up alerts for failed token refreshes

### Environment Security
```bash
# .env file should never be committed
echo ".env" >> .gitignore

# Use environment-specific configuration
# Development: .env.development
# Production: .env.production
```

---

## 📊 Monitoring

### Key Metrics to Monitor
- Token refresh success/failure rates
- API call latencies and error rates
- User connection status
- Database query performance

### Health Check Endpoint
```typescript
@Get('health/google')
async checkGoogleIntegration() {
  const stats = await this.userGoogleTokensRepository.getTokenStats();
  return {
    totalActiveTokens: stats.totalActiveTokens,
    tokensExpiringSoon: stats.tokensExpiringSoon,
    tokensExpiredButActive: stats.tokensExpiredButActive,
  };
}
```

---

## 🎯 Next Steps

1. **Set up Google Cloud credentials** following step 1
2. **Configure environment variables** with your values
3. **Test the OAuth flow** with a test user
4. **Integrate with email triage** using GmailService
5. **Add background jobs** for token management
6. **Monitor and optimize** based on usage patterns

The Google OAuth integration is now ready for production use with enterprise-grade security and scalability! 🚀 