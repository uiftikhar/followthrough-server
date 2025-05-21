import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { GraphService } from '../graph/graph.service';
import { StateService } from '../state/state.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Topic } from '../agents/topic-extraction.agent';
import { ActionItem } from '../agents/action-item.agent';
import { MeetingSummary } from '../agents/summary.agent';
import { SessionRepository } from '../../database/repositories/session.repository';
import { Session } from '../../database/schemas/session.schema';
import { AnalysisResultDto } from './dto/analysis-result.dto';
import { SentimentAnalysis } from '../agents/sentiment-analysis.agent';
import { AgentFactory } from '../agents/agent.factory';
import { SupervisorAgent } from '../agents/supervisor/supervisor.agent';

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
 */
@Injectable()
export class MeetingAnalysisService {
  private readonly logger = new Logger(MeetingAnalysisService.name);
  private readonly progressMap: Map<string, number> = new Map();
  
  // Node names for graph execution
  private readonly nodeNames = {
    START: '__start__',
    INITIALIZATION: 'initialization',
    CONTEXT_RETRIEVAL: 'context_retrieval',
    TOPIC_EXTRACTION: 'topic_extraction',
    ACTION_ITEM_EXTRACTION: 'action_item_extraction',
    SENTIMENT_ANALYSIS: 'sentiment_analysis',
    SUMMARY_GENERATION: 'summary_generation',
    SUPERVISION: 'supervision',
    POST_PROCESSING: 'post_processing',
    END: '__end__',
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly graphService: GraphService,
    private readonly stateService: StateService,
    private readonly eventEmitter: EventEmitter2,
    private readonly sessionRepository: SessionRepository,
    private readonly agentFactory: AgentFactory,
    private readonly supervisorAgent: SupervisorAgent,
  ) {
    this.logger.log('MeetingAnalysisService initialized with direct graph execution and MongoDB storage');
  }

  /**
   * Analyze a transcript
   */
  async analyzeTranscript(
    transcript: string,
    metadata?: Record<string, any>,
    userId?: string,
  ): Promise<{
    sessionId: string;
    status: string;
  }> {
    // If no userId is provided, default to system
    const actualUserId = userId || 'system';
    
    // Create a unique session ID
    const sessionId = this.generateSessionId();
    this.logger.log(`Created new analysis session: ${sessionId} for user: ${actualUserId}`);

    // Check if this is a RAG-enhanced analysis request
    const useRAG = metadata?.usedRag === true;

    // Create initial session object for MongoDB
    const sessionData: Partial<Session> = {
      sessionId,
      userId: actualUserId,
      status: 'pending',
      transcript,
      startTime: new Date(),
      metadata: metadata || {},
    };

    try {
      // Store the session in MongoDB
      await this.sessionRepository.createSession(sessionData);
      this.logger.log(`Session ${sessionId} stored in MongoDB for user ${actualUserId}`);
      
      // Initialize progress
      this.initProgress(sessionId);

      // Publish initial progress update
      this.publishProgressUpdate(
        sessionId,
        'initialization',
        0,
        'pending',
        'Starting analysis',
      );
      
      // Start real analysis process (non-blocking)
      this.runGraphAnalysis(sessionId, transcript, actualUserId, metadata, useRAG);

      return {
        sessionId,
        status: 'pending',
      };
    } catch (error) {
      this.logger.error(`Error initiating analysis: ${error.message}`, error.stack);
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
        session = await this.sessionRepository.getSessionByIdAndUserId(sessionId, userId);
        this.logger.log(`Found session ${sessionId} in MongoDB for user ${userId}`);
      } else {
        // Get session without user verification
        session = await this.sessionRepository.getSessionById(sessionId);
        this.logger.log(`Found session ${sessionId} in MongoDB`);
      }
      
      // Convert MongoDB session to AnalysisResultDto
      const result: AnalysisResultDto = {
        sessionId: session.sessionId,
        status: session.status as 'pending' | 'in_progress' | 'completed' | 'failed',
        createdAt: session.startTime,
        completedAt: session.endTime,
        transcript: session.transcript,
        topics: session.topics,
        actionItems: session.actionItems,
        summary: session.summary,
        sentiment: session.sentiment,
        errors: session.errors,
        ...session.metadata,
      };
      
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
  private async runGraphAnalysis(
    sessionId: string, 
    transcript: string, 
    userId: string,
    metadata?: Record<string, any>,
    useRAG: boolean = false
  ): Promise<void> {
    try {
      // Update session status to in_progress
      await this.sessionRepository.updateSession(sessionId, {
        status: 'in_progress',
      });
      
      this.publishProgressUpdate(
        sessionId,
        this.nodeNames.INITIALIZATION,
        5,
        'in_progress',
        useRAG ? 'Building RAG-enhanced agent graph' : 'Building agent graph',
      );
      
      // Create initial state using StateService
      const initialState = await this.stateService.createInitialState({
        transcript,
        sessionId,
        userId,
        startTime: new Date().toISOString(),
        metadata: metadata || {},
        useRAG,
      });
      
      this.logger.log(`Created initial state for graph execution: ${JSON.stringify(Object.keys(initialState))}`);
      this.publishProgressUpdate(
        sessionId,
        this.nodeNames.INITIALIZATION,
        10,
        'in_progress',
        'Building agent graph',
      );
      
      // Build the agent graph using GraphService
      const graph = useRAG 
        ? await this.graphService.buildRagMeetingAnalysisGraph()
        : await this.graphService.buildMeetingAnalysisGraph();
      
      // Add state transition handler for progress tracking
      this.attachProgressTracker(graph, sessionId);
      
      this.publishProgressUpdate(
        sessionId,
        this.nodeNames.INITIALIZATION,
        15,
        'in_progress',
        'Starting agent execution',
      );
      
      // Execute the graph with initial state using GraphService
      this.logger.log(`Executing agent graph for session ${sessionId}`);
      const finalState = await this.graphService.executeGraph(graph, initialState);
      
      this.logger.log(`Graph execution completed for session ${sessionId}`);
      this.logger.debug(`Final state keys: ${Object.keys(finalState).join(', ')}`);
      
      // Extract results from the final state
      const result = {
        topics: finalState.topics || [],
        actionItems: finalState.actionItems || [],
        summary: finalState.summary || null,
        sentiment: finalState.sentiment || null,
        errors: finalState.errors || [],
        context: useRAG ? (finalState.retrievedContext || null) : null,
      };
      
      // Update the session in MongoDB with completed status and results
      await this.sessionRepository.updateSession(sessionId, {
        status: 'completed',
        endTime: new Date(),
        ...result,
      });
      
      // Final progress update
      this.publishProgressUpdate(
        sessionId,
        'completed',
        100,
        'completed',
        'Analysis completed successfully',
      );
      
      this.logger.log(`Completed direct graph analysis for session ${sessionId}`);
    } catch (error) {
      this.logger.error(
        `Error in direct graph analysis for session ${sessionId}: ${error.message}`,
        error.stack,
      );
      
      // Update session in MongoDB with error state
      await this.sessionRepository.updateSession(sessionId, {
        status: 'failed',
        endTime: new Date(),
        errors: [{ 
          step: 'graph_execution', 
          error: error.message, 
          timestamp: new Date().toISOString() 
        }],
      }).catch(updateError => {
        this.logger.error(`Failed to update session with error state: ${updateError.message}`);
      });
      
      // Publish final error progress update
      this.publishProgressUpdate(
        sessionId,
        'failed',
        100,
        'failed',
        `Analysis failed: ${error.message}`,
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
              [`progress.${nodeName}`]: progress,
            };
            
            // Add any available results to the update
            if (nodeName === this.nodeNames.TOPIC_EXTRACTION && newState.topics) {
              partialUpdate.topics = newState.topics;
            } else if (nodeName === this.nodeNames.ACTION_ITEM_EXTRACTION && newState.actionItems) {
              partialUpdate.actionItems = newState.actionItems;
            } else if (nodeName === this.nodeNames.SENTIMENT_ANALYSIS && newState.sentiment) {
              partialUpdate.sentiment = newState.sentiment;
            } else if (nodeName === this.nodeNames.SUMMARY_GENERATION && newState.summary) {
              partialUpdate.summary = newState.summary;
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
}
