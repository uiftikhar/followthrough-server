import { Module } from "@nestjs/common";
import { LlmModule } from "../../llm/llm.module";
import { LanggraphCoreModule } from "../../core/core.module";
import { AgentFrameworkModule } from "../../../agent-framework/agent-framework.module";
import { SharedCoreModule } from "../../../shared/shared-core.module";

// Email-specific worker agents
import { EmailClassificationAgent } from "./email-classification.agent";
import { EmailSummarizationAgent } from "./email-summarization.agent";
import { EmailRagSummarizationAgent } from "./email-rag-summarization.agent";
import { EmailReplyDraftAgent } from "./email-reply-draft.agent";

// Phase 3: Tone learning agents
import { EmailToneAnalysisAgent } from "./email-tone-analysis.agent";
import { RagEmailReplyDraftAgent } from "./rag-email-reply-draft.agent";

// Phase 5: Human delegation and workflow agents
import { EmailDelegationAgent } from "./email-delegation.agent";
import { EmailSnoozeAgent } from "./email-snooze.agent";

// Phase 2: Pattern storage service for RAG learning
import { EmailPatternStorageService } from "./email-pattern-storage.service";

// Email agent factory
import { EmailAgentFactory } from "./email-agent.factory";

// Configuration tokens
import {
  EMAIL_CLASSIFICATION_CONFIG,
  EMAIL_SUMMARIZATION_CONFIG,
  EMAIL_REPLY_DRAFT_CONFIG,
  EMAIL_TONE_ANALYSIS_CONFIG,
  RAG_EMAIL_REPLY_DRAFT_CONFIG,
} from "./constants/injection-tokens";

import {
  EmailClassificationConfig,
  EmailSummarizationConfig,
  EmailReplyDraftConfig,
  EmailToneAnalysisConfig,
  RagEmailReplyDraftConfig,
} from "../dtos/email-triage.dto";

/**
 * EmailAgentsModule - Domain Services Layer
 *
 * Contains all agents specifically used for email triage workflows:
 * - Email classification and prioritization
 * - Email summarization and RAG-enhanced summarization
 * - Reply draft generation with tone learning
 * - Pattern recognition and delegation
 * - Snooze recommendations
 *
 * This module is self-contained and has no circular dependencies.
 */
@Module({
  imports: [
    LlmModule, // For LLM services
    LanggraphCoreModule, // For STATE_SERVICE
    AgentFrameworkModule, // For base agent framework
    SharedCoreModule, // For RAG capabilities
  ],
  providers: [
    // Email-specific worker agents
    EmailClassificationAgent,
    EmailSummarizationAgent,
    EmailRagSummarizationAgent,
    EmailReplyDraftAgent,

    // Phase 3: Tone learning agents
    EmailToneAnalysisAgent,
    RagEmailReplyDraftAgent,

    // Phase 5: Human delegation and workflow agents
    EmailDelegationAgent,
    EmailSnoozeAgent,

    // Phase 2: Pattern storage service for RAG learning
    EmailPatternStorageService,

    // Email agent factory
    EmailAgentFactory,

    // Agent configurations
    {
      provide: EMAIL_CLASSIFICATION_CONFIG,
      useFactory: (): EmailClassificationConfig => ({
        name: "Email Classification Agent",
        systemPrompt:
          "You are an AI assistant specialized in classifying support emails by priority and category. Be precise and consistent in your classifications.",
        priorities: ["urgent", "high", "normal", "low"],
        categories: [
          "bug_report",
          "feature_request",
          "question",
          "complaint",
          "praise",
          "other",
        ],
      }),
    },
    {
      provide: EMAIL_SUMMARIZATION_CONFIG,
      useFactory: (): EmailSummarizationConfig => ({
        name: "Email Summarization Agent",
        systemPrompt:
          "You are an AI assistant specialized in summarizing support emails. Extract the core problem, context, and ask clearly and concisely.",
        maxSummaryLength: 200,
      }),
    },
    {
      provide: EMAIL_REPLY_DRAFT_CONFIG,
      useFactory: (): EmailReplyDraftConfig => ({
        name: "Email Reply Draft Agent",
        systemPrompt:
          "You are an AI assistant specialized in generating professional reply drafts for support emails. Create helpful, empathetic, and actionable responses.",
        replyTemplates: {
          urgent:
            "Thank you for reaching out. We understand this is urgent and will prioritize your request. Our team will get back to you within 2 hours.",
          high: "Thank you for contacting us. We have received your request and will respond within 4 hours.",
          normal:
            "Hi {{sender_name}}, Thank you for contacting us. We have received your message and will get back to you within 24 hours.",
          low: "Thank you for your message. We will review your request and respond within 48 hours.",
          bug_report:
            "Thank you for reporting this issue. We will investigate and get back to you with an update soon.",
          feature_request:
            "Thank you for your feature suggestion. We will review it with our product team.",
          question:
            "Thank you for your question. We will provide you with a detailed answer shortly.",
          complaint:
            "Thank you for bringing this to our attention. We take your feedback seriously and will address this promptly.",
          praise:
            "Thank you for your kind words! We really appreciate your feedback.",
        },
      }),
    },
    // Phase 3: Tone learning configurations
    {
      provide: EMAIL_TONE_ANALYSIS_CONFIG,
      useFactory: (): EmailToneAnalysisConfig => ({
        name: "Email Tone Analysis Agent",
        systemPrompt:
          "You are an AI specialized in analyzing communication tone and style patterns from emails. Extract detailed tone characteristics to build personalized user profiles.",
        minSamplesForProfile: 3,
        maxSamplesAnalyzed: 50,
      }),
    },
    {
      provide: RAG_EMAIL_REPLY_DRAFT_CONFIG,
      useFactory: (): RagEmailReplyDraftConfig => ({
        name: "RAG Email Reply Draft Agent",
        systemPrompt:
          "You are an AI specialized in generating personalized email replies that match user communication styles using RAG and tone analysis.",
        replyTemplates: {
          urgent:
            "Thank you for reaching out. We understand this is urgent and will prioritize your request.",
          high: "Thank you for contacting us. We have received your request and will respond promptly.",
          normal:
            "Thank you for contacting us. We have received your message and will get back to you soon.",
          low: "Thank you for your message. We will review your request and respond within 48 hours.",
          bug_report:
            "Thank you for reporting this issue. We will investigate and provide an update.",
          feature_request:
            "Thank you for your feature suggestion. We will review it with our product team.",
          question:
            "Thank you for your question. We will provide you with a detailed answer.",
          complaint:
            "Thank you for bringing this to our attention. We take your feedback seriously.",
          praise:
            "Thank you for your kind words! We really appreciate your feedback.",
        },
        enableToneLearning: true,
        toneAdaptationStrength: 0.7,
        fallbackToBehavior: "professional",
      }),
    },
  ],
  exports: [
    // Export all email agents for use in workflow modules
    EmailClassificationAgent,
    EmailSummarizationAgent,
    EmailRagSummarizationAgent,
    EmailReplyDraftAgent,

    // Phase 3: Export new tone learning agents
    EmailToneAnalysisAgent,
    RagEmailReplyDraftAgent,

    // Phase 5: Export new delegation and workflow agents
    EmailDelegationAgent,
    EmailSnoozeAgent,

    // Phase 2: Export pattern storage service for RAG learning
    EmailPatternStorageService,

    // Export email agent factory for easy access
    EmailAgentFactory,
  ],
})
export class EmailAgentsModule {}
