import { Injectable } from "@nestjs/common";
import { BaseGraphBuilder } from "../core/base-graph-builder";
import { MeetingAnalysisState } from "./interfaces/meeting-analysis-state.interface";
import { MeetingAnalysisAgentFactory } from "./meeting-analysis-agent.factory";

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
    TOPIC_EXTRACTION: "topic_extraction",
    ACTION_ITEM_EXTRACTION: "action_item_extraction",
    SENTIMENT_ANALYSIS: "sentiment_analysis",
    SUMMARY_GENERATION: "summary_generation",
  };

  constructor(
    private readonly meetingAnalysisAgentFactory: MeetingAnalysisAgentFactory,
  ) {
    super();
  }

  /**
   * Build nodes for the meeting analysis graph
   */
  protected buildNodes(): Record<string, Function> {
    this.logger.log("Building nodes for meeting analysis graph");

    return {
      [this.nodeNames.START]: this.startNode.bind(this),
      [this.nodeNames.TOPIC_EXTRACTION]: this.topicExtractionNode.bind(this),
      [this.nodeNames.ACTION_ITEM_EXTRACTION]:
        this.actionItemExtractionNode.bind(this),
      [this.nodeNames.SENTIMENT_ANALYSIS]:
        this.sentimentAnalysisNode.bind(this),
      [this.nodeNames.SUMMARY_GENERATION]:
        this.summaryGenerationNode.bind(this),
      [this.nodeNames.END]: this.endNode.bind(this),
    };
  }

  /**
   * Define edges between nodes
   */
  protected defineEdges(graph: any): void {
    this.logger.log("Defining edges for meeting analysis graph");

    // Sequential flow from START to END
    graph.addEdge(this.nodeNames.START, this.nodeNames.TOPIC_EXTRACTION);
    graph.addEdge(
      this.nodeNames.TOPIC_EXTRACTION,
      this.nodeNames.ACTION_ITEM_EXTRACTION,
    );
    graph.addEdge(
      this.nodeNames.ACTION_ITEM_EXTRACTION,
      this.nodeNames.SENTIMENT_ANALYSIS,
    );
    graph.addEdge(
      this.nodeNames.SENTIMENT_ANALYSIS,
      this.nodeNames.SUMMARY_GENERATION,
    );
    graph.addEdge(this.nodeNames.SUMMARY_GENERATION, this.nodeNames.END);
  }

  /**
   * Start node - initialize state
   */
  private async startNode(
    state: MeetingAnalysisState,
  ): Promise<MeetingAnalysisState> {
    this.logger.log(`Starting meeting analysis for meeting ${state.meetingId}`);
    return {
      ...state,
      stage: "initialization",
    };
  }

  /**
   * Topic extraction node using RAG topic extraction agent
   */
  private async topicExtractionNode(
    state: MeetingAnalysisState,
  ): Promise<MeetingAnalysisState> {
    try {
      this.logger.log(
        `********* RAG TOPIC **********: Extracting topics for meeting ${state.meetingId}`,
      );

      // FIXED: Check transcript existence and format
      let transcript = state.transcript;
      if (!transcript || (typeof transcript === 'string' && transcript.trim().length === 0)) {
        this.logger.warn(
          `No transcript found in state for meeting ${state.meetingId}`,
        );
        return {
          ...state,
          topics: [{
            name: "No Content Available", 
            relevance: 1,
          }],
          stage: "topic_extraction",
          error: {
            message: "No transcript available for topic extraction",
            stage: "topic_extraction", 
            timestamp: new Date().toISOString(),
          },
        };
      }

      // FIXED: Ensure transcript is string format
      if (typeof transcript !== 'string') {
        this.logger.log(`Converting transcript object to string format for topic extraction`);
        if (transcript && typeof transcript === 'object' && 'content' in transcript) {
          transcript = (transcript as any).content;
        } else if (transcript && typeof transcript === 'object' && 'text' in transcript) {
          transcript = (transcript as any).text;
        } else {
          transcript = JSON.stringify(transcript);
        }
      }

      this.logger.log(
        `Processing transcript of length: ${transcript.length} characters for topic extraction`,
      );

      const ragTopicExtractionAgent = this.meetingAnalysisAgentFactory.getRagTopicExtractionAgent();
      if (!ragTopicExtractionAgent) {
        this.logger.warn(
          " ----------------------: RAG topic extraction agent not available, using fallback",
        );
        return {
          ...state,
          topics: [
            {
              name: "General Discussion",
              relevance: 3,
            },
          ],
          stage: "topic_extraction",
        };
      }

      // FIXED: Validate transcript content before processing
      if (transcript.trim().length < 10) {
        this.logger.warn(
          `Transcript too short (${transcript.length} chars) for meaningful topic extraction`,
        );
        return {
          ...state,
          topics: [{
            name: "Brief Discussion",
            relevance: 2,
          }],
          stage: "topic_extraction",
        };
      }

      // Use the RAG topic extraction agent with validated transcript
      const topics = await ragTopicExtractionAgent.extractTopics(
        transcript,
        {
          meetingId: state.meetingId,
          participantNames: this.extractParticipantNames(transcript),
          retrievalOptions: {
            includeHistoricalTopics: true,
            topK: 5,
            minScore: 0.7,
          },
        },
      );

      this.logger.log(`Extracted ${topics.length} topics using RAG agent`);

      // FIXED: Ensure we always have at least one topic
      if (!topics || topics.length === 0) {
        this.logger.warn("No topics extracted, creating fallback topic");
        return {
          ...state,
          topics: [{
            name: "Meeting Discussion", 
            relevance: 2,
          }],
          stage: "topic_extraction",
        };
      }

      return {
        ...state,
        topics,
        stage: "topic_extraction",
      };
    } catch (error) {
      this.logger.error(
        `Error in topic extraction: ${error.message}`,
        error.stack,
      );
      return {
        ...state,
        topics: [{
          name: "Error in Topic Extraction",
          relevance: 1,
        }],
        error: {
          message: error.message,
          stage: "topic_extraction",
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Action item extraction node using ActionItemAgent
   */
  private async actionItemExtractionNode(
    state: MeetingAnalysisState,
  ): Promise<MeetingAnalysisState> {
    try {
      this.logger.log(
        `Extracting action items for meeting ${state.meetingId}`,
      );

      // FIXED: Check transcript existence and format
      let transcript = state.transcript;
      if (!transcript || transcript.trim().length === 0) {
        this.logger.warn(
          `No transcript found in state for meeting ${state.meetingId}`,
        );
        return {
          ...state,
          actionItems: [],
          stage: "action_item_extraction",
          error: {
            message: "No transcript available for action item extraction",
            stage: "action_item_extraction", 
            timestamp: new Date().toISOString(),
          },
        };
      }

      // FIXED: Ensure transcript is string format for ActionItemAgent
      if (typeof transcript !== 'string') {
        this.logger.log(`Converting transcript object to string format`);
        if (transcript && typeof transcript === 'object' && 'content' in transcript) {
          transcript = (transcript as any).content;
        } else if (transcript && typeof transcript === 'object' && 'text' in transcript) {
          transcript = (transcript as any).text;
        } else {
          transcript = JSON.stringify(transcript);
        }
      }

      this.logger.log(
        `Processing transcript of length: ${transcript.length} characters`,
      );

      const actionItemAgent = this.meetingAnalysisAgentFactory.getActionItemAgent();
      if (!actionItemAgent) {
        this.logger.warn(
          "ActionItemAgent not available, using fallback",
        );
        return {
          ...state,
          actionItems: [],
          stage: "action_item_extraction",
        };
      }

      // FIXED: Use proper ActionItemAgent interface with structured input
      const actionItemResult = await actionItemAgent.processState({
        transcript,
        meetingId: state.meetingId,
        // Pass additional context if available
        participants: this.extractParticipantNames(transcript),
        topics: state.topics?.map(t => t.name) || [],
      });

      // FIXED: Extract action items from result with validation
      let actionItems: any[] = [];
      if (actionItemResult && actionItemResult.actionItems) {
        actionItems = Array.isArray(actionItemResult.actionItems) 
          ? actionItemResult.actionItems 
          : [];
      } else if (Array.isArray(actionItemResult)) {
        actionItems = actionItemResult;
      }

      // FIXED: Validate and clean action items
      const validatedActionItems = actionItems
        .filter((item: any) => item && typeof item === 'object' && item.description)
        .map((item: any) => ({
          description: item.description || 'Unknown action item',
          assignee: item.assignee || undefined,
          dueDate: item.dueDate || undefined,
          status: item.status || 'pending',
          priority: item.priority || 'medium',
        }));

      this.logger.log(
        `Extracted ${validatedActionItems.length} action items using ActionItemAgent`,
      );

      return {
        ...state,
        actionItems: validatedActionItems,
        stage: "action_item_extraction",
      };
    } catch (error) {
      this.logger.error(
        `Error in action item extraction: ${error.message}`,
        error.stack,
      );
      return {
        ...state,
        actionItems: [],
        stage: "action_item_extraction",
        error: {
          message: error.message,
          stage: "action_item_extraction",
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Sentiment analysis node using RAG-enhanced or regular SentimentAnalysisAgent
   */
  private async sentimentAnalysisNode(
    state: MeetingAnalysisState,
  ): Promise<MeetingAnalysisState> {
    try {
      this.logger.log(`Analyzing sentiment for meeting ${state.meetingId}`);
      const ragSentimentAnalysisAgent = this.meetingAnalysisAgentFactory.getRagSentimentAnalysisAgent();
      const sentimentAnalysisAgent = this.meetingAnalysisAgentFactory.getSentimentAnalysisAgent();
      
      this.logger.log(
        `Available agents: RAG=${!!ragSentimentAnalysisAgent}, Regular=${!!sentimentAnalysisAgent}`,
      );

      // FIXED: Check transcript existence and format for sentiment analysis
      let transcript = state.transcript;
      if (!transcript || (typeof transcript === 'string' && transcript.trim().length === 0)) {
        this.logger.warn(
          `No transcript found in state for sentiment analysis of meeting ${state.meetingId}`,
        );
        return {
          ...state,
          sentiment: {
            overall: 0,
            segments: [],
          },
          stage: "sentiment_analysis",
          error: {
            message: "No transcript available for sentiment analysis",
            stage: "sentiment_analysis", 
            timestamp: new Date().toISOString(),
          },
        };
      }

      // FIXED: Ensure transcript is string format for sentiment analysis
      if (typeof transcript !== 'string') {
        this.logger.log(`Converting transcript object to string format for sentiment analysis`);
        if (transcript && typeof transcript === 'object' && 'content' in transcript) {
          transcript = (transcript as any).content;
        } else if (transcript && typeof transcript === 'object' && 'text' in transcript) {
          transcript = (transcript as any).text;
        } else {
          transcript = JSON.stringify(transcript);
        }
      }

      this.logger.log(
        `Processing transcript of length: ${transcript.length} characters for sentiment analysis`,
      );

      // Prefer RAG-enhanced agent if available
      if (ragSentimentAnalysisAgent) {
        this.logger.log("Using RAG-enhanced sentiment analysis agent");

        const sentiment = await ragSentimentAnalysisAgent.analyzeSentiment(
          transcript,
          {
            meetingId: state.meetingId,
            participantNames: this.extractParticipantNames(transcript),
          },
        );

        this.logger.log(
          `RAG sentiment result: overall=${sentiment.overall}, score=${sentiment.score}, segments=${sentiment.segments?.length}`,
        );

        const mappedSentiment = {
          overall: sentiment.score, // Convert to number format expected by state
          segments: sentiment.segments?.map((seg) => ({
            text: seg.text,
            score: seg.score,
          })),
        };

        this.logger.log(
          `Mapped sentiment for state: overall=${mappedSentiment.overall}, segments=${mappedSentiment.segments?.length}`,
        );

        return {
          ...state,
          sentiment: mappedSentiment,
          stage: "sentiment_analysis",
        };
      }

      // Fallback to regular sentiment agent
      // const sentimentAnalysisAgent = this.meetingAnalysisAgentFactory.getSentimentAnalysisAgent();
      if (!sentimentAnalysisAgent) {
        this.logger.warn(
          "No sentiment analysis agent available, using fallback",
        );
        return {
          ...state,
          sentiment: {
            overall: 0,
            segments: undefined,
          },
          stage: "sentiment_analysis",
        };
      }

      this.logger.log("Using regular sentiment analysis agent");

      // Use the SentimentAnalysisAgent to analyze sentiment with validated transcript
      const result = await sentimentAnalysisAgent.processState({
        transcript: transcript,
        meetingId: state.meetingId,
      });

      this.logger.log(
        `Regular sentiment agent result: ${JSON.stringify(result.sentiment).substring(0, 200)}...`,
      );

      // Extract sentiment from the result
      const sentiment = result.sentiment || { overall: 0 };

      // Format and validate sentiment analysis
      const formattedSentiment = this.formatSentimentAnalysis(sentiment);

      this.logger.log(
        `Formatted sentiment: overall=${formattedSentiment.overall}, segments=${formattedSentiment.segments?.length}`,
      );

      return {
        ...state,
        sentiment: formattedSentiment,
        stage: "sentiment_analysis",
      };
    } catch (error) {
      this.logger.error(
        `Error in sentiment analysis: ${error.message}`,
        error.stack,
      );
      return {
        ...state,
        error: {
          message: error.message,
          stage: "sentiment_analysis",
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Summary generation node using RAG meeting analysis agent
   */
  private async summaryGenerationNode(
    state: MeetingAnalysisState,
  ): Promise<MeetingAnalysisState> {
    try {
      this.logger.log(`Generating summary for meeting ${state.meetingId}`);

      const ragMeetingAnalysisAgent = this.meetingAnalysisAgentFactory.getRagMeetingAnalysisAgent();
      if (!ragMeetingAnalysisAgent) {
        this.logger.warn(
          "RAG meeting analysis agent not available, using fallback",
        );
        return {
          ...state,
          summary: {
            meetingTitle: "Meeting Summary",
            summary:
              "Summary will be available when RAG agents are properly configured",
            decisions: [],
          },
          stage: "completed",
        };
      }

      // Enrich the transcript with extracted topics and action items for better context
      const topicsString =
        state.topics && state.topics.length > 0
          ? `Topics discussed: ${state.topics.map((t) => t.name).join(", ")}`
          : "No topics identified";

      const actionItemsString = state.actionItems?.length
        ? `Action Items: ${state.actionItems
            .map(
              (item) =>
                `${item.description}${item.assignee ? ` (Assigned to: ${item.assignee})` : ""}`,
            )
            .join("; ")}`
        : "No action items identified";

      const enrichedTranscript = `
${topicsString}
${actionItemsString}

Transcript:
${state.transcript}
      `;

      // Use the RAG meeting analysis agent with SUMMARY_GENERATION expertise
      const summaryResult =
        await ragMeetingAnalysisAgent.generateMeetingSummary(
          enrichedTranscript,
          {
            meetingId: state.meetingId,
            participantNames: this.extractParticipantNames(state.transcript),
          },
        );

      // Format and validate summary
      const formattedSummary = this.formatSummary(summaryResult);

      this.logger.log(`Generated summary using RAG agent`);

      return {
        ...state,
        summary: formattedSummary,
        stage: "completed",
      };
    } catch (error) {
      this.logger.error(
        `Error in summary generation: ${error.message}`,
        error.stack,
      );
      return {
        ...state,
        error: {
          message: error.message,
          stage: "summary_generation",
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * End node - finalize state
   */
  private async endNode(
    state: MeetingAnalysisState,
  ): Promise<MeetingAnalysisState> {
    this.logger.log(
      `Completed meeting analysis for meeting ${state.meetingId}`,
    );
    return {
      ...state,
      stage: "completed",
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
    if (typeof sentiment === "string") {
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
    if (result.sentiment && typeof result.sentiment === "object") {
      result = result.sentiment;
    }

    // Format and validate
    return {
      overall: typeof result.overall === "number" ? result.overall : 0,
      segments: Array.isArray(result.segments)
        ? result.segments.map((segment) => ({
            text: segment.text || "",
            score: typeof segment.score === "number" ? segment.score : 0,
          }))
        : undefined,
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
    if (!summary)
      return {
        meetingTitle: "Meeting Summary",
        summary: "",
        decisions: [],
      };

    // Parse JSON if it's a string
    let result = summary;
    if (typeof summary === "string") {
      try {
        const jsonMatch = summary.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          return {
            meetingTitle: "Meeting Summary",
            summary: summary,
            decisions: [],
          };
        }
      } catch (err) {
        this.logger.error(`Failed to parse summary: ${err.message}`);
        return {
          meetingTitle: "Meeting Summary",
          summary: summary,
          decisions: [],
        };
      }
    }

    // Format and validate
    return {
      meetingTitle: result.meetingTitle || result.title || "Meeting Summary",
      summary: result.summary || "",
      decisions: Array.isArray(result.decisions)
        ? result.decisions.map((decision) => ({
            title: decision.title || "",
            content: decision.content || decision.description || "",
          }))
        : [],
      next_steps: Array.isArray(result.next_steps)
        ? result.next_steps
        : undefined,
    };
  }
}
