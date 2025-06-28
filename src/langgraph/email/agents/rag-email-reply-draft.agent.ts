import { Injectable, Logger, Inject, Optional } from "@nestjs/common";
import { LLM_SERVICE } from "../../../langgraph/llm/constants/injection-tokens";
import { LlmService } from "../../../langgraph/llm/llm.service";
import { RAG_SERVICE } from "../../../rag/constants/injection-tokens";
import { RagService } from "../../../rag/rag.service";
import { VectorIndexes } from "../../../pinecone/pinecone-index.service";
import { EmailReplyDraftAgent } from "./email-reply-draft.agent";
import { EmailToneAnalysisAgent } from "./email-tone-analysis.agent";
import {
  EmailReplyDraft,
  RagEmailReplyDraftConfig,
  EmailClassification,
  EmailSummary,
  UserToneProfile,
  ToneFeatures,
} from "../dtos/email-triage.dto";

/**
 * RagEmailReplyDraftAgent - Phase 3: RAG-enhanced reply draft generation
 * Uses composition with EmailReplyDraftAgent and adds tone learning capabilities
 */
@Injectable()
export class RagEmailReplyDraftAgent {
  private readonly logger = new Logger(RagEmailReplyDraftAgent.name);
  private readonly ragConfig: RagEmailReplyDraftConfig;

  constructor(
    @Inject(LLM_SERVICE) private readonly llmService: LlmService,
    @Inject(RAG_SERVICE) private readonly ragService: RagService,
    @Optional() private readonly emailReplyDraftAgent?: EmailReplyDraftAgent,
    @Optional() private readonly toneAnalysisAgent?: EmailToneAnalysisAgent,
  ) {
    this.ragConfig = {
      name: "RAG Email Reply Draft Agent",
      systemPrompt: `You are an AI specialized in generating personalized email replies that match user communication styles.
      Use tone analysis and historical patterns to create authentic, personalized responses.`,
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
      toneAdaptationStrength: 0.7, // 70% adaptation to user's tone
      fallbackToBehavior: "professional",
    };
  }

  /**
   * Main method: Generate personalized reply draft using RAG and tone learning
   */
  async generateReplyDraft(
    emailContent: string,
    metadata: any,
    classification: EmailClassification,
    summary: EmailSummary,
  ): Promise<EmailReplyDraft> {
    this.logger.log(`Generating RAG-enhanced reply for: ${metadata.subject}`);

    if (!this.ragConfig.enableToneLearning) {
      // Fallback to basic reply draft agent
      return this.generateBasicReplyDraft(
        emailContent,
        metadata,
        classification,
        summary,
      );
    }

    try {
      // Step 1: Get user tone profile if available
      const userToneProfile = await this.getUserToneProfile(metadata.from);

      // Step 2: Retrieve similar successful reply patterns
      const similarPatterns = await this.getSimilarReplyPatterns(
        emailContent,
        metadata,
        classification,
      );

      // Step 3: Generate tone-adapted reply
      const personalizedReply = await this.generateToneAdaptedReply(
        emailContent,
        metadata,
        classification,
        summary,
        userToneProfile,
        similarPatterns,
      );

      // Step 4: Store successful pattern for future learning (async)
      this.storeReplyPattern(
        emailContent,
        metadata,
        classification,
        personalizedReply,
      ).catch((error) =>
        this.logger.warn(`Failed to store reply pattern: ${error.message}`),
      );

      this.logger.log(`RAG-enhanced reply generated successfully`);
      return personalizedReply;
    } catch (error) {
      this.logger.error(
        `Failed to generate RAG-enhanced reply: ${error.message}`,
      );
      // Fallback to basic reply generation
      return this.generateBasicReplyDraft(
        emailContent,
        metadata,
        classification,
        summary,
      );
    }
  }

  /**
   * Fallback to basic reply draft generation
   */
  private async generateBasicReplyDraft(
    emailContent: string,
    metadata: any,
    classification: EmailClassification,
    summary: EmailSummary,
  ): Promise<EmailReplyDraft> {
    if (this.emailReplyDraftAgent) {
      return this.emailReplyDraftAgent.generateReplyDraft(
        emailContent,
        metadata,
        classification,
        summary,
      );
    }

    // Direct basic implementation if no agent available
    const template = this.selectBaseTemplate(classification);

    return {
      subject: `Re: ${metadata.subject}`,
      body: `Dear ${metadata.from},\n\n${template}\n\nBest regards,\nSupport Team`,
      tone: "professional",
      next_steps: ["Review request", "Respond appropriately"],
    };
  }

  /**
   * Get user tone profile from RAG system
   */
  private async getUserToneProfile(
    userEmail: string,
  ): Promise<UserToneProfile | undefined> {
    if (!this.toneAnalysisAgent) {
      this.logger.warn("Tone analysis agent not available, using default tone");
      return undefined;
    }

    try {
      return await this.toneAnalysisAgent.getUserToneProfile(userEmail);
    } catch (error) {
      this.logger.error(`Failed to get user tone profile: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Retrieve similar successful reply patterns from RAG system
   */
  private async getSimilarReplyPatterns(
    emailContent: string,
    metadata: any,
    classification: EmailClassification,
  ): Promise<any[]> {
    try {
      const query = `Reply draft patterns for ${classification.priority} ${classification.category} email: ${metadata.subject}`;

      const patterns = await this.ragService.getContext(query, {
        indexName: VectorIndexes.EMAIL_TRIAGE,
        namespace: "reply-patterns",
        topK: 3,
        minScore: 0.6,
        filter: {
          type: "reply_pattern",
          priority: classification.priority,
          category: classification.category,
        },
      });

      this.logger.log(`Retrieved ${patterns.length} similar reply patterns`);
      return patterns;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve similar patterns: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Generate tone-adapted reply using user profile and patterns
   */
  private async generateToneAdaptedReply(
    emailContent: string,
    metadata: any,
    classification: EmailClassification,
    summary: EmailSummary,
    userToneProfile: UserToneProfile | undefined,
    similarPatterns: any[],
  ): Promise<EmailReplyDraft> {
    const baseTemplate = this.selectBaseTemplate(classification);
    const toneInstructions = this.buildToneInstructions(userToneProfile);
    const patternContext = this.buildPatternContext(similarPatterns);

    const prompt = `Generate a personalized email reply that matches the user's communication style.

ORIGINAL EMAIL:
Subject: ${metadata.subject}
From: ${metadata.from}
Content: ${emailContent}

ANALYSIS:
Priority: ${classification.priority}
Category: ${classification.category}
Problem: ${summary.problem}
Context: ${summary.context}
Ask: ${summary.ask}

BASE TEMPLATE:
${baseTemplate}

${toneInstructions}

${patternContext}

PERSONALIZATION REQUIREMENTS:
1. Match the user's preferred tone and formality level
2. Use similar phrasing patterns when appropriate
3. Maintain appropriate urgency for ${classification.priority} priority
4. Address their specific problem: ${summary.problem}
5. Provide clear next steps

Generate a professional reply that feels personalized and authentic.

Respond in JSON format:
{
  "subject": "Re: ${metadata.subject}",
  "body": "complete personalized reply",
  "tone": "professional|friendly|urgent|formal|casual",
  "next_steps": ["action1", "action2", "action3"]
}`;

    try {
      const model = this.llmService.getChatModel({
        temperature: 0.4, // Slightly higher for personalization
        maxTokens: 500,
      });

      const response = await model.invoke([
        { role: "system", content: this.ragConfig.systemPrompt },
        { role: "user", content: prompt },
      ]);

      const content = response.content.toString();
      let parsedContent = content;

      // Extract JSON from response
      const jsonMatch =
        content.match(/```json\n([\s\S]*?)\n```/) ||
        content.match(/```\n([\s\S]*?)\n```/) ||
        content.match(/(\{[\s\S]*\})/);

      if (jsonMatch) {
        parsedContent = jsonMatch[1];
      }

      const replyDraft = JSON.parse(parsedContent);

      // Enhance with tone-specific adjustments
      return this.applyToneAdjustments(replyDraft, userToneProfile);
    } catch (error) {
      this.logger.error(
        `Failed to generate tone-adapted reply: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Select appropriate base template for classification
   */
  private selectBaseTemplate(classification: EmailClassification): string {
    return (
      this.ragConfig.replyTemplates[classification.priority] ||
      this.ragConfig.replyTemplates[classification.category] ||
      this.ragConfig.replyTemplates.normal ||
      "Thank you for contacting us. We will address your request promptly."
    );
  }

  /**
   * Build tone instructions based on user profile
   */
  private buildToneInstructions(
    userToneProfile: UserToneProfile | undefined,
  ): string {
    if (!userToneProfile || userToneProfile.confidence < 0.5) {
      return `TONE GUIDELINES: Use ${this.ragConfig.fallbackToBehavior} tone as default.`;
    }

    const style = userToneProfile.communicationStyle;

    return `USER TONE PROFILE (Confidence: ${userToneProfile.confidence.toFixed(2)}):
- Formality: ${style.formality}
- Warmth: ${style.warmth}
- Directness: ${style.directness}
- Technical Level: ${style.technicalLevel}
- Emotional Tone: ${style.emotionalTone}
- Response Length: ${style.responseLength}
- Common Phrases: ${userToneProfile.commonPhrases.slice(0, 5).join(", ")}

ADAPTATION STRENGTH: ${this.ragConfig.toneAdaptationStrength * 100}% - Adapt reply to match user's style while maintaining professionalism.`;
  }

  /**
   * Build context from similar patterns
   */
  private buildPatternContext(patterns: any[]): string {
    if (patterns.length === 0) {
      return "PATTERN CONTEXT: No similar patterns available.";
    }

    const patternSummary = patterns
      .map(
        (pattern, index) =>
          `Pattern ${index + 1}: ${pattern.content?.substring(0, 100)}...`,
      )
      .join("\n");

    return `SIMILAR SUCCESSFUL PATTERNS:
${patternSummary}

Use these patterns as inspiration for structure and tone, but personalize the content.`;
  }

  /**
   * Apply final tone adjustments to the generated reply
   */
  private applyToneAdjustments(
    replyDraft: EmailReplyDraft,
    userToneProfile: UserToneProfile | undefined,
  ): EmailReplyDraft {
    if (!userToneProfile || userToneProfile.confidence < 0.5) {
      return replyDraft;
    }

    const style = userToneProfile.communicationStyle;

    // Adjust tone field based on user's communication style
    let adjustedTone = replyDraft.tone;

    if (style.formality === "casual" && style.warmth === "warm") {
      adjustedTone = "friendly";
    } else if (style.formality === "formal" && style.warmth === "neutral") {
      adjustedTone = "professional";
    } else if (style.urgency === "urgent") {
      adjustedTone = "urgent";
    }

    return {
      ...replyDraft,
      tone: adjustedTone as any,
    };
  }

  /**
   * Store successful reply pattern for future learning
   */
  private async storeReplyPattern(
    emailContent: string,
    metadata: any,
    classification: EmailClassification,
    replyDraft: EmailReplyDraft,
  ): Promise<void> {
    try {
      const patternId = `reply-pattern-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const patternDocument = {
        id: patternId,
        content: `Reply Pattern for ${classification.priority} ${classification.category}:

Original Subject: ${metadata.subject}
Original From: ${metadata.from}
Original Content: ${emailContent.substring(0, 200)}...

Generated Reply:
Subject: ${replyDraft.subject}
Body: ${replyDraft.body}
Tone: ${replyDraft.tone}
Next Steps: ${replyDraft.next_steps.join(", ")}`,
        metadata: {
          type: "reply_pattern",
          priority: classification.priority,
          category: classification.category,
          replyTone: replyDraft.tone,
          originalSubject: metadata.subject,
          originalFrom: metadata.from,
          timestamp: new Date().toISOString(),
        },
      };

      await this.ragService.processDocumentsForRag([patternDocument], {
        indexName: VectorIndexes.EMAIL_TRIAGE,
        namespace: "reply-patterns",
      });

      this.logger.log(`Reply pattern ${patternId} stored successfully`);
    } catch (error) {
      this.logger.error(`Failed to store reply pattern: ${error.message}`);
    }
  }
}
