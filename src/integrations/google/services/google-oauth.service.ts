import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, Auth } from 'googleapis';
import { UserGoogleTokensRepository, CreateGoogleTokensParams } from '../../../database/repositories/user-google-tokens.repository';
import { TokenEncryptionService } from './token-encryption.service';

export interface GoogleUserInfo {
  googleUserId: string;
  googleEmail: string;
  googleName?: string;
  googlePicture?: string;
  emailVerified?: boolean;
}

export interface GoogleOAuthTokens {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expires_in?: number;
  expiry_date?: number;
}

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);
  private readonly oauth2Client: Auth.OAuth2Client;
  private readonly requiredScopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
  ];

  constructor(
    private configService: ConfigService,
    private userGoogleTokensRepository: UserGoogleTokensRepository,
    private tokenEncryptionService: TokenEncryptionService,
  ) {
    // Initialize OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.get<string>('GOOGLE_REDIRECT_URI'),
    );

    // Validate required configuration
    this.validateConfiguration();
  }

  /**
   * Generate OAuth authorization URL for a user
   */
  generateAuthUrl(userId: string): string {
    this.logger.log(`Generating OAuth URL for user: ${userId}`);

    try {
      // Generate secure state parameter
      const state = this.tokenEncryptionService.generateSecureState(userId);

      // Generate OAuth URL
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline', // Required for refresh tokens
        scope: this.requiredScopes,
        state,
        prompt: 'consent', // Force consent screen to get refresh token
        include_granted_scopes: true,
      });

      this.logger.log(`OAuth URL generated for user: ${userId}`);
      return authUrl;
    } catch (error) {
      this.logger.error(`Failed to generate OAuth URL for user ${userId}:`, error);
      throw new Error('Failed to generate OAuth URL');
    }
  }

  /**
   * Handle OAuth callback and store tokens
   */
  async handleCallback(code: string, state: string): Promise<{ userId: string; userInfo: GoogleUserInfo }> {
    this.logger.log('Processing OAuth callback');

    try {
      // Validate state parameter
      const { userId } = this.tokenEncryptionService.validateState(state);

      // Exchange authorization code for tokens
      const { tokens } = await this.oauth2Client.getToken(code);
      this.logger.log(`Tokens received for user: ${userId}`);

      // Set credentials to get user info
      this.oauth2Client.setCredentials(tokens);

      // Get user information
      const userInfo = await this.getUserInfo();
      this.logger.log(`User info retrieved: ${userInfo.googleEmail}`);

      // Store tokens securely
      await this.storeTokens(userId, tokens as GoogleOAuthTokens, userInfo);

      return { userId, userInfo };
    } catch (error) {
      this.logger.error('OAuth callback processing failed:', error);
      throw new Error('OAuth callback processing failed');
    }
  }

  /**
   * Check if user is connected to Google
   */
  async isConnected(userId: string): Promise<boolean> {
    return this.userGoogleTokensRepository.hasValidTokens(userId);
  }

  /**
   * Get Google user info for a connected user
   */
  async getGoogleUserInfo(userId: string): Promise<GoogleUserInfo | null> {
    const userInfo = await this.userGoogleTokensRepository.getGoogleUserInfo(userId);
    
    if (!userInfo) {
      return null;
    }

    return {
      googleUserId: '', // We'll get this from the stored data if needed
      googleEmail: userInfo.googleEmail,
      googleName: userInfo.googleName,
      googlePicture: userInfo.googlePicture,
    };
  }

  /**
   * Get authenticated OAuth2 client for a user
   */
  async getAuthenticatedClient(userId: string): Promise<Auth.OAuth2Client> {
    const tokenData = await this.userGoogleTokensRepository.getTokensWithDecryption(userId);
    
    if (!tokenData) {
      throw new UnauthorizedException('User not connected to Google');
    }

    // Check if token needs refresh
    if (tokenData.tokens.expiresSoon && tokenData.refreshToken) {
      this.logger.log(`Refreshing tokens for user: ${userId}`);
      await this.refreshTokens(userId);
      // Get updated tokens
      const updatedTokenData = await this.userGoogleTokensRepository.getTokensWithDecryption(userId);
      if (!updatedTokenData) {
        throw new UnauthorizedException('Token refresh failed');
      }
      tokenData.accessToken = updatedTokenData.accessToken;
    }

    // Create new client instance with user tokens
    const client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.get<string>('GOOGLE_REDIRECT_URI'),
    );

    client.setCredentials({
      access_token: tokenData.accessToken,
      refresh_token: tokenData.refreshToken,
    });

    // Record token usage
    this.userGoogleTokensRepository.recordTokenUsage(userId);

    return client;
  }

  /**
   * Refresh tokens for a user
   */
  async refreshTokens(userId: string): Promise<void> {
    this.logger.log(`Refreshing tokens for user: ${userId}`);

    try {
      const tokenData = await this.userGoogleTokensRepository.getTokensWithDecryption(userId);
      
      if (!tokenData || !tokenData.refreshToken) {
        throw new Error('No refresh token available');
      }

      // Set refresh token and refresh
      this.oauth2Client.setCredentials({
        refresh_token: tokenData.refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('No access token received from refresh');
      }

      // Calculate expiry date
      const expiresAt = credentials.expiry_date 
        ? new Date(credentials.expiry_date)
        : new Date((Date.now() + 3600) * 1000);

      // Update stored tokens
      await this.userGoogleTokensRepository.updateTokens(userId, {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || undefined, // May be undefined
        expiresAt,
        tokenType: credentials.token_type || undefined,
      });

      this.logger.log(`Tokens refreshed successfully for user: ${userId}`);
    } catch (error) {
      this.logger.error(`Token refresh failed for user ${userId}:`, error);
      
      // If refresh fails, the tokens may be invalid
      // Consider revoking them or marking as inactive
      await this.userGoogleTokensRepository.revokeTokens(userId);
      throw new UnauthorizedException('Token refresh failed - please reconnect to Google');
    }
  }

  /**
   * Revoke Google access for a user
   */
  async revokeAccess(userId: string): Promise<void> {
    this.logger.log(`Revoking Google access for user: ${userId}`);

    try {
      const tokenData = await this.userGoogleTokensRepository.getTokensWithDecryption(userId);
      
      if (tokenData) {
        // Revoke tokens with Google
        try {
          await this.oauth2Client.revokeToken(tokenData.accessToken);
        } catch (error) {
          // Log but don't fail if Google revocation fails
          this.logger.warn(`Google token revocation failed for user ${userId}:`, error);
        }
      }

      // Remove tokens from our database
      await this.userGoogleTokensRepository.revokeTokens(userId);
      
      this.logger.log(`Google access revoked for user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to revoke Google access for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get current token status for a user
   */
  async getTokenStatus(userId: string): Promise<{
    isConnected: boolean;
    expiresAt?: Date;
    needsRefresh?: boolean;
    scopes?: string[];
    googleEmail?: string;
  }> {
    const tokenMetadata = await this.userGoogleTokensRepository.getTokenMetadata(userId);
    
    if (!tokenMetadata) {
      return { isConnected: false };
    }

    return {
      isConnected: true,
      expiresAt: tokenMetadata.expiresAt,
      needsRefresh: tokenMetadata.expiresSoon,
      scopes: tokenMetadata.scope,
      googleEmail: tokenMetadata.googleEmail,
    };
  }

  /**
   * Background task: Refresh expiring tokens
   */
  async refreshExpiringTokens(): Promise<void> {
    this.logger.log('Starting background token refresh');

    try {
      const expiringTokens = await this.userGoogleTokensRepository.getUsersWithExpiringTokens();
      
      this.logger.log(`Found ${expiringTokens.length} users with expiring tokens`);

      for (const tokenDoc of expiringTokens) {
        try {
          await this.refreshTokens(tokenDoc.userId.toString());
        } catch (error) {
          this.logger.error(`Background refresh failed for user ${tokenDoc.userId}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Background token refresh failed:', error);
    }
  }

  /**
   * Private: Get user information from Google
   */
  private async getUserInfo(): Promise<GoogleUserInfo> {
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const response = await oauth2.userinfo.get();
      
      const userInfo = response.data;
      
      return {
        googleUserId: userInfo.id!,
        googleEmail: userInfo.email!,
        googleName: userInfo.name || undefined,
        googlePicture: userInfo.picture || undefined,
        emailVerified: userInfo.verified_email || undefined,
      };
    } catch (error) {
      this.logger.error('Failed to get user info from Google:', error);
      throw new Error('Failed to get user information from Google');
    }
  }

  /**
   * Private: Store tokens securely
   */
  private async storeTokens(userId: string, tokens: GoogleOAuthTokens, userInfo: GoogleUserInfo): Promise<void> {
    // Calculate expiry date
    const expiresAt = tokens.expiry_date 
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

    // Parse scopes
    const scopes = tokens.scope ? tokens.scope.split(' ') : this.requiredScopes;

    const createParams: CreateGoogleTokensParams = {
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scope: scopes,
      googleUserId: userInfo.googleUserId,
      googleEmail: userInfo.googleEmail,
      googleName: userInfo.googleName,
      googlePicture: userInfo.googlePicture,
      tokenType: tokens.token_type || 'Bearer',
    };

    await this.userGoogleTokensRepository.createTokens(createParams);
  }

  /**
   * Private: Validate required configuration
   */
  private validateConfiguration(): void {
    const requiredConfig = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET', 
      'GOOGLE_REDIRECT_URI',
      'GOOGLE_TOKEN_ENCRYPTION_KEY',
    ];

    for (const config of requiredConfig) {
      if (!this.configService.get<string>(config)) {
        throw new Error(`Missing required configuration: ${config}`);
      }
    }
  }
} 