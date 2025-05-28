import { Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import { join } from "path";

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.local"],
      expandVariables: true,
      cache: true,
      load: [
        () => ({
          server: {
            port: parseInt(process.env.PORT || "3000", 10),
            host: process.env.HOST || "localhost",
          },
          database: {
            type: process.env.DB_TYPE || "sqlite",
            host: process.env.DB_HOST,
            port: process.env.DB_PORT
              ? parseInt(process.env.DB_PORT, 10)
              : undefined,
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE || "meetings.db",
            synchronize: process.env.DB_SYNCHRONIZE === "true",
          },
          auth: {
            jwtSecret: process.env.JWT_SECRET || "supersecret",
            jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
            refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
          },
          llm: {
            defaultModel: process.env.DEFAULT_LLM_MODEL || "gpt-4o",
            provider: process.env.LLM_PROVIDER || "openai",
            apiKey: process.env.OPENAI_API_KEY,
            anthropicApiKey: process.env.ANTHROPIC_API_KEY,
          },
        }),
      ],
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
