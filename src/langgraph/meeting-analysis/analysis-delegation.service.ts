import { Injectable, Logger } from '@nestjs/common';
import { MeetingAnalysisService } from './meeting-analysis.service';

/**
 * Service that acts as a bridge to avoid circular dependencies
 * between GraphService and MeetingAnalysisService
 */
@Injectable()
export class AnalysisDelegationService {
  private readonly logger = new Logger(AnalysisDelegationService.name);

  constructor(private readonly meetingAnalysisService: MeetingAnalysisService) {}

  /**
   * Delegate meeting analysis to the MeetingAnalysisService
   */
  async delegateMeetingAnalysis(
    state: any,
  ): Promise<any> {
    try {
      // Extract data from state
      const transcript = state.input?.transcript || state.transcript;
      const userId = state.userId || 'system';
      const sessionId = state.sessionId;
      const metadata = {
        ...state.metadata || {},
        // Enable RAG for enhanced analysis
        useRag: true,
        // Pass any additional metadata from the state
        routingInfo: state.routing || {},
        // Original request source
        source: 'supervisor_delegation'
      };

      this.logger.log(`Delegating meeting analysis to MeetingAnalysisService for session ${sessionId}`);
      
      // Run the analysis using the dedicated service with RAG enabled
      await this.meetingAnalysisService.runGraphAnalysis(
        sessionId,
        transcript,
        userId,
        metadata,
        true // Enable RAG
      );
      
      // Get the final results after the analysis is complete
      const analysisResult = await this.meetingAnalysisService.getAnalysisResults(sessionId, userId);
      
      this.logger.log(`Meeting analysis completed via delegation for session ${sessionId}`);
      
      // Return a format that can be integrated into the supervisor state
      return {
        ...state,
        result: {
          transcript: analysisResult.transcript,
          topics: analysisResult.topics || [],
          actionItems: analysisResult.actionItems || [],
          sentiment: analysisResult.sentiment || null,
          summary: analysisResult.summary || null,
          errors: analysisResult.errors || [],
          context: analysisResult.context || null,
        },
        resultType: 'meeting_analysis',
      };
    } catch (error) {
      this.logger.error(`Error in meeting analysis delegation: ${error.message}`, error.stack);
      return {
        ...state,
        result: null,
        resultType: 'meeting_analysis',
        errors: [
          ...(state.errors || []),
          {
            step: 'meeting_analysis_delegation',
            error: error.message,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    }
  }
} 