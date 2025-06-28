import {
  Controller,
  Post,
  Param,
  Body,
  Get,
  Logger,
  UseGuards,
  Request,
  ValidationPipe,
} from "@nestjs/common";
import { EmailDelegationAgent, User } from "./agents/email-delegation.agent";
import { EmailSnoozeAgent, SnoozeRequest } from "./agents/email-snooze.agent";
import { AuthGuard } from "@nestjs/passport";
import { UnifiedWorkflowService } from "../unified-workflow.service";
import { EmailTriageSessionRepository } from "../../database/repositories/email-triage-session.repository";

// DTOs for request validation
export class SendReplyDto {
  replyText: string;
  subject?: string;
  tone?: "professional" | "friendly" | "urgent";
  sendTime?: string; // Optional scheduled send time
}

export class DelegateEmailDto {
  delegateToUserId: string;
  delegateToEmail: string;
  delegateToName: string;
  notes?: string;
  urgency?: "low" | "normal" | "high" | "urgent";
}

export class SnoozeEmailDto {
  snoozeUntil: string; // ISO string
  reason?: string;
  notes?: string;
}

/**
 * EmailActionController - Handles user actions on emails
 * Part of Phase 6 implementation
 * Provides endpoints for send, delegate, and snooze operations
 * Integrates with Master Supervisor for workflow coordination
 */
@Controller("api/email")
@UseGuards(AuthGuard("jwt")) // Require authentication for all endpoints
export class EmailActionController {
  private readonly logger = new Logger(EmailActionController.name);

  constructor(
    private readonly unifiedWorkflowService: UnifiedWorkflowService,
    private readonly emailDelegationAgent: EmailDelegationAgent,
    private readonly emailSnoozeAgent: EmailSnoozeAgent,
    private readonly emailTriageSessionRepository: EmailTriageSessionRepository,
  ) {}

  /**
   * Send a reply to an email
   * POST /api/email/:id/send
   */
  @Post(":id/send")
  async sendReply(
    @Param("id") emailId: string,
    @Body(ValidationPipe) replyData: SendReplyDto,
    @Request() req: any,
  ) {
    this.logger.log(
      `Sending reply for email ${emailId} by user ${req.user?.id}`,
    );

    try {
      // Route through Master Supervisor to handle email sending
      const input = {
        type: "email_send",
        emailId,
        replyData: {
          ...replyData,
          userId: req.user.id,
          userEmail: req.user.email,
        },
        sessionId: `email-send-${Date.now()}`,
      };

      const result = await this.unifiedWorkflowService.processInput(
        input,
        {
          sessionId: input.sessionId,
          source: "user_action",
          action: "send_reply",
          userId: req.user.id,
        },
        req.user.id,
      );

      this.logger.log(`Email reply processed successfully for ${emailId}`);

      return {
        success: true,
        message: "Reply sent successfully",
        emailId,
        sessionId: input.sessionId,
        result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send reply for email ${emailId}: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        error: {
          message: error.message,
          code: "REPLY_SEND_FAILED",
        },
        emailId,
      };
    }
  }

  /**
   * Delegate an email to another team member
   * POST /api/email/:id/delegate
   */
  @Post(":id/delegate")
  async delegateEmail(
    @Param("id") emailId: string,
    @Body(ValidationPipe) delegateData: DelegateEmailDto,
    @Request() req: any,
  ) {
    this.logger.log(
      `Delegating email ${emailId} from ${req.user?.email} to ${delegateData.delegateToEmail}`,
    );

    try {
      // Get email data and triage results first (in a real implementation, this would come from database)
      const emailData = {
        id: emailId,
        body: "Sample email content for delegation", // TODO: Get from database
        metadata: {
          subject: "Sample Email Subject", // TODO: Get from database
          from: "sender@example.com",
          to: req.user.email,
        },
      };

      // Mock triage results (in real implementation, get from database)
      const triageResult = {
        classification: {
          priority: "high",
          category: "bug_report",
          confidence: 0.95,
        },
        summary: {
          problem: "User reporting login issues",
          context: "After recent system update",
          ask: "Urgent assistance needed",
        },
      };

      // Create user objects
      const delegator: User = {
        id: req.user.id,
        name: req.user.name || req.user.email,
        email: req.user.email,
      };

      const delegateTo: User = {
        id: delegateData.delegateToUserId,
        name: delegateData.delegateToName,
        email: delegateData.delegateToEmail,
      };

      // Use EmailDelegationAgent to handle the delegation
      const delegationResult = await this.emailDelegationAgent.delegateEmail(
        emailId,
        emailData,
        triageResult,
        delegator,
        delegateTo,
        delegateData.notes,
      );

      this.logger.log(
        `Email ${emailId} delegated successfully: ${delegationResult.id}`,
      );

      return {
        success: true,
        message: "Email delegated successfully",
        emailId,
        delegationId: delegationResult.id,
        delegatedTo: {
          id: delegateTo.id,
          name: delegateTo.name,
          email: delegateTo.email,
        },
        result: delegationResult,
      };
    } catch (error) {
      this.logger.error(
        `Failed to delegate email ${emailId}: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        error: {
          message: error.message,
          code: "EMAIL_DELEGATION_FAILED",
        },
        emailId,
      };
    }
  }

  /**
   * Snooze an email until specified time
   * POST /api/email/:id/snooze
   */
  @Post(":id/snooze")
  async snoozeEmail(
    @Param("id") emailId: string,
    @Body(ValidationPipe) snoozeData: SnoozeEmailDto,
    @Request() req: any,
  ) {
    this.logger.log(
      `Snoozing email ${emailId} until ${snoozeData.snoozeUntil} by user ${req.user?.id}`,
    );

    try {
      // Validate and parse snooze time
      const snoozeUntil = new Date(snoozeData.snoozeUntil);
      if (isNaN(snoozeUntil.getTime())) {
        throw new Error("Invalid snooze time format");
      }

      // Create snooze request
      const snoozeRequest: SnoozeRequest = {
        emailId,
        userId: req.user.id,
        snoozeUntil,
        reason: snoozeData.reason,
        notes: snoozeData.notes,
      };

      // Use EmailSnoozeAgent to handle the snoozing
      const snoozeResult =
        await this.emailSnoozeAgent.snoozeEmail(snoozeRequest);

      this.logger.log(
        `Email ${emailId} snoozed successfully: ${snoozeResult.id}`,
      );

      return {
        success: true,
        message: "Email snoozed successfully",
        emailId,
        snoozeId: snoozeResult.id,
        snoozeUntil: snoozeResult.snoozeUntil,
        result: snoozeResult,
      };
    } catch (error) {
      this.logger.error(
        `Failed to snooze email ${emailId}: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        error: {
          message: error.message,
          code: "EMAIL_SNOOZE_FAILED",
        },
        emailId,
      };
    }
  }

  /**
   * Cancel a snooze (unsnooze an email)
   * POST /api/email/snooze/:snoozeId/cancel
   */
  @Post("snooze/:snoozeId/cancel")
  async cancelSnooze(@Param("snoozeId") snoozeId: string, @Request() req: any) {
    this.logger.log(`Cancelling snooze ${snoozeId} by user ${req.user?.id}`);

    try {
      await this.emailSnoozeAgent.cancelSnooze(snoozeId, req.user.id);

      this.logger.log(`Snooze ${snoozeId} cancelled successfully`);

      return {
        success: true,
        message: "Snooze cancelled successfully",
        snoozeId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to cancel snooze ${snoozeId}: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        error: {
          message: error.message,
          code: "SNOOZE_CANCEL_FAILED",
        },
        snoozeId,
      };
    }
  }

  /**
   * Get user's active snoozes
   * GET /api/email/snoozes
   */
  @Get("snoozes")
  async getActiveSnoozes(@Request() req: any) {
    this.logger.log(`Getting active snoozes for user ${req.user?.id}`);

    try {
      const activeSnoozes = await this.emailSnoozeAgent.getActiveSnoozes(
        req.user.id,
      );

      return {
        success: true,
        snoozes: activeSnoozes,
        count: activeSnoozes.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get active snoozes: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        error: {
          message: error.message,
          code: "GET_SNOOZES_FAILED",
        },
      };
    }
  }

  /**
   * Get snooze statistics for user
   * GET /api/email/snoozes/stats
   */
  @Get("snoozes/stats")
  async getSnoozeStats(@Request() req: any) {
    this.logger.log(`Getting snooze statistics for user ${req.user?.id}`);

    try {
      const stats = await this.emailSnoozeAgent.getSnoozeStats(req.user.id);

      return {
        success: true,
        stats,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get snooze stats: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        error: {
          message: error.message,
          code: "GET_SNOOZE_STATS_FAILED",
        },
      };
    }
  }

  /**
   * 🆕 Get triage results for a specific email
   * GET /api/email/:emailId/triage-results
   */
  @Get(":emailId/triage-results")
  async getTriageResults(
    @Param("emailId") emailId: string,
    @Request() req: any,
  ) {
    this.logger.log(`Getting triage results for email ${emailId} by user ${req.user?.id}`);

    try {
      const triageSession = await this.emailTriageSessionRepository.findByEmailId(emailId);

      if (!triageSession) {
        return {
          success: false,
          error: {
            message: "Triage results not found for this email",
            code: "TRIAGE_RESULTS_NOT_FOUND",
          },
          emailId,
        };
      }

      // Check if user owns this email triage session
      if (triageSession.userId !== req.user.id) {
        return {
          success: false,
          error: {
            message: "Access denied to triage results",
            code: "TRIAGE_RESULTS_ACCESS_DENIED",
          },
          emailId,
        };
      }

      return {
        success: true,
        emailId,
        triageResults: {
          sessionId: triageSession.sessionId,
          status: triageSession.status,
          classification: triageSession.classification,
          summary: triageSession.summary,
          replyDraft: triageSession.replyDraft,
          retrievedContext: triageSession.retrievedContext,
          processingMetadata: triageSession.processingMetadata,
          contextRetrievalResults: triageSession.contextRetrievalResults,
          userToneProfile: triageSession.userToneProfile,
          startTime: triageSession.startTime,
          endTime: triageSession.endTime,
          progress: triageSession.progress,
          source: triageSession.source,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get triage results for email ${emailId}: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        error: {
          message: error.message,
          code: "GET_TRIAGE_RESULTS_FAILED",
        },
        emailId,
      };
    }
  }

  /**
   * 🆕 Get triage results by session ID
   * GET /api/email/triage-session/:sessionId
   */
  @Get("triage-session/:sessionId")
  async getTriageSession(
    @Param("sessionId") sessionId: string,
    @Request() req: any,
  ) {
    this.logger.log(`Getting triage session ${sessionId} by user ${req.user?.id}`);

    try {
      const triageSession = await this.emailTriageSessionRepository.findBySessionId(sessionId);

      if (!triageSession) {
        return {
          success: false,
          error: {
            message: "Triage session not found",
            code: "TRIAGE_SESSION_NOT_FOUND",
          },
          sessionId,
        };
      }

      // Check if user owns this triage session
      if (triageSession.userId !== req.user.id) {
        return {
          success: false,
          error: {
            message: "Access denied to triage session",
            code: "TRIAGE_SESSION_ACCESS_DENIED",
          },
          sessionId,
        };
      }

      return {
        success: true,
        sessionId,
        triageSession,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get triage session ${sessionId}: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        error: {
          message: error.message,
          code: "GET_TRIAGE_SESSION_FAILED",
        },
        sessionId,
      };
    }
  }

  /**
   * 🆕 Get user's triage history
   * GET /api/email/triage-history
   */
  @Get("triage-history")
  async getTriageHistory(@Request() req: any) {
    this.logger.log(`Getting triage history for user ${req.user?.id}`);

    try {
      const sessions = await this.emailTriageSessionRepository.findByUserId(
        req.user.id,
        {
          limit: 50,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }
      );

      const stats = await this.emailTriageSessionRepository.getUserStats(req.user.id);

      return {
        success: true,
        sessions,
        stats,
        count: sessions.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get triage history for user ${req.user?.id}: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        error: {
          message: error.message,
          code: "GET_TRIAGE_HISTORY_FAILED",
        },
      };
    }
  }

  /**
   * 🆕 Get user's triage statistics
   * GET /api/email/triage-stats
   */
  @Get("triage-stats")
  async getTriageStats(@Request() req: any) {
    this.logger.log(`Getting triage statistics for user ${req.user?.id}`);

    try {
      const stats = await this.emailTriageSessionRepository.getUserStats(req.user.id);

      return {
        success: true,
        stats,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get triage stats for user ${req.user?.id}: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        error: {
          message: error.message,
          code: "GET_TRIAGE_STATS_FAILED",
        },
      };
    }
  }
}
