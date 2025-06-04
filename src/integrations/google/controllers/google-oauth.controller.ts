import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Response } from "express";
import { Types } from "mongoose";
import { GoogleOAuthService } from "../services/google-oauth.service";
import { GmailWatchService } from "../services/gmail-watch.service";

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    [key: string]: any;
  };
}

interface SetupEmailNotificationsDto {
  labelIds?: string[];
  labelFilterBehavior?: "INCLUDE" | "EXCLUDE";
}

@Controller("oauth/google")
export class GoogleOAuthController {
  private readonly logger = new Logger(GoogleOAuthController.name);

  constructor(
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly gmailWatchService: GmailWatchService,
  ) {}

  /**
   * Get Google OAuth authorization URL
   * Requires JWT authentication
   */
  @Get("authorize")
  @UseGuards(AuthGuard("jwt"))
  async authorize(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;
      const authUrl = this.googleOAuthService.generateAuthUrl(userId);

      this.logger.log(`OAuth URL generated for user: ${userId}`);

      return {
        success: true,
        authUrl,
        message: "Redirect user to this URL to authorize Google access",
      };
    } catch (error) {
      this.logger.error("Failed to generate OAuth URL:", error);
      throw new HttpException(
        "Failed to generate OAuth URL",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Handle OAuth callback from Google
   * This endpoint receives the authorization code
   */
  @Get("callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") error: string,
    @Res() res: Response,
  ) {
    try {
      // Check for OAuth errors
      if (error) {
        this.logger.warn(`OAuth error received: ${error}`);
        return res.redirect(
          `${process.env.CLIENT_URL}/dashboard?google_auth_error=${error}`,
        );
      }

      // Validate required parameters
      if (!code || !state) {
        this.logger.warn("Missing code or state in OAuth callback");
        return res.redirect(
          `${process.env.CLIENT_URL}/dashboard?google_auth_error=missing_parameters`,
        );
      }

      // Process the OAuth callback
      const result = await this.googleOAuthService.handleCallback(code, state);

      this.logger.log(`OAuth callback successful for user: ${result.userId}`);

      // Redirect to success page
      return res.redirect(
        `${process.env.CLIENT_URL}/dashboard?google_auth_success=true&email=${encodeURIComponent(result.userInfo.googleEmail)}`,
      );
    } catch (error) {
      this.logger.error("OAuth callback processing failed:", error);

      const errorMessage = error.message.includes("expired")
        ? "oauth_expired"
        : "callback_failed";

      return res.redirect(
        `${process.env.CLIENT_URL}/dashboard?google_auth_error=${errorMessage}`,
      );
    }
  }

  /**
   * Get Google OAuth connection status
   * Requires JWT authentication
   */
  @Get("status")
  @UseGuards(AuthGuard("jwt"))
  async getStatus(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;
      this.logger.log("********* status **********", req.user);
      const status = await this.googleOAuthService.getTokenStatus(userId);

      let userInfo: any = null;
      if (status.isConnected) {
        userInfo = await this.googleOAuthService.getGoogleUserInfo(userId);
      }

      return {
        success: true,
        ...status,
        userInfo,
      };
    } catch (error) {
      this.logger.error("Failed to get OAuth status:", error);
      throw new HttpException(
        "Failed to get OAuth status",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Revoke Google OAuth access
   * Requires JWT authentication
   */
  @Delete("revoke")
  @UseGuards(AuthGuard("jwt"))
  async revoke(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;
      await this.googleOAuthService.revokeAccess(userId);

      this.logger.log(`Google access revoked for user: ${userId}`);

      return {
        success: true,
        message: "Google access revoked successfully",
      };
    } catch (error) {
      this.logger.error("Failed to revoke Google access:", error);
      throw new HttpException(
        "Failed to revoke Google access",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Manually refresh tokens (for testing/admin purposes)
   * Requires JWT authentication
   */
  @Post("refresh")
  @UseGuards(AuthGuard("jwt"))
  async refreshTokens(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;

      // Check if user is connected first
      const isConnected = await this.googleOAuthService.isConnected(userId);
      if (!isConnected) {
        throw new HttpException(
          "User not connected to Google",
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.googleOAuthService.refreshTokens(userId);

      this.logger.log(`Tokens refreshed for user: ${userId}`);

      return {
        success: true,
        message: "Tokens refreshed successfully",
      };
    } catch (error) {
      this.logger.error("Failed to refresh tokens:", error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        "Failed to refresh tokens",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test Google connection (makes a simple API call)
   * Requires JWT authentication
   */
  @Get("test")
  @UseGuards(AuthGuard("jwt"))
  async testConnection(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;

      // Check if user is connected
      const isConnected = await this.googleOAuthService.isConnected(userId);
      if (!isConnected) {
        return {
          success: false,
          message: "User not connected to Google",
          isConnected: false,
        };
      }

      // Get authenticated client and test it
      const client =
        await this.googleOAuthService.getAuthenticatedClient(userId);

      // Make a simple API call to test the connection
      const oauth2 = google.oauth2({ version: "v2", auth: client });
      const response = await oauth2.userinfo.get();

      this.logger.log(`Google connection test successful for user: ${userId}`);

      return {
        success: true,
        message: "Google connection is working",
        isConnected: true,
        testResult: {
          email: response.data.email,
          name: response.data.name,
          verified: response.data.verified_email,
        },
      };
    } catch (error) {
      this.logger.error("Google connection test failed:", error);

      return {
        success: false,
        message: "Google connection test failed",
        isConnected: false,
        error: error.message,
      };
    }
  }

  /**
   * Setup Gmail email notifications (create watch)
   * Requires JWT authentication
   */
  @Post("setup-email-notifications")
  @UseGuards(AuthGuard("jwt"))
  async setupEmailNotifications(
    @Req() req: AuthenticatedRequest,
    @Body() setupDto: SetupEmailNotificationsDto = {},
  ) {
    try {
      const userId = req.user.id;

      // Check if user is connected
      const isConnected = await this.googleOAuthService.isConnected(userId);
      if (!isConnected) {
        throw new HttpException(
          "User not connected to Google",
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check if user already has an active watch
      const existingWatch = await this.gmailWatchService.getWatchInfo(
        new Types.ObjectId(userId),
      );
      if (existingWatch && existingWatch.isActive) {
        this.logger.log(
          `Terminatiing existing watch: ${userId}, ${existingWatch}`,
        );
        const stopped = await this.gmailWatchService.stopWatch(
          new Types.ObjectId(userId),
        );
        this.logger.log(`Stopped watch successfully: ${stopped}`);
        // return {
        //   success: true,
        //   message: 'Gmail notifications already enabled',
        //   watchInfo: existingWatch,
        // };
      }

      // Create new Gmail watch
      const watchInfo = await this.gmailWatchService.createWatch({
        userId: new Types.ObjectId(userId),
        labelIds: setupDto.labelIds || ["INBOX"],
        labelFilterBehavior: setupDto.labelFilterBehavior || "INCLUDE",
      });

      this.logger.log(`Gmail notifications setup for user: ${userId}`);

      return {
        success: true,
        message: "Gmail notifications enabled successfully",
        watchInfo,
      };
    } catch (error) {
      this.logger.error("Failed to setup Gmail notifications:", error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        "Failed to setup Gmail notifications",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get Gmail notification status
   * Requires JWT authentication
   */
  @Get("email-notification-status")
  @UseGuards(AuthGuard("jwt"))
  async getEmailNotificationStatus(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;

      const watchInfo = await this.gmailWatchService.getWatchInfo(
        new Types.ObjectId(userId),
      );

      return {
        success: true,
        isEnabled: !!watchInfo?.isActive,
        watchInfo,
      };
    } catch (error) {
      this.logger.error("Failed to get email notification status:", error);
      throw new HttpException(
        "Failed to get email notification status",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Disable Gmail email notifications (stop watch)
   * Requires JWT authentication
   */
  @Delete("disable-email-notifications")
  @UseGuards(AuthGuard("jwt"))
  async disableEmailNotifications(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;

      const stopped = await this.gmailWatchService.stopWatch(
        new Types.ObjectId(userId),
      );

      if (!stopped) {
        return {
          success: true,
          message: "No active Gmail notifications found",
        };
      }

      this.logger.log(`Gmail notifications disabled for user: ${userId}`);

      return {
        success: true,
        message: "Gmail notifications disabled successfully",
      };
    } catch (error) {
      this.logger.error("Failed to disable Gmail notifications:", error);
      throw new HttpException(
        "Failed to disable Gmail notifications",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Renew Gmail watch (manual renewal)
   * Requires JWT authentication
   */
  @Post("renew-email-notifications")
  @UseGuards(AuthGuard("jwt"))
  async renewEmailNotifications(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;

      // Get existing watch
      const existingWatch = await this.gmailWatchService.getWatchInfo(
        new Types.ObjectId(userId),
      );
      if (!existingWatch) {
        throw new HttpException(
          "No Gmail watch found for user",
          HttpStatus.NOT_FOUND,
        );
      }

      // Renew the watch
      const watchInfo = await this.gmailWatchService.renewWatch(
        existingWatch.watchId,
      );

      this.logger.log(`Gmail watch renewed for user: ${userId}`);

      return {
        success: true,
        message: "Gmail notifications renewed successfully",
        watchInfo,
      };
    } catch (error) {
      this.logger.error("Failed to renew Gmail notifications:", error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        "Failed to renew Gmail notifications",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get Gmail watch statistics (admin endpoint)
   * Requires JWT authentication
   */
  @Get("watch-statistics")
  @UseGuards(AuthGuard("jwt"))
  async getWatchStatistics(@Req() req: AuthenticatedRequest) {
    try {
      const statistics = await this.gmailWatchService.getStatistics();

      return {
        success: true,
        statistics,
      };
    } catch (error) {
      this.logger.error("Failed to get watch statistics:", error);
      throw new HttpException(
        "Failed to get watch statistics",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

// Import google here to avoid circular dependency issues
import { google } from "googleapis";
