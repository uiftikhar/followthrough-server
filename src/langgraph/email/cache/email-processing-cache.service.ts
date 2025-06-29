import { Injectable, Logger } from '@nestjs/common';

/**
 * Email Processing Cache Service
 * 
 * Prevents duplicate processing of emails by maintaining a cache
 * of recently processed email IDs. Uses in-memory cache with TTL.
 * 
 * In production, this could be replaced with Redis for scalability.
 */
@Injectable()
export class EmailProcessingCacheService {
  private readonly logger = new Logger(EmailProcessingCacheService.name);
  private readonly cache = new Map<string, { timestamp: number; ttl: number }>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);

    this.logger.log('Email processing cache initialized');
  }

  /**
   * Check if an email has already been processed
   */
  async has(emailId: string): Promise<boolean> {
    const entry = this.cache.get(emailId);
    
    if (!entry) {
      return false;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(emailId);
      return false;
    }

    this.logger.log(`📋 Email ${emailId} found in processing cache`);
    return true;
  }

  /**
   * Mark an email as processed
   */
  async set(emailId: string, processed: boolean = true, ttlSeconds: number = 3600): Promise<void> {
    const ttlMs = ttlSeconds * 1000;
    
    this.cache.set(emailId, {
      timestamp: Date.now(),
      ttl: ttlMs
    });

    this.logger.log(`📝 Marked email ${emailId} as processed (TTL: ${ttlSeconds}s)`);
  }

  /**
   * Remove an email from the cache
   */
  async delete(emailId: string): Promise<void> {
    const deleted = this.cache.delete(emailId);
    if (deleted) {
      this.logger.log(`🗑️ Removed email ${emailId} from processing cache`);
    }
  }

  /**
   * Clear all cached entries
   */
  async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.log(`🧹 Cleared ${size} entries from processing cache`);
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; entries: Array<{ emailId: string; age: number; ttl: number }> } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([emailId, entry]) => ({
      emailId,
      age: Math.round((now - entry.timestamp) / 1000),
      ttl: Math.round(entry.ttl / 1000)
    }));

    return {
      size: this.cache.size,
      entries
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [emailId, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(emailId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`🧹 Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Cleanup on service destruction
   */
  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
    this.logger.log('Email processing cache destroyed');
  }
} 