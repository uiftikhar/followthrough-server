import { Module } from '@nestjs/common';
import { LlmModule } from '../../llm/llm.module';
import { LanggraphCoreModule } from '../../langgraph/core/core.module';
import { AgentFrameworkModule } from '../../agent-framework/agent-framework.module';
import { RagCoreModule } from '../../rag-core/rag-core.module';

// Email-specific worker agents
import { EmailClassificationAgent } from './email-classification.agent';
import { EmailSummarizationAgent } from './email-summarization.agent';
import { EmailRagSummarizationAgent } from './email-rag-summarization.agent';
import { EmailReplyDraftAgent } from './email-reply-draft.agent';

// Phase 5: Human delegation and workflow agents
import { EmailDelegationAgent } from './email-delegation.agent';
import { EmailSnoozeAgent } from './email-snooze.agent';

// Configuration tokens
import {
  EMAIL_CLASSIFICATION_CONFIG,
  EMAIL_SUMMARIZATION_CONFIG,
  EMAIL_REPLY_DRAFT_CONFIG,
} from './constants/injection-tokens';

import {
  EmailClassificationConfig,
  EmailSummarizationConfig,
  EmailReplyDraftConfig,
} from '../dtos/email-triage.dto';

/**
 * EmailAgentsModule - Domain Services Layer
 * Provides all email-specific agents (classification, summarization, reply drafts, delegation, snooze)
 * Part of Phase 1-5 of email triage implementation
 * Follows same pattern as MeetingAgentsModule
 */
@Module({
  imports: [
    LlmModule,              // For LLM services
    LanggraphCoreModule,    // For STATE_SERVICE
    AgentFrameworkModule,   // For base agent framework
    RagCoreModule,          // For RAG capabilities (future)
  ],
  providers: [
    // Phase 1-3: Email-specific worker agents
    EmailClassificationAgent,
    EmailSummarizationAgent,
    EmailRagSummarizationAgent,
    EmailReplyDraftAgent,
    
    // Phase 5: Human delegation and workflow agents
    EmailDelegationAgent,
    EmailSnoozeAgent,
    
    // Agent configurations
    {
      provide: EMAIL_CLASSIFICATION_CONFIG,
      useFactory: (): EmailClassificationConfig => ({
        name: 'Email Classification Agent',
        systemPrompt: 'You are an AI assistant specialized in classifying support emails by priority and category. Be precise and consistent in your classifications.',
        priorities: ['urgent', 'high', 'normal', 'low'],
        categories: ['bug_report', 'feature_request', 'question', 'complaint', 'praise', 'other'],
      }),
    },
    {
      provide: EMAIL_SUMMARIZATION_CONFIG,
      useFactory: (): EmailSummarizationConfig => ({
        name: 'Email Summarization Agent',
        systemPrompt: 'You are an AI assistant specialized in summarizing support emails. Extract the core problem, context, and ask clearly and concisely.',
        maxSummaryLength: 200,
      }),
    },
    {
      provide: EMAIL_REPLY_DRAFT_CONFIG,
      useFactory: (): EmailReplyDraftConfig => ({
        name: 'Email Reply Draft Agent',
        systemPrompt: 'You are an AI assistant specialized in generating professional reply drafts for support emails. Create helpful, empathetic, and actionable responses.',
        replyTemplates: {
          urgent: 'Thank you for reaching out. We understand this is urgent and will prioritize your request. Our team will get back to you within 2 hours.',
          high: 'Thank you for contacting us. We have received your request and will respond within 4 hours.',
          normal: 'Hi {{sender_name}}, Thank you for contacting us. We have received your message and will get back to you within 24 hours.',
          low: 'Thank you for your message. We will review your request and respond within 48 hours.',
          bug_report: 'Thank you for reporting this issue. We will investigate and get back to you with an update soon.',
          feature_request: 'Thank you for your feature suggestion. We will review it with our product team.',
          question: 'Thank you for your question. We will provide you with a detailed answer shortly.',
          complaint: 'Thank you for bringing this to our attention. We take your feedback seriously and will address this promptly.',
          praise: 'Thank you for your kind words! We really appreciate your feedback.',
        },
      }),
    },
  ],
  exports: [
    // Phase 1-3: Export all original agents for use in workflow modules
    EmailClassificationAgent,
    EmailSummarizationAgent,
    EmailRagSummarizationAgent,
    EmailReplyDraftAgent,
    
    // Phase 5: Export new delegation and workflow agents
    EmailDelegationAgent,
    EmailSnoozeAgent,
  ],
})
export class EmailAgentsModule {} 