import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Email } from './models/email.model';
import { Thread } from './models/thread.model';
import { EmailQueryDto } from './dtos/email-query.dto';
import { EmailConnectorFactory, EmailProvider } from './connectors/email-connector.factory';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private configService: ConfigService,
    private emailConnectorFactory: EmailConnectorFactory,
  ) {}

  async getEmails(userId: string, provider: EmailProvider, options: EmailQueryDto | any = {}): Promise<Email[]> {
    try {
      const connector = this.emailConnectorFactory.getConnector(provider);
      
      // Convert to EmailQueryDto if it's not already
      const query = options instanceof EmailQueryDto 
        ? options 
        : this.createQueryDto(options);
      
      return await connector.getEmails(userId, query);
    } catch (error) {
      this.logger.error(`Failed to get emails: ${error.message}`);
      throw error;
    }
  }

  async getEmail(userId: string, provider: EmailProvider, emailId: string): Promise<Email> {
    try {
      const connector = this.emailConnectorFactory.getConnector(provider);
      return await connector.getEmail(userId, emailId);
    } catch (error) {
      this.logger.error(`Failed to get email: ${error.message}`);
      throw error;
    }
  }

  async getThread(userId: string, provider: EmailProvider, threadId: string): Promise<Thread> {
    try {
      const connector = this.emailConnectorFactory.getConnector(provider);
      return await connector.getThread(userId, threadId);
    } catch (error) {
      this.logger.error(`Failed to get thread: ${error.message}`);
      throw error;
    }
  }

  async sendEmail(userId: string, provider: EmailProvider, email: Partial<Email>): Promise<Email> {
    try {
      const connector = this.emailConnectorFactory.getConnector(provider);
      return await connector.sendEmail(userId, email);
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw error;
    }
  }

  async updateEmailMetadata(
    userId: string, 
    provider: EmailProvider, 
    emailId: string, 
    metadata: Record<string, any>
  ): Promise<Email> {
    try {
      const connector = this.emailConnectorFactory.getConnector(provider);
      return await connector.updateEmailMetadata(userId, emailId, metadata);
    } catch (error) {
      this.logger.error(`Failed to update email metadata: ${error.message}`);
      throw error;
    }
  }

  async moveEmail(
    userId: string, 
    provider: EmailProvider, 
    emailId: string, 
    targetFolder: string
  ): Promise<Email> {
    try {
      const connector = this.emailConnectorFactory.getConnector(provider);
      return await connector.moveEmail(userId, emailId, targetFolder);
    } catch (error) {
      this.logger.error(`Failed to move email: ${error.message}`);
      throw error;
    }
  }

  async deleteEmail(userId: string, provider: EmailProvider, emailId: string): Promise<boolean> {
    try {
      const connector = this.emailConnectorFactory.getConnector(provider);
      return await connector.deleteEmail(userId, emailId);
    } catch (error) {
      this.logger.error(`Failed to delete email: ${error.message}`);
      throw error;
    }
  }

  async markAsRead(
    userId: string, 
    provider: EmailProvider, 
    emailId: string, 
    isRead: boolean
  ): Promise<Email> {
    try {
      const connector = this.emailConnectorFactory.getConnector(provider);
      return await connector.markAsRead(userId, emailId, isRead);
    } catch (error) {
      this.logger.error(`Failed to mark email as ${isRead ? 'read' : 'unread'}: ${error.message}`);
      throw error;
    }
  }

  async getFolders(userId: string, provider: EmailProvider): Promise<string[]> {
    try {
      const connector = this.emailConnectorFactory.getConnector(provider);
      return await connector.getFolders(userId);
    } catch (error) {
      this.logger.error(`Failed to get folders: ${error.message}`);
      throw error;
    }
  }

  getSupportedProviders(): EmailProvider[] {
    return this.emailConnectorFactory.getSupportedProviders();
  }

  /**
   * Create an EmailQueryDto from a generic object
   */
  private createQueryDto(options: any): EmailQueryDto {
    const query = new EmailQueryDto();
    
    // Map fields from options to query object
    if (options.query !== undefined) query.query = options.query;
    if (options.folder !== undefined) query.folder = options.folder;
    if (options.labels !== undefined) query.labels = options.labels;
    if (options.unreadOnly !== undefined) query.unreadOnly = options.unreadOnly;
    if (options.hasAttachment !== undefined) query.hasAttachment = options.hasAttachment;
    if (options.startDate !== undefined) query.startDate = options.startDate;
    if (options.endDate !== undefined) query.endDate = options.endDate;
    if (options.from !== undefined) query.from = options.from;
    if (options.to !== undefined) query.to = options.to;
    if (options.sortBy !== undefined) query.sortBy = options.sortBy;
    if (options.sortOrder !== undefined) query.sortOrder = options.sortOrder;
    if (options.limit !== undefined) query.limit = options.limit;
    if (options.offset !== undefined) query.offset = options.offset;
    if (options.includeMetadata !== undefined) query.includeMetadata = options.includeMetadata;
    if (options.includeAttachments !== undefined) query.includeAttachments = options.includeAttachments;
    
    return query;
  }
} 