import { Injectable, Logger } from "@nestjs/common";
import { EmailAgentFactory } from "../../email/agents/email-agent.factory";

// Use a simple interface that matches what our email agents expect
export interface EmailTriageState {
  sessionId: string;
  userId?: string;
  emailData: {
    id: string;
    from: string;
    to: string[];
    subject: string;
    body: string;
    attachments?: Array<{
      name: string;
      size: number;
      contentType: string;
    }>;
    metadata?: Record<string, any>;
  };
  classification?: {
    priority: "urgent" | "high" | "normal" | "low";
    category:
      | "bug_report"
      | "feature_request"
      | "question"
      | "complaint"
      | "praise"
      | "other";
    reasoning: string;
    confidence: number;
  };
  summary?: any;
  replyDraft?: any;
  senderPatterns?: {
    communicationStyle?: string;
    preferredTone?: string;
    responseTimeExpectation?: string;
    frequentTopics?: string[];
  };
  delegationSuggestion?: any;
  stage: string;
  currentStep?: string;
  progress: number;
  error?: any;
  context?: any;
  metadata?: any;
  processingMetadata?: any;
  startTime?: string;
  useRAG?: boolean;
}

@Injectable()
export class EmailTriageNodes {
  private readonly logger = new Logger(EmailTriageNodes.name);

  constructor(private readonly emailAgentFactory: EmailAgentFactory) {}

  /**
   * Initialize the email triage workflow
   */
  initializeEmailTriage = async (
    state: EmailTriageState,
  ): Promise<EmailTriageState> => {
    this.logger.log(
      `Initializing email triage for email ${state.emailData.id}`,
    );

    try {
      // Validate email data
      if (!state.emailData?.body || !state.emailData?.from) {
        throw new Error("Invalid email data - missing required fields");
      }

      return {
        ...state,
        stage: "initialized",
        currentStep: "initialization_complete",
        progress: 10,
        metadata: {
          ...state.metadata,
          startTime: new Date().toISOString(),
          emailLength: state.emailData.body.length,
          hasAttachments: (state.emailData.attachments?.length ?? 0) > 0,
        },
        processingMetadata: {
          agentsUsed: [],
          performanceMetrics: {},
          ragEnhanced: state.useRAG || false,
        },
      };
    } catch (error) {
      this.logger.error(`Error initializing email triage: ${error.message}`);
      return {
        ...state,
        error: error.message,
        stage: "initialization_failed",
        currentStep: "initialization_failed",
      };
    }
  };

  /**
   * Classify the email using EmailClassificationAgent
   */
  classifyEmail = async (
    state: EmailTriageState,
  ): Promise<EmailTriageState> => {
    this.logger.log(`Classifying email ${state.emailData.id}`);

    try {
      const classificationAgent =
        this.emailAgentFactory.getEmailClassificationAgent();

      if (!classificationAgent) {
        this.logger.warn(
          "EmailClassificationAgent not available, using fallback",
        );
        return {
          ...state,
          classification: {
            category: "other",
            priority: "normal",
            confidence: 0.0,
            reasoning: "Classification agent not available",
          },
          stage: "classification_failed",
          progress: 25,
        };
      }

      const startTime = Date.now();
      const classification = await classificationAgent.classifyEmail(
        state.emailData.body,
        {
          subject: state.emailData.subject,
          from: state.emailData.from,
          ...state.emailData.metadata,
        },
      );

      const duration = Date.now() - startTime;

      this.logger.log(
        `Email classified as ${classification.category} with priority ${classification.priority} (${duration}ms)`,
      );

      return this.formatClassificationResult(state, classification);
    } catch (error) {
      this.logger.error(`Error classifying email: ${(error as Error).message}`);

      return {
        ...state,
        classification: {
          category: "other",
          priority: "normal",
          confidence: 0.0,
          reasoning: "Classification failed",
        },
        stage: "classification_failed",
        progress: 25,
        error: `Classification failed: ${(error as Error).message}`,
      };
    }
  };

  private formatClassificationResult(
    state: EmailTriageState,
    classification: any,
  ): EmailTriageState {
    const validPriorities = ["urgent", "high", "normal", "low"];
    const validatedPriority = validPriorities.includes(classification.priority)
      ? classification.priority
      : "normal";

    return {
      ...state,
      classification: {
        category: classification.category || "other",
        priority: validatedPriority as "urgent" | "high" | "normal" | "low",
        confidence: Math.max(0, Math.min(1, classification.confidence || 0)),
        reasoning: classification.reasoning || "Automatic classification",
      },
      stage: "classification_completed",
      progress: 25,
      processingMetadata: {
        ...state.processingMetadata,
        classificationDetails: {
          hasAttachments: (state.emailData.attachments?.length ?? 0) > 0,
          wordCount: state.emailData.body?.length || 0,
          processedAt: new Date().toISOString(),
        },
      },
    };
  }

  /**
   * Summarize the email using EmailSummarizationAgent or EmailRagSummarizationAgent
   */
  summarizeEmail = async (
    state: EmailTriageState,
  ): Promise<EmailTriageState> => {
    this.logger.log(`Summarizing email ${state.emailData.id}`);

    try {
      const startTime = Date.now();
      let summary;
      let agentUsed = "";

      // Prefer RAG-enhanced summarization if available and RAG is enabled
      const ragSummarizationAgent =
        this.emailAgentFactory.getEmailRagSummarizationAgent();
      const regularSummarizationAgent =
        this.emailAgentFactory.getEmailSummarizationAgent();

      if (state.useRAG && ragSummarizationAgent) {
        this.logger.log("Using RAG-enhanced email summarization");
        summary = await ragSummarizationAgent.summarizeEmail(
          state.emailData.body,
          state.emailData.metadata || {},
        );
        agentUsed = "EmailRagSummarizationAgent";
      } else if (regularSummarizationAgent) {
        this.logger.log("Using regular email summarization");
        summary = await regularSummarizationAgent.summarizeEmail(
          state.emailData.body,
          state.emailData.metadata || {},
        );
        agentUsed = "EmailSummarizationAgent";
      } else {
        this.logger.warn("No summarization agent available, using fallback");
        summary = {
          briefSummary: "Unable to generate summary automatically",
          keyPoints: ["Email processing incomplete"],
          sentiment: "neutral" as const,
        };
        agentUsed = "FallbackSummarization";
      }

      const duration = Date.now() - startTime;

      this.logger.log(`Email summarized using ${agentUsed} (${duration}ms)`);

      return {
        ...state,
        summary: {
          briefSummary:
            summary.summary || summary.briefSummary || "Summary not available",
          keyPoints: summary.keyPoints || [],
          actionItems: summary.actionItems || [],
          sentiment: summary.sentiment || "neutral",
        },
        stage: "summarization_completed",
        currentStep: "summarization_completed",
        progress: 50,
        processingMetadata: {
          ...state.processingMetadata,
          agentsUsed: [
            ...(state.processingMetadata?.agentsUsed || []),
            agentUsed,
          ],
          performanceMetrics: {
            ...state.processingMetadata?.performanceMetrics,
            summarizationMs: duration,
          },
          ragEnhanced:
            state.useRAG && agentUsed === "EmailRagSummarizationAgent",
        },
      };
    } catch (error) {
      this.logger.error(`Error summarizing email: ${error.message}`);
      return {
        ...state,
        error: error.message,
        stage: "summarization_failed",
        currentStep: "summarization_failed",
        summary: {
          briefSummary: "Summarization failed",
          keyPoints: ["Error occurred during summarization"],
          sentiment: "neutral",
        },
      };
    }
  };

  /**
   * Generate reply draft using EmailReplyDraftAgent or RagEmailReplyDraftAgent
   */
  generateReplyDraft = async (
    state: EmailTriageState,
  ): Promise<EmailTriageState> => {
    this.logger.log(`Generating reply draft for email ${state.emailData.id}`);

    try {
      if (!state.classification || !state.summary) {
        this.logger.warn(
          "Missing classification or summary for reply draft generation",
        );
        return {
          ...state,
          error: "Missing classification or summary for reply generation",
          stage: "reply_generation_failed",
          currentStep: "reply_generation_failed",
        };
      }

      const startTime = Date.now();
      let replyDraft;
      let agentUsed = "";

      // Prefer RAG-enhanced reply draft if available and RAG is enabled
      const ragReplyDraftAgent =
        this.emailAgentFactory.getRagEmailReplyDraftAgent();
      const regularReplyDraftAgent =
        this.emailAgentFactory.getEmailReplyDraftAgent();

      if (state.useRAG && ragReplyDraftAgent) {
        this.logger.log("Using RAG-enhanced email reply draft generation");
        replyDraft = await ragReplyDraftAgent.generateReplyDraft(
          state.emailData.body,
          state.emailData.metadata || {},
          state.classification,
          state.summary,
        );
        agentUsed = "RagEmailReplyDraftAgent";
      } else if (regularReplyDraftAgent) {
        this.logger.log("Using regular email reply draft generation");
        replyDraft = await regularReplyDraftAgent.generateReplyDraft(
          state.emailData.body,
          state.emailData.metadata || {},
          state.classification,
          state.summary,
        );
        agentUsed = "EmailReplyDraftAgent";
      } else {
        this.logger.warn("No reply draft agent available, using fallback");
        replyDraft = {
          subject: `Re: ${state.emailData.subject}`,
          body: "Thank you for your email. We will get back to you soon.",
          tone: "professional" as const,
          confidence: 0.0,
          suggestedActions: [
            {
              action: "review" as const,
              reason:
                "Reply draft agent not available - requires manual review",
            },
          ],
        };
        agentUsed = "FallbackReplyDraft";
      }

      const duration = Date.now() - startTime;

      this.logger.log(
        `Reply draft generated using ${agentUsed} (${duration}ms)`,
      );

      return {
        ...state,
        replyDraft: {
          subject: replyDraft.subject,
          body: replyDraft.body,
          tone: replyDraft.tone,
          confidence: replyDraft.confidence,
          suggestedActions: replyDraft.suggestedActions || [],
        },
        stage: "reply_generation_completed",
        currentStep: "reply_generation_completed",
        progress: 75,
        processingMetadata: {
          ...state.processingMetadata,
          agentsUsed: [
            ...(state.processingMetadata?.agentsUsed || []),
            agentUsed,
          ],
          performanceMetrics: {
            ...state.processingMetadata?.performanceMetrics,
            replyDraftMs: duration,
          },
        },
      };
    } catch (error) {
      this.logger.error(`Error generating reply draft: ${error.message}`);
      return {
        ...state,
        error: error.message,
        stage: "reply_generation_failed",
        currentStep: "reply_generation_failed",
        replyDraft: {
          subject: `Re: ${state.emailData.subject}`,
          body: "Error occurred while generating reply draft",
          tone: "professional",
          confidence: 0.0,
        },
      };
    }
  };

  /**
   * Analyze sender patterns using EmailToneAnalysisAgent (optional step)
   */
  analyzeSenderPatterns = async (
    state: EmailTriageState,
  ): Promise<EmailTriageState> => {
    this.logger.log(
      `Analyzing sender patterns for email ${state.emailData.id}`,
    );

    try {
      // For now, provide a simple fallback implementation
      // This will be enhanced when the proper agent methods are available
      const formattedPatterns = {
        communicationStyle: "professional", // Default
        preferredTone: "professional", // Default
        responseTimeExpectation: "24h",
        frequentTopics: [], // Default empty
      };

      return {
        ...state,
        senderPatterns: formattedPatterns,
        stage: "patterns_analyzed",
        progress: 70,
      };
    } catch (error) {
      this.logger.error(
        `Error analyzing sender patterns: ${(error as Error).message}`,
      );

      return {
        ...state,
        error: `Failed to analyze sender patterns: ${(error as Error).message}`,
        stage: "patterns_analysis_failed",
        senderPatterns: {
          communicationStyle: "unknown",
          preferredTone: "professional",
          responseTimeExpectation: "24h",
          frequentTopics: [],
        },
      };
    }
  };

  /**
   * Generate delegation suggestions using EmailDelegationAgent (optional step)
   */
  generateDelegationSuggestion = async (
    state: EmailTriageState,
  ): Promise<EmailTriageState> => {
    this.logger.log(
      `Generating delegation suggestion for email ${state.emailData.id}`,
    );

    try {
      // For now, provide a simple fallback implementation
      // This will be enhanced when the proper agent methods are available
      const shouldDelegate =
        state.classification?.priority === "urgent" ||
        state.classification?.priority === "high";

      const formattedDelegation = {
        recommended: shouldDelegate,
        suggestedAssignee: shouldDelegate ? "support_team" : null,
        department: shouldDelegate ? "customer_support" : null,
        reasoning: shouldDelegate
          ? "High/urgent priority email may require delegation"
          : "Normal priority, no delegation needed",
        confidence: 0.7,
        urgencyLevel: state.classification?.priority || "normal",
      };

      return {
        ...state,
        delegationSuggestion: formattedDelegation,
        stage: "delegation_completed",
        progress: 85,
      };
    } catch (error) {
      this.logger.error(
        `Error generating delegation suggestion: ${(error as Error).message}`,
      );

      return {
        ...state,
        error: `Failed to generate delegation suggestion: ${(error as Error).message}`,
        stage: "delegation_failed",
        delegationSuggestion: {
          recommended: false,
          reasoning: "Delegation analysis failed",
          confidence: 0.0,
        },
      };
    }
  };

  /**
   * Finalize the email triage workflow
   */
  finalizeEmailTriage = async (
    state: EmailTriageState,
  ): Promise<EmailTriageState> => {
    this.logger.log(`Finalizing email triage for email ${state.emailData.id}`);

    try {
      const endTime = new Date().toISOString();
      const startTime = state.startTime || state.metadata?.startTime;
      const totalDuration = startTime
        ? Date.now() - new Date(startTime).getTime()
        : 0;

      this.logger.log(
        `Email triage completed for ${state.emailData.id} in ${totalDuration}ms. ` +
          `Classification: ${state.classification?.category || "unknown"}, ` +
          `Priority: ${state.classification?.priority || "unknown"}, ` +
          `Reply confidence: ${state.replyDraft?.confidence || 0}`,
      );

      return {
        ...state,
        stage: "completed",
        currentStep: "workflow_completed",
        progress: 100,
        metadata: {
          ...state.metadata,
          endTime,
          totalDuration,
          workflowCompleted: true,
        },
        processingMetadata: {
          ...state.processingMetadata,
          performanceMetrics: {
            ...state.processingMetadata?.performanceMetrics,
            totalDurationMs: totalDuration,
          },
        },
      };
    } catch (error) {
      this.logger.error(`Error finalizing email triage: ${error.message}`);
      return {
        ...state,
        error: error.message,
        stage: "finalization_failed",
        currentStep: "finalization_failed",
        progress: 100,
      };
    }
  };
}
