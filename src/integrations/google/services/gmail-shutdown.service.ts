import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GmailWatchService } from './gmail-watch.service';

/**
 * Gmail Shutdown Service
 * Handles graceful cleanup of Gmail watches when the server shuts down
 * Only activates when GOOGLE_REMOVE_ACTIVE_WATCHERS=true
 */
@Injectable()
export class GmailShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(GmailShutdownService.name);
  private readonly shouldCleanupWatches: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly gmailWatchService: GmailWatchService,
  ) {
    // Check if watch cleanup is enabled
    this.shouldCleanupWatches = this.configService.get<boolean>('GOOGLE_REMOVE_ACTIVE_WATCHERS', false);
    
    if (this.shouldCleanupWatches) {
      this.logger.log('✅ Gmail watch cleanup on shutdown is ENABLED');
    } else {
      this.logger.log('ℹ️ Gmail watch cleanup on shutdown is DISABLED (set GOOGLE_REMOVE_ACTIVE_WATCHERS=true to enable)');
    }
  }

  /**
   * Called when the application is shutting down
   * This is triggered by SIGTERM, SIGINT, or other shutdown signals
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    if (!this.shouldCleanupWatches) {
      this.logger.log(`🛑 Application shutting down (${signal || 'unknown signal'}) - Gmail watch cleanup disabled`);
      return;
    }

    this.logger.log(`🛑 Application shutting down (${signal || 'unknown signal'}) - starting Gmail watch cleanup`);

    try {
      // Set a timeout for the cleanup process to prevent hanging shutdown
      const cleanupTimeout = 30000; // 30 seconds
      
      const cleanupPromise = this.performGracefulCleanup();
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Cleanup timeout')), cleanupTimeout);
      });

      // Race between cleanup and timeout
      await Promise.race([cleanupPromise, timeoutPromise]);
      
      this.logger.log('✅ Gmail watch cleanup completed successfully');
    } catch (error) {
      if (error.message === 'Cleanup timeout') {
        this.logger.error('⏰ Gmail watch cleanup timed out after 30 seconds');
      } else {
        this.logger.error('❌ Gmail watch cleanup failed:', error);
      }
    }
  }

  /**
   * Perform the actual cleanup of Gmail watches
   */
  private async performGracefulCleanup(): Promise<void> {
    try {
      this.logger.log('🧹 Starting graceful cleanup of Gmail watches...');

      const result = await this.gmailWatchService.stopAllActiveWatches();

      // Log summary
      this.logger.log(`📊 Cleanup Summary:
        - Total watches found: ${result.totalWatches}
        - Successfully stopped: ${result.successfullyStopped}
        - Failed to stop: ${result.failed}
        - Success rate: ${result.totalWatches > 0 ? Math.round((result.successfullyStopped / result.totalWatches) * 100) : 100}%`);

      if (result.failed > 0) {
        this.logger.warn(`⚠️ ${result.failed} watches failed to stop during shutdown`);
        result.errors.forEach((error, index) => {
          this.logger.warn(`  ${index + 1}. ${error}`);
        });
      }

      if (result.successfullyStopped > 0) {
        this.logger.log(`✅ Successfully cleaned up ${result.successfullyStopped} Gmail watches`);
      }
    } catch (error) {
      this.logger.error('❌ Failed to perform graceful Gmail watch cleanup:', error);
      throw error;
    }
  }

  /**
   * Manual cleanup trigger (for testing or admin use)
   */
  async triggerManualCleanup(): Promise<{
    totalWatches: number;
    successfullyStopped: number;
    failed: number;
    errors: string[];
  }> {
    if (!this.shouldCleanupWatches) {
      throw new Error('Gmail watch cleanup is disabled. Set GOOGLE_REMOVE_ACTIVE_WATCHERS=true to enable.');
    }

    this.logger.log('🔧 Manual Gmail watch cleanup triggered');
    
    try {
      const result = await this.gmailWatchService.stopAllActiveWatches();
      this.logger.log('✅ Manual cleanup completed successfully');
      return result;
    } catch (error) {
      this.logger.error('❌ Manual cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Check if cleanup is enabled
   */
  isCleanupEnabled(): boolean {
    return this.shouldCleanupWatches;
  }
} 