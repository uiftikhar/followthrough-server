import { Injectable, Logger, NotFoundException, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
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
import { GraphExecutionService } from '../core/graph-execution.service';
import { TeamHandler } from '../core/interfaces/team-handler.interface';
import { MeetingAnalysisGraphBuilder } from './meeting-analysis-graph.builder';
import { MeetingAnalysisState } from './interfaces/meeting-analysis-state.interface';
import { TeamHandlerRegistry } from '../core/team-handler-registry.service';
import { EnhancedGraphService } from '../core/enhanced-graph.service';

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
    private readonly stateService: StateService,
    private readonly eventEmitter: EventEmitter2,
    private readonly sessionRepository: SessionRepository,
    private readonly agentFactory: AgentFactory,
    private readonly supervisorAgent: SupervisorAgent,
    private readonly graphExecutionService: GraphExecutionService,
    private readonly meetingAnalysisGraphBuilder: MeetingAnalysisGraphBuilder,
    private readonly teamHandlerRegistry: TeamHandlerRegistry,
    private readonly enhancedGraphService: EnhancedGraphService,
  ) {
    this.logger.log('MeetingAnalysisService initialized with direct graph execution and MongoDB storage');
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
    this.logger.log('Processing meeting transcript');
    
    // Create a unique ID for this meeting if not provided
    const meetingId = input.metadata?.meetingId || uuidv4();
    
    // Prepare initial state
    const initialState: MeetingAnalysisState = {
      meetingId,
      transcript: input.content,
      context: input.metadata || {},
    };
    
    try {
      // Build the graph
      const graph = await this.meetingAnalysisGraphBuilder.buildGraph();
      
      // Attach progress tracking
      this.graphExecutionService.attachProgressTracker(graph, meetingId);
      
      // Execute the graph
      this.logger.log(`Executing meeting analysis graph for meeting ${meetingId}`);
      const result = await this.graphExecutionService.executeGraph<MeetingAnalysisState>(
        graph,
        initialState,
      );
      
      this.logger.log(`Completed meeting analysis for meeting ${meetingId}`);
      return result;
    } catch (error) {
      this.logger.error(`Error analyzing meeting ${meetingId}: ${error.message}`, error.stack);
      return {
        ...initialState,
        error: {
          message: error.message,
          stage: 'execution',
          timestamp: new Date().toISOString(),
        },
      };
    }
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
    useRAG: boolean = false
  ): Promise<void> {
    try {
      this.logger.log(`Running graph analysis for session ${sessionId}`);
      
      // Prepare the initial state
      const initialState = {
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
      });
      
      this.logger.log(`Results saved for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error saving results: ${error.message}`, error.stack);
      throw error;
    }
  }
}
