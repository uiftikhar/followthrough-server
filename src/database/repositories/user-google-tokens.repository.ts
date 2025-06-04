import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  UserGoogleTokens,
  UserGoogleTokensDocument,
} from "../schemas/user-google-tokens.schema";
import { TokenEncryptionService } from "../../integrations/google/services/token-encryption.service";

export interface CreateGoogleTokensParams {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope: string[];
  googleUserId: string;
  googleEmail: string;
  googleName?: string;
  googlePicture?: string;
  tokenType?: string;
}

export interface UpdateGoogleTokensParams {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope?: string[];
  tokenType?: string;
}

export interface GoogleTokensWithDecrypted {
  tokens: UserGoogleTokensDocument;
  accessToken: string;
  refreshToken?: string;
}

@Injectable()
export class UserGoogleTokensRepository {
  private readonly logger = new Logger(UserGoogleTokensRepository.name);

  constructor(
    @InjectModel(UserGoogleTokens.name)
    private readonly userGoogleTokensModel: Model<UserGoogleTokensDocument>,
    private readonly tokenEncryptionService: TokenEncryptionService,
  ) {}

  /**
   * Store new Google tokens for a user
   */
  async createTokens(
    params: CreateGoogleTokensParams,
  ): Promise<UserGoogleTokensDocument> {
    this.logger.log(`Creating Google tokens for user: ${params.userId}`);

    try {
      // Encrypt tokens before storage
      const accessTokenEncrypted = this.tokenEncryptionService.encrypt(
        params.accessToken,
      );
      const refreshTokenEncrypted = params.refreshToken
        ? this.tokenEncryptionService.encrypt(params.refreshToken)
        : undefined;

      // Create or update user tokens (upsert)
      const tokenData = await this.userGoogleTokensModel.findOneAndUpdate(
        { userId: new Types.ObjectId(params.userId) },
        {
          accessTokenEncrypted,
          refreshTokenEncrypted,
          expiresAt: params.expiresAt,
          scope: params.scope,
          googleUserId: params.googleUserId,
          googleEmail: params.googleEmail,
          googleName: params.googleName,
          googlePicture: params.googlePicture,
          tokenType: params.tokenType || "Bearer",
          isActive: true,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );

      this.logger.log(
        `Google tokens created/updated for user: ${params.userId}`,
      );
      return tokenData;
    } catch (error) {
      this.logger.error(
        `Failed to create Google tokens for user ${params.userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get decrypted tokens for a user
   */
  async getTokensWithDecryption(
    userId: string,
  ): Promise<GoogleTokensWithDecrypted | null> {
    try {
      const tokenDoc = await this.userGoogleTokensModel.findOne({
        userId: new Types.ObjectId(userId),
        isActive: true,
      });

      if (!tokenDoc) {
        return null;
      }

      // Decrypt tokens
      const accessToken = this.tokenEncryptionService.decrypt(
        tokenDoc.accessTokenEncrypted,
      );
      const refreshToken = tokenDoc.refreshTokenEncrypted
        ? this.tokenEncryptionService.decrypt(tokenDoc.refreshTokenEncrypted)
        : undefined;

      return {
        tokens: tokenDoc,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      this.logger.error(`Failed to get tokens for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get token metadata without decryption (for status checks)
   */
  async getTokenMetadata(
    userId: string,
  ): Promise<UserGoogleTokensDocument | null> {
    return this.userGoogleTokensModel
      .findOne({
        userId: new Types.ObjectId(userId),
        isActive: true,
      })
      .select("-accessTokenEncrypted -refreshTokenEncrypted");
  }

  /**
   * Update tokens after refresh
   */
  async updateTokens(
    userId: string,
    params: UpdateGoogleTokensParams,
  ): Promise<UserGoogleTokensDocument | null> {
    this.logger.log(`Updating Google tokens for user: ${userId}`);

    try {
      // Encrypt new tokens
      const accessTokenEncrypted = this.tokenEncryptionService.encrypt(
        params.accessToken,
      );
      const refreshTokenEncrypted = params.refreshToken
        ? this.tokenEncryptionService.encrypt(params.refreshToken)
        : undefined;

      const updateData: any = {
        accessTokenEncrypted,
        expiresAt: params.expiresAt,
        tokenType: params.tokenType || "Bearer",
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      };

      // Only update refresh token if provided
      if (refreshTokenEncrypted) {
        updateData.refreshTokenEncrypted = refreshTokenEncrypted;
      }

      // Only update scope if provided
      if (params.scope) {
        updateData.scope = params.scope;
      }

      const tokenData = await this.userGoogleTokensModel.findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          isActive: true,
        },
        updateData,
        { new: true },
      );

      if (tokenData) {
        this.logger.log(`Google tokens updated for user: ${userId}`);
      }

      return tokenData;
    } catch (error) {
      this.logger.error(
        `Failed to update Google tokens for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Record token usage for analytics
   */
  async recordTokenUsage(userId: string): Promise<void> {
    try {
      await this.userGoogleTokensModel.updateOne(
        {
          userId: new Types.ObjectId(userId),
          isActive: true,
        },
        {
          lastUsedAt: new Date(),
        },
      );
    } catch (error) {
      // Don't throw error for analytics failures
      this.logger.warn(
        `Failed to record token usage for user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Check if user has valid Google tokens
   */
  async hasValidTokens(userId: string): Promise<boolean> {
    try {
      const tokenDoc = await this.userGoogleTokensModel.findOne({
        userId: new Types.ObjectId(userId),
        isActive: true,
      });

      if (!tokenDoc) {
        return false;
      }

      // Check if token is expired or expires soon
      // If it expires soon, we'll need to refresh it
      return !tokenDoc.isExpired;
    } catch (error) {
      this.logger.error(
        `Failed to check token validity for user ${userId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Check if tokens need refresh (expire within 5 minutes)
   */
  async needsRefresh(userId: string): Promise<boolean> {
    try {
      const tokenDoc = await this.userGoogleTokensModel.findOne({
        userId: new Types.ObjectId(userId),
        isActive: true,
      });

      return tokenDoc ? tokenDoc.expiresSoon : false;
    } catch (error) {
      this.logger.error(
        `Failed to check refresh need for user ${userId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Revoke (deactivate) Google tokens for a user
   */
  async revokeTokens(userId: string): Promise<boolean> {
    this.logger.log(`Revoking Google tokens for user: ${userId}`);

    try {
      const result = await this.userGoogleTokensModel.updateOne(
        { userId: new Types.ObjectId(userId) },
        {
          isActive: false,
          updatedAt: new Date(),
        },
      );

      const success = result.modifiedCount > 0;
      if (success) {
        this.logger.log(`Google tokens revoked for user: ${userId}`);
      }

      return success;
    } catch (error) {
      this.logger.error(
        `Failed to revoke Google tokens for user ${userId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get all users with expiring tokens (for background refresh)
   */
  async getUsersWithExpiringTokens(): Promise<UserGoogleTokensDocument[]> {
    const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);

    return this.userGoogleTokensModel
      .find({
        isActive: true,
        expiresAt: { $lte: tenMinutesFromNow },
        refreshTokenEncrypted: { $exists: true, $ne: null },
      })
      .select("-accessTokenEncrypted -refreshTokenEncrypted");
  }

  /**
   * Clean up very old inactive tokens (housekeeping)
   */
  async cleanupOldTokens(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await this.userGoogleTokensModel.deleteMany({
      isActive: false,
      updatedAt: { $lt: thirtyDaysAgo },
    });

    if (result.deletedCount > 0) {
      this.logger.log(
        `Cleaned up ${result.deletedCount} old inactive Google tokens`,
      );
    }

    return result.deletedCount;
  }

  /**
   * Get Google user info by userId
   */
  async getGoogleUserInfo(userId: string): Promise<{
    googleEmail: string;
    googleName?: string;
    googlePicture?: string;
  } | null> {
    const tokenDoc = await this.userGoogleTokensModel
      .findOne({
        userId: new Types.ObjectId(userId),
        isActive: true,
      })
      .select("googleEmail googleName googlePicture");

    if (!tokenDoc) {
      return null;
    }

    return {
      googleEmail: tokenDoc.googleEmail,
      googleName: tokenDoc.googleName,
      googlePicture: tokenDoc.googlePicture,
    };
  }

  /**
   * Get statistics for monitoring
   */
  async getTokenStats(): Promise<{
    totalActiveTokens: number;
    tokensExpiringSoon: number;
    tokensExpiredButActive: number;
  }> {
    const now = new Date();
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    const [totalActive, expiringSoon, expired] = await Promise.all([
      this.userGoogleTokensModel.countDocuments({ isActive: true }),
      this.userGoogleTokensModel.countDocuments({
        isActive: true,
        expiresAt: { $lte: fiveMinutesFromNow, $gt: now },
      }),
      this.userGoogleTokensModel.countDocuments({
        isActive: true,
        expiresAt: { $lte: now },
      }),
    ]);

    return {
      totalActiveTokens: totalActive,
      tokensExpiringSoon: expiringSoon,
      tokensExpiredButActive: expired,
    };
  }
}
