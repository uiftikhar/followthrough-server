import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MeetingModule } from './meeting/meeting.module';
import { SessionRepository } from './repositories/session.repository';
import { Session, SessionSchema } from './schemas/session.schema';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const uri = configService.get<string>('MONGO_DB_URI');
        const username = configService.get<string>('MONGO_DB_USERNAME');
        const password = configService.get<string>('MONGO_DB_PASSWORD');
        
        // If a full URI is provided, use it directly
        if (uri && !uri.includes('${MONGO_DB_USERNAME}')) {
          return {
            uri,
            useNewUrlParser: true,
            useUnifiedTopology: true,
          };
        }
        
        // Otherwise construct the URI
        const host = configService.get<string>('MONGO_DB_HOST', 'mongo');
        const port = configService.get<string>('MONGO_DB_PORT', '27017');
        const database = configService.get<string>('MONGO_DB_DATABASE', 'productiveai');
        
        // Construct connection URI
        const constructedUri = `mongodb://${username}:${password}@${host}:${port}/${database}`;

        return {
          uri: constructedUri,
          useNewUrlParser: true,
          useUnifiedTopology: true,
        };
      },
    }),
    MongooseModule.forFeature([
      { name: Session.name, schema: SessionSchema },
    ]),
    MeetingModule,
  ],
  providers: [SessionRepository],
  exports: [SessionRepository, MongooseModule, MeetingModule],
})
export class DatabaseModule {}
