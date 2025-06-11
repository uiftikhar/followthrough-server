import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  OnModuleInit,
  Inject,
} from "@nestjs/common";
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
import { AnalysisResultDto } from "./dto/analysis-result.dto";
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
 * Service for handling meeting analysis requests
 * Implements TeamHandler to be used by the supervisor
 */
@Injectable()
export class MeetingAnalysisService implements TeamHandler, OnModuleInit {
  private readonly logger = new Logger(MeetingAnalysisService.name);
  private readonly teamName = "meeting_analysis";
  private readonly ragEnabled: boolean;
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
    SUPERVISION: "supervision",
    POST_PROCESSING: "post_processing",
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
    this.ragEnabled = this.configService.get<boolean>("rag.enabled", true);
    this.logger.log(
      "MeetingAnalysisService initialized with enhanced RAG capabilities",
    );
    this.logger.log(
      `RAG capabilities are ${this.ragEnabled ? "enabled" : "disabled"}`,
    );
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
    // Check if input looks like a meeting transcript
    // This is a simple heuristic and could be improved
    if (typeof input?.content !== "string") {
      return false;
    }

    const content = input.content.toLowerCase();

    // Check for common meeting transcript patterns
    const hasSpeakers =
      content.includes(":") && (content.match(/\w+\s*:/g) || []).length > 3;

    const hasMeetingKeywords = [
      "meeting",
      "call",
      "discussion",
      "agenda",
      "action item",
      "minutes",
      "participant",
      "attendee",
      "next steps",
    ].some((keyword) => content.includes(keyword));

    return hasSpeakers || hasMeetingKeywords;
  }

  /**
   * Process a meeting transcript
   */
  async process(input: any): Promise<MeetingAnalysisState> {
    this.logger.log(
      "Processing meeting transcript with enhanced RAG",
      JSON.stringify(input),
    );
    this.logger.log("TRACE: ", console.trace());

    // FIXED: Validate and extract transcript from multiple possible sources
    let transcript = input.content || input.transcript || input.text || "";

    // If transcript is an object, extract the content
    if (typeof transcript === "object" && transcript !== null) {
      transcript =
        transcript.content || transcript.text || JSON.stringify(transcript);
    }

    // Ensure transcript is a string
    transcript = String(transcript || "").trim();

    this.logger.log(
      `📝 Transcript validation: length=${transcript.length}, type=${typeof transcript}`,
    );

    // FIXED: Validate transcript existence
    if (!transcript || transcript.length === 0) {
      this.logger.error(
        `❌ No transcript content found in input. Input keys: ${Object.keys(input)}`,
      );
      this.logger.error(
        `📄 Input structure: ${JSON.stringify(input, null, 2).substring(0, 500)}...`,
      );

      return {
        meetingId: input.metadata?.meetingId || uuidv4(),
        transcript: "",
        topics: [
          {
            name: "No Transcript Provided",
            relevance: 1,
          },
        ],
        actionItems: [],
        sentiment: { overall: 0, segments: [] },
        summary: {
          meetingTitle: "No Content Available",
          summary: "No transcript content was provided for analysis.",
          decisions: [],
        },
        stage: "completed",
        error: {
          message: "No transcript content found in input",
          stage: "input_validation",
          timestamp: new Date().toISOString(),
        },
      };
    }

    this.logger.log(`✅ Transcript validated: ${transcript.length} characters`);

    // Create a unique ID for this meeting if not provided
    const meetingId = input.metadata?.meetingId || uuidv4();

    // Prepare initial state with validated transcript
    const initialState: MeetingAnalysisState = {
      meetingId,
      transcript,
      context: input.metadata || {},
    };

    try {
      // Step 1: Store current meeting transcript in Pinecone for future RAG retrieval
      await this.storeMeetingTranscriptForRag(
        meetingId,
        transcript,
        input.metadata,
      );

      // Step 2: Enhanced RAG context retrieval using adaptive RAG
      let enhancedState = initialState;
      if (this.ragEnabled) {
        this.logger.log(
          `Using enhanced RAG capabilities for meeting analysis ${meetingId}`,
        );
        try {
          // Determine the best retrieval strategy using adaptive RAG
          const retrievalStrategy =
            await this.adaptiveRagService.determineRetrievalStrategy(
              transcript.substring(0, 500), // Use a sample of the transcript for strategy determination
            );

          this.logger.log(
            `Adaptive RAG selected strategy: ${retrievalStrategy.strategy}`,
          );

          // Use the determined strategy for enhanced context retrieval
          const retrievalOptions = {
            indexName: "meeting-analysis",
            namespace: "transcripts",
            topK: retrievalStrategy.settings.topK || 5,
            minScore: retrievalStrategy.settings.minScore || 0.7,
            filter: input.metadata?.filter,
          };

          // Get context using the standard RAG service with adaptive settings
          const documents = await this.ragService.getContext(
            transcript,
            retrievalOptions,
          );

          this.logger.log(
            `Retrieved ${documents.length} relevant documents with adaptive strategy: ${retrievalStrategy.strategy}`,
          );

          // Add enhanced context to the initial state
          if (documents.length > 0) {
            enhancedState = {
              ...initialState,
              context: {
                ...initialState.context,
                retrievedContext: {
                  documents,
                  contextText: this.formatContextForAnalysis(documents),
                  timestamp: new Date().toISOString(),
                  adaptiveStrategy: retrievalStrategy.strategy,
                  retrievalSettings: retrievalStrategy.settings,
                },
              },
            };

            this.logger.log(
              `Enhanced state with adaptive RAG context for meeting ${meetingId}`,
            );
          }
        } catch (error) {
          this.logger.warn(
            `Error retrieving adaptive RAG context: ${error.message}`,
          );
          // Continue with analysis even if RAG retrieval fails
        }
      }

      // Step 3: Build and execute the LangGraph StateGraph
      const graph = await this.meetingAnalysisGraph;

      // Initialize progress tracking for this session
      this.graphExecutionService.initProgress(meetingId);

      // Execute the graph with GraphExecutionService
      this.logger.log(
        `Executing LangGraph meeting analysis for meeting ${meetingId}`,
      );
      const result =
        await this.graphExecutionService.executeGraph<MeetingAnalysisState>(
          graph,
          enhancedState,
        );

      this.logger.log(
        `Completed LangGraph meeting analysis for meeting ${meetingId}`,
      );

      // Ensure we return a properly formatted state with correct types
      return {
        ...result,
        transcript: result.transcript || transcript,
        topics: result.topics || [],
        actionItems: result.actionItems || [],
        sentiment: result.sentiment,
        summary: result.summary,
        stage: "completed",
        error: result.error,
      };
    } catch (error) {
      this.logger.error(
        `Error analyzing meeting ${meetingId}: ${error.message}`,
        error.stack,
      );
      return {
        ...initialState,
        topics: [],
        actionItems: [],
        sentiment: undefined,
        summary: undefined,
        stage: "completed",
        error: {
          message: error.message,
          stage: "execution",
          timestamp: new Date().toISOString(),
        },
      };
    }
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
      this.logger.log(
        `Storing meeting ${meetingId} transcript in Pinecone for RAG`,
      );

      // FIXED: Validate transcript before storage
      if (!transcript || transcript.trim().length === 0) {
        this.logger.warn(
          `❌ Cannot store empty transcript for meeting ${meetingId}`,
        );
        return;
      }

      this.logger.log(`📝 Storing transcript: ${transcript.length} characters`);

      // Use semantic chunking for better chunk boundaries
      const chunks = await this.ragService.chunkText(transcript, {
        chunkSize: 1000,
        chunkOverlap: 200,
        useSemanticChunking: true, // Use semantic chunking for better context
      });

      // FIXED: Validate chunks were created
      if (!chunks || chunks.length === 0) {
        this.logger.warn(
          `❌ No chunks created for meeting ${meetingId} transcript`,
        );
        return;
      }

      this.logger.log(`📦 Created ${chunks.length} chunks for storage`);

      // Process and store chunks using DocumentProcessorService
      const documents = chunks
        .filter((chunk, index) => {
          if (!chunk || chunk.trim().length === 0) {
            this.logger.warn(
              `❌ Skipping empty chunk ${index} for meeting ${meetingId}`,
            );
            return false;
          }
          return true;
        })
        .map((chunk, index) => ({
          id: `${meetingId}-chunk-${index}`,
          content: chunk,
          metadata: {
            meetingId,
            chunkIndex: index,
            totalChunks: chunks.length,
            timestamp: new Date().toISOString(),
            type: "meeting_transcript",
            text: chunk, // FIXED: Ensure text is also included in metadata
            ...metadata,
          },
        }));

      // FIXED: Validate we have valid documents to store
      if (documents.length === 0) {
        this.logger.warn(
          `❌ No valid documents to store for meeting ${meetingId}`,
        );
        return;
      }

      this.logger.log(`📄 Prepared ${documents.length} documents for storage`);

      // Store in Pinecone for future retrieval
      const storedChunkIds =
        await this.documentProcessorService.processAndStoreDocuments(
          documents,
          {
            indexName: "meeting-analysis",
            namespace: "transcripts",
            batchSize: 5,
            concurrency: 2,
          },
        );

      this.logger.log(
        `Successfully stored ${storedChunkIds.length} chunks for meeting ${meetingId} in Pinecone`,
      );
    } catch (error) {
      this.logger.error(
        `Error storing meeting transcript in Pinecone: ${error.message}`,
        error.stack,
      );
      // Don't throw - analysis can continue without storage
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
  async analyzeTranscript(
    transcript: string,
    metadata?: Record<string, any>,
    userId?: string,
  ): Promise<any> {
    // If no userId is provided, default to system
    const actualUserId = userId || 'system';
    
    // Create a unique session ID
    const sessionId = this.generateSessionId();
    this.logger.log(`Created new analysis session: ${sessionId} for user: ${actualUserId}`);
    
    // Check if this is a RAG-enhanced analysis request
    const useRAG = metadata?.useRag !== false && this.ragEnabled;
    if (useRAG) {
      this.logger.log(`Session ${sessionId} will use RAG capabilities`);
    }
    
    // Create initial session object for MongoDB
    const sessionData: Partial<Session> = {
      sessionId,
      userId: actualUserId,
      status: 'pending',
      transcript,
      startTime: new Date(),
      metadata: {
        ...metadata || {},
        useRag: useRAG
      },
    };
    
    try {
      // Store the session in MongoDB
      await this.sessionRepository.createSession(sessionData);
      this.logger.log(`Session ${sessionId} stored in MongoDB for user ${actualUserId}`);
      
      // Store transcript for RAG retrieval (if enabled) - do this first to allow indexing time
      if (useRAG) {
        const meetingId = metadata?.meetingId || sessionId;
        await this.storeMeetingTranscriptForRag(meetingId, transcript, metadata);
        
        // Add a small delay to allow Pinecone indexing to complete
        this.logger.log('Waiting 2 seconds for Pinecone indexing to complete...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Start real analysis process (non-blocking)
      this.runGraphAnalysis(sessionId, transcript, actualUserId, metadata)
        .catch(error => {
          this.logger.error(`Background analysis failed for session ${sessionId}: ${error.message}`, error.stack);
        });
      
      return {
        sessionId,
        status: 'pending',
        message: 'Analysis started successfully'
      };
    } catch (error) {
      this.logger.error(`Error initiating analysis: ${error.message}`, error.stack);
      
      // Update session with error
      await this.sessionRepository.updateSession(sessionId, {
        status: 'failed',
        endTime: new Date(),
        errors: [{
          step: 'initialization',
          error: error.message,
          timestamp: new Date().toISOString(),
        }],
      });
      
      throw error;
    }
  }

  /**
   * Get analysis results for a session
   */
  async getAnalysisResults(
    sessionId: string,
    userId?: string,
  ): Promise<AnalysisResultDto> {
    this.logger.log(`Retrieving analysis results for session: ${sessionId}`);

    try {
      let session: Session;

      if (userId) {
        // Get session with user verification
        session = await this.sessionRepository.getSessionByIdAndUserId(
          sessionId,
          userId,
        );
        this.logger.log(
          `Found session ${sessionId} in MongoDB for user ${userId}`,
        );
      } else {
        // Get session without user verification
        session = await this.sessionRepository.getSessionById(sessionId);
        this.logger.log(`Found session ${sessionId} in MongoDB`);
      }

      // Calculate progress percentage
      const progress =
        session.status === "completed"
          ? 100
          : session.status === "failed"
            ? 0  // ✅ Show 0% for failed instead of 100%
            : session.progress || 0; // Use the progress stored in session

      // Calculate what has been completed so far
      const completedSteps: string[] = [];
      if (session.topics && session.topics.length > 0)
        completedSteps.push("topics");
      if (session.actionItems && session.actionItems.length > 0)
        completedSteps.push("action_items");
      if (session.sentiment) completedSteps.push("sentiment");
      if (session.summary) completedSteps.push("summary");

      // Convert MongoDB session to AnalysisResultDto
      const result: AnalysisResultDto = {
        sessionId: session.sessionId,
        status: session.status as
          | "pending"
          | "in_progress"
          | "completed"
          | "failed",
        progress: progress,
        completedSteps: completedSteps,
        createdAt: session.startTime,
        completedAt: session.endTime,
        transcript: session.transcript,
        topics: session.topics || [],
        actionItems: session.actionItems || [],
        summary: session.summary || null,
        sentiment: session.sentiment || null,
        errors: session.errors || [],
        // Include context for RAG results if available
        context: session.metadata?.context || null,
        ...session.metadata,
      };

      this.logger.log(
        `Returning results for session ${sessionId} with status ${result.status} and progress ${progress}%`,
      );

      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error; // Re-throw authorization errors
      }
      this.logger.error(
        `Error retrieving analysis results: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return uuidv4();
  }

  /**
   * Run meeting analysis using direct graph construction and execution
   */
  async runGraphAnalysis(
    sessionId: string,
    transcript: string,
    userId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      this.logger.log(`Running graph analysis for session ${sessionId}`);

      // Determine if RAG should be used
      const useRag = this.ragEnabled && metadata?.useRag !== false;

      // Prepare the initial state
      let initialState: any = {
        transcript,
        sessionId,
        userId,
        startTime: new Date().toISOString(),
        metadata: metadata || {},
        currentPhase: "initialization",
        topics: [],
        actionItems: [],
        sentiment: null,
        summary: null,
        errors: [],
      };

      // If RAG is enabled, enhance the state with relevant context
      if (useRag) {
        this.logger.log(`Using RAG for session ${sessionId}`);
        try {
          // Use the existing RAG service to get context
          const documents = await this.ragService.getContext(transcript, {
            indexName: "meeting-analysis",
            namespace: "transcripts",
            topK: 3,
            filter: metadata?.filter,
            minScore: 0.7,
          });

          this.logger.log(
            `Retrieved ${documents.length} relevant documents for context`,
          );

          // Format the context for use in the prompts
          if (documents.length > 0) {
            const contextText = documents
              .map((doc) => {
                return `--- Previous meeting content (${doc.metadata?.meetingTitle || "Untitled"}) ---\n${doc.content}\n--- End of content ---`;
              })
              .join("\n\n");

            // Add context to the initial state
            initialState = {
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

            this.logger.log(
              `Enhanced state with RAG context for session ${sessionId}`,
            );
          }
        } catch (error) {
          this.logger.warn(`Error retrieving RAG context: ${error.message}`);
          // Continue with analysis even if RAG retrieval fails
        }
      }

      // Use the direct graph execution approach
      this.logger.log(`Using direct graph execution for session ${sessionId}`);

      try {
        // Build the analysis graph using LangGraph StateGraph
        const graph = await this.meetingAnalysisGraph;

        // Initialize progress tracking for this session
        this.graphExecutionService.initProgress(sessionId);

        // Execute the graph with GraphExecutionService
        this.logger.log(`Executing agent graph for session ${sessionId}`);
        const finalState = await this.graphExecutionService.executeGraph(
          graph,
          initialState,
        );

        this.logger.log(`Graph execution completed for session ${sessionId}`);

        // Check if there were any errors during execution
        if (finalState.error || (finalState.errors && finalState.errors.length > 0)) {
          const errorMessage = finalState.error?.message || finalState.errors?.[0]?.error || 'Unknown error occurred';
          throw new Error(`Graph execution failed: ${errorMessage}`);
        }

        // Extract results
        const result = {
          transcript,
          topics: finalState.topics || [],
          actionItems: finalState.actionItems || [],
          sentiment: finalState.sentiment || null,
          summary: finalState.summary || null,
          errors: finalState.errors || [],
          // Include retrieved context in the results
          context: finalState.metadata?.retrievedContext
            ? {
                usedRag: true,
                retrievedContext: finalState.metadata.retrievedContext,
              }
            : null,
        };

        // Validate that we have some meaningful results
        const hasResults = result.topics.length > 0 || result.actionItems.length > 0 || result.summary;
        if (!hasResults) {
          throw new Error('Analysis completed but no meaningful results were generated');
        }

        // Save results to database
        await this.saveResults(sessionId, result);

        // Complete progress tracking
        this.graphExecutionService.completeProgress(
          sessionId,
          `Analysis completed with ${result.topics.length} topics and ${result.actionItems.length} action items`,
        );

        this.logger.log(`Successfully completed analysis for session ${sessionId}`);

      } catch (error) {
        this.logger.error(
          `Error in graph execution: ${error.message}`,
          error.stack,
        );
        throw error; // Re-throw to be caught by outer catch block
      }
    } catch (error) {
      this.logger.error(`Error in analysis: ${error.message}`, error.stack);

      // Update session with error - mark as FAILED, not completed
      await this.sessionRepository.updateSession(sessionId, {
        status: "failed",
        endTime: new Date(),
        errors: [
          {
            step: "graph_analysis",
            error: error.message,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      // Fail progress tracking
      this.graphExecutionService.failProgress(
        sessionId,
        `Analysis failed: ${error.message}`,
      );

      // Don't re-throw the error here to prevent unhandled rejection
      this.logger.error(`Analysis failed for session ${sessionId}: ${error.message}`);
    }
  }

  /**
   * Save analysis results to database
   */
  private async saveResults(sessionId: string, result: any): Promise<void> {
    this.logger.log(`Saving results for session ${sessionId}`);

    try {
      // Update the session in MongoDB with completed status and results
      await this.sessionRepository.updateSession(sessionId, {
        status: "completed",
        endTime: new Date(),
        topics: result.topics,
        actionItems: result.actionItems,
        sentiment: result.sentiment,
        summary: result.summary,
        errors: result.errors,
        // Include the context/RAG information
        metadata: {
          context: result.context,
        },
      });

      this.logger.log(`Results saved for session ${sessionId}`);

      // 🚀 NEW: Emit meeting analysis completion event for post-meeting orchestration
      this.emitMeetingAnalysisCompletedEvent(sessionId, result);
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
        .addNode("actionItemExtraction", this.actionItemExtractionNode.bind(this))
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

      this.logger.log("Meeting analysis graph initialized and compiled successfully");
    } catch (error) {
      this.logger.error(`Error initializing meeting analysis graph: ${error.message}`, error.stack);
      throw error; // Throw the error to prevent the service from starting with a broken graph
    }
  }

  // Node implementations
  private async initializationNode(state: MeetingAnalysisState): Promise<MeetingAnalysisState> {
    this.logger.log("Starting meeting analysis initialization");
    
    // Track progress for this node
    await this.trackNodeProgress(this.nodeNames.INITIALIZATION, state);
    
    return {
      ...state,
      stage: "initialization"
    };
  }

  private async contextRetrievalNode(state: MeetingAnalysisState): Promise<MeetingAnalysisState> {
    this.logger.log("Starting context retrieval");
    
    // Track progress for this node
    await this.trackNodeProgress(this.nodeNames.CONTEXT_RETRIEVAL, state);
    
    if (this.ragEnabled) {
      try {
        // Create a more specific context query from the beginning of the transcript
        const contextQuery = `${state.transcript.substring(0, 500)}...`;
        
        const retrievalOptions = {
          indexName: "meeting-analysis",
          namespace: "transcripts",
          topK: 5,
          minScore: 0.7,
        };

        this.logger.log(`Getting context for query: "${contextQuery.substring(0, 100)}..."`);
        this.logger.log(`Retrieval options: ${JSON.stringify(retrievalOptions)}`);

        const relevantDocuments = await this.ragService.getContext(
          contextQuery,
          retrievalOptions
        );

        this.logger.log(`Retrieved ${relevantDocuments.length} relevant documents for context enhancement`);

        if (relevantDocuments.length === 0) {
          this.logger.warn('No relevant documents found - this might be due to:');
          this.logger.warn('1. Pinecone indexing not yet complete (try waiting longer)');
          this.logger.warn('2. No similar meetings in the knowledge base');
          this.logger.warn('3. Query not matching existing document embeddings');
          this.logger.warn('4. Minimum score threshold too high');
        } else {
          this.logger.log(`Context documents retrieved: ${relevantDocuments.map(doc => doc.id).join(', ')}`);
        }

        return {
          ...state,
          metadata: {
            ...state.metadata,
            retrievedContext: relevantDocuments,
            ragEnabled: true,
            retrievalQuery: contextQuery.substring(0, 100)
          },
          stage: "context_retrieved"
        };
      } catch (error) {
        this.logger.warn(`Context retrieval failed: ${error.message}`);
        this.logger.warn('Continuing analysis without RAG context');
        return {
          ...state,
          metadata: {
            ...state.metadata,
            ragEnabled: false,
            ragError: error.message
          },
          stage: "context_retrieval_failed"
        };
      }
    } else {
      this.logger.log('RAG is disabled - skipping context retrieval');
    }
    
    return {
      ...state,
      stage: "context_retrieved"
    };
  }

  private async topicExtractionNode(state: MeetingAnalysisState): Promise<MeetingAnalysisState> {
    this.logger.log("Starting topic extraction");
    
    // Track progress for this node
    await this.trackNodeProgress(this.nodeNames.TOPIC_EXTRACTION, state);
    
    const agent = this.meetingAnalysisAgentFactory.getTopicExtractionAgent();
    const topics = await agent.extractTopics(state.transcript);
    
    const updatedState = {
      ...state,
      topics: topics.map(topic => ({
        name: topic.name,
        subtopics: topic.subtopics,
        participants: topic.participants,
        relevance: topic.relevance,
        duration: topic.duration
      })),
      stage: "topic_extraction" as const
    };
    
    return updatedState;
  }

  private async actionItemExtractionNode(state: MeetingAnalysisState): Promise<MeetingAnalysisState> {
    this.logger.log("Starting action item extraction");
    
    // Track progress for this node
    await this.trackNodeProgress(this.nodeNames.ACTION_ITEM_EXTRACTION, state);
    
    const agent = this.meetingAnalysisAgentFactory.getActionItemAgent();
    const agentActionItems = await agent.extractActionItems(state.transcript);
    
    // Map agent output to MeetingAnalysisState format
    const actionItems = agentActionItems.map(item => ({
      description: item.description,
      assignee: item.assignee,
      dueDate: item.deadline,
      status: (item.status === "in_progress" ? "pending" : item.status) as "pending" | "completed"
    }));
    
    const updatedState = {
      ...state,
      actionItems,
      stage: "action_item_extraction" as const
    };
    
    return updatedState;
  }

  private async sentimentAnalysisNode(state: MeetingAnalysisState): Promise<MeetingAnalysisState> {
    this.logger.log("Starting sentiment analysis");
    
    // Track progress for this node
    await this.trackNodeProgress(this.nodeNames.SENTIMENT_ANALYSIS, state);
    
    const agent = this.meetingAnalysisAgentFactory.getSentimentAnalysisAgent();
    const sentimentAnalysis = await agent.analyzeSentiment(state.transcript);
    
    const updatedState = {
      ...state,
      sentiment: {
        overall: sentimentAnalysis.score, // Use score (number) for overall sentiment
        segments: sentimentAnalysis.segments?.map(segment => ({
          text: segment.text,
          score: segment.score
        }))
      },
      stage: "sentiment_analysis" as const
    };
    
    return updatedState;
  }

  private async summaryGenerationNode(state: MeetingAnalysisState): Promise<MeetingAnalysisState> {
    this.logger.log("Starting summary generation");
    
    // Track progress for this node
    await this.trackNodeProgress(this.nodeNames.SUMMARY_GENERATION, state);
    
    const agent = this.meetingAnalysisAgentFactory.getSummaryAgent();
    const summary = await agent.generateSummary(state.transcript);
    
    const updatedState = {
      ...state,
      summary: {
        meetingTitle: summary.meetingTitle,
        summary: summary.summary,
        decisions: summary.decisions?.map(decision => ({
          title: decision.title,
          content: decision.content
        })) || [],
        next_steps: summary.next_steps
      },
      stage: "summary_generation" as const
    };
    
    return updatedState;
  }

  private async documentStorageNode(state: MeetingAnalysisState): Promise<MeetingAnalysisState> {
    this.logger.log("Starting document storage");
    
    // Track progress for this node  
    await this.trackNodeProgress("document_storage", state);
    
    // Document storage logic would go here
    
    return {
      ...state,
      stage: "summary_generation"
    };
  }

  private async finalizationNode(state: MeetingAnalysisState): Promise<MeetingAnalysisState> {
    this.logger.log("Starting finalization");
    
    // Track progress for this node
    await this.trackNodeProgress("finalization", state);
    
    return {
      ...state,
      stage: "completed"
    };
  }

  /**
   * Track progress within a node execution
   */
  private async trackNodeProgress(nodeName: string, state: any): Promise<void> {
    try {
      // Calculate progress based on the current node
      const progress = this.graphExecutionService.calculateProgressForNode(nodeName);

      // Only update progress if this is a tracked node
      if (progress > 0) {
        // Update progress using GraphExecutionService
        this.graphExecutionService.updateProgress(
          state.sessionId,
          nodeName,
          progress,
          "in_progress",
          `Executing ${nodeName.replace("_", " ")}`,
        );

        // Update MongoDB with partial results
        if (state) {
          const partialUpdate: any = {
            progress: progress,
            status: "in_progress",
          };

          // Add any available results to the update
          if (
            nodeName === this.nodeNames.TOPIC_EXTRACTION &&
            state.topics
          ) {
            partialUpdate.topics = state.topics;
            this.logger.log(
              `Saving partial topics result for session ${state.sessionId}: ${state.topics.length} topics`,
            );
          } else if (
            nodeName === this.nodeNames.ACTION_ITEM_EXTRACTION &&
            state.actionItems
          ) {
            partialUpdate.actionItems = state.actionItems;
            this.logger.log(
              `Saving partial action items result for session ${state.sessionId}: ${state.actionItems.length} items`,
            );
          } else if (
            nodeName === this.nodeNames.SENTIMENT_ANALYSIS &&
            state.sentiment
          ) {
            partialUpdate.sentiment = state.sentiment;
            this.logger.log(
              `Saving partial sentiment result for session ${state.sessionId}`,
            );
          } else if (
            nodeName === this.nodeNames.SUMMARY_GENERATION &&
            state.summary
          ) {
            partialUpdate.summary = state.summary;
            this.logger.log(
              `Saving partial summary result for session ${state.sessionId}`,
            );
          }

          // Update MongoDB with partial results
          await this.sessionRepository.updateSession(
            state.sessionId,
            partialUpdate,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error in progress tracking: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Calculate progress percentage based on current node
   */
  private calculateProgressForNode(nodeName: string): number {
    // Base progress for each completed node
    const nodeBaseProgress: Record<string, number> = {
      [this.nodeNames.INITIALIZATION]: 5,
      [this.nodeNames.CONTEXT_RETRIEVAL]: 15,
      [this.nodeNames.TOPIC_EXTRACTION]: 35,
      [this.nodeNames.ACTION_ITEM_EXTRACTION]: 55,
      [this.nodeNames.SENTIMENT_ANALYSIS]: 70,
      [this.nodeNames.SUMMARY_GENERATION]: 85,
      [this.nodeNames.SUPERVISION]: 95,
      [this.nodeNames.POST_PROCESSING]: 97,
      [this.nodeNames.END]: 100,
    };

    return nodeBaseProgress[nodeName] || 0;
  }
}
