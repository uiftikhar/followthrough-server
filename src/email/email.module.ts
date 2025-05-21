import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { GmailConnector } from './connectors/gmail.connector';
import { OutlookConnector } from './connectors/outlook.connector';
import { EmailConnectorFactory } from './connectors/email-connector.factory';
import { MCPModule } from '../mcp/mcp.module';

@Module({
  imports: [
    ConfigModule,
    MCPModule,
  ],
  providers: [
    EmailService,
    GmailConnector,
    OutlookConnector,
    EmailConnectorFactory,
  ],
  exports: [
    EmailService,
  ],
})
export class EmailModule {} 