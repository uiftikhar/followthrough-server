import { Injectable, Logger, NotFoundException, UnauthorizedException, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StateService } from '../state/state.service';
import { Topic } from '../agents/topic-extraction.agent';
import { ActionItem } from '../agents/action-item.agent';
import { MeetingSummary } from '../agents/summary.agent';
import { SentimentAnalysis } from '../agents/sentiment-analysis.agent';
import { AgentFactory } from '../agents/agent.factory';
import { GraphExecutionService } from '../core/graph-execution.service';
import { TeamHandler } from '../core/interfaces/team-handler.interface';
import { MeetingAnalysisGraphBuilder } from './meeting-analysis-graph.builder';
import { MeetingAnalysisState } from './interfaces/meeting-analysis-state.interface';
import { TeamHandlerRegistry } from '../core/team-handler-registry.service';
import { EnhancedGraphService } from '../core/enhanced-graph.service';
import { RAG_SERVICE } from '../../rag/constants/injection-tokens';
import { RagService } from '../../rag/rag.service';
import { DocumentProcessorService } from '../../embedding/document-processor.service';
import { AdaptiveRagService } from '../../rag/adaptive-rag.service';
import { SessionRepository } from '../../database/repositories/session.repository';
import { Session } from '../../database/schemas/session.schema';
import { AnalysisResultDto } from './dto/analysis-result.dto';

/**
 * Event type for analysis progress updates
 */
export interface AnalysisProgressEvent {
  sessionId: string;
  phase: string;
  progress: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
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
  private readonly progressMap: Map<string, number> = new Map();
  private readonly teamName = 'meeting_analysis';
  private readonly ragEnabled: boolean;

  // Node names for graph execution
  private readonly nodeNames = {
    START: '__start__',
    INITIALIZATION: 'initialization',
    CONTEXT_RETRIEVAL: 'context_retrieval',
    TOPIC_EXTRACTION: 'topic_extraction',
    ACTION_ITEM_EXTRACTION: 'action_item_extraction',
    SENTIMENT_ANALYSIS: 'sentiment_analysis',
    SUMMARY_GENERATION: 'summary_generation',
    DOCUMENT_STORAGE: 'document_storage',
    SUPERVISION: 'supervision',
    POST_PROCESSING: 'post_processing',
    END: '__end__',
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly sessionRepository: SessionRepository,
    private readonly graphExecutionService: GraphExecutionService,
    private readonly meetingAnalysisGraphBuilder: MeetingAnalysisGraphBuilder,
    private readonly teamHandlerRegistry: TeamHandlerRegistry,
    private readonly stateService: StateService,
    private readonly agentFactory: AgentFactory,
    private readonly enhancedGraphService: EnhancedGraphService,
    @Inject(RAG_SERVICE) private readonly ragService: RagService,
    private readonly documentProcessorService: DocumentProcessorService,
    private readonly adaptiveRagService: AdaptiveRagService,
  ) {
    this.ragEnabled = this.configService.get<boolean>('rag.enabled', true);
    this.logger.log('MeetingAnalysisService initialized with enhanced RAG capabilities');
    this.logger.log(`RAG capabilities are ${this.ragEnabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Register with TeamHandlerRegistry on module initialization
   */
  onModuleInit() {
    this.teamHandlerRegistry.registerHandler(
      this.getTeamName(),
      this
    );
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
    if (typeof input?.content !== 'string') {
      return false;
    }

    const content = input.content.toLowerCase();

    // Check for common meeting transcript patterns
    const hasSpeakers = content.includes(':') &&
      (content.match(/\w+\s*:/g) || []).length > 3;

    const hasMeetingKeywords = [
      'meeting', 'call', 'discussion', 'agenda', 'action item',
      'minutes', 'participant', 'attendee', 'next steps',
    ].some(keyword => content.includes(keyword));

    return hasSpeakers || hasMeetingKeywords;
  }

  /**
   * Process a meeting transcript
   */
  async process(input: any): Promise<MeetingAnalysisState> {
    this.logger.log('Processing meeting transcript with enhanced RAG');

    // Create a unique ID for this meeting if not provided
    const meetingId = input.metadata?.meetingId || uuidv4();

    // Prepare initial state
    const initialState: MeetingAnalysisState = {
      meetingId,
      transcript: input.content,
      context: input.metadata || {},
    };

    try {
      // Step 1: Store current meeting transcript in Pinecone for future RAG retrieval
      await this.storeMeetingTranscriptForRag(meetingId, input.content, input.metadata);

      // Step 2: Enhanced RAG context retrieval using adaptive RAG
      let enhancedState = initialState;
      if (this.ragEnabled) {
        this.logger.log(`Using enhanced RAG capabilities for meeting analysis ${meetingId}`);
        try {
          // Determine the best retrieval strategy using adaptive RAG
          const retrievalStrategy = await this.adaptiveRagService.determineRetrievalStrategy(
            input.content.substring(0, 500) // Use a sample of the transcript for strategy determination
          );

          this.logger.log(`Adaptive RAG selected strategy: ${retrievalStrategy.strategy}`);

          // Use the determined strategy for enhanced context retrieval
          const retrievalOptions = {
            indexName: 'meeting-analysis',
            namespace: 'transcripts',
            topK: retrievalStrategy.settings.topK || 5,
            minScore: retrievalStrategy.settings.minScore || 0.7,
            filter: input.metadata?.filter,
          };

          // Get context using the standard RAG service with adaptive settings
          const documents = await this.ragService.getContext(input.content, retrievalOptions);

          this.logger.log(`Retrieved ${documents.length} relevant documents with adaptive strategy: ${retrievalStrategy.strategy}`);

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
                  retrievalSettings: retrievalStrategy.settings
                }
              }
            };

            this.logger.log(`Enhanced state with adaptive RAG context for meeting ${meetingId}`);
          }
        } catch (error) {
          this.logger.warn(`Error retrieving adaptive RAG context: ${error.message}`);
          // Continue with analysis even if RAG retrieval fails
        }
      }

      // Step 3: Build and execute the enhanced graph
      const graph = await this.meetingAnalysisGraphBuilder.buildGraph();

      // Attach progress tracking
      this.graphExecutionService.attachProgressTracker(graph, meetingId);

      // Execute the graph with the enhanced state
      this.logger.log(`Executing enhanced meeting analysis graph for meeting ${meetingId}`);
      const result = await this.graphExecutionService.executeGraph<MeetingAnalysisState>(
        graph,
        enhancedState,
      );

      this.logger.log(`Completed enhanced meeting analysis for meeting ${meetingId}`);

      // Ensure we return a properly formatted state with correct types
      return {
        ...result,
        transcript: result.transcript || input.content,
        topics: result.topics || [],
        actionItems: result.actionItems || [],
        sentiment: result.sentiment,
        summary: result.summary,
        stage: 'completed',
        error: result.error
      };
    } catch (error) {
      this.logger.error(`Error analyzing meeting ${meetingId}: ${error.message}`, error.stack);
      return {
        ...initialState,
        topics: [],
        actionItems: [],
        sentiment: undefined,
        summary: undefined,
        stage: 'completed',
        error: {
          message: error.message,
          stage: 'execution',
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
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      this.logger.log(`Storing meeting ${meetingId} transcript in Pinecone for RAG`);

      // Use semantic chunking for better chunk boundaries
      const chunks = await this.ragService.chunkText(transcript, {
        chunkSize: 1000,
        chunkOverlap: 200,
        useSemanticChunking: true, // Use semantic chunking for better context
      });

      // Process and store chunks using DocumentProcessorService
      const documents = chunks.map((chunk, index) => ({
        id: `${meetingId}-chunk-${index}`,
        content: chunk,
        metadata: {
          meetingId,
          chunkIndex: index,
          totalChunks: chunks.length,
          timestamp: new Date().toISOString(),
          type: 'meeting_transcript',
          ...metadata,
        },
      }));

      // Store in Pinecone for future retrieval
      const storedChunkIds = await this.documentProcessorService.processAndStoreDocuments(
        documents,
        {
          indexName: 'meeting-analysis',
          namespace: 'transcripts',
          batchSize: 5,
          concurrency: 2,
        }
      );

      this.logger.log(`Successfully stored ${storedChunkIds.length} chunks for meeting ${meetingId} in Pinecone`);
    } catch (error) {
      this.logger.error(`Error storing meeting transcript in Pinecone: ${error.message}`, error.stack);
      // Don't throw - analysis can continue without storage
    }
  }

  /**
   * Format retrieved context for analysis
   */
  private formatContextForAnalysis(documents: any[]): string {
    return documents.map(doc => {
      const metadata = doc.metadata || {};
      const meetingId = metadata.meetingId || 'unknown';
      const timestamp = metadata.timestamp || 'unknown';
      
      return `--- Meeting ${meetingId} (${timestamp}) ---\n${doc.content}\n--- End ---`;
    }).join('\n\n');
  }

  /**
   * Analyze a transcript
   */
  async analyzeTranscript(
    transcript: string,
    metadata?: Record<string, any>,
    userId?: string,
  ): Promise<any> {
    // // If no userId is provided, default to system
    // const actualUserId = userId || 'system';

    // // Create a unique session ID
    // const sessionId = this.generateSessionId();
    // this.logger.log(`Created new analysis session: ${sessionId} for user: ${actualUserId}`);

    // // Check if this is a RAG-enhanced analysis request
    // const useRAG = metadata?.useRag !== false && this.ragEnabled;
    // if (useRAG) {
    //   this.logger.log(`Session ${sessionId} will use RAG capabilities`);
    // }

    // // Create initial session object for MongoDB
    // const sessionData: Partial<Session> = {
    //   sessionId,
    //   userId: actualUserId,
    //   status: 'pending',
    //   transcript,
    //   startTime: new Date(),
    //   metadata: {
    //     ...metadata || {},
    //     useRag: useRAG
    //   },
    // };

    // try {
    //   // Store the session in MongoDB
    //   await this.sessionRepository.createSession(sessionData);
    //   this.logger.log(`Session ${sessionId} stored in MongoDB for user ${actualUserId}`);

    //   // Initialize progress
    //   this.initProgress(sessionId);

    //   // Publish initial progress update
    //   this.publishProgressUpdate(
    //     sessionId,
    //     'initialization',
    //     0,
    //     'pending',
    //     'Starting analysis',
    //   );

    //   // Start real analysis process (non-blocking)
    //   this.runGraphAnalysis(sessionId, transcript, actualUserId, metadata);

    //   return {
    //     sessionId,
    //     status: 'pending',
    //   };
    // } catch (error) {
    //   this.logger.error(`Error initiating analysis: ${error.message}`, error.stack);
    //   throw error;
    // }
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
        session = await this.sessionRepository.getSessionByIdAndUserId(sessionId, userId);
        this.logger.log(`Found session ${sessionId} in MongoDB for user ${userId}`);
      } else {
        // Get session without user verification
        session = await this.sessionRepository.getSessionById(sessionId);
        this.logger.log(`Found session ${sessionId} in MongoDB`);
      }

      // Calculate progress percentage
      const progress = session.status === 'completed' ? 100 :
        session.status === 'failed' ? 100 :
          this.progressMap.get(sessionId) || 0;

      // Calculate what has been completed so far
      const completedSteps: string[] = [];
      if (session.topics && session.topics.length > 0) completedSteps.push('topics');
      if (session.actionItems && session.actionItems.length > 0) completedSteps.push('action_items');
      if (session.sentiment) completedSteps.push('sentiment');
      if (session.summary) completedSteps.push('summary');

      // Convert MongoDB session to AnalysisResultDto
      const result: AnalysisResultDto = {
        sessionId: session.sessionId,
        status: session.status as 'pending' | 'in_progress' | 'completed' | 'failed',
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

      this.logger.log(`Returning results for session ${sessionId} with status ${result.status} and progress ${progress}%`);

      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error; // Re-throw authorization errors
      }
      this.logger.error(`Error retrieving analysis results: ${error.message}`, error.stack);
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
   * Initialize progress tracking for a new session
   */
  private initProgress(sessionId: string): void {
    this.progressMap.set(sessionId, 0);
    this.logger.debug(`Initialized progress tracking for session ${sessionId}`);
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
        currentPhase: 'initialization',
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
            indexName: 'meeting-analysis',
            namespace: 'transcripts',
            topK: 3,
            filter: metadata?.filter,
            minScore: 0.7
          });

          this.logger.log(`Retrieved ${documents.length} relevant documents for context`);

          // Format the context for use in the prompts
          if (documents.length > 0) {
            const contextText = documents.map(doc => {
              return `--- Previous meeting content (${doc.metadata?.meetingTitle || 'Untitled'}) ---\n${doc.content}\n--- End of content ---`;
            }).join('\n\n');

            // Add context to the initial state
            initialState = {
              ...initialState,
              metadata: {
                ...initialState.metadata,
                retrievedContext: {
                  documents,
                  contextText,
                  timestamp: new Date().toISOString()
                }
              }
            };

            this.logger.log(`Enhanced state with RAG context for session ${sessionId}`);
          }
        } catch (error) {
          this.logger.warn(`Error retrieving RAG context: ${error.message}`);
          // Continue with analysis even if RAG retrieval fails
        }
      }

      // Use the direct graph execution approach
      this.logger.log(`Using direct graph execution for session ${sessionId}`);

      try {
        // Build the analysis graph using MeetingAnalysisGraphBuilder
        const graph = await this.meetingAnalysisGraphBuilder.buildGraph();

        // Add state transition handler for progress tracking
        this.attachProgressTracker(graph, sessionId);

        // Execute the graph with GraphExecutionService
        this.logger.log(`Executing agent graph for session ${sessionId}`);
        const finalState = await this.graphExecutionService.executeGraph(graph, initialState);

        this.logger.log(`Graph execution completed for session ${sessionId}`);

        // Extract results
        const result = {
          transcript,
          topics: finalState.topics || [],
          actionItems: finalState.actionItems || [],
          sentiment: finalState.sentiment || null,
          summary: finalState.summary || null,
          errors: finalState.errors || [],
          // Include retrieved context in the results
          context: finalState.metadata?.retrievedContext ? {
            usedRag: true,
            retrievedContext: finalState.metadata.retrievedContext
          } : null
        };

        // Save results to database
        await this.saveResults(sessionId, result);

        // Final progress update
        this.publishProgressUpdate(
          sessionId,
          'completed',
          100,
          'completed',
          `Analysis completed with ${result.topics.length} topics and ${result.actionItems.length} action items`
        );
      } catch (error) {
        this.logger.error(`Error in graph execution: ${error.message}`, error.stack);
        throw error;
      }
    } catch (error) {
      this.logger.error(`Error in analysis: ${error.message}`, error.stack);

      // Update session with error
      await this.sessionRepository.updateSession(sessionId, {
        status: 'failed',
        endTime: new Date(),
        errors: [{
          step: 'graph_analysis',
          error: error.message,
          timestamp: new Date().toISOString(),
        }],
      });

      // Final error progress update
      this.publishProgressUpdate(
        sessionId,
        'failed',
        100,
        'failed',
        `Analysis failed: ${error.message}`
      );
    }
  }

  /**
   * Attach progress tracking to the graph
   */
  private attachProgressTracker(graph: any, sessionId: string): void {
    // Attach state transition handler to track progress
    graph.addStateTransitionHandler(async (prevState: any, newState: any, nodeName: string) => {
      try {
        // Calculate progress based on the current node
        const progress = this.calculateProgressForNode(nodeName);

        // Only update progress if this is a tracked node
        if (progress > 0) {
          // Publish progress update
          this.publishProgressUpdate(
            sessionId,
            nodeName,
            progress,
            'in_progress',
            `Executing ${nodeName.replace('_', ' ')}`,
          );

          // Update MongoDB with partial results
          if (newState) {
            const partialUpdate: any = {
              progress: progress,
              status: 'in_progress'
            };

            // Add any available results to the update
            if (nodeName === this.nodeNames.TOPIC_EXTRACTION && newState.topics) {
              partialUpdate.topics = newState.topics;
              this.logger.log(`Saving partial topics result for session ${sessionId}: ${newState.topics.length} topics`);
            } else if (nodeName === this.nodeNames.ACTION_ITEM_EXTRACTION && newState.actionItems) {
              partialUpdate.actionItems = newState.actionItems;
              this.logger.log(`Saving partial action items result for session ${sessionId}: ${newState.actionItems.length} items`);
            } else if (nodeName === this.nodeNames.SENTIMENT_ANALYSIS && newState.sentiment) {
              partialUpdate.sentiment = newState.sentiment;
              this.logger.log(`Saving partial sentiment result for session ${sessionId}`);
            } else if (nodeName === this.nodeNames.SUMMARY_GENERATION && newState.summary) {
              partialUpdate.summary = newState.summary;
              this.logger.log(`Saving partial summary result for session ${sessionId}`);
            }

            // Update MongoDB with partial results
            await this.sessionRepository.updateSession(sessionId, partialUpdate);
          }
        }
      } catch (error) {
        this.logger.error(`Error in progress tracking: ${error.message}`, error.stack);
      }

      // Always return the newState to continue graph execution
      return newState;
    });
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

  /**
   * Publish a progress update event
   */
  private publishProgressUpdate(
    sessionId: string,
    phase: string,
    progress: number,
    status: 'pending' | 'in_progress' | 'completed' | 'failed',
    message?: string,
  ): void {
    const event: AnalysisProgressEvent = {
      sessionId,
      phase,
      progress,
      status,
      message,
      timestamp: new Date().toISOString(),
    };

    // Save current progress
    this.progressMap.set(sessionId, progress);

    // Emit event for WebSocket gateway
    this.eventEmitter.emit('analysis.progress', event);

    this.logger.log(
      `Published progress update for session ${sessionId}: ${progress}% (${phase}) - ${message}`,
    );
  }

  /**
   * Save analysis results to database
   */
  private async saveResults(sessionId: string, result: any): Promise<void> {
    this.logger.log(`Saving results for session ${sessionId}`);

    try {
      // Update the session in MongoDB with completed status and results
      await this.sessionRepository.updateSession(sessionId, {
        status: 'completed',
        endTime: new Date(),
        topics: result.topics,
        actionItems: result.actionItems,
        sentiment: result.sentiment,
        summary: result.summary,
        errors: result.errors,
        // Include the context/RAG information
        metadata: {
          context: result.context
        }
      });

      this.logger.log(`Results saved for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error saving results: ${error.message}`, error.stack);
      throw error;
    }
  }
}
