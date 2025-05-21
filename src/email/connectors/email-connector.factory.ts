import { Injectable, Logger } from '@nestjs/common';
import { EmailConnector } from './email-connector.interface';
import { GmailConnector } from './gmail.connector';
import { OutlookConnector } from './outlook.connector';

export type EmailProvider = 'gmail' | 'outlook';

@Injectable()
export class EmailConnectorFactory {
  private readonly logger = new Logger(EmailConnectorFactory.name);
  
  constructor(
    private readonly gmailConnector: GmailConnector,
    private readonly outlookConnector: OutlookConnector,
  ) {}
  
  getConnector(provider: EmailProvider): EmailConnector {
    switch (provider.toLowerCase()) {
      case 'gmail':
        return this.gmailConnector;
      case 'outlook':
        return this.outlookConnector;
      default:
        this.logger.warn(`Unknown email provider: ${provider}. Defaulting to Gmail.`);
        return this.gmailConnector;
    }
  }
  
  getSupportedProviders(): EmailProvider[] {
    return ['gmail', 'outlook'];
  }
} 