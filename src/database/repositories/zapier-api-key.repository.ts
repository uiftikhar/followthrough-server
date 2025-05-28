import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ZapierApiKey, ZapierApiKeyDocument } from '../schemas/zapier-api-key.schema';
import * as crypto from 'crypto';

export interface CreateZapierApiKeyParams {
  userId: string;
  name: string;
  description?: string;
  permissions?: string[];
  expiresAt?: Date;
}

export interface ZapierApiKeyStats {
  totalKeys: number;
  activeKeys: number;
  totalUsage: number;
  lastUsed?: Date;
}

@Injectable()
export class ZapierApiKeyRepository {
  private readonly logger = new Logger(ZapierApiKeyRepository.name);

  constructor(
    @InjectModel(ZapierApiKey.name)
    private readonly zapierApiKeyModel: Model<ZapierApiKeyDocument>,
  ) {}

  /**
   * Generate a new API key and store it securely
   */
  async createApiKey(params: CreateZapierApiKeyParams): Promise<{ apiKey: string; document: ZapierApiKeyDocument }> {
    this.logger.log(`Creating new API key for user: ${params.userId}`);

    // Generate a cryptographically secure API key
    const apiKey = this.generateSecureApiKey();
    const keyHash = this.hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 8); // Store prefix for identification

    const zapierApiKey = new this.zapierApiKeyModel({
      userId: new Types.ObjectId(params.userId),
      keyHash,
      keyPrefix,
      name: params.name,
      description: params.description,
      permissions: params.permissions || ['email:process'],
      expiresAt: params.expiresAt,
      isActive: true,
      usageCount: 0,
    });

    const savedDocument = await zapierApiKey.save();
    
    this.logger.log(`API key created successfully: ${keyPrefix}...`);
    
    return {
      apiKey, // Return the actual key only once
      document: savedDocument,
    };
  }

  /**
   * Validate an API key and return associated user info
   */
  async validateApiKey(apiKey: string): Promise<ZapierApiKeyDocument | null> {
    if (!apiKey || !apiKey.startsWith('zapier_')) {
      return null;
    }

    const keyHash = this.hashApiKey(apiKey);
    
    const zapierApiKey = await this.zapierApiKeyModel.findOne({
      keyHash,
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    }).populate('userId').exec();

    return zapierApiKey;
  }

  /**
   * Record API key usage
   */
  async recordUsage(apiKey: string, ipAddress?: string): Promise<void> {
    const keyHash = this.hashApiKey(apiKey);
    
    await this.zapierApiKeyModel.updateOne(
      { keyHash, isActive: true },
      {
        $inc: { usageCount: 1 },
        $set: {
          lastUsedAt: new Date(),
          lastUsedFromIp: ipAddress,
        },
      }
    ).exec();
  }

  /**
   * Get all API keys for a user
   */
  async getApiKeysForUser(userId: string): Promise<ZapierApiKeyDocument[]> {
    return this.zapierApiKeyModel.find({
      userId: new Types.ObjectId(userId),
      isActive: true,
    })
    .sort({ createdAt: -1 })
    .select('-keyHash') // Don't return the hash
    .exec();
  }

  /**
   * Revoke (deactivate) an API key
   */
  async revokeApiKey(apiKey: string, userId?: string): Promise<boolean> {
    const keyHash = this.hashApiKey(apiKey);
    
    const filter: any = { keyHash };
    if (userId) {
      filter.userId = new Types.ObjectId(userId);
    }

    const result = await this.zapierApiKeyModel.updateOne(
      filter,
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
        },
      }
    ).exec();

    const success = result.modifiedCount > 0;
    if (success) {
      this.logger.log(`API key revoked: ${apiKey.substring(0, 8)}...`);
    }
    
    return success;
  }

  /**
   * Revoke API key by ID (safer for UI operations)
   */
  async revokeApiKeyById(keyId: string, userId: string): Promise<boolean> {
    const result = await this.zapierApiKeyModel.updateOne(
      {
        _id: new Types.ObjectId(keyId),
        userId: new Types.ObjectId(userId),
      },
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
        },
      }
    ).exec();

    return result.modifiedCount > 0;
  }

  /**
   * Update API key metadata
   */
  async updateApiKey(keyId: string, userId: string, updates: Partial<Pick<ZapierApiKey, 'name' | 'description' | 'permissions'>>): Promise<ZapierApiKeyDocument | null> {
    return this.zapierApiKeyModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(keyId),
        userId: new Types.ObjectId(userId),
        isActive: true,
      },
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
        },
      },
      { new: true }
    )
    .select('-keyHash')
    .exec();
  }

  /**
   * Get API key statistics for a user
   */
  async getApiKeyStats(userId: string): Promise<ZapierApiKeyStats> {
    const stats = await this.zapierApiKeyModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
        },
      },
      {
        $group: {
          _id: null,
          totalKeys: { $sum: 1 },
          activeKeys: {
            $sum: {
              $cond: [{ $eq: ['$isActive', true] }, 1, 0],
            },
          },
          totalUsage: { $sum: '$usageCount' },
          lastUsed: { $max: '$lastUsedAt' },
        },
      },
    ]).exec();

    if (!stats || stats.length === 0) {
      return {
        totalKeys: 0,
        activeKeys: 0,
        totalUsage: 0,
      };
    }

    return stats[0];
  }

  /**
   * Clean up expired API keys (called by cron job)
   */
  async cleanupExpiredKeys(): Promise<number> {
    const result = await this.zapierApiKeyModel.updateMany(
      {
        expiresAt: { $lt: new Date() },
        isActive: true,
      },
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
        },
      }
    ).exec();

    if (result.modifiedCount > 0) {
      this.logger.log(`Cleaned up ${result.modifiedCount} expired API keys`);
    }

    return result.modifiedCount;
  }

  /**
   * Find API key by prefix (for identification in logs)
   */
  async findByPrefix(prefix: string): Promise<ZapierApiKeyDocument | null> {
    return this.zapierApiKeyModel.findOne({
      keyPrefix: prefix,
      isActive: true,
    })
    .select('-keyHash')
    .exec();
  }

  /**
   * Private helper: Generate a secure API key
   */
  private generateSecureApiKey(): string {
    // Generate 32 bytes of random data and convert to hex
    const randomBytes = crypto.randomBytes(32).toString('hex');
    return `zapier_${randomBytes}`;
  }

  /**
   * Private helper: Hash an API key for storage
   */
  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }
} 