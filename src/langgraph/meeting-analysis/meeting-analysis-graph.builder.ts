import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { BaseGraphBuilder } from '../core/base-graph-builder';
import { MeetingAnalysisState } from './interfaces/meeting-analysis-state.interface';
import { ChatCompletionMessageParam } from 'openai/resources/chat';

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
  
  constructor(private readonly llmService: LlmService) {
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
   * Topic extraction node
   */
  private async topicExtractionNode(state: MeetingAnalysisState): Promise<MeetingAnalysisState> {
    try {
      this.logger.log(`Extracting topics for meeting ${state.meetingId}`);
      
      const prompt = `
        Please extract the main topics discussed in the following meeting transcript.
        For each topic, provide:
        1. A name (short phrase, 3-7 words)
        2. Subtopics if applicable (array of strings)
        3. Participants involved in this topic (if identifiable)
        
        Return the topics as a JSON array of objects with this structure:
        [
          {
            "name": "Topic name here",
            "subtopics": ["Subtopic 1", "Subtopic 2"],
            "participants": ["Person 1", "Person 2"],
            "relevance": 8
          }
        ]
        
        Transcript:
        ${state.transcript}
      `;
      
      // Using the LlmService with OpenAI's native client
      const openai = this.llmService.getChatModel({ 
        model: 'gpt-4o',
        temperature: 0.7
      });
      
      const response = await openai.invoke([
        { role: 'user', content: prompt }
      ]);
      
      let formattedTopics: Array<{
        name: string;
        subtopics?: string[];
        participants?: string[];
        relevance?: number;
      }> = [];
      
      try {
        // Try to parse JSON from the content
        const content = response.content.toString();
        // Extract the JSON array from the response if it's wrapped in markdown or explanations
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsedTopics = JSON.parse(jsonMatch[0]);
          formattedTopics = parsedTopics.map(topic => ({
            name: topic.name || topic.title || "Untitled Topic",
            subtopics: topic.subtopics || [],
            participants: topic.participants || [],
            relevance: topic.relevance || 5
          }));
        } else {
          // If we couldn't find a proper JSON array, convert simple string topics to structured topics
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
            formattedTopics = parsed.map(topicName => ({
              name: topicName,
              subtopics: [],
              participants: [],
              relevance: 5
            }));
          } else if (parsed.topics && Array.isArray(parsed.topics)) {
            if (typeof parsed.topics[0] === 'string') {
              formattedTopics = parsed.topics.map(topicName => ({
                name: topicName,
                subtopics: [],
                participants: [],
                relevance: 5
              }));
            } else {
              formattedTopics = parsed.topics;
            }
          }
        }
      } catch (err) {
        this.logger.error(`Failed to parse topics: ${err.message}`);
        // Create a fallback by converting any existing topics that might be strings
        if (state.topics && Array.isArray(state.topics)) {
          if (typeof state.topics[0] === 'string') {
            
            formattedTopics = state.topics.map(topic => ({
              name: topic.name || "Untitled Topic",
              subtopics: topic.subtopics || [],
              participants: topic.participants || [],
              relevance: topic.relevance || 5
            }));
          } else {
            formattedTopics = state.topics as any;
          }
        }
      }
      
      return {
        ...state,
        topics: formattedTopics,
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
   * Action item extraction node
   */
  private async actionItemExtractionNode(state: MeetingAnalysisState): Promise<MeetingAnalysisState> {
    try {
      this.logger.log(`Extracting action items for meeting ${state.meetingId}`);
      
      const prompt = `
        Please extract action items from the following meeting transcript.
        For each action item, identify:
        1. A clear description of the task
        2. The person assigned to the task (if mentioned)
        3. Due date or timeframe (if mentioned)
        
        Return the action items as a JSON array with objects containing:
        - description (string)
        - assignee (string, or null if not specified)
        - dueDate (string, or null if not specified)
        - status (string, always "pending")
        
        Transcript:
        ${state.transcript}
      `;
      
      // Using the LlmService with OpenAI's native client
      const openai = this.llmService.getChatModel({ 
        model: 'gpt-4o',
        temperature: 0.7
      });
      
      const response = await openai.invoke([
        { role: 'user', content: prompt }
      ]);
      
      let actionItems = [];
      try {
        // Try to parse JSON from the content
        const content = response.content.toString();
        // Extract JSON object/array from the response
        const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          actionItems = Array.isArray(parsed) ? parsed : parsed.actionItems || [];
        } else {
          this.logger.warn('No valid JSON found in action items response');
          actionItems = [];
        }
      } catch (err) {
        this.logger.error(`Failed to parse action items: ${err.message}`);
        actionItems = [];
      }
      
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
   * Sentiment analysis node
   */
  private async sentimentAnalysisNode(state: MeetingAnalysisState): Promise<MeetingAnalysisState> {
    try {
      this.logger.log(`Analyzing sentiment for meeting ${state.meetingId}`);
      
      const prompt = `
        Please analyze the sentiment of the following meeting transcript.
        Provide an overall sentiment score from -1.0 (very negative) to 1.0 (very positive).
        Also identify up to 3 key segments (quotations) from the transcript that strongly influenced your rating.
        For each segment, provide the text and its individual sentiment score.
        
        Return the results as a JSON object with:
        - overall (number)
        - segments (array of objects with 'text' and 'score' properties)
        
        Transcript:
        ${state.transcript}
      `;
      
      // Using the LlmService with OpenAI's native client
      const openai = this.llmService.getChatModel({ 
        model: 'gpt-4o',
        temperature: 0.7
      });
      
      const response = await openai.invoke([
        { role: 'user', content: prompt }
      ]);
      
      let sentiment = { overall: 0 };
      try {
        // Try to parse JSON from the content
        const content = response.content.toString();
        // Extract JSON object from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          sentiment = parsed.sentiment || parsed;
        } else {
          this.logger.warn('No valid JSON found in sentiment analysis response');
        }
      } catch (err) {
        this.logger.error(`Failed to parse sentiment: ${err.message}`);
      }
      
      return {
        ...state,
        sentiment,
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
   * Summary generation node
   */
  private async summaryGenerationNode(state: MeetingAnalysisState): Promise<MeetingAnalysisState> {
    try {
      this.logger.log(`Generating summary for meeting ${state.meetingId}`);
      
      // Safely extract topic names
      const topicsString = state.topics && state.topics.length > 0
        ? state.topics.map(topic => typeof topic === 'string' ? topic : topic.name).join(', ')
        : 'No topics identified';
      
      const actionItemsString = state.actionItems?.length 
        ? state.actionItems.map(item => 
            `- ${item.description}${item.assignee ? ` (Assigned to: ${item.assignee})` : ''}${item.dueDate ? ` (Due: ${item.dueDate})` : ''}`
          ).join('\n')
        : 'No action items identified';
      
      const prompt = `
        Please generate a comprehensive summary of the following meeting transcript.
        
        Create a response in this JSON format:
        {
          "meetingTitle": "A concise title for the meeting",
          "summary": "A detailed 250-350 word summary of the key discussions and outcomes",
          "decisions": [
            {
              "title": "Short name for decision",
              "content": "Details about the decision made"
            }
          ],
          "next_steps": ["Next step 1", "Next step 2"]
        }
        
        Here are the main topics discussed:
        ${topicsString}
        
        Here are the action items identified:
        ${actionItemsString}
        
        Transcript:
        ${state.transcript}
      `;
      
      // Using the LlmService with OpenAI's native client
      const openai = this.llmService.getChatModel({ 
        model: 'gpt-4o',
        temperature: 0.7
      });
      
      const response = await openai.invoke([
        { role: 'user', content: prompt }
      ]);
      
      let summaryObj = {
        meetingTitle: "Meeting Summary",
        summary: "",
        decisions: [],
        next_steps: []
      };
      
      try {
        // Try to parse JSON from the content
        const content = response.content.toString();
        // Extract JSON object from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          summaryObj = {
            meetingTitle: parsed.meetingTitle || "Meeting Summary",
            summary: parsed.summary || content,
            decisions: parsed.decisions || [],
            next_steps: parsed.next_steps || []
          };
        } else {
          // If no JSON object found, use the entire content as summary
          summaryObj.summary = content;
        }
      } catch (error) {
        this.logger.error(`Failed to parse summary as JSON: ${error.message}`);
        // Use the raw content as the summary if parsing fails
        summaryObj.summary = response.content.toString();
      }
      
      return {
        ...state,
        summary: summaryObj,
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
} 