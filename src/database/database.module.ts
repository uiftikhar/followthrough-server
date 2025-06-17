import { Module, OnModuleInit } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { SessionRepository } from "./repositories/session.repository";
import { UserRepository } from "./repositories/user.repository";
import { UserGoogleTokensRepository } from "./repositories/user-google-tokens.repository";
import { Session, SessionSchema } from "./schemas/session.schema";
import { User, UserSchema } from "../auth/entities/user.schema";
import { UserGoogleTokens, UserGoogleTokensSchema } from "./schemas/user-google-tokens.schema";
import { GmailWatch, GmailWatchSchema } from "./schemas/gmail-watch.schema";
import { DatabaseInitializationService } from "./services/database-initialization.service";
import { TokenEncryptionService } from "../integrations/google/services/token-encryption.service";

@Module({
  imports: [
    ConfigModule, // Required for TokenEncryptionService
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const uri = configService.get<string>("MONGO_DB_URI");
        const username = configService.get<string>("MONGO_DB_USERNAME");
        const password = configService.get<string>("MONGO_DB_PASSWORD");

        // Validate required configuration
        if (!uri) {
          throw new Error("MONGO_DB_URI is required");
        }

        // Check if running in production/Railway environment
        const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
        
        // If a full URI is provided, use it directly
        if (uri) {
          // For Railway deployment with MongoDB Atlas
          const mongoConfig = {
            uri,
            
            // SSL/TLS configuration for MongoDB Atlas
            ssl: true,
            tls: true,
            tlsAllowInvalidCertificates: false,
            tlsAllowInvalidHostnames: false,
            
            // Connection pool settings optimized for Railway
            maxPoolSize: isProduction ? 10 : 5,
            minPoolSize: 1,
            maxIdleTimeMS: 30000,
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 30000,
            
            // Retry settings for unstable connections
            retryWrites: true,
            retryReads: true,
            
            // Buffer settings for Railway
            bufferCommands: false,
            
            // Database name
            dbName: configService.get<string>("MONGO_DB_NAME", "productiveai"),
          };

          // Log connection attempt (without sensitive data)
          console.log(`🔗 Connecting to MongoDB Atlas via Railway...`);
          console.log(`📊 Environment: ${isProduction ? 'Production' : 'Development'}`);
          console.log(`🏗️ Pool size: ${mongoConfig.maxPoolSize}`);
          
          return mongoConfig;
        }

        // Otherwise construct the URI (fallback for local development)
        const host = configService.get<string>("MONGO_DB_HOST", "mongo");
        const port = configService.get<string>("MONGO_DB_PORT", "27017");
        const database = configService.get<string>(
          "MONGO_DB_DATABASE",
          "productiveai",
        );

        // Construct connection URI
        const constructedUri = `mongodb://${username}:${password}@${host}:${port}/${database}`;

        return {
          uri: constructedUri,
          // Remove deprecated options for local connections too
          // useNewUrlParser: true,  // REMOVED
          // useUnifiedTopology: true,  // REMOVED
          
          // For local development (non-SSL)
          ssl: false,
          maxPoolSize: 5,
          minPoolSize: 1,
          serverSelectionTimeoutMS: 10000,
          socketTimeoutMS: 20000,
        };
      },
    }),
    // Register all required schemas for meeting analysis flow
    MongooseModule.forFeature([
      { name: Session.name, schema: SessionSchema },
      { name: User.name, schema: UserSchema },
      { name: UserGoogleTokens.name, schema: UserGoogleTokensSchema },
      { name: GmailWatch.name, schema: GmailWatchSchema },
    ]),
  ],
  providers: [
    TokenEncryptionService, // Required by UserGoogleTokensRepository
    SessionRepository,
    UserRepository,
    UserGoogleTokensRepository,
    DatabaseInitializationService,
  ],
  exports: [
    SessionRepository,
    UserRepository,
    UserGoogleTokensRepository,
    MongooseModule,
    DatabaseInitializationService,
  ],
})
export class DatabaseModule implements OnModuleInit {
  constructor(
    private readonly databaseInitializationService: DatabaseInitializationService,
  ) {}

  async onModuleInit() {
    // Initialize collections and indexes on module startup
    await this.databaseInitializationService.initializeCollections();
  }
}
