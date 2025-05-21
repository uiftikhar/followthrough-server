import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  colorize: true,
                  levelFirst: true,
                  translateTime: 'SYS:standard',
                },
              }
            : undefined,
        level: process.env.LOG_LEVEL || 'info',
        autoLogging: process.env.NODE_ENV !== 'test',
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
            'req.body.password',
            '*.password',
            '*.apiKey',
          ],
          remove: true,
        },
      },
    }),
  ],
  exports: [LoggerModule],
})
export class LoggingModule {}
