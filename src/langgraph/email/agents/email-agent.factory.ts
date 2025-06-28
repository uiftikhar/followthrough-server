import { Injectable } from "@nestjs/common";


// Import the existing email agents from the email module
import { EmailClassificationAgent } from "./email-classification.agent";
import { EmailSummarizationAgent } from "./email-summarization.agent";
import { EmailReplyDraftAgent } from "./email-reply-draft.agent";
import { EmailToneAnalysisAgent } from "./email-tone-analysis.agent";
import { EmailDelegationAgent } from "./email-delegation.agent";
import { EmailSnoozeAgent } from "./email-snooze.agent";
import { RagEmailReplyDraftAgent } from "./rag-email-reply-draft.agent";
import { EmailRagSummarizationAgent } from "./email-rag-summarization.agent";

/**
 * EmailAgentFactory
 *
 * Factory for email triage workflow specific agents.
 * This provides access to all agents used in email triage workflows
 * without circular dependencies.
 */
@Injectable()
export class EmailAgentFactory {
  constructor(
    // Core email agents
    private readonly emailClassificationAgent: EmailClassificationAgent,
    private readonly emailSummarizationAgent: EmailSummarizationAgent,
    private readonly emailReplyDraftAgent: EmailReplyDraftAgent,
    private readonly emailToneAnalysisAgent: EmailToneAnalysisAgent,
    private readonly emailDelegationAgent: EmailDelegationAgent,
    private readonly emailSnoozeAgent: EmailSnoozeAgent,

    // RAG-enhanced email agents
    private readonly ragEmailReplyDraftAgent: RagEmailReplyDraftAgent,
    private readonly emailRagSummarizationAgent: EmailRagSummarizationAgent,
  ) {}

  /**
   * Get the email classification agent
   */
  getEmailClassificationAgent(): EmailClassificationAgent {
    return this.emailClassificationAgent;
  }

  /**
   * Get the email summarization agent
   */
  getEmailSummarizationAgent(): EmailSummarizationAgent {
    return this.emailSummarizationAgent;
  }

  /**
   * Get the email reply draft agent
   */
  getEmailReplyDraftAgent(): EmailReplyDraftAgent {
    return this.emailReplyDraftAgent;
  }

  /**
   * Get the email tone analysis agent
   */
  getEmailToneAnalysisAgent(): EmailToneAnalysisAgent {
    return this.emailToneAnalysisAgent;
  }

  /**
   * Get the email delegation agent
   */
  getEmailDelegationAgent(): EmailDelegationAgent {
    return this.emailDelegationAgent;
  }

  /**
   * Get the email snooze agent
   */
  getEmailSnoozeAgent(): EmailSnoozeAgent {
    return this.emailSnoozeAgent;
  }

  /**
   * Get the RAG email reply draft agent
   */
  getRagEmailReplyDraftAgent(): RagEmailReplyDraftAgent {
    return this.ragEmailReplyDraftAgent;
  }

  /**
   * Get the email RAG summarization agent
   */
  getEmailRagSummarizationAgent(): EmailRagSummarizationAgent {
    return this.emailRagSummarizationAgent;
  }

  // TODO: Implement additional getters as agents are added
  /*
  getPriorityAssessmentAgent(): PriorityAssessmentAgent {
    return this.priorityAssessmentAgent;
  }

  getPatternRecognitionAgent(): PatternRecognitionAgent {
    return this.patternRecognitionAgent;
  }

  getDelegationAgent(): DelegationAgent {
    return this.delegationAgent;
  }

  getToneAnalysisAgent(): ToneAnalysisAgent {
    return this.toneAnalysisAgent;
  }
  */

  /**
   * Get all currently implemented email agents
   */
  getAllAgents() {
    return {
      emailClassification: this.emailClassificationAgent,
      emailSummarization: this.emailSummarizationAgent,
      emailReplyDraft: this.emailReplyDraftAgent,
      emailToneAnalysis: this.emailToneAnalysisAgent,
      emailDelegation: this.emailDelegationAgent,
      emailSnooze: this.emailSnoozeAgent,
      ragEmailReplyDraft: this.ragEmailReplyDraftAgent,
      emailRagSummarization: this.emailRagSummarizationAgent,
    };
  }

  /**
   * Get basic email agents (non-RAG)
   */
  getBasicAgents() {
    return {
      classification: this.emailClassificationAgent,
      summarization: this.emailSummarizationAgent,
      replyDraft: this.emailReplyDraftAgent,
      toneAnalysis: this.emailToneAnalysisAgent,
      delegation: this.emailDelegationAgent,
      snooze: this.emailSnoozeAgent,
    };
  }

  /**
   * Get RAG-enhanced email agents
   */
  getRagAgents() {
    return {
      ragReplyDraft: this.ragEmailReplyDraftAgent,
      ragSummarization: this.emailRagSummarizationAgent,
    };
  }

  /**
   * Get agents by category
   */
  getAgentsByCategory() {
    return {
      analysis: {
        classification: this.emailClassificationAgent,
        summarization: this.emailSummarizationAgent,
        toneAnalysis: this.emailToneAnalysisAgent,
      },
      response: {
        replyDraft: this.emailReplyDraftAgent,
        ragReplyDraft: this.ragEmailReplyDraftAgent,
      },
      actions: {
        delegation: this.emailDelegationAgent,
        snooze: this.emailSnoozeAgent,
      },
      rag: {
        ragSummarization: this.emailRagSummarizationAgent,
      },
    };
  }
}
