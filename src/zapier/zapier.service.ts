import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ZapierApiKeyRepository, CreateZapierApiKeyParams, ZapierApiKeyStats } from "../database/repositories/zapier-api-key.repository";
import { ZapierApiKeyDocument } from "../database/schemas/zapier-api-key.schema";

export interface GenerateApiKeyParams {
  userId: string;
  name: string;
  description?: string;
  permissions?: string[];
  expiresAt?: Date;
}

@Injectable()
export class ZapierService {
  private readonly logger = new Logger(ZapierService.name);

  constructor(
    private configService: ConfigService,
    private zapierApiKeyRepository: ZapierApiKeyRepository,
  ) {}

  /**
   * Validates an API key and records usage
   */
  async validateApiKey(apiKey: string, ipAddress?: string): Promise<boolean> {
    try {
      const zapierApiKey = await this.zapierApiKeyRepository.validateApiKey(apiKey);
      
      if (!zapierApiKey) {
        this.logger.warn(`Invalid API key attempted: ${apiKey.substring(0, 8)}...`);
        return false;
      }

      // Record usage asynchronously (don't wait for it)
      this.zapierApiKeyRepository.recordUsage(apiKey, ipAddress).catch(error => {
        this.logger.error(`Failed to record API key usage: ${error.message}`);
      });

      return true;
    } catch (error) {
      this.logger.error(`Error validating API key: ${error.message}`);
      return false;
    }
  }

  /**
   * Gets user ID associated with an API key
   */
  async getUserIdFromApiKey(apiKey: string): Promise<string> {
    const zapierApiKey = await this.zapierApiKeyRepository.validateApiKey(apiKey);
    
    if (!zapierApiKey) {
      throw new UnauthorizedException("Invalid API key");
    }

    return zapierApiKey.userId.toString();
  }

  /**
   * Gets full API key document (for detailed operations)
   */
  async getApiKeyDocument(apiKey: string): Promise<ZapierApiKeyDocument | null> {
    return this.zapierApiKeyRepository.validateApiKey(apiKey);
  }

  /**
   * Generates a new API key for a user
   */
  async generateApiKey(params: GenerateApiKeyParams): Promise<{ apiKey: string; keyId: string; displayKey: string }> {
    this.logger.log(`Generating new API key for user ${params.userId}: ${params.name}`);
    
    try {
      const createParams: CreateZapierApiKeyParams = {
        userId: params.userId,
        name: params.name,
        description: params.description,
        permissions: params.permissions || ['email:process'],
        expiresAt: params.expiresAt,
      };

      const { apiKey, document } = await this.zapierApiKeyRepository.createApiKey(createParams);
      
      this.logger.log(`API key generated successfully for user ${params.userId}: ${document.keyPrefix}...`);
      
      return {
        apiKey, // Full API key (only returned once)
        keyId: (document._id as any).toString(),
        displayKey: document.displayKey, // Masked version for display
      };
    } catch (error) {
      this.logger.error(`Failed to generate API key for user ${params.userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Revokes an API key
   */
  async revokeApiKey(apiKey: string, userId?: string): Promise<boolean> {
    try {
      const result = await this.zapierApiKeyRepository.revokeApiKey(apiKey, userId);
      
      if (result) {
        this.logger.log(`API key revoked: ${apiKey.substring(0, 8)}...`);
      } else {
        this.logger.warn(`Failed to revoke API key: ${apiKey.substring(0, 8)}...`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Error revoking API key: ${error.message}`);
      return false;
    }
  }

  /**
   * Revokes an API key by ID (safer for UI operations)
   */
  async revokeApiKeyById(keyId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.zapierApiKeyRepository.revokeApiKeyById(keyId, userId);
      
      if (result) {
        this.logger.log(`API key revoked by ID: ${keyId} for user: ${userId}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Error revoking API key by ID: ${error.message}`);
      return false;
    }
  }

  /**
   * Lists all API keys for a user (returns safe data without hashes)
   */
  async listApiKeysForUser(userId: string): Promise<ZapierApiKeyDocument[]> {
    try {
      return this.zapierApiKeyRepository.getApiKeysForUser(userId);
    } catch (error) {
      this.logger.error(`Error listing API keys for user ${userId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Update API key metadata
   */
  async updateApiKey(keyId: string, userId: string, updates: { name?: string; description?: string; permissions?: string[] }): Promise<ZapierApiKeyDocument | null> {
    try {
      const result = await this.zapierApiKeyRepository.updateApiKey(keyId, userId, updates);
      
      if (result) {
        this.logger.log(`API key updated: ${keyId} for user: ${userId}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Error updating API key: ${error.message}`);
      return null;
    }
  }

  /**
   * Get API key statistics for a user
   */
  async getApiKeyStats(userId: string): Promise<ZapierApiKeyStats> {
    try {
      return this.zapierApiKeyRepository.getApiKeyStats(userId);
    } catch (error) {
      this.logger.error(`Error getting API key stats for user ${userId}: ${error.message}`);
      return {
        totalKeys: 0,
        activeKeys: 0,
        totalUsage: 0,
      };
    }
  }

  /**
   * Get count of active API keys (for monitoring)
   */
  async getActiveKeyCount(): Promise<number> {
    try {
      // This would require a new repository method for global stats
      // For now, return 0 as a placeholder
      return 0;
    } catch (error) {
      this.logger.error(`Error getting active key count: ${error.message}`);
      return 0;
    }
  }

  /**
   * Clean up expired API keys (should be called by a cron job)
   */
  async cleanupExpiredKeys(): Promise<number> {
    try {
      return this.zapierApiKeyRepository.cleanupExpiredKeys();
    } catch (error) {
      this.logger.error(`Error cleaning up expired keys: ${error.message}`);
      return 0;
    }
  }

  /**
   * Handles incoming webhook from Zapier
   */
  async handleWebhook(payload: any, event: string): Promise<any> {
    this.logger.log(`Received webhook for event: ${event}`);
    this.logger.debug("Webhook payload:", payload);

    // Process webhook based on event type
    switch (event) {
      case "task.created":
        return this.handleTaskCreated(payload);
      case "meeting.scheduled":
        return this.handleMeetingScheduled(payload);
      default:
        this.logger.warn(`Unknown webhook event: ${event}`);
        return { status: "error", message: `Unknown event type: ${event}` };
    }
  }

  private async handleTaskCreated(payload: any): Promise<any> {
    // Implement task creation logic
    this.logger.log("Processing task creation", payload);
    return { status: "success", message: "Task received" };
  }

  private async handleMeetingScheduled(payload: any): Promise<any> {
    // Implement meeting scheduling logic
    this.logger.log("Processing meeting scheduling", payload);
    return { status: "success", message: "Meeting received" };
  }
}
