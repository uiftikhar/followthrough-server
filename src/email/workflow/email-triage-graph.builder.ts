import { Injectable, Logger, Optional, Inject } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { EmailTriageState, EmailTriageResult, UserToneProfile } from "../dtos/email-triage.dto";

// Import all email agents for direct injection
import { EmailClassificationAgent } from "../agents/email-classification.agent";
import { EmailSummarizationAgent } from "../agents/email-summarization.agent";
import { EmailRagSummarizationAgent } from "../agents/email-rag-summarization.agent";
import { EmailReplyDraftAgent } from "../agents/email-reply-draft.agent";
import { EmailDelegationAgent } from "../agents/email-delegation.agent";
import { EmailSnoozeAgent } from "../agents/email-snooze.agent";

// Phase 3: Import tone learning agents
import { EmailToneAnalysisAgent } from "../agents/email-tone-analysis.agent";
import { RagEmailReplyDraftAgent } from "../agents/rag-email-reply-draft.agent";

// Import RAG services for context enrichment
import { RAG_SERVICE } from "../../rag/constants/injection-tokens";
import { RagService } from "../../rag/rag.service";
import { VectorIndexes } from "../../pinecone/pinecone-index.service";
import { EmailPatternStorageService } from "../agents/email-pattern-storage.service";

/**
 * EmailTriageGraphBuilder - Fully agentic graph-based workflow for email triage
 * Enhanced with RAG context enrichment, pattern learning, and tone adaptation (Phase 3)
 * Implements true parallel processing (Phase 4)
 * Follows the MeetingAnalysisGraphBuilder pattern with direct agent injection
 * Each node performs actual agent work instead of delegating to a manager
 */
@Injectable()
export class EmailTriageGraphBuilder {
  private readonly logger = new Logger(EmailTriageGraphBuilder.name);

  // Node names for enhanced email triage graph
  private readonly nodeNames = {
    START: "__start__",
    INITIALIZATION: "initialization",
    CONTEXT_ENRICHMENT: "context_enrichment",
    PARALLEL_ANALYSIS: "parallel_analysis", // Phase 4: True parallel processing
    COORDINATION: "coordination",
    REPLY_DRAFT: "reply_draft",
    PATTERN_STORAGE: "pattern_storage",
    FINALIZATION: "finalization",
    END: "__end__",
  };

  constructor(
    // Add EventEmitter for notifications
    private readonly eventEmitter: EventEmitter2,
    
    // Inject all email agents with @Optional decorators for graceful fallbacks
    @Optional()
    private readonly emailClassificationAgent?: EmailClassificationAgent,
    @Optional()
    private readonly emailSummarizationAgent?: EmailSummarizationAgent,
    @Optional()
    private readonly emailRagSummarizationAgent?: EmailRagSummarizationAgent,
    @Optional()
    private readonly emailReplyDraftAgent?: EmailReplyDraftAgent,
    @Optional()
    private readonly emailDelegationAgent?: EmailDelegationAgent,
    @Optional()
    private readonly emailSnoozeAgent?: EmailSnoozeAgent,
    // Phase 3: Inject tone learning agents
    @Optional()
    private readonly emailToneAnalysisAgent?: EmailToneAnalysisAgent,
    @Optional()
    private readonly ragEmailReplyDraftAgent?: RagEmailReplyDraftAgent,
    // Phase 2: Inject RAG service for context enrichment
    @Optional()
    @Inject(RAG_SERVICE)
    private readonly ragService?: RagService,
    // Phase 2: Inject pattern storage service
    @Optional()
    private readonly emailPatternStorageService?: EmailPatternStorageService,
  ) {}

  /**
   * Build the enhanced email triage graph with RAG context enrichment, tone learning, and true parallel processing
   */
  async buildGraph(): Promise<any> {
    this.logger.log("Building RAG-enhanced agentic email triage graph - Phase 3 & 4");

    // Create enhanced graph structure for email triage
    const graph = {
      nodes: this.buildNodes(),
      edges: this.defineEdges(),
      entryPoint: this.nodeNames.START,
      exitPoint: this.nodeNames.END,
    };

    this.logger.log("RAG-enhanced agentic email triage graph with tone learning and true parallel processing built successfully");
    return graph;
  }

  /**
   * Build the nodes for the enhanced email triage graph
   */
  private buildNodes(): Record<string, Function> {
    return {
      [this.nodeNames.START]: this.startNode.bind(this),
      [this.nodeNames.INITIALIZATION]: this.initializationNode.bind(this),
      [this.nodeNames.CONTEXT_ENRICHMENT]: this.contextEnrichmentNode.bind(this),
      [this.nodeNames.PARALLEL_ANALYSIS]: this.parallelAnalysisNode.bind(this),
      [this.nodeNames.COORDINATION]: this.coordinationNode.bind(this),
      [this.nodeNames.REPLY_DRAFT]: this.replyDraftNode.bind(this),
      [this.nodeNames.PATTERN_STORAGE]: this.patternStorageNode.bind(this),
      [this.nodeNames.FINALIZATION]: this.finalizationNode.bind(this),
      [this.nodeNames.END]: this.endNode.bind(this),
    };
  }

  /**
   * Define the edges for RAG-enhanced flow
   * Enhanced flow: START -> INITIALIZATION -> CONTEXT_ENRICHMENT -> parallel(CLASSIFICATION + SUMMARIZATION) -> COORDINATION -> REPLY_DRAFT -> PATTERN_STORAGE -> FINALIZATION -> END
   */
  private defineEdges(): Array<{ from: string; to: string }> {
    return [
      { from: this.nodeNames.START, to: this.nodeNames.INITIALIZATION },
      { from: this.nodeNames.INITIALIZATION, to: this.nodeNames.CONTEXT_ENRICHMENT },
      { from: this.nodeNames.CONTEXT_ENRICHMENT, to: this.nodeNames.PARALLEL_ANALYSIS },
      { from: this.nodeNames.PARALLEL_ANALYSIS, to: this.nodeNames.COORDINATION },
      { from: this.nodeNames.COORDINATION, to: this.nodeNames.REPLY_DRAFT },
      { from: this.nodeNames.REPLY_DRAFT, to: this.nodeNames.PATTERN_STORAGE },
      { from: this.nodeNames.PATTERN_STORAGE, to: this.nodeNames.FINALIZATION },
      { from: this.nodeNames.FINALIZATION, to: this.nodeNames.END },
    ];
  }

  /**
   * Start node - initialize email triage state
   */
  private async startNode(state: EmailTriageState): Promise<EmailTriageState> {
    this.logger.log(`Starting RAG-enhanced agentic email triage for session: ${state.sessionId}`);
    return {
      ...state,
      currentStep: "started",
      progress: 5,
    };
  }

  /**
   * Initialization node - Prepare and validate email data for processing
   */
  private async initializationNode(
    state: EmailTriageState,
  ): Promise<EmailTriageState> {
    this.logger.log("Initializing RAG-enhanced email triage process");

    try {
      // Validate email data structure
      if (
        !state.emailData ||
        !state.emailData.body ||
        !state.emailData.metadata
      ) {
        throw new Error("Invalid email data structure - missing body or metadata");
      }

      // Log available agents and services for debugging
      this.logger.log(
        `Available services: Classification=${!!this.emailClassificationAgent}, ` +
        `Summarization=${!!this.emailSummarizationAgent}, ` +
        `RAG_Summarization=${!!this.emailRagSummarizationAgent}, ` +
        `ReplyDraft=${!!this.emailReplyDraftAgent}, ` +
        `RAG_Service=${!!this.ragService}`
      );

      return {
        ...state,
        currentStep: "initialized",
        progress: 10,
      };
    } catch (error) {
      this.logger.error(`Error in initialization: ${error.message}`, error.stack);
      return {
        ...state,
        error: {
          message: error.message,
          stage: "initialization",
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * ENHANCED - Context Enrichment Node (Phase 5)
   * Comprehensive RAG context retrieval from multiple namespaces
   * Retrieves relevant email patterns, tone profiles, and reply patterns before analysis
   */
  private async contextEnrichmentNode(
    state: EmailTriageState,
  ): Promise<EmailTriageState> {
    const startTime = Date.now();
    
    try {
      this.logger.log("🔍 Enhanced context retrieval starting - Phase 5 implementation");

      if (!this.ragService) {
        this.logger.warn("RAG service not available, proceeding without context enrichment");
        return {
          ...state,
          currentStep: "context_enrichment",
          progress: 15,
          retrievedContext: [],
          contextRetrievalResults: {
            totalQueries: 0,
            totalDocuments: 0,
            namespaces: [],
            retrievalDuration: 0,
            retrievedAt: new Date().toISOString(),
          },
        };
      }

      // Initialize processing metadata
      const processingMetadata = {
        ...state.processingMetadata,
        startedAt: state.processingMetadata?.startedAt || new Date().toISOString(),
        ragEnhanced: true,
        agentsUsed: state.processingMetadata?.agentsUsed || [],
      };

      // Generate comprehensive retrieval queries for multiple contexts
      const retrievalQueries = [
        // Historical email patterns
        {
          query: `Subject: ${state.emailData.metadata.subject || 'Email'} Content: ${state.emailData.body.substring(0, 200)}`,
          namespace: "email-patterns",
          purpose: "historical_patterns",
          topK: 3,
        },
        // Email classification patterns
        {
          query: `Email classification priority category: ${state.emailData.metadata.subject} from ${state.emailData.metadata.from}`,
          namespace: "email-patterns", 
          purpose: "classification_patterns",
          topK: 2,
        },
        // Email summarization examples
        {
          query: `Email summary analysis: ${this.extractKeywords(state.emailData.body).join(' ')}`,
          namespace: "email-summaries",
          purpose: "summarization_examples",
          topK: 2,
        },
        // Reply pattern examples
        {
          query: `Email reply patterns for: ${state.emailData.metadata.subject}`,
          namespace: "reply-patterns",
          purpose: "reply_examples", 
          topK: 2,
        },
      ];

      // Add user tone profile retrieval if userId is available
      if (state.emailData.metadata.userId) {
        retrievalQueries.push({
          query: `User tone profile for: ${state.emailData.metadata.from}`,
          namespace: "user-tone-profiles",
          purpose: "user_tone_profile",
          topK: 1,
        });
      }

      this.logger.log(`📊 Executing ${retrievalQueries.length} context retrieval queries across ${new Set(retrievalQueries.map(q => q.namespace)).size} namespaces`);

      // Execute all retrieval queries in parallel
      const contextPromises = retrievalQueries.map(async (queryConfig) => {
        try {
          const results = await this.ragService!.getContext(queryConfig.query, {
            indexName: VectorIndexes.EMAIL_TRIAGE,
            namespace: queryConfig.namespace,
            topK: queryConfig.topK,
            minScore: 0.6, // Consistent threshold
          });

          // Enhance results with query metadata
          return results.map(doc => ({
            ...doc,
            namespace: queryConfig.namespace,
            purpose: queryConfig.purpose,
            queryText: queryConfig.query,
          }));
        } catch (error) {
          this.logger.error(`Failed to retrieve from namespace ${queryConfig.namespace}: ${error.message}`);
          return [];
        }
      });

      const contextResults = await Promise.all(contextPromises);
      const retrievedContext = contextResults.flat().slice(0, 15); // Max 15 documents total

      // Extract user tone profile if available
      let userToneProfile: UserToneProfile | undefined;
      const toneProfileDocs = retrievedContext.filter(doc => doc.namespace === "user-tone-profiles");
      if (toneProfileDocs.length > 0 && this.emailToneAnalysisAgent) {
        try {
          // Reconstruct tone profile from RAG data
          userToneProfile = await this.emailToneAnalysisAgent.reconstructToneProfileFromRAG(toneProfileDocs[0]);
          this.logger.log(`👤 Retrieved user tone profile for: ${state.emailData.metadata.from}`);
        } catch (error) {
          this.logger.error(`Failed to reconstruct tone profile: ${error.message}`);
        }
      }

      const endTime = Date.now();
      const retrievalDuration = endTime - startTime;

      // Create comprehensive context retrieval results
      const contextRetrievalResults = {
        totalQueries: retrievalQueries.length,
        totalDocuments: retrievedContext.length,
        namespaces: [...new Set(retrievedContext.map(doc => doc.namespace).filter(Boolean))],
        retrievalDuration,
        retrievedAt: new Date().toISOString(),
      };

      this.logger.log(
        `📋 Enhanced context retrieval completed: ${retrievedContext.length} documents from ${contextRetrievalResults.namespaces.length} namespaces in ${retrievalDuration}ms`
      );

      // Log detailed breakdown
      contextRetrievalResults.namespaces.forEach(namespace => {
        const count = retrievedContext.filter(doc => doc.namespace === namespace).length;
        this.logger.log(`  📁 ${namespace}: ${count} documents`);
      });

      return {
        ...state,
        currentStep: "context_enrichment",
        progress: 15,
        retrievedContext,
        userToneProfile,
        contextRetrievalResults,
        processingMetadata: {
          ...processingMetadata,
          performanceMetrics: {
            ...processingMetadata.performanceMetrics,
            contextRetrievalMs: retrievalDuration,
          },
        },
      };
    } catch (error) {
      const endTime = Date.now();
      const retrievalDuration = endTime - startTime;
      
      this.logger.error(
        `Error in enhanced context enrichment: ${error.message}`,
        error.stack,
      );
      
      return {
        ...state,
        currentStep: "context_enrichment",
        progress: 15,
        retrievedContext: [],
        contextRetrievalResults: {
          totalQueries: 0,
          totalDocuments: 0,
          namespaces: [],
          retrievalDuration,
          retrievedAt: new Date().toISOString(),
        },
        error: {
          message: error.message,
          stage: "context_enrichment",
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Helper method to extract keywords from email content
   */
  private extractKeywords(content: string): string[] {
    // Simple keyword extraction (can be enhanced with NLP)
    const stopWords = ['the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'are', 'as', 'was', 'with', 'for'];
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.includes(word));
    
    // Return top 10 most frequent words
    const wordCount = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * ENHANCED Phase 4: True Parallel Analysis Node with Performance Tracking
   * Executes classification and summarization in true parallel using Promise.all()
   * Enhanced with detailed performance metrics and state management (Phase 6)
   */
  private async parallelAnalysisNode(
    state: EmailTriageState,
  ): Promise<EmailTriageState> {
    const startTime = Date.now();
    
    try {
      this.logger.log("🔄 Executing enhanced true parallel analysis (classification + summarization) - Phase 6");

      if (!this.emailClassificationAgent && !this.emailSummarizationAgent && !this.emailRagSummarizationAgent) {
        this.logger.warn("No analysis agents available");
        return {
          ...state,
          currentStep: "parallel_analysis",
          progress: 50,
          error: {
            message: "No analysis agents available",
            stage: "parallel_analysis",
            timestamp: new Date().toISOString(),
          },
        };
      }

       // Extract user tone profile if available
       let userToneProfile: UserToneProfile | undefined;
       const toneProfileDocs = state.retrievedContext?.filter(doc => doc.namespace === "user-tone-profiles") || [];
       if (toneProfileDocs.length > 0 && this.emailToneAnalysisAgent) {
         try {
           // Reconstruct tone profile from RAG data
           const profile = await this.emailToneAnalysisAgent.reconstructToneProfileFromRAG(toneProfileDocs[0]);
           userToneProfile = profile || undefined;
           this.logger.log(`👤 Retrieved user tone profile for: ${state.emailData.metadata.from}`);
         } catch (error) {
           this.logger.error(`Failed to reconstruct tone profile: ${error.message}`);
         }
       }

       // Update processing metadata with agents used
       const agentsUsed = [...(state.processingMetadata?.agentsUsed || [])];
       if (this.emailClassificationAgent) agentsUsed.push('EmailClassificationAgent');
       if (this.emailRagSummarizationAgent) agentsUsed.push('EmailRagSummarizationAgent');
       else if (this.emailSummarizationAgent) agentsUsed.push('EmailSummarizationAgent');

       // Track parallel execution timing
       const classificationStartTime = Date.now();
       const summarizationStartTime = Date.now();

       // Execute classification and summarization in TRUE parallel using Promise.all()
       const [classificationResult, summarizationResult] = await Promise.all([
         this.executeClassificationWithTiming(state, classificationStartTime),
         this.executeSummarizationWithTiming(state, summarizationStartTime),
       ]);

       const endTime = Date.now();
       const parallelDuration = endTime - startTime;

       // Create comprehensive performance metrics
       const parallelResults = {
         classificationStarted: true,
         summarizationStarted: true,
         classificationCompleted: true,
         summarizationCompleted: true,
         parallelCompletedAt: new Date().toISOString(),
         parallelDuration,
       };

       this.logger.log(`✅ Enhanced parallel analysis completed in ${parallelDuration}ms - Priority: ${classificationResult.priority}, Category: ${classificationResult.category}`);

       return {
         ...state,
         classification: classificationResult,
         summary: summarizationResult,
         userToneProfile,
         currentStep: "parallel_analysis",
         progress: 50,
         parallelResults,
         processingMetadata: {
           ...state.processingMetadata,
           agentsUsed,
           performanceMetrics: {
             ...state.processingMetadata?.performanceMetrics,
             classificationMs: classificationResult.timing,
             summarizationMs: summarizationResult.timing,
           },
         },
       };
    } catch (error) {
      const endTime = Date.now();
      const parallelDuration = endTime - startTime;
      
      this.logger.error(
        `Error in enhanced parallel analysis: ${error.message}`,
        error.stack,
      );
      return {
        ...state,
        currentStep: "parallel_analysis",
        progress: 50,
        parallelResults: {
          classificationStarted: true,
          summarizationStarted: true,
          classificationCompleted: false,
          summarizationCompleted: false,
          parallelCompletedAt: new Date().toISOString(),
          parallelDuration,
        },
        error: {
          message: error.message,
          stage: "parallel_analysis",
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Helper: Execute email classification with timing
   */
  private async executeClassificationWithTiming(state: EmailTriageState, startTime: number) {
    if (!this.emailClassificationAgent) {
      this.logger.warn("EmailClassificationAgent not available, using fallback");
      return {
        priority: "normal" as const,
        category: "other" as const,
        reasoning: "Classification agent not available",
        confidence: 0.0,
        timing: Date.now() - startTime,
      };
    }

    try {
      const result = await this.emailClassificationAgent.classifyEmail(
        state.emailData.body,
        state.emailData.metadata,
      );
      return {
        ...result,
        timing: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Classification failed: ${error.message}`);
      return {
        priority: "normal" as const,
        category: "other" as const,
        reasoning: "Classification failed",
        confidence: 0.0,
        timing: Date.now() - startTime,
      };
    }
  }

  /**
   * Helper: Execute email summarization with timing
   */
  private async executeSummarizationWithTiming(state: EmailTriageState, startTime: number) {
    // Prefer RAG-enhanced summarization if available
    if (this.emailRagSummarizationAgent) {
      this.logger.log("Using RAG-enhanced email summarization agent with timing");
      try {
        const result = await this.emailRagSummarizationAgent.summarizeEmail(
          state.emailData.body,
          state.emailData.metadata,
        );
        return {
          ...result,
          timing: Date.now() - startTime,
        };
      } catch (error) {
        this.logger.error(`RAG summarization failed: ${error.message}`);
      }
    }

    // Fallback to regular summarization agent
    if (this.emailSummarizationAgent) {
      this.logger.log("Using regular email summarization agent with timing");
      try {
        const result = await this.emailSummarizationAgent.summarizeEmail(
          state.emailData.body,
          state.emailData.metadata,
        );
        return {
          ...result,
          timing: Date.now() - startTime,
        };
      } catch (error) {
        this.logger.error(`Regular summarization failed: ${error.message}`);
      }
    }

    this.logger.warn("No summarization agent available, using fallback");
    return {
      problem: "Unable to identify specific problem",
      context: "Summarization agent not available",
      ask: "Unable to determine request",
      summary: "Failed to summarize email automatically",
      timing: Date.now() - startTime,
    };
  }

  /**
   * Enhanced Reply draft node - Use RagEmailReplyDraftAgent for tone-adapted replies
   * Phase 6: Enhanced with performance tracking
   */
  private async replyDraftNode(
    state: EmailTriageState,
  ): Promise<EmailTriageState> {
    const startTime = Date.now();
    
    try {
      this.logger.log("🎭 Generating tone-adapted reply draft using RAG capabilities with performance tracking");

      // Prefer RAG-enhanced reply draft agent for tone learning
      if (this.ragEmailReplyDraftAgent) {
        this.logger.log("Using RAG Email Reply Draft Agent with tone learning");
        
        if (!state.classification || !state.summary) {
          this.logger.warn("Missing classification or summary for reply draft generation");
          // Create fallback values if missing
          const fallbackClassification = state.classification || {
            priority: "normal" as const,
            category: "other" as const,
            reasoning: "Missing classification",
            confidence: 0.0,
          };
          
          const fallbackSummary = state.summary || {
            problem: "Unable to identify problem",
            context: "Missing summary",
            ask: "Unable to determine request",
            summary: "Email processing incomplete",
          };

          const replyDraft = await this.ragEmailReplyDraftAgent.generateReplyDraft(
            state.emailData.body,
            state.emailData.metadata,
            fallbackClassification,
            fallbackSummary,
          );

          const replyDraftMs = Date.now() - startTime;

          return {
            ...state,
            replyDraft,
            currentStep: "reply_draft",
            progress: 80,
            processingMetadata: {
              ...state.processingMetadata,
              performanceMetrics: {
                ...state.processingMetadata?.performanceMetrics,
                replyDraftMs,
              },
            },
          };
        }

        const replyDraft = await this.ragEmailReplyDraftAgent.generateReplyDraft(
          state.emailData.body,
          state.emailData.metadata,
          state.classification,
          state.summary,
        );

        const replyDraftMs = Date.now() - startTime;

        this.logger.log(`Tone-adapted reply draft generated successfully in ${replyDraftMs}ms`);

        return {
          ...state,
          replyDraft,
          currentStep: "reply_draft",
          progress: 80,
          processingMetadata: {
            ...state.processingMetadata,
            performanceMetrics: {
              ...state.processingMetadata?.performanceMetrics,
              replyDraftMs,
            },
          },
        };
      }

      // Fallback to regular reply draft agent
      if (this.emailReplyDraftAgent) {
        this.logger.log("Using regular EmailReplyDraftAgent");
        
        if (!state.classification || !state.summary) {
          this.logger.warn("Missing classification or summary for reply draft generation");
          // Create fallback values if missing
          const fallbackClassification = state.classification || {
            priority: "normal" as const,
            category: "other" as const,
            reasoning: "Missing classification",
            confidence: 0.0,
          };
          
          const fallbackSummary = state.summary || {
            problem: "Unable to identify problem",
            context: "Missing summary",
            ask: "Unable to determine request",
            summary: "Email processing incomplete",
          };

          const replyDraft = await this.emailReplyDraftAgent.generateReplyDraft(
            state.emailData.body,
            state.emailData.metadata,
            fallbackClassification,
            fallbackSummary,
          );

          const replyDraftMs = Date.now() - startTime;

          return {
            ...state,
            replyDraft,
            currentStep: "reply_draft",
            progress: 80,
            processingMetadata: {
              ...state.processingMetadata,
              performanceMetrics: {
                ...state.processingMetadata?.performanceMetrics,
                replyDraftMs,
              },
            },
          };
        }

        const replyDraft = await this.emailReplyDraftAgent.generateReplyDraft(
          state.emailData.body,
          state.emailData.metadata,
          state.classification,
          state.summary,
        );

        const replyDraftMs = Date.now() - startTime;

        this.logger.log(`Regular reply draft generated successfully in ${replyDraftMs}ms`);

        return {
          ...state,
          replyDraft,
          currentStep: "reply_draft",
          progress: 80,
          processingMetadata: {
            ...state.processingMetadata,
            performanceMetrics: {
              ...state.processingMetadata?.performanceMetrics,
              replyDraftMs,
            },
          },
        };
      }

      // Final fallback
      const replyDraftMs = Date.now() - startTime;
      
      this.logger.warn("No reply draft agent available, using fallback");
      return {
        ...state,
        replyDraft: {
          subject: `Re: ${state.emailData.metadata?.subject || "Your Email"}`,
          body: "Thank you for your email. We have received your message and will get back to you soon.",
          tone: "professional",
          next_steps: ["Manual review", "Respond within 24 hours"],
        },
        currentStep: "reply_draft",
        progress: 80,
        processingMetadata: {
          ...state.processingMetadata,
          performanceMetrics: {
            ...state.processingMetadata?.performanceMetrics,
            replyDraftMs,
          },
        },
      };
    } catch (error) {
      const replyDraftMs = Date.now() - startTime;
      
      this.logger.error(
        `Error in reply draft generation: ${error.message}`,
        error.stack,
      );
      return {
        ...state,
        processingMetadata: {
          ...state.processingMetadata,
          performanceMetrics: {
            ...state.processingMetadata?.performanceMetrics,
            replyDraftMs,
          },
        },
        error: {
          message: error.message,
          stage: "reply_draft",
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * ENHANCED Finalization node - Complete the email triage process with comprehensive metrics
   * Phase 6: Enhanced state management and performance tracking
   */
  private async finalizationNode(
    state: EmailTriageState,
  ): Promise<EmailTriageState> {
    try {
      this.logger.log("📊 Finalizing enhanced email triage process with comprehensive metrics");

      // Calculate total processing time
      const totalStartTime = state.processingMetadata?.startedAt ? 
        new Date(state.processingMetadata.startedAt).getTime() : Date.now();
      const totalProcessingMs = Date.now() - totalStartTime;

      // Create comprehensive performance metrics
      const performanceMetrics = {
        ...state.processingMetadata?.performanceMetrics,
        totalProcessingMs,
        completedAt: new Date().toISOString()
      };

      // Create final result
      const finalResult: EmailTriageResult = {
        sessionId: state.sessionId,
        emailId: state.emailData.id || `email-${Date.now()}`,
        classification: state.classification!,
        summary: state.summary!,
        replyDraft: state.replyDraft!,
        status: "completed",
        processedAt: new Date(),
      };

      const finalState: EmailTriageState = {
        ...state,
        currentStep: "completed",
        progress: 100,
        result: finalResult,
        processingMetadata: {
          ...state.processingMetadata,
          performanceMetrics
        }
      };

      // 📢 NOTIFICATION FIX: Emit completion event via WebSocket
      this.logger.log(`📨 Emitting triage.completed notification for session: ${state.sessionId}`);
      
      try {
        // Emit to the specific user who triggered the triage
        const userEmail = state.emailData.metadata.from || state.emailData.metadata.userId;
        if (userEmail) {
          // Emit completion notification with detailed results
          const notificationPayload = {
            sessionId: state.sessionId,
            emailId: finalResult.emailId,
            status: 'completed',
            result: finalResult,
            performanceMetrics,
            timestamp: new Date().toISOString()
          };

          this.logger.log(`🚀 Broadcasting triage.completed to user: ${userEmail}`, notificationPayload);
          
          // Use EventEmitter to broadcast notification
          this.eventEmitter.emit('email.triage.completed', {
            userEmail,
            ...notificationPayload
          });

          this.logger.log(`✅ Successfully emitted triage.completed notification`);
        } else {
          this.logger.warn(`⚠️ No user email found for notification emission`);
        }
      } catch (notificationError) {
        this.logger.error(`❌ Failed to emit completion notification: ${notificationError.message}`);
        // Don't fail the entire process for notification errors
      }

      this.logger.log(`🎯 Email triage completed successfully:
        - Session: ${state.sessionId}
        - Priority: ${state.classification?.priority}
        - Category: ${state.classification?.category}
        - Processing Time: ${totalProcessingMs}ms
        - RAG Enhanced: ${state.processingMetadata?.ragEnhanced}
        - Agents Used: ${state.processingMetadata?.agentsUsed?.join(', ')}`);

      return finalState;
      
    } catch (error) {
      this.logger.error(`Failed to finalize email triage: ${error.message}`, error.stack);
      
      return {
        ...state,
        currentStep: "error",
        progress: 100,
        error: {
          message: error.message,
          stage: "finalization",
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * End node - Exit point for email triage
   */
  private async endNode(state: EmailTriageState): Promise<EmailTriageState> {
    this.logger.log(`Agentic email triage completed for session: ${state.sessionId}`);
    return state;
  }

  /**
   * Execute the RAG-enhanced email triage graph with given state
   * Enhanced Phase 3 & 4 flow with tone learning and true parallel processing
   */
  async executeGraph(
    initialState: EmailTriageState,
  ): Promise<EmailTriageState> {
    this.logger.log("Executing RAG-enhanced agentic email triage graph - Phase 3 & 4");

    try {
      // Execute enhanced flow: START -> INITIALIZATION -> CONTEXT_ENRICHMENT -> PARALLEL_ANALYSIS -> COORDINATION -> REPLY_DRAFT -> PATTERN_STORAGE -> FINALIZATION -> END
      
      let currentState = await this.startNode(initialState);
      currentState = await this.initializationNode(currentState);
      
      // Phase 2: Context enrichment before analysis
      currentState = await this.contextEnrichmentNode(currentState);
      
      // Phase 4: TRUE parallel processing using Promise.all() within parallelAnalysisNode
      currentState = await this.parallelAnalysisNode(currentState);

      // Continue with sequential execution
      currentState = await this.coordinationNode(currentState);
      
      // Phase 3: Use tone-adapted reply generation
      currentState = await this.replyDraftNode(currentState);
      
      // Phase 2: Store pattern for future learning
      currentState = await this.patternStorageNode(currentState);
      
      currentState = await this.finalizationNode(currentState);
      currentState = await this.endNode(currentState);

      this.logger.log("RAG-enhanced agentic email triage graph execution completed successfully");
      return currentState;
    } catch (error) {
      this.logger.error(
        `Error executing RAG-enhanced email triage graph: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Coordination node - Combine results from parallel classification and summarization
   */
  private async coordinationNode(
    state: EmailTriageState,
  ): Promise<EmailTriageState> {
    try {
      this.logger.log("Coordinating classification and summarization results");

      // Validate that we have both classification and summary results
      if (!state.classification) {
        this.logger.warn("Missing classification result in coordination");
      }
      
      if (!state.summary) {
        this.logger.warn("Missing summary result in coordination");
      }

      this.logger.log(
        `Coordination complete - Priority: ${state.classification?.priority || 'unknown'}, ` +
        `Category: ${state.classification?.category || 'unknown'}`
      );

      return {
        ...state,
        currentStep: "coordination",
        progress: 60,
      };
    } catch (error) {
      this.logger.error(
        `Error in coordination: ${error.message}`,
        error.stack,
      );
      return {
        ...state,
        error: {
          message: error.message,
          stage: "coordination",
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * NEW - Pattern Storage Node (Phase 2)
   * Stores successful email triage patterns for future learning
   */
  private async patternStorageNode(
    state: EmailTriageState,
  ): Promise<EmailTriageState> {
    try {
      this.logger.log("📦 Storing email pattern for future learning");

      if (!this.emailPatternStorageService) {
        this.logger.warn("EmailPatternStorageService not available, skipping pattern storage");
        return {
          ...state,
          currentStep: "pattern_storage",
          progress: 90,
        };
      }

      if (!state.classification || !state.summary || !state.replyDraft) {
        this.logger.warn("Cannot store pattern - missing analysis results");
        return {
          ...state,
          currentStep: "pattern_storage",
          progress: 90,
        };
      }

      // Store pattern using dedicated service (async to not block response)
      this.emailPatternStorageService.storeEmailPattern(state).catch(error => {
        this.logger.error(`Failed to store email pattern: ${error.message}`);
      });

      this.logger.log("📋 Email pattern queued for storage");

      return {
        ...state,
        currentStep: "pattern_storage",
        progress: 90,
      };
    } catch (error) {
      this.logger.error(
        `Error in pattern storage: ${error.message}`,
        error.stack,
      );
      return {
        ...state,
        currentStep: "pattern_storage",
        progress: 90,
        // Don't fail the whole process for storage errors
      };
    }
  }
}
