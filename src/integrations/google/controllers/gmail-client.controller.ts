import { 
  Controller, 
  Get, 
  Post, 
  Delete,
  Body,
  Query,
  Req, 
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
  Param
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { Types } from 'mongoose';
import { GoogleOAuthService } from '../services/google-oauth.service';
import { GmailWatchService } from '../services/gmail-watch.service';
import { PubSubService } from '../services/pubsub.service';
import { GmailService } from '../services/gmail.service';
import { UnifiedWorkflowService } from '../../../langgraph/unified-workflow.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    [key: string]: any;
  };
}

interface TestEmailTriageDto {
  subject: string;
  from: string;
  body: string;
  to?: string;
}

interface SetupGmailNotificationsDto {
  labelIds?: string[];
  labelFilterBehavior?: 'INCLUDE' | 'EXCLUDE';
}

/**
 * Gmail Client Controller - Complete API for Gmail Push Notifications
 * 
 * This controller provides all endpoints needed for clients to:
 * 1. Complete OAuth flow with Google
 * 2. Set up Gmail push notifications 
 * 3. Test the complete workflow
 * 4. Monitor system health and status
 * 
 * Usage Flow:
 * 1. GET /gmail/client/auth-url - Get OAuth URL
 * 2. User completes OAuth flow 
 * 3. GET /gmail/client/status - Check connection status
 * 4. POST /gmail/client/setup-notifications - Enable push notifications
 * 5. POST /gmail/client/test-triage - Test email processing
 * 6. GET /gmail/client/health - Monitor system health
 */
@Controller('gmail/client')
export class GmailClientController {
  private readonly logger = new Logger(GmailClientController.name);

  constructor(
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly gmailWatchService: GmailWatchService,
    private readonly pubSubService: PubSubService,
    private readonly gmailService: GmailService,
    private readonly unifiedWorkflowService: UnifiedWorkflowService,
  ) {}

  /**
   * Get Google OAuth authorization URL
   * Step 1: Client calls this to get OAuth URL for user
   */
  @Get('auth-url')
  @UseGuards(AuthGuard('jwt'))
  async getAuthUrl(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;
      const authUrl = this.googleOAuthService.generateAuthUrl(userId);

      this.logger.log(`OAuth URL generated for user: ${userId}`);

      return {
        success: true,
        authUrl,
        message: 'Redirect user to this URL to authorize Google access',
        instructions: 'After user completes OAuth, call /gmail/client/status to verify connection',
      };
    } catch (error) {
      this.logger.error('Failed to generate OAuth URL:', error);
      throw new HttpException(
        'Failed to generate OAuth URL',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get comprehensive connection and notification status
   * Step 2: Client calls this after OAuth to verify setup
   */
  @Get('status')
  @UseGuards(AuthGuard('jwt'))
  async getStatus(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;
      
      // Get OAuth status
      const oauthStatus = await this.googleOAuthService.getTokenStatus(userId);
      
      let userInfo: any = null;
      let watchInfo: any = null;
      
      if (oauthStatus.isConnected) {
        // Get Google user info
        userInfo = await this.googleOAuthService.getGoogleUserInfo(userId);
        
        // Get Gmail watch status
        watchInfo = await this.gmailWatchService.getWatchInfo(new Types.ObjectId(userId));
      }

      // Get overall system health
      const systemHealth = await this.getSystemHealth();

      return {
        success: true,
        oauth: {
          isConnected: oauthStatus.isConnected,
          userInfo,
        },
        notifications: {
          isEnabled: !!watchInfo?.isActive,
          watchInfo,
        },
        system: systemHealth,
        nextSteps: this.getNextSteps(oauthStatus.isConnected, !!watchInfo?.isActive),
      };
    } catch (error) {
      this.logger.error('Failed to get status:', error);
      throw new HttpException(
        'Failed to get status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Set up Gmail push notifications
   * Step 3: Client calls this to enable notifications after OAuth
   */
  @Post('setup-notifications')
  @UseGuards(AuthGuard('jwt'))
  async setupNotifications(
    @Req() req: AuthenticatedRequest,
    @Body() setupDto: SetupGmailNotificationsDto = {},
  ) {
    try {
      const userId = req.user.id;
      
      // Check if user is connected
      const isConnected = await this.googleOAuthService.isConnected(userId);
      if (!isConnected) {
        throw new HttpException(
          'User not connected to Google. Please complete OAuth first.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check if user already has an active watch
      const existingWatch = await this.gmailWatchService.getWatchInfo(new Types.ObjectId(userId));
      if (existingWatch && existingWatch.isActive) {
        return {
          success: true,
          message: 'Gmail notifications already enabled',
          watchInfo: existingWatch,
          nextSteps: ['Send a test email to trigger processing', 'Use POST /gmail/client/test-triage for immediate testing'],
        };
      }

      // Create new Gmail watch
      const watchInfo = await this.gmailWatchService.createWatch({
        userId: new Types.ObjectId(userId),
        labelIds: setupDto.labelIds || ['INBOX'],
        labelFilterBehavior: setupDto.labelFilterBehavior || 'INCLUDE',
      });

      this.logger.log(`Gmail notifications setup for user: ${userId}`);

      return {
        success: true,
        message: 'Gmail notifications enabled successfully',
        watchInfo,
        nextSteps: [
          'Send an email to your Gmail inbox to test push notifications',
          'Use POST /gmail/client/test-triage to test email processing immediately',
          'Check GET /gmail/client/health for system monitoring',
        ],
      };
    } catch (error) {
      this.logger.error('Failed to setup Gmail notifications:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Failed to setup Gmail notifications',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test email triage functionality
   * Step 4: Client can use this to test the email processing workflow
   */
  @Post('test-triage')
  @UseGuards(AuthGuard('jwt'))
  async testEmailTriage(
    @Req() req: AuthenticatedRequest,
    @Body() testEmail: TestEmailTriageDto,
  ) {
    try {
      const userId = req.user.id;
      
      this.logger.log(`Testing email triage for user: ${userId}`);

      // Create test email data in the format expected by the triage system
      const triageInput = {
        type: "email_triage",
        emailData: {
          id: `test-${Date.now()}`,
          body: testEmail.body,
          metadata: {
            subject: testEmail.subject,
            from: testEmail.from,
            to: testEmail.to || req.user.email,
            timestamp: new Date().toISOString(),
            headers: {},
            gmailSource: false, // This is a test, not from Gmail
          },
        },
        sessionId: `test-gmail-${userId}-${Date.now()}`,
      };

      // Process through unified workflow service
      const result = await this.unifiedWorkflowService.processInput(
        triageInput,
        { 
          source: 'gmail_test',
          userId,
          testMode: true,
        },
        userId
      );

      this.logger.log(`Email triage test completed for user: ${userId}`);

      return {
        success: true,
        message: 'Email triage test completed successfully',
        sessionId: result.sessionId,
        status: result.status,
        testEmail: {
          subject: testEmail.subject,
          from: testEmail.from,
          preview: testEmail.body.substring(0, 100) + '...',
        },
        instructions: 'Check the session results in your dashboard or use the sessionId to track progress',
      };
    } catch (error) {
      this.logger.error('Failed to test email triage:', error);
      throw new HttpException(
        'Failed to test email triage',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Disable Gmail notifications
   */
  @Delete('disable-notifications')
  @UseGuards(AuthGuard('jwt'))
  async disableNotifications(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;
      
      const stopped = await this.gmailWatchService.stopWatch(new Types.ObjectId(userId));
      
      if (!stopped) {
        return {
          success: true,
          message: 'No active Gmail notifications found',
        };
      }

      this.logger.log(`Gmail notifications disabled for user: ${userId}`);

      return {
        success: true,
        message: 'Gmail notifications disabled successfully',
        nextSteps: ['Use POST /gmail/client/setup-notifications to re-enable'],
      };
    } catch (error) {
      this.logger.error('Failed to disable Gmail notifications:', error);
      throw new HttpException(
        'Failed to disable Gmail notifications',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get system health and statistics
   */
  @Get('health')
  async getHealth() {
    try {
      const health = await this.getSystemHealth();
      
      return {
        success: true,
        ...health,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        success: false,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get detailed watch statistics (admin endpoint)
   */
  @Get('statistics')
  @UseGuards(AuthGuard('jwt'))
  async getStatistics(@Req() req: AuthenticatedRequest) {
    try {
      const statistics = await this.gmailWatchService.getStatistics();
      const pubsubHealth = await this.pubSubService.getSubscriptionHealth();

      return {
        success: true,
        watches: statistics,
        pubsub: pubsubHealth,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get statistics:', error);
      throw new HttpException(
        'Failed to get statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Manual watch renewal (admin endpoint)
   */
  @Post('renew-watch')
  @UseGuards(AuthGuard('jwt'))
  async renewWatch(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.id;
      
      const existingWatch = await this.gmailWatchService.getWatchInfo(new Types.ObjectId(userId));
      if (!existingWatch) {
        throw new HttpException(
          'No Gmail watch found for user',
          HttpStatus.NOT_FOUND,
        );
      }

      const watchInfo = await this.gmailWatchService.renewWatch(existingWatch.watchId);

      this.logger.log(`Gmail watch renewed for user: ${userId}`);

      return {
        success: true,
        message: 'Gmail watch renewed successfully',
        watchInfo,
      };
    } catch (error) {
      this.logger.error('Failed to renew Gmail watch:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Failed to renew Gmail watch',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test Pub/Sub connection
   */
  @Post('test-pubsub')
  async testPubSubConnection() {
    try {
      const isHealthy = await this.pubSubService.testConnection();
      const subscriptionHealth = await this.pubSubService.getSubscriptionHealth();

      return {
        success: true,
        pubsub: {
          connected: isHealthy,
          subscriptions: subscriptionHealth,
        },
        message: isHealthy ? 'Pub/Sub connection is healthy' : 'Pub/Sub connection issues detected',
      };
    } catch (error) {
      this.logger.error('Pub/Sub test failed:', error);
      return {
        success: false,
        pubsub: {
          connected: false,
          error: error.message,
        },
        message: 'Pub/Sub connection test failed',
      };
    }
  }

  /**
   * Process pull messages manually (for testing)
   */
  @Post('process-pull-messages')
  async processPullMessages() {
    try {
      const notifications = await this.pubSubService.processPulledMessages();
      
      return {
        success: true,
        processed: notifications.length,
        notifications: notifications.map(n => ({
          emailAddress: n.emailAddress,
          historyId: n.historyId,
        })),
        message: `Processed ${notifications.length} pull messages`,
      };
    } catch (error) {
      this.logger.error('Failed to process pull messages:', error);
      throw new HttpException(
        'Failed to process pull messages',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get system health information
   */
  private async getSystemHealth(): Promise<any> {
    try {
      const [pubsubHealthy, subscriptionHealth, watchStats] = await Promise.all([
        this.pubSubService.testConnection(),
        this.pubSubService.getSubscriptionHealth(),
        this.gmailWatchService.getStatistics(),
      ]);

      return {
        status: pubsubHealthy ? 'healthy' : 'unhealthy',
        pubsub: {
          connected: pubsubHealthy,
          subscriptions: subscriptionHealth,
        },
        watches: watchStats,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  /**
   * Get next steps based on current state
   */
  private getNextSteps(isOAuthConnected: boolean, isNotificationsEnabled: boolean): string[] {
    if (!isOAuthConnected) {
      return [
        'Complete Google OAuth authorization using the auth-url endpoint',
        'After OAuth, call /gmail/client/status to verify connection',
      ];
    }

    if (!isNotificationsEnabled) {
      return [
        'Enable Gmail notifications using POST /gmail/client/setup-notifications',
        'Test the system using POST /gmail/client/test-triage',
      ];
    }

    return [
      'System is fully configured and ready',
      'Send emails to your Gmail inbox to test push notifications',
      'Use POST /gmail/client/test-triage to test email processing',
      'Monitor system health with GET /gmail/client/health',
    ];
  }
} 