import { Injectable, Optional } from '@nestjs/common';
import { BaseGraphBuilder } from '../core/base-graph-builder';
import { MeetingAnalysisState } from './interfaces/meeting-analysis-state.interface';
import { RagMeetingAnalysisAgent } from '../agents/rag-agents/rag-meeting-agent';
import { RagTopicExtractionAgent } from '../agents/rag-agents/rag-topic-extraction-agent';
import { RagSentimentAnalysisAgent } from '../agents/rag-agents/rag-sentiment-analysis-agent';
import { SentimentAnalysisAgent } from '../agents/sentiment-analysis.agent';
import { ActionItemAgent } from '../agents/action-item.agent';


/**
 * Graph builder for meeting analysis
 */
@Injectable()
export class MeetingAnalysisGraphBuilder extends BaseGraphBuilder<MeetingAnalysisState> {
  /**
   * Node names for the meeting analysis graph
   */
  private readonly nodeNames = {
    ...this.baseNodeNames,
    TOPIC_EXTRACTION: 'topic_extraction',
    ACTION_ITEM_EXTRACTION: 'action_item_extraction',
    SENTIMENT_ANALYSIS: 'sentiment_analysis',
    SUMMARY_GENERATION: 'summary_generation',
  };
  
  constructor(
    @Optional() private readonly ragMeetingAnalysisAgent?: RagMeetingAnalysisAgent,
    @Optional() private readonly ragTopicExtractionAgent?: RagTopicExtractionAgent,
    @Optional() private readonly ragSentimentAnalysisAgent?: RagSentimentAnalysisAgent,
    @Optional() private readonly sentimentAnalysisAgent?: SentimentAnalysisAgent,
    @Optional() private readonly actionItemAgent?: ActionItemAgent
  ) {
    super();
  }
  
  /**
   * Build nodes for the meeting analysis graph
   */
  protected buildNodes(): Record<string, Function> {
    this.logger.log('Building nodes for meeting analysis graph');
    
    return {
      [this.nodeNames.START]: this.startNode.bind(this),
      [this.nodeNames.TOPIC_EXTRACTION]: this.topicExtractionNode.bind(this),
      [this.nodeNames.ACTION_ITEM_EXTRACTION]: this.actionItemExtractionNode.bind(this),
      [this.nodeNames.SENTIMENT_ANALYSIS]: this.sentimentAnalysisNode.bind(this),
      [this.nodeNames.SUMMARY_GENERATION]: this.summaryGenerationNode.bind(this),
      [this.nodeNames.END]: this.endNode.bind(this),
    };
  }
  
  /**
   * Define edges between nodes
   */
  protected defineEdges(graph: any): void {
    this.logger.log('Defining edges for meeting analysis graph');
    
    // Sequential flow from START to END
    graph.addEdge(this.nodeNames.START, this.nodeNames.TOPIC_EXTRACTION);
    graph.addEdge(this.nodeNames.TOPIC_EXTRACTION, this.nodeNames.ACTION_ITEM_EXTRACTION);
    graph.addEdge(this.nodeNames.ACTION_ITEM_EXTRACTION, this.nodeNames.SENTIMENT_ANALYSIS);
    graph.addEdge(this.nodeNames.SENTIMENT_ANALYSIS, this.nodeNames.SUMMARY_GENERATION);
    graph.addEdge(this.nodeNames.SUMMARY_GENERATION, this.nodeNames.END);
  }
  
  /**
   * Start node - initialize state
   */
  private async startNode(state: MeetingAnalysisState): Promise<MeetingAnalysisState> {
    this.logger.log(`Starting meeting analysis for meeting ${state.meetingId}`);
    return {
      ...state,
      stage: 'initialization',
    };
  }
  
  /**
   * Topic extraction node using RAG topic extraction agent
   */
  private async topicExtractionNode(state: MeetingAnalysisState): Promise<MeetingAnalysisState> {
    try {
      this.logger.log(`********* RAG TOPIC **********: Extracting topics for meeting ${state.meetingId}`);
      
      if (!this.ragTopicExtractionAgent) {
        this.logger.warn(' ----------------------: RAG topic extraction agent not available, using fallback');
        return {
          ...state,
          topics: [{
            name: 'General Discussion',
            relevance: 3
          }],
          stage: 'topic_extraction',
        };
      }
      
      // Use the RAG topic extraction agent
      const topics = await this.ragTopicExtractionAgent.extractTopics(
        state.transcript,
        {
          meetingId: state.meetingId,
          participantNames: this.extractParticipantNames(state.transcript),
          retrievalOptions: {
            includeHistoricalTopics: true,
            topK: 5,
            minScore: 0.7
          }
        }
      );
      
      this.logger.log(`Extracted ${topics.length} topics using RAG agent`);
      
      return {
        ...state,
        topics,
        stage: 'topic_extraction',
      };
    } catch (error) {
      this.logger.error(`Error in topic extraction: ${error.message}`, error.stack);
      return {
        ...state,
        error: {
          message: error.message,
          stage: 'topic_extraction',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
  
  /**
   * Action item extraction node using ActionItemAgent
   */
  private async actionItemExtractionNode(state: MeetingAnalysisState): Promise<MeetingAnalysisState> {
    try {
      this.logger.log(`Extracting action items for meeting ${state.meetingId}`);
      
      if (!this.actionItemAgent) {
        this.logger.warn('Action item agent not available, using fallback');
        return {
          ...state,
          actionItems: [{
            description: 'Action items will be available when action item agent is properly configured',
            status: 'pending'
          }],
          stage: 'action_item_extraction',
        };
      }
      
      // Use the ActionItemAgent to extract action items
      const result = await this.actionItemAgent.processState({
        transcript: state.transcript,
        meetingId: state.meetingId,
        participantNames: this.extractParticipantNames(state.transcript)
      });
      
      // Extract action items from the result
      const actionItems = result.actionItems || [];
      
      this.logger.log(`Extracted ${actionItems.length} action items using ActionItemAgent`);
      
      return {
        ...state,
        actionItems,
        stage: 'action_item_extraction',
      };
    } catch (error) {
      this.logger.error(`Error in action item extraction: ${error.message}`, error.stack);
      return {
        ...state,
        error: {
          message: error.message,
          stage: 'action_item_extraction',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
  
  /**
   * Sentiment analysis node using RAG-enhanced or regular SentimentAnalysisAgent
   */
  private async sentimentAnalysisNode(state: MeetingAnalysisState): Promise<MeetingAnalysisState> {
    try {
      this.logger.log(`Analyzing sentiment for meeting ${state.meetingId}`);
      this.logger.log(`Available agents: RAG=${!!this.ragSentimentAnalysisAgent}, Regular=${!!this.sentimentAnalysisAgent}`);
      
      // Prefer RAG-enhanced agent if available
      if (this.ragSentimentAnalysisAgent) {
        this.logger.log('Using RAG-enhanced sentiment analysis agent');
        
        const sentiment = await this.ragSentimentAnalysisAgent.analyzeSentiment(
          state.transcript,
          {
            meetingId: state.meetingId,
            participantNames: this.extractParticipantNames(state.transcript),
          }
        );
        
        this.logger.log(`RAG sentiment result: overall=${sentiment.overall}, score=${sentiment.score}, segments=${sentiment.segments?.length}`);
        
        const mappedSentiment = {
          overall: sentiment.score, // Convert to number format expected by state
          segments: sentiment.segments?.map(seg => ({
            text: seg.text,
            score: seg.score
          }))
        };
        
        this.logger.log(`Mapped sentiment for state: overall=${mappedSentiment.overall}, segments=${mappedSentiment.segments?.length}`);
        
        return {
          ...state,
          sentiment: mappedSentiment,
          stage: 'sentiment_analysis',
        };
      }
      
      // Fallback to regular sentiment agent
      if (!this.sentimentAnalysisAgent) {
        this.logger.warn('No sentiment analysis agent available, using fallback');
        return {
          ...state,
          sentiment: {
            overall: 0,
            segments: undefined
          },
          stage: 'sentiment_analysis',
        };
      }
      
      this.logger.log('Using regular sentiment analysis agent');
      
      // Use the SentimentAnalysisAgent to analyze sentiment
      const result = await this.sentimentAnalysisAgent.processState({
        transcript: state.transcript,
        meetingId: state.meetingId,
      });
      
      this.logger.log(`Regular sentiment agent result: ${JSON.stringify(result.sentiment).substring(0, 200)}...`);
      
      // Extract sentiment from the result
      const sentiment = result.sentiment || { overall: 0 };
      
      // Format and validate sentiment analysis
      const formattedSentiment = this.formatSentimentAnalysis(sentiment);
      
      this.logger.log(`Formatted sentiment: overall=${formattedSentiment.overall}, segments=${formattedSentiment.segments?.length}`);
      
      return {
        ...state,
        sentiment: formattedSentiment,
        stage: 'sentiment_analysis',
      };
    } catch (error) {
      this.logger.error(`Error in sentiment analysis: ${error.message}`, error.stack);
      return {
        ...state,
        error: {
          message: error.message,
          stage: 'sentiment_analysis',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
  
  /**
   * Summary generation node using RAG meeting analysis agent
   */
  private async summaryGenerationNode(state: MeetingAnalysisState): Promise<MeetingAnalysisState> {
    try {
      this.logger.log(`Generating summary for meeting ${state.meetingId}`);
      
      if (!this.ragMeetingAnalysisAgent) {
        this.logger.warn('RAG meeting analysis agent not available, using fallback');
        return {
          ...state,
          summary: {
            meetingTitle: 'Meeting Summary',
            summary: 'Summary will be available when RAG agents are properly configured',
            decisions: []
          },
          stage: 'completed',
        };
      }
      
      // Enrich the transcript with extracted topics and action items for better context
      const topicsString = state.topics && state.topics.length > 0
        ? `Topics discussed: ${state.topics.map(t => t.name).join(', ')}`
        : 'No topics identified';
        
      const actionItemsString = state.actionItems?.length 
        ? `Action Items: ${state.actionItems.map(item => 
            `${item.description}${item.assignee ? ` (Assigned to: ${item.assignee})` : ''}`
          ).join('; ')}`
        : 'No action items identified';
        
      const enrichedTranscript = `
${topicsString}
${actionItemsString}

Transcript:
${state.transcript}
      `;
      
      // Use the RAG meeting analysis agent with SUMMARY_GENERATION expertise
      const summaryResult = await this.ragMeetingAnalysisAgent.generateMeetingSummary(
        enrichedTranscript,
        {
          meetingId: state.meetingId,
          participantNames: this.extractParticipantNames(state.transcript),
        }
      );
      
      // Format and validate summary
      const formattedSummary = this.formatSummary(summaryResult);
      
      this.logger.log(`Generated summary using RAG agent`);
      
      return {
        ...state,
        summary: formattedSummary,
        stage: 'completed',
      };
    } catch (error) {
      this.logger.error(`Error in summary generation: ${error.message}`, error.stack);
      return {
        ...state,
        error: {
          message: error.message,
          stage: 'summary_generation',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
  
  /**
   * End node - finalize state
   */
  private async endNode(state: MeetingAnalysisState): Promise<MeetingAnalysisState> {
    this.logger.log(`Completed meeting analysis for meeting ${state.meetingId}`);
    return {
      ...state,
      stage: 'completed',
    };
  }
  
  /**
   * Helper method to extract participant names from transcript
   */
  private extractParticipantNames(transcript: string): string[] {
    // Simple regex to extract speaker names from transcript
    const speakerPattern = /^([A-Za-z\s]+):/gm;
    const speakers = new Set<string>();
    
    let match;
    while ((match = speakerPattern.exec(transcript)) !== null) {
      const speakerName = match[1].trim();
      if (speakerName && !speakers.has(speakerName)) {
        speakers.add(speakerName);
      }
    }
    
    return Array.from(speakers);
  }
  
  /**
   * Format and validate sentiment analysis
   */
  private formatSentimentAnalysis(sentiment: any): {
    overall: number;
    segments?: Array<{
      text: string;
      score: number;
    }>;
  } {
    if (!sentiment) return { overall: 0 };
    
    // Parse JSON if it's a string
    let result = sentiment;
    if (typeof sentiment === 'string') {
      try {
        const jsonMatch = sentiment.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          return { overall: 0 };
        }
      } catch (err) {
        this.logger.error(`Failed to parse sentiment: ${err.message}`);
        return { overall: 0 };
      }
    }
    
    // If sentiment is nested under a property, extract it
    if (result.sentiment && typeof result.sentiment === 'object') {
      result = result.sentiment;
    }
    
    // Format and validate
    return {
      overall: typeof result.overall === 'number' ? result.overall : 0,
      segments: Array.isArray(result.segments) ? 
        result.segments.map(segment => ({
          text: segment.text || '',
          score: typeof segment.score === 'number' ? segment.score : 0
        })) : 
        undefined
    };
  }
  
  /**
   * Format and validate summary
   */
  private formatSummary(summary: any): {
    meetingTitle: string;
    summary: string;
    decisions: Array<{
      title: string;
      content: string;
    }>;
    next_steps?: string[];
  } {
    if (!summary) return { 
      meetingTitle: "Meeting Summary", 
      summary: "", 
      decisions: [] 
    };
    
    // Parse JSON if it's a string
    let result = summary;
    if (typeof summary === 'string') {
      try {
        const jsonMatch = summary.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          return { 
            meetingTitle: "Meeting Summary", 
            summary: summary, 
            decisions: [] 
          };
        }
      } catch (err) {
        this.logger.error(`Failed to parse summary: ${err.message}`);
        return { 
          meetingTitle: "Meeting Summary", 
          summary: summary, 
          decisions: [] 
        };
      }
    }
    
    // Format and validate
    return {
      meetingTitle: result.meetingTitle || result.title || "Meeting Summary",
      summary: result.summary || "",
      decisions: Array.isArray(result.decisions) ? 
        result.decisions.map(decision => ({
          title: decision.title || "",
          content: decision.content || decision.description || ""
        })) : 
        [],
      next_steps: Array.isArray(result.next_steps) ? result.next_steps : undefined
    };
  }
} 