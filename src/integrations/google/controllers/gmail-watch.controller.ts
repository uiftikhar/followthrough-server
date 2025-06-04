import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  Logger,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Types } from "mongoose";
import { JwtAuthGuard } from "../../../auth/guards/jwt-auth.guard";
import {
  GmailWatchService,
  CreateWatchParams,
  WatchInfo,
} from "../services/gmail-watch.service";
import { GmailNotificationService } from "../services/gmail-notification.service";
import { GmailShutdownService } from "../services/gmail-shutdown.service";

interface CreateWatchDto {
  labelIds?: string[];
  labelFilterBehavior?: "INCLUDE" | "EXCLUDE";
}

interface WatchStatusResponse {
  success: boolean;
  watch?: WatchInfo;
  message: string;
  activeSessions?: Map<string, number>;
}

@Controller("api/gmail/watch")
@UseGuards(JwtAuthGuard)
export class GmailWatchController {
  private readonly logger = new Logger(GmailWatchController.name);

  constructor(
    private readonly gmailWatchService: GmailWatchService,
    private readonly gmailNotificationService: GmailNotificationService,
    private readonly gmailShutdownService: GmailShutdownService,
  ) {}

  /**
   * Create a new Gmail watch for the authenticated user
   * POST /api/gmail/watch
   */
  @Post()
  async createWatch(
    @Body() createWatchDto: CreateWatchDto,
    @Request() req: any,
  ): Promise<WatchStatusResponse> {
    try {
      const userId = new Types.ObjectId(req.user.id);
      this.logger.log(`📡 Creating Gmail watch for user: ${userId}`);

      // Check if user already has an active watch
      const existingWatch = await this.gmailWatchService.getWatchInfo(userId);
      if (existingWatch && existingWatch.isActive) {
        this.logger.warn(`User ${userId} already has an active Gmail watch`);
        return {
          success: false,
          watch: existingWatch,
          message:
            "User already has an active Gmail watch. Use DELETE to remove it first.",
        };
      }

      // Create new watch
      const watchParams: CreateWatchParams = {
        userId,
        labelIds: createWatchDto.labelIds || ["INBOX"],
        labelFilterBehavior: createWatchDto.labelFilterBehavior || "INCLUDE",
      };

      const watch = await this.gmailWatchService.createWatch(watchParams);

      this.logger.log(
        `✅ Gmail watch created successfully for user: ${userId}, email: ${watch.googleEmail}`,
      );

      return {
        success: true,
        watch,
        message: "Gmail watch created successfully",
      };
    } catch (error) {
      this.logger.error(
        `Failed to create Gmail watch: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          message: `Failed to create Gmail watch: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get current watch status for the authenticated user
   * GET /api/gmail/watch
   */
  @Get()
  async getWatchStatus(@Request() req: any): Promise<WatchStatusResponse> {
    try {
      const userId = new Types.ObjectId(req.user.id);
      this.logger.log(`📊 Getting watch status for user: ${userId}`);

      const watch = await this.gmailWatchService.getWatchInfo(userId);

      if (!watch) {
        return {
          success: true,
          message: "No active Gmail watch found for user",
        };
      }

      // Get active sessions for this user
      const activeSessions =
        await this.gmailNotificationService.getActiveUserSessions();

      return {
        success: true,
        watch,
        message: "Watch status retrieved successfully",
        activeSessions,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get watch status: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          message: `Failed to get watch status: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete/stop Gmail watch for the authenticated user
   * DELETE /api/gmail/watch
   */
  @Delete()
  async stopWatch(@Request() req: any): Promise<WatchStatusResponse> {
    try {
      const userId = new Types.ObjectId(req.user.id);
      this.logger.log(`🛑 Stopping Gmail watch for user: ${userId}`);

      const stopped = await this.gmailWatchService.stopWatch(userId);

      if (stopped) {
        this.logger.log(
          `✅ Gmail watch stopped successfully for user: ${userId}`,
        );
        return {
          success: true,
          message: "Gmail watch stopped successfully",
        };
      } else {
        return {
          success: false,
          message: "No active Gmail watch found to stop",
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to stop Gmail watch: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          message: `Failed to stop Gmail watch: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Renew an existing Gmail watch for the authenticated user
   * POST /api/gmail/watch/renew
   */
  @Post("renew")
  async renewWatch(@Request() req: any): Promise<WatchStatusResponse> {
    try {
      const userId = new Types.ObjectId(req.user.id);
      this.logger.log(`🔄 Renewing Gmail watch for user: ${userId}`);

      // Get current watch
      const currentWatch = await this.gmailWatchService.getWatchInfo(userId);
      if (!currentWatch) {
        return {
          success: false,
          message: "No active Gmail watch found to renew",
        };
      }

      const renewedWatch = await this.gmailWatchService.renewWatch(
        currentWatch.watchId,
      );

      this.logger.log(
        `✅ Gmail watch renewed successfully for user: ${userId}`,
      );

      return {
        success: true,
        watch: renewedWatch,
        message: "Gmail watch renewed successfully",
      };
    } catch (error) {
      this.logger.error(
        `Failed to renew Gmail watch: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          message: `Failed to renew Gmail watch: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ADMIN: Get all active user sessions (for monitoring and debugging)
   * GET /api/gmail/watch/sessions
   */
  @Get("sessions")
  async getActiveSessions(@Request() req: any): Promise<{
    success: boolean;
    sessions: Map<string, number>;
    totalUsers: number;
    totalConnections: number;
  }> {
    try {
      // Note: In production, add admin role check here
      this.logger.log(
        `📊 Getting all active sessions (requested by: ${req.user.id})`,
      );

      const sessions =
        await this.gmailNotificationService.getActiveUserSessions();
      const totalUsers = sessions.size;
      const totalConnections = Array.from(sessions.values()).reduce(
        (sum, count) => sum + count,
        0,
      );

      return {
        success: true,
        sessions,
        totalUsers,
        totalConnections,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get active sessions: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          message: `Failed to get active sessions: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ADMIN: Force cleanup of inactive sessions
   * POST /api/gmail/watch/cleanup
   */
  @Post("cleanup")
  async forceCleanup(@Request() req: any): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // Note: In production, add admin role check here
      this.logger.log(`🧹 Force cleanup requested by: ${req.user.id}`);

      await this.gmailNotificationService.forceCleanupInactiveSessions();

      return {
        success: true,
        message: "Inactive sessions cleanup completed",
      };
    } catch (error) {
      this.logger.error(
        `Failed to force cleanup: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          message: `Failed to force cleanup: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ADMIN: Manually trigger Gmail watch shutdown cleanup
   * POST /api/gmail/watch/shutdown-cleanup
   */
  @Post("shutdown-cleanup")
  async manualShutdownCleanup(@Request() req: any): Promise<{
    success: boolean;
    message: string;
    result?: {
      totalWatches: number;
      successfullyStopped: number;
      failed: number;
      errors: string[];
    };
  }> {
    try {
      // Note: In production, add admin role check here
      this.logger.log(
        `🛑 Manual shutdown cleanup requested by: ${req.user.id}`,
      );

      if (!this.gmailShutdownService.isCleanupEnabled()) {
        return {
          success: false,
          message:
            "Gmail watch cleanup is disabled. Set GOOGLE_REMOVE_ACTIVE_WATCHERS=true to enable.",
        };
      }

      const result = await this.gmailShutdownService.triggerManualCleanup();

      return {
        success: true,
        message: `Manual shutdown cleanup completed. Stopped ${result.successfullyStopped}/${result.totalWatches} watches.`,
        result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to perform manual shutdown cleanup: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          message: `Failed to perform manual shutdown cleanup: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ADMIN: Get shutdown cleanup status and configuration
   * GET /api/gmail/watch/shutdown-status
   */
  @Get("shutdown-status")
  async getShutdownStatus(@Request() req: any): Promise<{
    success: boolean;
    cleanupEnabled: boolean;
    message: string;
  }> {
    try {
      // Note: In production, add admin role check here
      this.logger.log(`📊 Shutdown status requested by: ${req.user.id}`);

      const cleanupEnabled = this.gmailShutdownService.isCleanupEnabled();

      return {
        success: true,
        cleanupEnabled,
        message: cleanupEnabled
          ? "Gmail watch cleanup on shutdown is ENABLED"
          : "Gmail watch cleanup on shutdown is DISABLED (set GOOGLE_REMOVE_ACTIVE_WATCHERS=true to enable)",
      };
    } catch (error) {
      this.logger.error(
        `Failed to get shutdown status: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          message: `Failed to get shutdown status: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
