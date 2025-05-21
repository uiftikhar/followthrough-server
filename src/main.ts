import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cors from 'cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use pino logger
  app.useLogger(app.get(Logger));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable CORS
  app.use(
    cors({
    origin: ['http://localhost:3000', 'http://localhost:8080'], // Allow both Next.js and other clients
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true, // Allow cookies and authentication headers
    allowedHeaders: 'Origin,X-Requested-With,Content-Type,Accept,Authorization',
    })
  );

  // Add middleware to handle mockServiceWorker.js requests
  app.use((req, res, next) => {
    // Check if the request is for mockServiceWorker.js
    if (req.url.includes('mockServiceWorker.js')) {
      // Return an empty JS file with 200 OK
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end('// Empty mock service worker file');
      return;
    }
    next();
  });

  // Swagger documentation setup
  const config = new DocumentBuilder()
    .setTitle('Meeting Analysis API')
    .setDescription('API for NestJS-based meeting analysis system')
    .setVersion('1.0')
    .addTag('Meeting Analysis')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Get config
  const configService = app.get(ConfigService);
  const port = configService.get<number>('server.port') || 3001; // Set default port to 3001
  const host = configService.get<string>('server.host') || '0.0.0.0';

  await app.listen(port, host);
  console.log(`Application is running on: http://${host}:${port}`);
  console.log(
    `Swagger documentation available at: http://localhost:${port}/api/docs`,
  );
}
bootstrap();
