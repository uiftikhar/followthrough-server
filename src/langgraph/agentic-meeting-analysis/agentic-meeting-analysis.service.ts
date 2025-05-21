import { Injectable, Logger } from '@nestjs/common';
import { RagMeetingAnalysisAgent } from './agents/enhanced/rag-meeting-agent';
import { RagTopicExtractionAgent } from './agents/enhanced/rag-topic-extraction-agent';
import { AgentExpertise } from './interfaces/agent.interface';
import {
  Topic,
  MeetingTranscript,
  RetrievedContext,
} from './interfaces/state.interface';

/**
 * Service for RAG-enhanced meeting analysis
 * using contextual information from previous meetings
 */
@Injectable()
export class AgenticMeetingAnalysisService {
  private readonly logger = new Logger(AgenticMeetingAnalysisService.name);

  constructor(
    private readonly ragMeetingAnalysisAgent: RagMeetingAnalysisAgent,
    private readonly ragTopicExtractionAgent: RagTopicExtractionAgent,
  ) {}

  /**
   * Extract topics from a meeting transcript with RAG enhancement
   */
  async extractTopics(
    transcript: string,
    options?: {
      meetingId?: string;
      participantNames?: string[];
      retrievalOptions?: {
        includeHistoricalTopics?: boolean;
        topK?: number;
        minScore?: number;
      };
    },
  ): Promise<Topic[]> {
    try {
      this.logger.log(
        `Extracting topics with RAG for meeting: ${options?.meetingId || 'unknown'}`,
      );

      const topics = await this.ragTopicExtractionAgent.extractTopics(
        transcript,
        options,
      );

      return topics;
    } catch (error) {
      this.logger.error(`Error extracting topics with RAG: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze a meeting transcript with a specified expertise
   */
  async analyzeTranscript<T = any>(
    transcript: string,
    expertise: AgentExpertise,
    options?: {
      meetingId?: string;
      participantNames?: string[];
      retrievalOptions?: {
        topK?: number;
        minScore?: number;
        indexName?: string;
        namespace?: string;
      };
    },
  ): Promise<T> {
    try {
      this.logger.log(
        `Analyzing transcript with RAG using expertise: ${expertise}`,
      );

      const result = await this.ragMeetingAnalysisAgent.analyzeTranscript(
        transcript,
        {
          meetingId: options?.meetingId,
          participantNames: options?.participantNames,
          expertise,
          retrievalOptions: options?.retrievalOptions,
        },
      );

      return result as T;
    } catch (error) {
      this.logger.error(
        `Error analyzing transcript with RAG (${expertise}): ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Process a meeting transcript for automatic topic extraction and analysis
   */
  async processMeetingTranscript(
    transcript: string | MeetingTranscript,
    options?: {
      meetingId?: string;
      analyzeTopics?: boolean;
      analyzeActionItems?: boolean;
      analyzeSentiment?: boolean;
      analyzeSummary?: boolean;
    },
  ): Promise<{
    meetingId: string;
    topics?: Topic[];
    retrievedContext?: RetrievedContext;
    [key: string]: any;
  }> {
    const meetingId = options?.meetingId || `meeting-${Date.now()}`;

    // Convert MeetingTranscript to string if needed
    const transcriptText =
      typeof transcript === 'string'
        ? transcript
        : this.formatTranscript(transcript);

    const result: any = {
      meetingId,
    };

    // Extract topics if requested (or by default)
    if (options?.analyzeTopics !== false) {
      result.topics = await this.extractTopics(transcriptText, { meetingId });
    }

    // Extract action items if requested
    if (options?.analyzeActionItems) {
      result.actionItems = await this.analyzeTranscript(
        transcriptText,
        AgentExpertise.ACTION_ITEM_EXTRACTION,
        { meetingId },
      );
    }

    // Analyze sentiment if requested
    if (options?.analyzeSentiment) {
      result.sentiment = await this.analyzeTranscript(
        transcriptText,
        AgentExpertise.SENTIMENT_ANALYSIS,
        { meetingId },
      );
    }

    // Generate summary if requested
    if (options?.analyzeSummary) {
      result.summary = await this.analyzeTranscript(
        transcriptText,
        AgentExpertise.SUMMARY_GENERATION,
        { meetingId },
      );
    }

    return result;
  }

  /**
   * Format a transcript object into a string
   */
  private formatTranscript(transcript: MeetingTranscript): string {
    if (!transcript.segments || !Array.isArray(transcript.segments)) {
      return JSON.stringify(transcript);
    }

    return transcript.segments
      .map((segment) => {
        const speaker = segment.speakerName || `Speaker ${segment.speakerId}`;
        return `${speaker}: ${segment.content}`;
      })
      .join('\n\n');
  }
}
