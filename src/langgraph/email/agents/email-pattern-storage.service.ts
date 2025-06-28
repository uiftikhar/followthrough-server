import { Injectable, Logger, Inject } from "@nestjs/common";

import { EmailTriageState } from "../dtos/email-triage.dto";
import { VectorIndexes } from "src/pinecone/pinecone-index.service";
import { RAG_SERVICE, RagService } from "src/rag";

/**
 * EmailPatternStorageService - Handles storing email triage patterns for learning
 * Stores successful triage patterns in vector database for future RAG retrieval
 */
@Injectable()
export class EmailPatternStorageService {
  private readonly logger = new Logger(EmailPatternStorageService.name);

  constructor(@Inject(RAG_SERVICE) private readonly ragService: RagService) {}

  /**
   * Store an email triage pattern for future learning
   */
  async storeEmailPattern(state: EmailTriageState): Promise<void> {
    if (!state.classification || !state.summary || !state.replyDraft) {
      this.logger.warn(
        "Cannot store incomplete pattern - missing analysis results",
      );
      return;
    }

    try {
      this.logger.log(`Storing email pattern for session: ${state.sessionId}`);

      // Create pattern document
      const patternDocument = this.createPatternDocument(state);

      // Store in email-triage index with patterns namespace using RagService
      await this.ragService.processDocumentsForRag(
        [
          {
            id: patternDocument.id,
            content: patternDocument.content,
            metadata: patternDocument.metadata,
          },
        ],
        {
          indexName: VectorIndexes.EMAIL_TRIAGE,
          namespace: "email-patterns",
        },
      );

      this.logger.log(
        `Email pattern ${patternDocument.id} stored successfully`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to store email pattern: ${error.message}`,
        error.stack,
      );
      // Don't throw - pattern storage shouldn't break the main flow
    }
  }

  /**
   * Store multiple successful patterns in batch
   */
  async storeBatchPatterns(states: EmailTriageState[]): Promise<void> {
    const validStates = states.filter(
      (state) => state.classification && state.summary && state.replyDraft,
    );

    if (validStates.length === 0) {
      this.logger.warn("No valid patterns to store in batch");
      return;
    }

    try {
      this.logger.log(`Storing ${validStates.length} email patterns in batch`);

      const patternDocuments = validStates.map((state) =>
        this.createPatternDocument(state),
      );

      // Store all patterns using RagService
      await this.ragService.processDocumentsForRag(
        patternDocuments.map((doc) => ({
          id: doc.id,
          content: doc.content,
          metadata: doc.metadata,
        })),
        {
          indexName: VectorIndexes.EMAIL_TRIAGE,
          namespace: "email-patterns",
        },
      );

      this.logger.log(
        `Batch stored ${validStates.length} email patterns successfully`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to store batch patterns: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Create a structured pattern document from email triage state
   */
  private createPatternDocument(state: EmailTriageState) {
    const patternId = `pattern-${state.sessionId}-${Date.now()}`;

    const content = `Email Pattern Analysis:

Subject: ${state.emailData.metadata.subject || "Unknown"}
From: ${state.emailData.metadata.from || "Unknown"}

Classification:
- Priority: ${state.classification!.priority}
- Category: ${state.classification!.category}  
- Confidence: ${state.classification!.confidence}
- Reasoning: ${state.classification!.reasoning}

Summary Analysis:
- Problem: ${state.summary!.problem}
- Context: ${state.summary!.context}
- Ask: ${state.summary!.ask}
- Summary: ${state.summary!.summary}

Reply Approach:
- Tone: ${state.replyDraft!.tone}
- Next Steps: ${state.replyDraft!.next_steps.join(", ")}

Email Content Keywords: ${this.extractKeywords(state.emailData.body).join(", ")}
Processing Context: ${state.retrievedContext?.length || 0} historical patterns referenced

Email Content Sample: ${state.emailData.body.substring(0, 300)}...`;

    const metadata = {
      emailId: state.emailData.id || patternId,
      sessionId: state.sessionId,
      priority: state.classification!.priority,
      category: state.classification!.category,
      confidence: state.classification!.confidence,
      subject: state.emailData.metadata.subject,
      from: state.emailData.metadata.from,
      to: state.emailData.metadata.to,
      replyTone: state.replyDraft!.tone,
      timestamp: new Date().toISOString(),
      type: "email_pattern",
      contextCount: state.retrievedContext?.length || 0,
      keywords: this.extractKeywords(state.emailData.body),
    };

    return {
      id: patternId,
      content,
      metadata,
    };
  }

  /**
   * Extract keywords from email content for pattern indexing
   */
  private extractKeywords(content: string): string[] {
    const stopWords = [
      "the",
      "is",
      "at",
      "which",
      "on",
      "and",
      "a",
      "to",
      "are",
      "as",
      "was",
      "with",
      "for",
      "this",
      "that",
      "have",
      "has",
      "been",
      "will",
      "would",
      "can",
      "could",
    ];

    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.includes(word));

    // Count word frequencies
    const wordCount = words.reduce(
      (acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Return top 15 most frequent words
    return Object.entries(wordCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([word]) => word);
  }

  /**
   * Query similar patterns for analysis
   */
  async findSimilarPatterns(
    emailContent: string,
    emailMetadata: any,
    options: {
      topK?: number;
      minScore?: number;
      category?: string;
      priority?: string;
    } = {},
  ): Promise<any[]> {
    try {
      const query = `Email analysis: Subject: ${emailMetadata.subject} Content: ${emailContent.substring(0, 200)}`;

      const retrievalOptions = {
        indexName: VectorIndexes.EMAIL_TRIAGE,
        namespace: "email-patterns",
        topK: options.topK || 5,
        minScore: options.minScore || 0.7,
        filter: this.buildPatternFilter(options),
      };

      const similarPatterns = await this.ragService.getContext(
        query,
        retrievalOptions,
      );

      this.logger.log(`Found ${similarPatterns.length} similar email patterns`);
      return similarPatterns;
    } catch (error) {
      this.logger.error(`Failed to find similar patterns: ${error.message}`);
      return [];
    }
  }

  /**
   * Build filter for pattern retrieval
   */
  private buildPatternFilter(options: {
    category?: string;
    priority?: string;
  }) {
    const filter: any = { type: "email_pattern" };

    if (options.category) {
      filter.category = options.category;
    }

    if (options.priority) {
      filter.priority = options.priority;
    }

    return filter;
  }
}
