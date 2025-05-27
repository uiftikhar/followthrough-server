# FollowThrough AI Zapier Integration - Deployment Guide

This guide walks you through deploying the FollowThrough AI Zapier integration to the Zapier platform.

## Prerequisites

1. **Zapier CLI installed**:
   ```bash
   npm install -g zapier-platform-cli
   ```

2. **Zapier Developer Account**: Sign up at [developer.zapier.com](https://developer.zapier.com)

3. **FollowThrough AI Server**: Ensure your server is running and accessible

4. **Google OAuth Credentials**: Set up OAuth 2.0 credentials in Google Cloud Console

## Environment Setup

### 1. Configure Environment Variables

Create a `.env` file in the package root:

```bash
# FollowThrough AI Server
FOLLOWTHROUGH_API_URL=https://your-server.com
FOLLOWTHROUGH_API_KEY=your-api-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://zapier.com/dashboard/auth/oauth/return/App123456CLIAPI/

# Zapier
ZAPIER_DEPLOY_KEY=your-zapier-deploy-key
```

### 2. Update Package Configuration

Update `.zapierapprc` with your app details:

```json
{
  "id": 123456,
  "key": "followthrough-ai-integration"
}
```

## Pre-Deployment Steps

### 1. Install Dependencies

```bash
cd zapier-packages/followthrough-ai-integration
npm install
```

### 2. Run Tests

```bash
npm test
```

### 3. Validate Package

```bash
zapier validate
```

### 4. Test Authentication

```bash
zapier test --auth
```

## Deployment Process

### 1. Login to Zapier CLI

```bash
zapier login
```

### 2. Create New App (First Time Only)

```bash
zapier register "FollowThrough AI Integration"
```

This will create a new app and update your `.zapierapprc` file.

### 3. Deploy to Zapier

```bash
# Deploy to development environment
zapier push

# Deploy specific version
zapier push --version=1.0.0
```

### 4. Test the Integration

```bash
# Test triggers
zapier test --trigger=new_email

# Test actions
zapier test --action=triggerEmailTriage

# Test creates
zapier test --create=draftReply

# Test searches
zapier test --search=findEmails
```

## Server-Side Requirements

Ensure your FollowThrough AI server has these endpoints:

### Authentication Endpoints
- `GET /oauth/google/authorize` - OAuth authorization
- `POST /oauth/google/token` - Token exchange
- `GET /oauth/google/test` - Authentication test

### Email Endpoints
- `GET /api/gmail/messages` - Get emails
- `POST /api/gmail/send` - Send emails
- `POST /api/gmail/subscribe` - Subscribe to webhooks
- `DELETE /api/gmail/unsubscribe/:id` - Unsubscribe from webhooks

### Calendar Endpoints
- `GET /api/calendar/events` - Get calendar events
- `POST /api/calendar/events` - Create calendar events
- `POST /api/calendar/subscribe` - Subscribe to webhooks
- `DELETE /api/calendar/unsubscribe/:id` - Unsubscribe from webhooks

### AI Processing Endpoints
- `POST /api/zapier/webhooks/email` - Email triage
- `POST /api/zapier/webhooks/meeting` - Meeting analysis
- `POST /api/zapier/draft-reply` - Generate draft replies
- `POST /api/zapier/extract-tasks` - Extract tasks from emails

## Publishing to Zapier App Directory

### 1. Prepare for Review

1. **Complete App Information**:
   - App description
   - Logo (256x256 PNG)
   - Screenshots
   - Help documentation

2. **Test Thoroughly**:
   ```bash
   zapier test
   zapier validate
   ```

3. **Create Sample Zaps**:
   - Email triage workflow
   - Meeting analysis workflow
   - Task extraction workflow

### 2. Submit for Review

```bash
# Promote to public
zapier promote 1.0.0
```

### 3. App Review Process

Zapier will review your app for:
- Functionality
- User experience
- Security
- Documentation quality

## Monitoring and Maintenance

### 1. Monitor Usage

```bash
# View app analytics
zapier logs

# Monitor specific operations
zapier logs --type=trigger --operation=new_email
```

### 2. Update the App

```bash
# Deploy new version
zapier push --version=1.1.0

# Migrate users to new version
zapier migrate 1.0.0 1.1.0
```

### 3. Handle Issues

```bash
# View error logs
zapier logs --status=error

# Debug specific issues
zapier logs --user=user@example.com
```

## Security Considerations

### 1. API Key Management
- Use environment variables for sensitive data
- Rotate API keys regularly
- Implement rate limiting

### 2. OAuth Security
- Use HTTPS for all endpoints
- Validate OAuth tokens
- Implement proper scope restrictions

### 3. Data Privacy
- Follow GDPR/CCPA requirements
- Implement data retention policies
- Secure data transmission

## Troubleshooting

### Common Issues

1. **Authentication Failures**:
   ```bash
   # Check OAuth configuration
   zapier test --auth
   
   # Verify server endpoints
   curl -X GET "https://your-server.com/oauth/google/test"
   ```

2. **API Errors**:
   ```bash
   # Check server logs
   zapier logs --status=error
   
   # Test specific endpoints
   zapier test --action=triggerEmailTriage
   ```

3. **Webhook Issues**:
   ```bash
   # Verify webhook subscriptions
   zapier logs --type=hook
   
   # Test webhook endpoints
   curl -X POST "https://your-server.com/api/gmail/subscribe"
   ```

### Debug Mode

Enable debug logging:

```bash
export LOG_LEVEL=debug
zapier test --debug
```

## Support and Documentation

### User Documentation
- Create comprehensive help docs
- Provide setup tutorials
- Include troubleshooting guides

### Developer Resources
- API documentation
- Code examples
- Integration guides

### Support Channels
- Email support
- Community forums
- GitHub issues

## Performance Optimization

### 1. Caching
- Implement response caching
- Use Redis for session storage
- Cache OAuth tokens

### 2. Rate Limiting
- Implement API rate limits
- Use exponential backoff
- Queue heavy operations

### 3. Monitoring
- Set up application monitoring
- Track API response times
- Monitor error rates

## Compliance

### 1. Data Protection
- GDPR compliance
- Data encryption
- Secure data deletion

### 2. API Standards
- RESTful API design
- Proper HTTP status codes
- Consistent error responses

### 3. Zapier Requirements
- Follow Zapier platform guidelines
- Implement required webhooks
- Provide proper error handling

## Next Steps

After successful deployment:

1. **User Onboarding**: Create tutorials and guides
2. **Feature Expansion**: Add more triggers and actions
3. **Integration Partners**: Connect with other platforms
4. **Analytics**: Track usage and optimize performance
5. **Community**: Build user community and support

For additional help, refer to:
- [Zapier Platform Documentation](https://platform.zapier.com/docs)
- [FollowThrough AI API Documentation](https://docs.followthrough.ai)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2) 