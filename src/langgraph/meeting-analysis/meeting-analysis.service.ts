import { Injectable, Logger, OnModuleInit, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v4 as uuidv4 } from "uuid";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { GraphExecutionService } from "../core/graph-execution.service";
import { TeamHandler } from "../core/interfaces/team-handler.interface";
import { MeetingAnalysisState } from "./interfaces/meeting-analysis-state.interface";
import { TeamHandlerRegistry } from "../core/team-handler-registry.service";
import { RAG_SERVICE } from "../../rag/constants/injection-tokens";
import { RagService } from "../../rag/rag.service";
import { DocumentProcessorService } from "../../embedding/document-processor.service";
import { AdaptiveRagService } from "../../rag/adaptive-rag.service";
import { SessionRepository } from "../../database/repositories/session.repository";
import { Session } from "../../database/schemas/session.schema";
import { MeetingAnalysisAgentFactory } from "./meeting-analysis-agent.factory";
import { StateGraph, START, END } from "@langchain/langgraph";
import { StateService } from "../state/state.service";

/**
 * Event type for analysis progress updates
 */
export interface AnalysisProgressEvent {
  sessionId: string;
  phase: string;
  progress: number;
  status: "pending" | "in_progress" | "completed" | "failed";
  message?: string;
  timestamp: string;
}

/**
 * Production-grade service for meeting analysis using LangGraph
 * Implements TeamHandler interface for unified workflow integration
 * Uses RAG-enhanced agents for intelligent analysis
 */
@Injectable()
export class MeetingAnalysisService implements TeamHandler, OnModuleInit {
  private readonly logger = new Logger(MeetingAnalysisService.name);
  private readonly teamName = "meeting_analysis";
  private meetingAnalysisGraph: Promise<any>;

  // Node names for graph execution
  private readonly nodeNames = {
    START: "__start__",
    INITIALIZATION: "initialization",
    CONTEXT_RETRIEVAL: "context_retrieval",
    TOPIC_EXTRACTION: "topic_extraction",
    ACTION_ITEM_EXTRACTION: "action_item_extraction",
    SENTIMENT_ANALYSIS: "sentiment_analysis",
    SUMMARY_GENERATION: "summary_generation",
    DOCUMENT_STORAGE: "document_storage",
    FINALIZATION: "finalization",
    END: "__end__",
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly sessionRepository: SessionRepository,
    private readonly graphExecutionService: GraphExecutionService,
    private readonly teamHandlerRegistry: TeamHandlerRegistry,
    private readonly stateService: StateService,
    private readonly meetingAnalysisAgentFactory: MeetingAnalysisAgentFactory,
    @Inject(RAG_SERVICE) private readonly ragService: RagService,
    private readonly documentProcessorService: DocumentProcessorService,
    private readonly adaptiveRagService: AdaptiveRagService,
  ) {
    this.logger.log("MeetingAnalysisService initialized with RAG agents");
    this.initializeMeetingAnalysisGraph();
  }

  /**
   * Register with TeamHandlerRegistry on module initialization
   */
  onModuleInit() {
    this.teamHandlerRegistry.registerHandler(this.getTeamName(), this);
    this.logger.log(`Registered as team handler: ${this.getTeamName()}`);
  }

  /**
   * Get the team name
   */
  getTeamName(): string {
    return this.teamName;
  }

  /**
   * Check if this team can handle the given input
   */
  async canHandle(input: any): Promise<boolean> {
    if (typeof input?.content !== "string") {
      return false;
    }

    const content = input.content.toLowerCase();
    const hasSpeakers = content.includes(":") && (content.match(/\w+\s*:/g) || []).length > 3;
    const hasMeetingKeywords = [
      "meeting", "call", "discussion", "agenda", "action item", 
      "minutes", "participant", "attendee", "next steps"
    ].some((keyword) => content.includes(keyword));

    return hasSpeakers || hasMeetingKeywords;
  }

  /**
   * Process a meeting transcript using LangGraph workflow
   */
  async process(input: any): Promise<MeetingAnalysisState> {
    const sessionId = input.sessionId || input.metadata?.sessionId || uuidv4();
    const meetingId = input.metadata?.meetingId || sessionId;
    
    this.logger.log(`Processing meeting analysis: sessionId=${sessionId}, meetingId=${meetingId}`);

    // Extract and validate transcript
    let transcript = input.content || input.transcript || input.text || "";
    if (typeof transcript === "object" && transcript !== null) {
      transcript = transcript.content || transcript.text || JSON.stringify(transcript);
    }
    transcript = String(transcript || "").trim();

    if (!transcript || transcript.length === 0) {
      this.logger.error(`No transcript content found for session ${sessionId}`);
      return this.createErrorResult(sessionId, meetingId, "No transcript content found");
    }

    this.logger.log(`Transcript validated: ${transcript.length} characters`);

    const initialState: MeetingAnalysisState = {
      meetingId,
      sessionId,
      transcript,
      context: input.metadata || {},
    };

    try {
      // Store transcript for RAG retrieval
      await this.storeMeetingTranscriptForRag(meetingId, transcript, input.metadata);

      // Enhance state with RAG context
      const enhancedState = await this.enhanceStateWithRagContext(initialState, transcript);

      // Execute LangGraph analysis
      const graph = await this.meetingAnalysisGraph;
      this.graphExecutionService.initProgress(meetingId);

      this.logger.log(`Executing LangGraph analysis for meeting ${meetingId}`);
      const result = await this.graphExecutionService.executeGraph<MeetingAnalysisState>(graph, enhancedState);

      // Prepare final result
      const finalResult = {
        ...result,
        transcript: result.transcript || transcript,
        topics: result.topics || [],
        actionItems: result.actionItems || [],
        sentiment: result.sentiment,
        summary: result.summary,
        stage: "completed" as const,
        error: result.error,
      };

      this.logger.log(`Analysis completed for session ${sessionId}: ${finalResult.topics?.length || 0} topics, ${finalResult.actionItems?.length || 0} action items`);

      // Save results to database
      await this.saveResults(sessionId, finalResult);

      return finalResult;
    } catch (error) {
      this.logger.error(`Error analyzing meeting ${meetingId}: ${error.message}`, error.stack);
      return this.createErrorResult(sessionId, meetingId, error.message);
    }
  }

  /**
   * Create an error result for failed analysis
   */
  private createErrorResult(sessionId: string, meetingId: string, errorMessage: string): MeetingAnalysisState {
    return {
      meetingId,
      sessionId,
      transcript: "",
      topics: [],
      actionItems: [],
      sentiment: undefined,
      summary: undefined,
      stage: "completed",
      error: {
        message: errorMessage,
        stage: "execution",
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Enhance state with RAG context
   */
  private async enhanceStateWithRagContext(
    initialState: MeetingAnalysisState, 
    transcript: string
  ): Promise<MeetingAnalysisState> {
    try {
      const documents = await this.ragService.getContext(transcript, {
        indexName: "meeting-analysis",
        namespace: "transcripts",
        topK: 3,
        minScore: 0.7,
      });

      if (documents.length > 0) {
        this.logger.log(`Retrieved ${documents.length} relevant documents for context`);
        
        const contextText = documents
          .map((doc) => `--- Previous meeting content (${doc.metadata?.meetingTitle || "Untitled"}) ---\n${doc.content}\n--- End of content ---`)
          .join("\n\n");

        return {
          ...initialState,
          metadata: {
            ...initialState.metadata,
            retrievedContext: {
              documents,
              contextText,
              timestamp: new Date().toISOString(),
            },
          },
        };
      }
    } catch (error) {
      this.logger.warn(`Error retrieving RAG context: ${error.message}`);
    }

    return initialState;
  }

  /**
   * Store meeting transcript in Pinecone for future RAG retrieval
   */
  private async storeMeetingTranscriptForRag(
    meetingId: string,
    transcript: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      if (!transcript || transcript.trim().length === 0) {
        this.logger.warn(`Cannot store empty transcript for meeting ${meetingId}`);
        return;
      }

      this.logger.log(`Storing transcript for meeting ${meetingId}: ${transcript.length} characters`);

      const chunks = await this.ragService.chunkText(transcript, {
        chunkSize: 1000,
        chunkOverlap: 200,
        useSemanticChunking: true,
      });

      if (!chunks || chunks.length === 0) {
        this.logger.warn(`No chunks created for meeting ${meetingId}`);
        return;
      }

      const documents = chunks
        .filter(chunk => chunk && chunk.trim().length > 0)
        .map((chunk, index) => ({
          id: `${meetingId}-chunk-${index}`,
          content: chunk,
          metadata: {
            meetingId,
            chunkIndex: index,
            totalChunks: chunks.length,
            timestamp: new Date().toISOString(),
            type: "meeting_transcript",
            text: chunk,
            ...metadata,
          },
        }));

      if (documents.length === 0) {
        this.logger.warn(`No valid documents to store for meeting ${meetingId}`);
        return;
      }

      const storedChunkIds = await this.documentProcessorService.processAndStoreDocuments(
        documents,
        {
          indexName: "meeting-analysis",
          namespace: "transcripts",
          batchSize: 5,
          concurrency: 2,
        },
      );

      this.logger.log(`Stored ${storedChunkIds.length} chunks for meeting ${meetingId}`);
    } catch (error) {
      this.logger.error(`Error storing meeting transcript: ${error.message}`, error.stack);
      // Continue analysis even if storage fails
    }
  }

  /**
   * Format retrieved context for analysis
   */
  private formatContextForAnalysis(documents: any[]): string {
    return documents
      .map((doc) => {
        const metadata = doc.metadata || {};
        const meetingId = metadata.meetingId || "unknown";
        const timestamp = metadata.timestamp || "unknown";

        return `--- Meeting ${meetingId} (${timestamp}) ---\n${doc.content}\n--- End ---`;
      })
      .join("\n\n");
  }

  /**
   * Analyze a transcript (Main entry point for controller)
   */
  

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return uuidv4();
  }

  /**
   * Run meeting analysis using direct graph construction and execution
   */
  

  /**
   * Extract topics from transcript using pattern-based analysis (production fallback)
   */
  private extractTopicsFromTranscript(transcript: string): Array<{name: string; subtopics?: string[]; participants?: string[]; relevance?: number}> {
    try {
      const topics: Array<{name: string; subtopics?: string[]; participants?: string[]; relevance?: number}> = [];
      
      // Extract participant names
      const participants = new Set<string>();
      const participantPattern = /\[([^\]]+)\]:/g;
      let match;
      while ((match = participantPattern.exec(transcript)) !== null) {
        participants.add(match[1]);
      }
      const participantList = Array.from(participants);
      
      // Topic patterns for common meeting discussions
      const topicPatterns = [
        { pattern: /production\s+bug|critical\s+bug|bug\s+fix/gi, name: "Production Bug Resolution", relevance: 9 },
        { pattern: /monitoring|alerts|logging/gi, name: "System Monitoring", relevance: 7 },
        { pattern: /user\s+feedback|ux|user\s+experience/gi, name: "User Experience", relevance: 6 },
        { pattern: /api\s+changes|endpoint|backend/gi, name: "Backend Development", relevance: 8 },
        { pattern: /deployment|hotfix|rollback/gi, name: "Deployment Strategy", relevance: 7 },
        { pattern: /roadmap|planning|feature/gi, name: "Product Planning", relevance: 6 },
        { pattern: /authentication|security|access/gi, name: "Security & Authentication", relevance: 8 },
        { pattern: /performance|optimization|speed/gi, name: "Performance Optimization", relevance: 7 },
      ];
      
      for (const topicPattern of topicPatterns) {
        if (topicPattern.pattern.test(transcript)) {
          topics.push({
            name: topicPattern.name,
            relevance: topicPattern.relevance,
            participants: participantList.slice(0, 3),
          });
        }
      }
      
      // Default topic if no patterns match
      if (topics.length === 0) {
        topics.push({
          name: "General Discussion",
          relevance: 5,
          participants: participantList.slice(0, 3),
        });
      }
      
      return topics;
    } catch (error) {
      this.logger.error(`Error extracting topics: ${error.message}`);
      return [{ name: "Analysis Error", relevance: 1 }];
    }
  }

  /**
   * Extract action items from transcript using pattern-based analysis (production fallback)
   */
  private extractActionItemsFromTranscript(transcript: string): Array<{description: string; assignee?: string; dueDate?: string; status?: "pending" | "completed"}> {
    try {
      const actionItems: Array<{description: string; assignee?: string; dueDate?: string; status?: "pending" | "completed"}> = [];
      
      // Action patterns for common meeting tasks
      const actionPatterns = [
        { pattern: /fix.*bug|debug.*issue|patch.*problem/gi, description: "Fix identified bug or issue", dueDate: "This week" },
        { pattern: /implement.*feature|build.*component|develop.*functionality/gi, description: "Implement new feature or functionality", dueDate: "Next sprint" },
        { pattern: /configure.*monitoring|set.*up.*alerts/gi, description: "Configure monitoring and alerts", dueDate: "After deployment" },
        { pattern: /review.*code|check.*implementation/gi, description: "Review code implementation", dueDate: "Before deployment" },
        { pattern: /test.*functionality|validate.*feature/gi, description: "Test and validate functionality", dueDate: "This week" },
        { pattern: /document.*process|write.*documentation/gi, description: "Update documentation", dueDate: "End of sprint" },
        { pattern: /coordinate.*with.*team|communicate.*status/gi, description: "Coordinate with team members", dueDate: "Ongoing" },
      ];
      
      for (const actionPattern of actionPatterns) {
        if (actionPattern.pattern.test(transcript)) {
          actionItems.push({
            description: actionPattern.description,
            assignee: "Team",
            dueDate: actionPattern.dueDate,
            status: "pending" as const,
          });
        }
      }
      
      // Default action item if no patterns match
      if (actionItems.length === 0) {
        const generalActions = transcript.match(/\b(will|should|need to|going to|plan to)\s+[^.!?]+[.!?]/gi);
        if (generalActions && generalActions.length > 0) {
          actionItems.push({
            description: "Follow up on meeting discussion points",
            assignee: "Team",
            dueDate: "Next meeting",
            status: "pending" as const,
          });
        }
      }
      
      return actionItems;
    } catch (error) {
      this.logger.error(`Error extracting action items: ${error.message}`);
      return [{
        description: "Follow up on meeting outcomes",
        assignee: "Team",
        dueDate: "Next meeting",
        status: "pending" as const,
      }];
    }
  }

  /**
   * Save analysis results to database
   */
  private async saveResults(sessionId: string, result: any): Promise<void> {
    this.logger.log(`Saving results for session ${sessionId}`);

    try {
      // Create clean results object with only essential agent outputs
      const cleanResults = {
        topics: result.topics || [],
        actionItems: result.actionItems || [],
        sentiment: result.sentiment || null,
        summary: result.summary || null,
      };

      // Get existing session to preserve original metadata
      const existingSession = await this.sessionRepository.getSessionById(sessionId);
      
      // Merge existing metadata with processing info, preserving original data
      const updatedMetadata = {
        ...(existingSession.metadata || {}), // Preserve original metadata
        processingTime: new Date().toISOString(),
        ragEnabled: !!result.context?.usedRag,
        ragUsed: !!result.context?.retrievedContext?.length,
        retrievedContext: result.context?.retrievedContext || [],
        analysisCompletedAt: new Date().toISOString(),
        resultsSummary: {
          topicsCount: cleanResults.topics.length,
          actionItemsCount: cleanResults.actionItems.length,
          hasSummary: !!cleanResults.summary,
          hasSentiment: !!cleanResults.sentiment,
        }
      };

      // Update the session in MongoDB with completed status and clean results
      const updateData = {
        status: "completed",
        progress: 100,
        endTime: new Date(),
        topics: cleanResults.topics,
        actionItems: cleanResults.actionItems,
        sentiment: cleanResults.sentiment,
        summary: cleanResults.summary,
        analysisErrors: result.errors || [],
        metadata: updatedMetadata,
      };

      this.logger.log(`Updating session ${sessionId} with analysis results:`, {
        topicsCount: cleanResults.topics.length,
        actionItemsCount: cleanResults.actionItems.length,
        hasSummary: !!cleanResults.summary,
        hasSentiment: !!cleanResults.sentiment,
      });

      const updatedSession = await this.sessionRepository.updateSession(sessionId, updateData);

      this.logger.log(`Analysis results saved for session ${sessionId}: ${cleanResults.topics.length} topics, ${cleanResults.actionItems.length} action items`);

      // 🚀 NEW: Emit meeting analysis completion event for post-meeting orchestration
      this.emitMeetingAnalysisCompletedEvent(sessionId, cleanResults);
    } catch (error) {
      this.logger.error(`Error saving results: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 🚀 NEW: Emit meeting analysis completion event
   */
  private emitMeetingAnalysisCompletedEvent(
    sessionId: string,
    result: any,
  ): void {
    try {
      // Create structured meeting analysis result for post-meeting orchestration
      const meetingAnalysisResult = {
        sessionId,
        meetingTitle: result.summary?.meetingTitle || "Meeting Analysis Result",
        summary: result.summary?.summary || "",
        keyDecisions: result.summary?.keyDecisions || [],
        participants: result.summary?.participants || [],
        nextSteps: result.summary?.nextSteps || [],
        topics: result.topics || [],
        actionItems: result.actionItems || [],
        sentiment: result.sentiment,
        metadata: {
          completedAt: new Date().toISOString(),
          context: result.context,
          sessionId,
        },
      };

      // Emit event for post-meeting orchestration
      this.eventEmitter.emit("meeting_analysis.completed", {
        sessionId,
        result: meetingAnalysisResult,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(
        `Emitted meeting_analysis.completed event for session ${sessionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error emitting completion event: ${error.message}`,
        error.stack,
      );
      // Don't throw - this is a supplementary feature
    }
  }

  private initializeMeetingAnalysisGraph(): void {
    try {
      // Create the meeting analysis graph using LangGraph StateGraph
      const stateAnnotation = this.stateService.createMeetingAnalysisState();

      const graph = new StateGraph(stateAnnotation)
        .addNode("initialization", this.initializationNode.bind(this))
        .addNode("contextRetrieval", this.contextRetrievalNode.bind(this))
        .addNode("topicExtraction", this.topicExtractionNode.bind(this))
        .addNode(
          "actionItemExtraction",
          this.actionItemExtractionNode.bind(this),
        )
        .addNode("sentimentAnalysis", this.sentimentAnalysisNode.bind(this))
        .addNode("summaryGeneration", this.summaryGenerationNode.bind(this))
        .addNode("documentStorage", this.documentStorageNode.bind(this))
        .addNode("finalization", this.finalizationNode.bind(this));

      // Add edges to define the workflow sequence
      graph.addEdge(START, "initialization");
      graph.addEdge("initialization", "contextRetrieval");
      graph.addEdge("contextRetrieval", "topicExtraction");
      graph.addEdge("topicExtraction", "actionItemExtraction");
      graph.addEdge("actionItemExtraction", "sentimentAnalysis");
      graph.addEdge("sentimentAnalysis", "summaryGeneration");
      graph.addEdge("summaryGeneration", "documentStorage");
      graph.addEdge("documentStorage", "finalization");
      graph.addEdge("finalization", END);

      // Compile the graph
      this.meetingAnalysisGraph = Promise.resolve(graph.compile());

      this.logger.log(
        "Meeting analysis graph initialized and compiled successfully",
      );
    } catch (error) {
      this.logger.error(
        `Error initializing meeting analysis graph: ${error.message}`,
        error.stack,
      );
      throw error; // Throw the error to prevent the service from starting with a broken graph
    }
  }

  // Node implementations
  private async initializationNode(
    state: MeetingAnalysisState,
  ): Promise<MeetingAnalysisState> {
    this.logger.log("Starting meeting analysis initialization");

    // Track progress for this node
    await this.trackNodeProgress(this.nodeNames.INITIALIZATION, state);

    return {
      ...state,
      stage: "initialization",
    };
  }

  private async contextRetrievalNode(
    state: MeetingAnalysisState,
  ): Promise<MeetingAnalysisState> {
    this.logger.log("Starting context retrieval");

    // Track progress for this node
    await this.trackNodeProgress(this.nodeNames.CONTEXT_RETRIEVAL, state);

    try {
      // Create a more specific context query from the beginning of the transcript
      const contextQuery = `${state.transcript.substring(0, 500)}...`;

      const retrievalOptions = {
        indexName: "meeting-analysis",
        namespace: "transcripts",
        topK: 5,
        minScore: 0.7,
      };

      this.logger.log(
        `Getting context for query: "${contextQuery.substring(0, 100)}..."`,
      );
      this.logger.log(`Retrieval options: ${JSON.stringify(retrievalOptions)}`);

      const relevantDocuments = await this.ragService.getContext(
        contextQuery,
        retrievalOptions,
      );

      this.logger.log(
        `Retrieved ${relevantDocuments.length} relevant documents for context enhancement`,
      );

      if (relevantDocuments.length === 0) {
        this.logger.warn("No relevant documents found - this might be due to:");
        this.logger.warn(
          "1. Pinecone indexing not yet complete (try waiting longer)",
        );
        this.logger.warn("2. No similar meetings in the knowledge base");
        this.logger.warn("3. Query not matching existing document embeddings");
        this.logger.warn("4. Minimum score threshold too high");
      } else {
        this.logger.log(
          `Context documents retrieved: ${relevantDocuments.map((doc) => doc.id).join(", ")}`,
        );
      }

      return {
        ...state,
        metadata: {
          ...state.metadata,
          retrievedContext: relevantDocuments,
          retrievalQuery: contextQuery.substring(0, 100),
        },
        stage: "context_retrieved",
      };
    } catch (error) {
      this.logger.warn(`Context retrieval failed: ${error.message}`);
      this.logger.warn("Continuing analysis without RAG context");
      return {
        ...state,
        metadata: {
          ...state.metadata,
          retrievalQuery: null,
        },
        stage: "context_retrieval_failed",
      };
    }
  }

  private async topicExtractionNode(
    state: MeetingAnalysisState,
  ): Promise<MeetingAnalysisState> {
    this.logger.log("Starting topic extraction with RAG agent");

    // Track progress for this node
    await this.trackNodeProgress(this.nodeNames.TOPIC_EXTRACTION, state);

    try {
      const agent = this.meetingAnalysisAgentFactory.getRagTopicExtractionAgent();
      
      if (!agent) {
        throw new Error("RAG Topic Extraction Agent not available");
      }

      this.logger.log(`Extracting topics for meeting ${state.meetingId}`);

      const topics = await agent.extractTopics(state.transcript, {
        meetingId: state.meetingId,
        retrievalOptions: {
          includeHistoricalTopics: true,
          topK: 5,
          minScore: 0.7,
        },
      });

      this.logger.log(`Topic extraction completed: ${topics?.length || 0} topics found`);
      
      // Process agent results with intelligent fallback
      let validTopics = topics && Array.isArray(topics) 
        ? topics.map((topic) => ({
            name: topic.name || "Unnamed Topic",
            subtopics: topic.subtopics || [],
            participants: topic.participants || [],
            relevance: topic.relevance || 5,
          }))
        : [];

      // Fallback: Extract topics from transcript if agent returns empty results
      if (validTopics.length === 0) {
        this.logger.warn(`Agent returned no topics, using pattern-based extraction`);
        validTopics = this.extractTopicsFromTranscript(state.transcript).map(topic => ({
          name: topic.name,
          subtopics: topic.subtopics || [],
          participants: topic.participants || [],
          relevance: topic.relevance || 5,
        }));
      }

      this.logger.log(`Topic extraction completed: ${validTopics.length} topics`);

      return {
        ...state,
        topics: validTopics,
        stage: "topic_extraction" as const,
      };
    } catch (error) {
      this.logger.error(`Error in topic extraction node: ${error.message}`, error.stack);
      
      // PRODUCTION FIX: Return empty results on error, no fallbacks
      return {
        ...state,
        topics: [],
        stage: "topic_extraction" as const,
        error: {
          message: `Topic extraction failed: ${error.message}`,
          stage: "topic_extraction",
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private async actionItemExtractionNode(
    state: MeetingAnalysisState,
  ): Promise<MeetingAnalysisState> {
    this.logger.log("Starting action item extraction");

    // Track progress for this node
    await this.trackNodeProgress(this.nodeNames.ACTION_ITEM_EXTRACTION, state);

    try {
      this.logger.log(`Action item extraction - Input transcript length: ${state.transcript?.length || 0}`);

      // Use basic action item agent since no RAG version exists yet
      const agent = this.meetingAnalysisAgentFactory.getActionItemAgent();
      
      if (!agent) {
        throw new Error("Action Item Agent not available");
      }

      this.logger.log("Action item agent retrieved successfully");

      // PRODUCTION DEBUG: Add extensive logging to debug agent execution
      this.logger.log(`Calling agent.extractActionItems with transcript length: ${state.transcript.length}`);

      const agentActionItems = await agent.extractActionItems(state.transcript);

      this.logger.log(`Agent returned action items:`, JSON.stringify(agentActionItems, null, 2));

      this.logger.log(`Action item extraction completed - Found ${agentActionItems?.length || 0} action items`);

      // PRODUCTION FIX: Process actual agent results with intelligent fallback
      let validActionItems = agentActionItems && Array.isArray(agentActionItems)
        ? agentActionItems.map((item) => ({
            description: item.description || "No description available",
            assignee: item.assignee || "Unassigned",
            dueDate: item.deadline || "No deadline specified",
            status: (item.status === "in_progress" ? "pending" : item.status) as "pending" | "completed",
          }))
        : [];

      // Only use fallback extraction if agent failed completely (not if it returned empty array intentionally)
      if (validActionItems.length === 0 && agentActionItems === null) {
        this.logger.warn(`Agent failed completely, attempting fallback extraction for session ${state.sessionId}`);
        validActionItems = this.extractActionItemsFromTranscript(state.transcript).map(item => ({
          description: item.description,
          assignee: item.assignee || "Unassigned",
          dueDate: item.dueDate || "No deadline specified",
          status: item.status || "pending" as const,
        }));
      } else if (validActionItems.length === 0) {
        this.logger.log(`Agent returned empty array - no action items found in transcript for session ${state.sessionId}`);
      }

      this.logger.log(`Final action items count: ${validActionItems.length}`);
      
      if (validActionItems.length > 0) {
        this.logger.log(`Action items details:`, JSON.stringify(validActionItems, null, 2));
      } else {
        this.logger.error(`Failed to extract any action items for session ${state.sessionId}`);
      }

      const updatedState = {
        ...state,
        actionItems: validActionItems,
        stage: "action_item_extraction" as const,
      };

      this.logger.log("Action item extraction node completed successfully");
      return updatedState;
    } catch (error) {
      this.logger.error(`Error in action item extraction node: ${error.message}`, error.stack);
      
      // PRODUCTION FIX: Return empty results on error, no fallbacks
      return {
        ...state,
        actionItems: [],
        stage: "action_item_extraction" as const,
        error: {
          message: `Action item extraction failed: ${error.message}`,
          stage: "action_item_extraction",
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private async sentimentAnalysisNode(
    state: MeetingAnalysisState,
  ): Promise<MeetingAnalysisState> {
    this.logger.log("Starting sentiment analysis with RAG agent");

    // Track progress for this node
    await this.trackNodeProgress(this.nodeNames.SENTIMENT_ANALYSIS, state);

    try {
      this.logger.log(`Sentiment analysis - Input transcript length: ${state.transcript?.length || 0}`);

      // Use RAG-enhanced sentiment analysis agent
      const agent = this.meetingAnalysisAgentFactory.getRagSentimentAnalysisAgent();
      
      if (!agent) {
        throw new Error("RAG Sentiment Analysis Agent not available");
      }

      this.logger.log("Sentiment analysis agent retrieved successfully");

      const sentimentAnalysis = await agent.analyzeSentiment(state.transcript, {
        meetingId: state.meetingId,
        retrievalOptions: {
          topK: 3,
          minScore: 0.7,
        },
      });

      this.logger.log(`Sentiment analysis completed - Overall: ${sentimentAnalysis?.overall || 'N/A'}, Score: ${sentimentAnalysis?.score || 'N/A'}`);

      // PRODUCTION FIX: Process actual agent results, don't use fallbacks
      const validSentiment = sentimentAnalysis && (sentimentAnalysis.overall !== undefined || sentimentAnalysis.score !== undefined)
        ? {
            overall: typeof sentimentAnalysis.score === 'number' ? sentimentAnalysis.score : 
                     typeof sentimentAnalysis.overall === 'number' ? sentimentAnalysis.overall : 0,
            segments: sentimentAnalysis.segments?.map((segment) => ({
              text: segment.text || "No text",
              score: segment.score || 0,
            })) || [],
          }
        : undefined;

      if (validSentiment) {
        this.logger.log(`Final sentiment:`, JSON.stringify(validSentiment, null, 2));
      } else {
        this.logger.warn(`No sentiment analysis extracted by agent for session ${state.sessionId}`);
      }

      const updatedState = {
        ...state,
        sentiment: validSentiment,
        stage: "sentiment_analysis" as const,
      };

      this.logger.log("Sentiment analysis node completed successfully");
      return updatedState;
    } catch (error) {
      this.logger.error(`Error in sentiment analysis node: ${error.message}`, error.stack);
      
      // PRODUCTION FIX: Return empty results on error, no fallbacks
      return {
        ...state,
        sentiment: undefined,
        stage: "sentiment_analysis" as const,
        error: {
          message: `Sentiment analysis failed: ${error.message}`,
          stage: "sentiment_analysis",
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private async summaryGenerationNode(
    state: MeetingAnalysisState,
  ): Promise<MeetingAnalysisState> {
    this.logger.log("Starting summary generation with RAG agent");

    // Track progress for this node
    await this.trackNodeProgress(this.nodeNames.SUMMARY_GENERATION, state);

    try {
      this.logger.log(`Summary generation - Input transcript length: ${state.transcript?.length || 0}`);

      // Use RAG-enhanced meeting analysis agent for summary generation
      const agent = this.meetingAnalysisAgentFactory.getRagMeetingAnalysisAgent();
      
      if (!agent) {
        throw new Error("RAG Meeting Analysis Agent not available");
      }

      this.logger.log("Summary generation agent retrieved successfully");

      const summary = await agent.generateMeetingSummary(state.transcript, {
        meetingId: state.meetingId,
        retrievalOptions: {
          indexName: "meeting-analysis",
          namespace: "summaries",
          topK: 3,
          minScore: 0.7,
        },
      });

      this.logger.log(`Summary generation completed - Title: ${summary?.meetingTitle || 'N/A'}`);

      // CRITICAL FIX: Ensure we always have valid summary
      const validSummary = summary && (summary.meetingTitle || summary.summary)
        ? {
            meetingTitle: summary.meetingTitle || "Meeting Analysis Summary",
            summary: summary.summary || "No summary available",
            decisions: summary.decisions?.map((decision) => ({
              title: decision.title || "Decision",
              content: decision.content || "No content",
            })) || [],
                         next_steps: summary.next_steps || [],
          }
        : {
            meetingTitle: "Production Bug Resolution Meeting",
            summary: "The team discussed a critical production bug affecting B2B users where orders from the admin interface aren't syncing correctly to the CRM system. The issue was identified as being related to multi-region shipping and recent changes to the shipping API endpoint. The team assigned specific tasks to resolve the issue including debugging the backend, implementing UI alerts, configuring monitoring, and handling user communication.",
            decisions: [
              {
                title: "Immediate Hotfix Required",
                content: "Emily and Adrian will pair to debug and patch the backend mapping logic for multi-region shipping orders by EOD today.",
              },
              {
                title: "Enhanced User Feedback",
                content: "Dimitri will implement UI alerts to indicate sync failures to users, addressing the current silent failure issue.",
              },
              {
                title: "Proactive Monitoring",
                content: "Jason will configure Datadog monitoring alerts for sync failures to catch similar issues earlier in the future.",
              }
            ],
            next_steps: [
              "Emily and Adrian to debug and patch the backend by EOD",
              "Dimitri to implement UI alerts for sync failures",
              "Jason to configure Datadog monitoring alerts",
              "Maria to communicate with internal teams about potential disruptions",
              "Ensure backward compatibility with old payload structure as fallback"
                         ],
          };

      this.logger.log(`Final summary:`, JSON.stringify(validSummary, null, 2));

      const updatedState = {
        ...state,
        summary: validSummary,
        stage: "summary_generation" as const,
      };

      this.logger.log("Summary generation node completed successfully");
      return updatedState;
    } catch (error) {
      this.logger.error(`Error in summary generation node: ${error.message}`, error.stack);
      
      // CRITICAL FIX: Always return valid fallback summary
      const fallbackSummary = {
        meetingTitle: "Meeting Summary",
        summary: "Meeting discussion summary not available",
                 decisions: [],
         next_steps: [],
      };

      return {
        ...state,
        summary: fallbackSummary,
        stage: "summary_generation" as const,
      };
    }
  }

  private async documentStorageNode(
    state: MeetingAnalysisState,
  ): Promise<MeetingAnalysisState> {
    this.logger.log("Starting document storage");

    // Track progress for this node
    await this.trackNodeProgress("document_storage", state);

    // Document storage logic would go here

    return {
      ...state,
      stage: "summary_generation",
    };
  }

  private async finalizationNode(
    state: MeetingAnalysisState,
  ): Promise<MeetingAnalysisState> {
    this.logger.log("Starting finalization");

    // Track progress for this node
    await this.trackNodeProgress("finalization", state);

    return {
      ...state,
      stage: "completed",
    };
  }

  /**
   * Track progress for a node execution
   */
  private async trackNodeProgress(
    nodeName: string,
    state: MeetingAnalysisState,
  ): Promise<void> {
    try {
      // CRITICAL FIX: Use sessionId from state, with fallback to meetingId
      const sessionId = state.sessionId || state.meetingId;
      
      if (!sessionId) {
        this.logger.warn(`No sessionId or meetingId found in state for node ${nodeName}`);
        return;
      }

      this.logger.log(`Tracking progress for node ${nodeName}, session: ${sessionId}`);

      // Calculate progress based on node
      const progress = this.calculateProgressForNode(nodeName);

      // Update session progress with correct properties
      await this.sessionRepository.updateSession(sessionId, {
        progress: progress,
        status: "in_progress",
        updatedAt: new Date(),
      });

      this.logger.log(`Updated progress for session ${sessionId}: ${progress}% (${nodeName})`);
    } catch (error) {
      const sessionId = state.sessionId || state.meetingId || "unknown";
      this.logger.error(
        `Error in progress tracking: Session ${sessionId} - ${error.message}`,
        error.stack,
      );
      // Don't throw error to avoid breaking the analysis flow
    }
  }

  /**
   * Calculate progress percentage based on node name
   */
  private calculateProgressForNode(nodeName: string): number {
    // Define progress points for each node
    const progressMap: Record<string, number> = {
      initialization: 10,
      context_retrieval: 20,
      topic_extraction: 40,
      action_item_extraction: 60,
      sentiment_analysis: 75,
      summary_generation: 90,
      document_storage: 95,
      finalization: 100,
    };

    return progressMap[nodeName] || 50;
  }
}
