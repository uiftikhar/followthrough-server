import { registerAs } from '@nestjs/config';

export default registerAs('zapier', () => ({
  apiKeyPrefix: process.env.ZAPIER_API_KEY_PREFIX || 'zapier_',
  webhookTimeoutMs: parseInt(process.env.ZAPIER_WEBHOOK_TIMEOUT_MS || '30000', 10),
  maxApiKeysPerUser: parseInt(process.env.ZAPIER_MAX_API_KEYS_PER_USER || '5', 10),
  baseUrl: process.env.ZAPIER_BASE_URL || 'https://your-api-domain.com',
})); 