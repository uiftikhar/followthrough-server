import { Injectable, Logger } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";

interface IndexConfig {
  key: Record<string, 1 | -1>;
  options?: Record<string, any>;
}

interface CollectionConfig {
  name: string;
  indexes: IndexConfig[];
}

@Injectable()
export class DatabaseInitializationService {
  private readonly logger = new Logger(DatabaseInitializationService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /**
   * Initialize all required collections for the meeting analysis flow
   * Creates collections if they don't exist and ensures proper indexes
   */
  async initializeCollections(): Promise<void> {
    this.logger.log("🚀 Initializing MongoDB collections for meeting analysis flow...");

    try {
      // Get database instance
      const db = this.connection.db;
      if (!db) {
        throw new Error("Database connection not available");
      }

      // Define required collections with their indexes
      const collections: CollectionConfig[] = [
        {
          name: "users",
          indexes: [
            { key: { email: 1 }, options: { unique: true } },
            { key: { createdAt: 1 } },
          ],
        },
        {
          name: "sessions", 
          indexes: [
            { key: { sessionId: 1 }, options: { unique: true } },
            { key: { userId: 1 } },
            { key: { status: 1 } },
            { key: { createdAt: 1 } },
            { key: { userId: 1, status: 1 } }, // Compound index for user queries
          ],
        },
        {
          name: "user_google_tokens",
          indexes: [
            { key: { userId: 1 }, options: { unique: true } },
            { key: { googleUserId: 1 } },
            { key: { googleEmail: 1 } },
            { key: { isActive: 1 } },
            { key: { expiresAt: 1 } },
            { key: { userId: 1, isActive: 1 } }, // Compound index for active tokens
          ],
        },
        {
          name: "gmail_watches",
          indexes: [
            { key: { userId: 1 } },
            { key: { historyId: 1 } },
            { key: { isActive: 1 } },
            { key: { expiresAt: 1 } },
            { key: { userId: 1, isActive: 1 } }, // Compound index for active watches
          ],
        },
      ];

      // Get existing collections
      const existingCollections = await db.listCollections().toArray();
      const existingNames = existingCollections.map(col => col.name);

      // Create collections and indexes
      for (const { name, indexes } of collections) {
        // Create collection if it doesn't exist
        if (!existingNames.includes(name)) {
          await db.createCollection(name);
          this.logger.log(`✅ Created collection: ${name}`);
        } else {
          this.logger.log(`📋 Collection already exists: ${name}`);
        }

        // Create indexes
        const collection = db.collection(name);
        for (const indexConfig of indexes) {
          try {
            await collection.createIndex(indexConfig.key, indexConfig.options || {});
            this.logger.log(`📊 Created index on ${name}: ${JSON.stringify(indexConfig.key)}`);
          } catch (error: any) {
            // Index might already exist, which is fine
            if (error.code === 85) { // IndexOptionsConflict
              this.logger.log(`📊 Index already exists on ${name}: ${JSON.stringify(indexConfig.key)}`);
            } else {
              this.logger.warn(`⚠️ Failed to create index on ${name}:`, error.message);
            }
          }
        }
      }

      // Verify database connection
      await this.verifyConnection();

      this.logger.log("🎉 MongoDB collections initialization completed successfully!");

    } catch (error) {
      this.logger.error("❌ Failed to initialize MongoDB collections:", error);
      throw error;
    }
  }

  /**
   * Verify database connection and collections
   */
  private async verifyConnection(): Promise<void> {
    try {
      const db = this.connection.db;
      if (!db) {
        throw new Error("Database connection not available");
      }

      // Test database connectivity
      await db.admin().ping();
      this.logger.log("✅ Database connection verified");

      // List all collections for verification
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(col => col.name);
      
      this.logger.log(`📋 Available collections: ${collectionNames.join(", ")}`);

      // Verify required collections exist
      const requiredCollections = ["users", "sessions", "user_google_tokens", "gmail_watches"];
      const missingCollections = requiredCollections.filter(name => !collectionNames.includes(name));
      
      if (missingCollections.length > 0) {
        this.logger.warn(`⚠️ Missing collections: ${missingCollections.join(", ")}`);
      } else {
        this.logger.log("✅ All required collections are present");
      }

    } catch (error) {
      this.logger.error("❌ Database verification failed:", error);
      throw error;
    }
  }

  /**
   * Get collection statistics for monitoring
   */
  async getCollectionStats(): Promise<Record<string, any>> {
    try {
      const db = this.connection.db;
      if (!db) {
        throw new Error("Database connection not available");
      }

      const stats: Record<string, any> = {};
      const collections = ["users", "sessions", "user_google_tokens", "gmail_watches"];

      for (const collectionName of collections) {
        try {
          const collection = db.collection(collectionName);
          const count = await collection.countDocuments();
          const indexes = await collection.indexes();
          
          stats[collectionName] = {
            documentCount: count,
            indexCount: indexes.length,
            indexes: indexes.map(idx => idx.name),
          };
        } catch (error: any) {
          stats[collectionName] = {
            error: error.message,
          };
        }
      }

      return stats;
    } catch (error) {
      this.logger.error("Failed to get collection stats:", error);
      throw error;
    }
  }

  /**
   * Health check for database and collections
   */
  async healthCheck(): Promise<{ status: string; details: Record<string, any> }> {
    try {
      const db = this.connection.db;
      if (!db) {
        return {
          status: "unhealthy",
          details: { error: "Database connection not available" },
        };
      }

      // Test connection
      await db.admin().ping();

      // Get collection stats
      const stats = await this.getCollectionStats();

      return {
        status: "healthy",
        details: {
          connectionState: this.connection.readyState,
          collections: stats,
        },
      };
    } catch (error: any) {
      return {
        status: "unhealthy",
        details: { error: error.message },
      };
    }
  }
} 