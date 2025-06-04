import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

@Injectable()
export class TokenEncryptionService {
  private readonly logger = new Logger(TokenEncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly encryptionKey: Buffer;

  constructor(private configService: ConfigService) {
    const key = this.configService.get<string>('GOOGLE_TOKEN_ENCRYPTION_KEY');
    
    if (!key) {
      throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY is required for token encryption');
    }

    // Ensure key is 32 bytes for AES-256
    this.encryptionKey = crypto.scryptSync(key, 'salt', 32);
  }

  /**
   * Encrypt sensitive token data using AES-256-GCM
   */
  encrypt(plaintext: string): string {
    try {
      if (!plaintext) {
        throw new Error('Cannot encrypt empty or null data');
      }

      // Generate random IV for each encryption
      const iv = crypto.randomBytes(16);
      
      // Create cipher with IV
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      cipher.setAAD(Buffer.from('google-oauth-token', 'utf8'));

      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Combine IV, authTag, and encrypted data
      const result: EncryptedData = {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
      };

      // Return as base64 encoded JSON
      return Buffer.from(JSON.stringify(result)).toString('base64');
    } catch (error) {
      this.logger.error('Token encryption failed', error);
      throw new Error('Token encryption failed');
    }
  }

  /**
   * Decrypt token data using AES-256-GCM
   */
  decrypt(encryptedData: string): string {
    try {
      if (!encryptedData) {
        throw new Error('Cannot decrypt empty or null data');
      }

      // Parse encrypted data
      const data: EncryptedData = JSON.parse(
        Buffer.from(encryptedData, 'base64').toString('utf8')
      );

      // Create decipher with IV
      const decipher = crypto.createDecipheriv(
        this.algorithm, 
        this.encryptionKey, 
        Buffer.from(data.iv, 'hex')
      );
      decipher.setAAD(Buffer.from('google-oauth-token', 'utf8'));
      decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));

      // Decrypt the data
      let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Token decryption failed', error);
      throw new Error('Token decryption failed - token may be corrupted');
    }
  }

  /**
   * Securely compare two encrypted tokens without decrypting
   */
  compareEncrypted(encrypted1: string, encrypted2: string): boolean {
    try {
      // Use crypto.timingSafeEqual to prevent timing attacks
      const buffer1 = Buffer.from(encrypted1, 'base64');
      const buffer2 = Buffer.from(encrypted2, 'base64');
      
      if (buffer1.length !== buffer2.length) {
        return false;
      }
      
      return crypto.timingSafeEqual(buffer1, buffer2);
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate a secure state parameter for OAuth
   */
  generateSecureState(userId: string): string {
    try {
      const timestamp = Date.now().toString();
      const randomBytes = crypto.randomBytes(16).toString('hex');
      const payload = `${userId}:${timestamp}:${randomBytes}`;
      
      // Create HMAC for integrity
      const hmac = crypto.createHmac('sha256', this.encryptionKey);
      hmac.update(payload);
      const signature = hmac.digest('hex');
      
      const stateData = {
        payload,
        signature,
      };
      
      return Buffer.from(JSON.stringify(stateData)).toString('base64url');
    } catch (error) {
      this.logger.error('State generation failed', error);
      throw new Error('Failed to generate secure state');
    }
  }

  /**
   * Validate and extract data from OAuth state parameter
   */
  validateState(state: string): { userId: string; timestamp: number } {
    try {
      if (!state) {
        throw new Error('State parameter is required');
      }

      // Parse state data
      const stateData = JSON.parse(
        Buffer.from(state, 'base64url').toString('utf8')
      );

      // Verify HMAC signature
      const hmac = crypto.createHmac('sha256', this.encryptionKey);
      hmac.update(stateData.payload);
      const expectedSignature = hmac.digest('hex');

      if (!crypto.timingSafeEqual(
        Buffer.from(stateData.signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      )) {
        throw new Error('Invalid state signature');
      }

      // Parse payload
      const [userId, timestampStr] = stateData.payload.split(':');
      const timestamp = parseInt(timestampStr, 10);

      // Check if state is not too old (30 minutes)
      const maxAge = 30 * 60 * 1000; // 30 minutes
      if (Date.now() - timestamp > maxAge) {
        throw new Error('State parameter has expired');
      }

      return { userId, timestamp };
    } catch (error) {
      this.logger.error('State validation failed', error);
      throw new Error('Invalid or expired state parameter');
    }
  }

  /**
   * Create a secure hash of sensitive data for logging/comparison
   */
  createSecureHash(data: string): string {
    return crypto
      .createHmac('sha256', this.encryptionKey)
      .update(data)
      .digest('hex')
      .substring(0, 8); // First 8 characters for identification
  }
} 