import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GmailWatchService } from './gmail-watch.service';
import { PubSubService } from './pubsub.service';
import { GoogleOAuthService } from './google-oauth.service';

/**
 * Gmail Background Service - Handles automated tasks for Gmail Push Notifications
 * 
 * This service provides:
 * - Automatic watch renewal before expiration
 * - Health monitoring and alerting
 * - Error recovery and cleanup
 * - Statistics collection and reporting
 * - Background message processing
 * 
 * Scheduled Tasks:
 * - Every hour: Check for expiring watches and renew
 * - Every 6 hours: Process any pending pull messages
 * - Every day: Cleanup old error records and statistics
 * - Every week: Full system health check and reporting
 */
@Injectable()
export class GmailBackgroundService implements OnModuleInit {
  private readonly logger = new Logger(GmailBackgroundService.name);
  private isInitialized = false;

  constructor(
    private readonly gmailWatchService: GmailWatchService,
    private readonly pubSubService: PubSubService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.logger.log('Gmail Background Service initializing...');
    
    // Perform initial health check
    await this.performInitialHealthCheck();
    
    this.isInitialized = true;
    this.logger.log('Gmail Background Service initialized successfully');
  }

  /**
   * Hourly job: Check and renew expiring Gmail watches
   * Runs every hour at minute 0
   */
  @Cron('0 * * * *', {
    name: 'renewExpiringWatches',
    timeZone: 'UTC',
  })
  async renewExpiringWatches(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      this.logger.log('Starting scheduled watch renewal check');

      const result = await this.gmailWatchService.renewExpiringWatches();
      
      this.logger.log(
        `Watch renewal completed: ${result.renewed} renewed, ${result.failed} failed`
      );

      // Log warnings if there were failures
      if (result.failed > 0) {
        this.logger.warn(
          `${result.failed} watches failed to renew - manual intervention may be required`
        );
      }

      // Update metrics
      await this.recordMetrics('watch_renewal', {
        renewed: result.renewed,
        failed: result.failed,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error('Scheduled watch renewal failed:', error);
    }
  }

  /**
   * Every 6 hours: Process pending pull messages (backup processing)
   * Runs at 00:00, 06:00, 12:00, 18:00 UTC
   */
  @Cron('0 0,6,12,18 * * *', {
    name: 'processPendingPullMessages',
    timeZone: 'UTC',
  })
  async processPendingPullMessages(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      this.logger.log('Starting scheduled pull message processing');

      const notifications = await this.pubSubService.processPulledMessages();
      
      this.logger.log(
        `Processed ${notifications.length} pending pull messages`
      );

      // Update metrics
      await this.recordMetrics('pull_processing', {
        processed: notifications.length,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error('Scheduled pull message processing failed:', error);
    }
  }

  /**
   * Daily job: System health check and cleanup
   * Runs every day at 02:00 UTC
   */
  @Cron('0 2 * * *', {
    name: 'dailyHealthCheckAndCleanup',
    timeZone: 'UTC',
  })
  async dailyHealthCheckAndCleanup(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      this.logger.log('Starting daily health check and cleanup');

      // Perform comprehensive health check
      const healthCheck = await this.performComprehensiveHealthCheck();
      
      // Cleanup old error records (older than 7 days)
      await this.cleanupOldErrorRecords();
      
      // Generate daily report
      await this.generateDailyReport(healthCheck);

      this.logger.log('Daily health check and cleanup completed');

    } catch (error) {
      this.logger.error('Daily health check and cleanup failed:', error);
    }
  }

  /**
   * Weekly job: Full system analysis and reporting
   * Runs every Sunday at 03:00 UTC
   */
  @Cron('0 3 * * 0', {
    name: 'weeklySystemAnalysis',
    timeZone: 'UTC',
  })
  async weeklySystemAnalysis(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      this.logger.log('Starting weekly system analysis');

      const analysis = await this.performWeeklyAnalysis();
      
      this.logger.log('Weekly system analysis completed', {
        ...analysis,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error('Weekly system analysis failed:', error);
    }
  }

  /**
   * Manual trigger: Force renewal of all expiring watches
   */
  async forceRenewalCheck(): Promise<{
    renewed: number;
    failed: number;
    details: any[];
  }> {
    try {
      this.logger.log('Force renewal check triggered');

      const expiringWatches = await this.gmailWatchService.findWatchesNeedingRenewal();
      const details: any[] = [];
      let renewed = 0;
      let failed = 0;

      for (const watch of expiringWatches) {
        try {
          await this.gmailWatchService.renewWatch(watch.watchId);
          renewed++;
          details.push({
            watchId: watch.watchId,
            email: watch.googleEmail,
            status: 'success',
          });
        } catch (error) {
          failed++;
          details.push({
            watchId: watch.watchId,
            email: watch.googleEmail,
            status: 'failed',
            error: error.message,
          });
        }
      }

      this.logger.log(`Force renewal completed: ${renewed} renewed, ${failed} failed`);

      return { renewed, failed, details };
    } catch (error) {
      this.logger.error('Force renewal check failed:', error);
      throw error;
    }
  }

  /**
   * Manual trigger: Process all pending pull messages
   */
  async forcePullProcessing(): Promise<{
    processed: number;
    notifications: any[];
  }> {
    try {
      this.logger.log('Force pull processing triggered');

      const notifications = await this.pubSubService.processPulledMessages();
      
      this.logger.log(`Force pull processing completed: ${notifications.length} processed`);

      return {
        processed: notifications.length,
        notifications: notifications.map(n => ({
          emailAddress: n.emailAddress,
          historyId: n.historyId,
        })),
      };
    } catch (error) {
      this.logger.error('Force pull processing failed:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive system health status
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: any[];
    summary: any;
  }> {
    const checks: any[] = [];
    let healthyChecks = 0;
    let totalChecks = 0;

    try {
      // Check Pub/Sub connection
      totalChecks++;
      try {
        const pubsubHealthy = await this.pubSubService.testConnection();
        checks.push({
          name: 'PubSub Connection',
          status: pubsubHealthy ? 'healthy' : 'unhealthy',
          message: pubsubHealthy ? 'Connected' : 'Connection failed',
          timestamp: new Date().toISOString(),
        });
        if (pubsubHealthy) healthyChecks++;
      } catch (error) {
        checks.push({
          name: 'PubSub Connection',
          status: 'unhealthy',
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      }

      // Check subscription health
      totalChecks++;
      try {
        const subscriptionHealth = await this.pubSubService.getSubscriptionHealth();
        const isHealthy = subscriptionHealth.pushSubscription?.exists && subscriptionHealth.pullSubscription?.exists;
        checks.push({
          name: 'Subscriptions',
          status: isHealthy ? 'healthy' : 'degraded',
          details: subscriptionHealth,
          timestamp: new Date().toISOString(),
        });
        if (isHealthy) healthyChecks++;
      } catch (error) {
        checks.push({
          name: 'Subscriptions',
          status: 'unhealthy',
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      }

      // Check watch statistics with user context
      totalChecks++;
      try {
        const watchStats = await this.gmailWatchService.getStatistics();
        const hasActiveWatches = watchStats.totalActive > 0;
        const errorCount = watchStats.withErrors;
        
        let status = 'healthy';
        if (errorCount > 0 && errorCount > watchStats.totalActive * 0.1) {
          status = 'degraded'; // More than 10% error rate
        }
        if (!hasActiveWatches) {
          status = 'degraded'; // No active watches
        }

        checks.push({
          name: 'Gmail Watches',
          status,
          details: {
            ...watchStats,
            contextNote: 'Only processing watches for users with active sessions',
          },
          timestamp: new Date().toISOString(),
        });
        if (status === 'healthy') healthyChecks++;
        
        this.logger.log(`📊 Background service health check: ${watchStats.totalActive} active watches, ${errorCount} with errors`);
      } catch (error) {
        checks.push({
          name: 'Gmail Watches',
          status: 'unhealthy',
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      }

      // Determine overall health
      const healthRatio = healthyChecks / totalChecks;
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
      
      if (healthRatio >= 0.8) {
        overallStatus = 'healthy';
      } else if (healthRatio >= 0.5) {
        overallStatus = 'degraded';
      } else {
        overallStatus = 'unhealthy';
      }

      this.logger.log(`🏥 System health check completed: ${overallStatus} (${healthyChecks}/${totalChecks} checks passed)`);

      return {
        status: overallStatus,
        checks,
        summary: {
          healthyChecks,
          totalChecks,
          healthRatio: Math.round(healthRatio * 100),
          timestamp: new Date().toISOString(),
          contextNote: 'Background services only process data for users with active sessions',
        },
      };

    } catch (error) {
      this.logger.error('❌ System health check failed:', error);
      return {
        status: 'unhealthy',
        checks: [{
          name: 'System Health Check',
          status: 'unhealthy',
          message: 'Health check process failed',
          error: error.message,
          timestamp: new Date().toISOString(),
        }],
        summary: {
          healthyChecks: 0,
          totalChecks: 1,
          healthRatio: 0,
          timestamp: new Date().toISOString(),
          contextNote: 'Health check process encountered an error',
        },
      };
    }
  }

  /**
   * Perform initial health check on service startup
   */
  private async performInitialHealthCheck(): Promise<void> {
    try {
      const health = await this.getSystemHealth();
      
      this.logger.log('Initial health check completed', {
        status: health.status,
        healthRatio: health.summary.healthRatio,
      });

      if (health.status === 'unhealthy') {
        this.logger.warn('System is unhealthy on startup - manual intervention may be required');
      }

    } catch (error) {
      this.logger.error('Initial health check failed:', error);
    }
  }

  /**
   * Perform comprehensive health check with detailed analysis
   */
  private async performComprehensiveHealthCheck(): Promise<any> {
    const health = await this.getSystemHealth();
    const stats = await this.gmailWatchService.getStatistics();
    
    return {
      health,
      statistics: stats,
      recommendations: this.generateHealthRecommendations(health, stats),
    };
  }

  /**
   * Cleanup old error records and statistics
   */
  private async cleanupOldErrorRecords(): Promise<void> {
    try {
      // This would implement cleanup of old error logs, statistics, etc.
      // For now, we'll just log the action
      this.logger.log('Performing cleanup of old error records');
      
      // TODO: Implement actual cleanup logic when error storage is implemented
      
    } catch (error) {
      this.logger.error('Cleanup of old error records failed:', error);
    }
  }

  /**
   * Generate daily health report
   */
  private async generateDailyReport(healthCheck: any): Promise<void> {
    try {
      const report = {
        date: new Date().toISOString().split('T')[0],
        health: healthCheck.health,
        statistics: healthCheck.statistics,
        recommendations: healthCheck.recommendations,
      };

      this.logger.log('Daily health report generated', report);
      
      // TODO: Send report via email/notification system if configured
      
    } catch (error) {
      this.logger.error('Daily report generation failed:', error);
    }
  }

  /**
   * Perform weekly system analysis
   */
  private async performWeeklyAnalysis(): Promise<any> {
    try {
      const stats = await this.gmailWatchService.getStatistics();
      const health = await this.getSystemHealth();

      return {
        week: this.getWeekNumber(),
        summary: {
          totalActiveWatches: stats.totalActive,
          totalNotifications: stats.totalNotifications,
          totalEmailsProcessed: stats.totalEmailsProcessed,
          errorRate: stats.withErrors / Math.max(stats.totalActive, 1),
          systemHealth: health.status,
        },
        trends: {
          // TODO: Implement trend analysis when historical data is available
          message: 'Trend analysis will be available after collecting historical data',
        },
      };

    } catch (error) {
      this.logger.error('Weekly analysis failed:', error);
      return {
        week: this.getWeekNumber(),
        error: error.message,
      };
    }
  }

  /**
   * Generate health recommendations based on current state
   */
  private generateHealthRecommendations(health: any, stats: any): string[] {
    const recommendations: string[] = [];

    if (health.status === 'unhealthy') {
      recommendations.push('System is unhealthy - immediate attention required');
    }

    if (stats.withErrors > 0) {
      recommendations.push(`${stats.withErrors} watches have errors - review and fix`);
    }

    if (stats.expiringSoon > 0) {
      recommendations.push(`${stats.expiringSoon} watches are expiring soon - check renewal process`);
    }

    if (stats.totalActive === 0) {
      recommendations.push('No active watches found - users may need to re-enable notifications');
    }

    if (recommendations.length === 0) {
      recommendations.push('System is operating normally');
    }

    return recommendations;
  }

  /**
   * Record metrics for monitoring and analysis
   */
  private async recordMetrics(type: string, data: any): Promise<void> {
    try {
      // TODO: Implement metrics storage (Redis, InfluxDB, etc.)
      this.logger.debug('Recording metrics', { type, data });
    } catch (error) {
      this.logger.error('Failed to record metrics:', error);
    }
  }

  /**
   * Get current week number
   */
  private getWeekNumber(): number {
    const date = new Date();
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }
} 