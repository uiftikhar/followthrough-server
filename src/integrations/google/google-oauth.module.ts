import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

// Schemas
import { UserGoogleTokens, UserGoogleTokensSchema } from '../../database/schemas/user-google-tokens.schema';

// Repositories
import { UserGoogleTokensRepository } from '../../database/repositories/user-google-tokens.repository';

// Services
import { TokenEncryptionService } from './services/token-encryption.service';
import { GoogleOAuthService } from './services/google-oauth.service';

// Controllers
import { GoogleOAuthController } from './controllers/google-oauth.controller';

// Guards
import { GoogleAuthGuard } from './guards/google-auth.guard';

/**
 * GoogleOAuthModule - Server-side Google OAuth integration
 * 
 * This module provides:
 * - Secure token storage with encryption
 * - OAuth flow management (authorization, callback, refresh)
 * - Authenticated Google API client factory
 * - Integration guards for protected routes
 * 
 * Usage:
 * 1. Import this module in other feature modules
 * 2. Use GoogleOAuthService to get authenticated clients
 * 3. Use GoogleAuthGuard to protect Google API endpoints
 * 4. Use GoogleOAuthController endpoints for frontend integration
 */
@Module({
  imports: [
    ConfigModule, // For Google OAuth configuration
    MongooseModule.forFeature([
      { name: UserGoogleTokens.name, schema: UserGoogleTokensSchema },
    ]),
  ],
  controllers: [
    GoogleOAuthController, // OAuth flow endpoints
  ],
  providers: [
    // Core services
    TokenEncryptionService,
    GoogleOAuthService,
    
    // Repository
    UserGoogleTokensRepository,
    
    // Guards
    GoogleAuthGuard,
  ],
  exports: [
    // Export services for use in other modules
    GoogleOAuthService,
    GoogleAuthGuard,
    UserGoogleTokensRepository,
    TokenEncryptionService,
  ],
})
export class GoogleOAuthModule {} 