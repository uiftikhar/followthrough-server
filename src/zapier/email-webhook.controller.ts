import { Controller, Post, Body, Logger, UseGuards, Headers } from '@nestjs/common';
import { UnifiedWorkflowService } from '../langgraph/unified-workflow.service';
import { ZapierEmailPayload } from '../email/dtos/email-triage.dto';
import { ZapierApiKeyGuard } from './guards/api-key.guard';

/**
 * ZapierEmailWebhookController - Dedicated controller for Zapier email webhooks
 * Integrates with Master Supervisor for real-time email processing
 * Part of Phase 4 implementation
 */
@Controller('api/zapier/webhooks')
export class ZapierEmailWebhookController {
  private readonly logger = new Logger(ZapierEmailWebhookController.name);

  constructor(
    private readonly unifiedWorkflowService: UnifiedWorkflowService,
  ) {}

  /**
   * Main Zapier email webhook endpoint
   * POST /api/zapier/webhooks/email
   */
  @Post('email')
  @UseGuards(ZapierApiKeyGuard) // API key authentication
  async handleEmailWebhook(
    @Body() emailPayload: ZapierEmailPayload,
    @Headers() headers: any
  ): Promise<any> {
    this.logger.log('Received email webhook from Zapier');
    this.logger.log(`Email subject: ${emailPayload.subject}`);
    this.logger.log(`From: ${emailPayload.from}`);
    
    try {
      // Transform Zapier payload to our unified format for email triage
      const input = {
        type: 'email_triage',
        emailData: {
          id: emailPayload.id || `zapier-${Date.now()}`,
          body: emailPayload.body,
          metadata: {
            subject: emailPayload.subject,
            from: emailPayload.from,
            to: emailPayload.to,
            timestamp: emailPayload.timestamp || new Date().toISOString(),
            headers: emailPayload.headers || {},
            zapierSource: true,
            webhookId: headers['x-zapier-webhook-id'] || 'unknown',
          },
        },
        sessionId: `zapier-email-${Date.now()}`,
      };

      this.logger.log(`Processing email triage through Master Supervisor for: ${input.emailData.metadata.subject}`);

      // Route through existing Master Supervisor to email_triage team
      const result = await this.unifiedWorkflowService.processInput(
        input,
        { 
          sessionId: input.sessionId,
          source: 'zapier_webhook',
          webhookHeaders: headers 
        },
        emailPayload.userId || 'zapier-user',
      );

      this.logger.log('Zapier email webhook processed successfully');
      
      // Return Zapier-friendly response
      return {
        success: true,
        message: 'Email processed successfully',
        sessionId: input.sessionId,
        emailId: input.emailData.id,
        processedAt: new Date().toISOString(),
        result: {
          status: result.status || 'processed',
          sessionId: result.sessionId
        }
      };
    } catch (error) {
      this.logger.error(`Zapier webhook processing failed: ${error.message}`, error.stack);
      
      // Return error in Zapier-friendly format
      return {
        success: false,
        error: {
          message: error.message,
          code: 'EMAIL_PROCESSING_FAILED',
          timestamp: new Date().toISOString(),
        },
        emailId: emailPayload.id,
      };
    }
  }

  /**
   * Zapier test endpoint for webhook setup
   * POST /api/zapier/webhooks/email/test
   */
  @Post('email/test')
  @UseGuards(ZapierApiKeyGuard)
  async testEmailWebhook(@Body() testPayload: any): Promise<any> {
    this.logger.log('Received test webhook from Zapier');
    
    return {
      success: true,
      message: 'Zapier email webhook is configured correctly',
      timestamp: new Date().toISOString(),
      testData: {
        received: testPayload,
        capabilities: [
          'email_classification',
          'email_summarization',
          'reply_draft_generation',
          'priority_detection',
          'sentiment_analysis'
        ]
      }
    };
  }

  /**
   * Batch email processing endpoint for multiple emails
   * POST /api/zapier/webhooks/email/batch
   */
  @Post('email/batch')
  @UseGuards(ZapierApiKeyGuard)
  async handleBatchEmailWebhook(@Body() batchPayload: { emails: ZapierEmailPayload[] }): Promise<any> {
    this.logger.log(`Received batch email webhook with ${batchPayload.emails?.length || 0} emails`);
    
    try {
      if (!batchPayload.emails || !Array.isArray(batchPayload.emails)) {
        throw new Error('Invalid batch payload: emails array required');
      }

      interface ProcessingResult {
        emailId: string;
        success: boolean;
        sessionId?: string;
        error?: string;
      }

      const results: ProcessingResult[] = [];
      
      // Process emails sequentially to avoid overwhelming the system
      for (const email of batchPayload.emails) {
        try {
          const result = await this.handleEmailWebhook(email, {});
          results.push({
            emailId: email.id,
            success: result.success,
            sessionId: result.sessionId,
          });
        } catch (error) {
          results.push({
            emailId: email.id,
            success: false,
            error: error.message,
          });
        }
      }

      this.logger.log(`Batch processing completed: ${results.filter(r => r.success).length}/${results.length} successful`);
      
      return {
        success: true,
        message: 'Batch email processing completed',
        totalEmails: batchPayload.emails.length,
        successfulProcessed: results.filter(r => r.success).length,
        results,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Batch webhook processing failed: ${error.message}`, error.stack);
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
} 