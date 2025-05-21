# Zapier Integration Module

This module provides the necessary components to integrate your NestJS application with Zapier.

## Features

- API Key management
- Webhook handling
- Integration with Zapier's Web Builder

## Architecture

The module consists of the following components:

- **ZapierModule**: The main module that exports all Zapier functionality
- **ZapierService**: Core service for API key management and webhook handling
- **ZapierController**: Controller for managing API keys
- **WebhookController**: Controller for handling incoming webhooks from Zapier
- **TriggerController**: Controller for providing triggers data to Zapier
- **ZapierApiKeyGuard**: Guard for securing endpoints with API key authentication

## Configuration

Add the following variables to your .env file:

```
ZAPIER_API_KEY_PREFIX=zapier_
ZAPIER_WEBHOOK_TIMEOUT_MS=30000
ZAPIER_MAX_API_KEYS_PER_USER=5
ZAPIER_BASE_URL=https://your-api-domain.com
```

## Usage

1. Import the ZapierModule in your AppModule:

```typescript
import { ZapierModule } from './zapier/zapier.module';

@Module({
  imports: [
    // ... other modules
    ZapierModule,
  ],
})
export class AppModule {}
```

2. Generate an API key for a user:

```typescript
// In your service
constructor(private zapierService: ZapierService) {}

generateApiKeyForUser(userId: string) {
  return this.zapierService.generateApiKey(userId);
}
```

3. Handle webhooks from Zapier:

```typescript
// This is already handled by the WebhookController
// You can customize the webhook handling in ZapierService
```

## Extending

See the detailed guides in the `nestjs-server/guides/zapier-integration/` directory:

- **README.md**: General guide for setting up the Zapier integration
- **DEVELOPER.md**: Developer guide for extending the integration

## Security Considerations

- API keys are stored in memory, consider implementing a persistent storage solution for production
- Rate limiting is recommended for production deployments
- Consider implementing a more robust authentication mechanism like OAuth 2.0 for production 