import { Injectable, Inject, Logger } from '@nestjs/common';
import { BaseAgent } from '../../langgraph/agents/base-agent';
import { LlmService } from '../../langgraph/llm/llm.service';
import { RagService } from '../../rag/rag.service';

import { 
  MeetingContext, 
  MeetingContextOptions, 
  ParticipantHistory, 
  PreviousMeetingContext, 
  TopicPrediction 
} from '../interfaces/meeting-context.interface';
import { CalendarEvent } from '../interfaces/calendar-event.interface';
import { RAG_SERVICE } from '../../rag/constants/injection-tokens';

@Injectable()
export class MeetingContextAgent extends BaseAgent {
  readonly logger = new Logger(MeetingContextAgent.name);

  constructor(
    llmService: LlmService,
    @Inject(RAG_SERVICE) private readonly ragService: RagService,
  ) {
    super(llmService, {
      name: 'MeetingContextAgent',
      systemPrompt: `You are a specialized meeting context analysis agent. Your role is to:

1. Analyze upcoming meetings and gather relevant context
2. Examine participant histories and interaction patterns
3. Identify relevant previous meetings and outcomes
4. Predict likely discussion topics based on patterns
5. Generate actionable preparation recommendations

You have access to:
- Historical meeting data and outcomes
- Participant interaction patterns
- Previous meeting summaries and action items
- Calendar scheduling patterns
- Topic and decision history

Always provide comprehensive, actionable insights that help participants prepare effectively for meetings.

Respond with valid JSON following the specified interface structures.`,
      llmOptions: {
        temperature: 0.3,
        model: 'gpt-4o',
        maxTokens: 4000
      }
    });
  }

  /**
   * Gather comprehensive context for an upcoming meeting
   */
  async gatherMeetingContext(
    upcomingMeeting: CalendarEvent,
    options: MeetingContextOptions = {}
  ): Promise<MeetingContext> {
    this.logger.log(`Gathering context for meeting: ${upcomingMeeting.title}`);

    const defaultOptions: Required<MeetingContextOptions> = {
      lookbackDays: 90,
      maxPreviousMeetings: 10,
      minRelevanceScore: 0.3,
      includeParticipantHistory: true,
      includeTopicPredictions: true,
      includeRecommendations: true,
      useRAG: true
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      // Step 1: Gather participant histories
      const participantHistories = finalOptions.includeParticipantHistory 
        ? await this.gatherParticipantHistories(upcomingMeeting.attendees, finalOptions)
        : [];

      // Step 2: Retrieve relevant previous meetings
      const previousMeetingContext = await this.retrievePreviousMeetingContext(
        upcomingMeeting,
        finalOptions
      );

      // Step 3: Generate topic predictions
      const topicPredictions = finalOptions.includeTopicPredictions
        ? await this.generateTopicPredictions(upcomingMeeting, previousMeetingContext, participantHistories)
        : [];

      // Step 4: Create context summary
      const contextSummary = this.createContextSummary(
        previousMeetingContext,
        participantHistories,
        upcomingMeeting
      );

      // Step 5: Generate recommendations
      const recommendations = finalOptions.includeRecommendations
        ? await this.generateMeetingRecommendations(
            upcomingMeeting,
            previousMeetingContext,
            participantHistories,
            topicPredictions
          )
        : [];

      const meetingContext: MeetingContext = {
        meetingId: upcomingMeeting.id,
        upcomingMeeting: {
          id: upcomingMeeting.id,
          title: upcomingMeeting.title,
          startTime: upcomingMeeting.startTime,
          endTime: upcomingMeeting.endTime,
          description: upcomingMeeting.description,
          participants: upcomingMeeting.attendees.map(a => a.email),
          organizer: upcomingMeeting.organizer.email,
          location: upcomingMeeting.location,
          meetingLink: upcomingMeeting.meetingLink
        },
        participantHistories,
        previousMeetingContext,
        topicPredictions,
        contextSummary,
        recommendations,
        retrievalMetadata: {
          retrievedAt: new Date().toISOString(),
          sources: ['calendar_history', 'meeting_summaries', finalOptions.useRAG ? 'rag_enhanced' : 'basic'].filter(Boolean),
          ragEnhanced: finalOptions.useRAG,
          confidence: this.calculateOverallConfidence(previousMeetingContext, participantHistories)
        }
      };

      this.logger.log(`Successfully gathered context for meeting ${upcomingMeeting.id}: ${previousMeetingContext.length} previous meetings, ${participantHistories.length} participants, ${topicPredictions.length} predictions`);
      
      return meetingContext;

    } catch (error) {
      this.logger.error(`Error gathering meeting context: ${error.message}`);
      return this.createMinimalContext(upcomingMeeting, error.message);
    }
  }

  /**
   * Gather historical data and patterns for meeting participants
   */
  private async gatherParticipantHistories(
    attendees: any[],
    options: Required<MeetingContextOptions>
  ): Promise<ParticipantHistory[]> {
    this.logger.log(`Gathering participant histories for ${attendees.length} attendees`);

    const histories: ParticipantHistory[] = [];

    for (const attendee of attendees) {
      try {
        // Retrieve participant's meeting history via RAG
        let participantData: any = {};
        
        if (options.useRAG) {
          const contextQuery = `Meeting history and patterns for participant ${attendee.email}`;
          const retrievedDocs = await this.ragService.getContext(contextQuery, {
            indexName: 'calendar-workflow',
            namespace: 'meeting-history',
            topK: 20,
            minScore: 0.4,
            filter: { participant: attendee.email }
          });
          
          participantData = this.extractParticipantDataFromRAG(retrievedDocs);
        }

        // Generate participant analysis
        const prompt = this.buildParticipantAnalysisPrompt(attendee, participantData);
        const response = await this.processMessage(prompt);
        const analysis = this.parseParticipantAnalysis(response);

        const history: ParticipantHistory = {
          email: attendee.email,
          displayName: attendee.displayName || attendee.email.split('@')[0],
          totalMeetings: participantData.totalMeetings || 0,
          recentMeetings: participantData.recentMeetings || [],
          commonTopics: analysis.commonTopics || [],
          preferredMeetingTimes: analysis.preferredMeetingTimes || [],
          responsePatterns: analysis.responsePatterns || {
            averageResponseTime: 60,
            acceptanceRate: 0.8,
            lastInteraction: new Date().toISOString()
          },
          meetingBehavior: analysis.meetingBehavior || {
            punctuality: 'unknown',
            participation: 'unknown',
            preparedness: 'unknown'
          }
        };

        histories.push(history);

      } catch (error) {
        this.logger.warn(`Error gathering history for ${attendee.email}: ${error.message}`);
        // Create minimal history entry
        histories.push({
          email: attendee.email,
          displayName: attendee.displayName || attendee.email.split('@')[0],
          totalMeetings: 0,
          recentMeetings: [],
          commonTopics: [],
          preferredMeetingTimes: [],
          responsePatterns: {
            averageResponseTime: 60,
            acceptanceRate: 0.8,
            lastInteraction: new Date().toISOString()
          },
          meetingBehavior: {
            punctuality: 'unknown',
            participation: 'unknown',
            preparedness: 'unknown'
          }
        });
      }
    }

    return histories;
  }

  /**
   * Retrieve and analyze relevant previous meetings
   */
  private async retrievePreviousMeetingContext(
    upcomingMeeting: CalendarEvent,
    options: Required<MeetingContextOptions>
  ): Promise<PreviousMeetingContext[]> {
    this.logger.log(`Retrieving previous meeting context for: ${upcomingMeeting.title}`);

    const contexts: PreviousMeetingContext[] = [];

    try {
      if (options.useRAG) {
        // Build context query
        const contextQuery = this.buildMeetingContextQuery(upcomingMeeting);
        
        const retrievedDocs = await this.ragService.getContext(contextQuery, {
          indexName: 'calendar-workflow',
          namespace: 'meetings',
          topK: options.maxPreviousMeetings * 2, // Get more to filter later
          minScore: options.minRelevanceScore,
          filter: {
            participants: { $in: upcomingMeeting.attendees.map(a => a.email) }
          }
        });

        // Process retrieved meetings
        for (const doc of retrievedDocs.slice(0, options.maxPreviousMeetings)) {
          const context = this.extractMeetingContextFromDocument(doc);
          if (context && context.relevanceScore >= options.minRelevanceScore) {
            contexts.push(context);
          }
        }
      }

      // Sort by relevance score
      contexts.sort((a, b) => b.relevanceScore - a.relevanceScore);

      this.logger.log(`Retrieved ${contexts.length} relevant previous meetings`);
      return contexts;

    } catch (error) {
      this.logger.warn(`Error retrieving previous meeting context: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate predictions about likely meeting topics
   */
  private async generateTopicPredictions(
    upcomingMeeting: CalendarEvent,
    previousMeetings: PreviousMeetingContext[],
    participantHistories: ParticipantHistory[]
  ): Promise<TopicPrediction[]> {
    this.logger.log(`Generating topic predictions for: ${upcomingMeeting.title}`);

    try {
      const prompt = this.buildTopicPredictionPrompt(upcomingMeeting, previousMeetings, participantHistories);
      const response = await this.processMessage(prompt);
      const predictions = this.parseTopicPredictions(response);

      this.logger.log(`Generated ${predictions.length} topic predictions`);
      return predictions;

    } catch (error) {
      this.logger.error(`Error generating topic predictions: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate actionable meeting preparation recommendations
   */
  private async generateMeetingRecommendations(
    upcomingMeeting: CalendarEvent,
    previousMeetings: PreviousMeetingContext[],
    participantHistories: ParticipantHistory[],
    topicPredictions: TopicPrediction[]
  ): Promise<Array<{
    type: 'preparation' | 'agenda' | 'follow_up' | 'scheduling';
    priority: 'high' | 'medium' | 'low';
    message: string;
    actionable: boolean;
  }>> {
    this.logger.log(`Generating recommendations for: ${upcomingMeeting.title}`);

    try {
      const prompt = this.buildRecommendationsPrompt(upcomingMeeting, previousMeetings, participantHistories, topicPredictions);
      const response = await this.processMessage(prompt);
      const recommendations = this.parseRecommendations(response);

      this.logger.log(`Generated ${recommendations.length} recommendations`);
      return recommendations;

    } catch (error) {
      this.logger.error(`Error generating recommendations: ${error.message}`);
      return [];
    }
  }

  // Helper methods for prompt building
  private buildParticipantAnalysisPrompt(attendee: any, participantData: any): string {
    return `Analyze this meeting participant's patterns and behavior:

PARTICIPANT: ${attendee.email} (${attendee.displayName || 'Unknown'})

HISTORICAL DATA:
${JSON.stringify(participantData, null, 2)}

Please analyze and return JSON with:
- commonTopics: array of frequently discussed topics
- preferredMeetingTimes: array of preferred time slots
- responsePatterns: response time and acceptance patterns
- meetingBehavior: punctuality, participation, and preparedness patterns

Focus on actionable insights for meeting preparation.`;
  }

  private buildMeetingContextQuery(meeting: CalendarEvent): string {
    const participants = meeting.attendees.map(a => a.email).join(', ');
    const title = meeting.title;
    const description = meeting.description || '';
    
    return `Meeting context for: "${title}" with participants: ${participants}. ${description}`;
  }

  private buildTopicPredictionPrompt(
    meeting: CalendarEvent,
    previousMeetings: PreviousMeetingContext[],
    participants: ParticipantHistory[]
  ): string {
    return `Predict likely discussion topics for this upcoming meeting:

UPCOMING MEETING:
Title: ${meeting.title}
Description: ${meeting.description || 'No description'}
Participants: ${meeting.attendees.map(a => a.email).join(', ')}
Duration: ${Math.round((new Date(meeting.endTime).getTime() - new Date(meeting.startTime).getTime()) / (1000 * 60))} minutes

PREVIOUS MEETINGS CONTEXT:
${previousMeetings.slice(0, 5).map(m => `- ${m.title}: ${m.topics.join(', ')}`).join('\n')}

PARTICIPANT COMMON TOPICS:
${participants.map(p => `${p.email}: ${p.commonTopics.join(', ')}`).join('\n')}

Generate 3-7 topic predictions with confidence scores and reasoning.
Return JSON array of TopicPrediction objects.`;
  }

  private buildRecommendationsPrompt(
    meeting: CalendarEvent,
    previousMeetings: PreviousMeetingContext[],
    participants: ParticipantHistory[],
    topics: TopicPrediction[]
  ): string {
    return `Generate actionable recommendations for this meeting:

MEETING DETAILS:
${JSON.stringify({
  title: meeting.title,
  duration: Math.round((new Date(meeting.endTime).getTime() - new Date(meeting.startTime).getTime()) / (1000 * 60)),
  participants: meeting.attendees.length,
  description: meeting.description
}, null, 2)}

CONTEXT:
- ${previousMeetings.length} relevant previous meetings
- ${participants.length} participants with history
- ${topics.length} predicted topics

PREDICTED TOPICS:
${topics.map(t => `- ${t.topic} (confidence: ${t.confidence})`).join('\n')}

Generate specific, actionable recommendations for:
1. Meeting preparation
2. Agenda optimization
3. Follow-up planning
4. Scheduling considerations

Return JSON array with type, priority, message, and actionable flag.`;
  }

  // Parsing methods
  private parseParticipantAnalysis(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch (error) {
      this.logger.warn(`Error parsing participant analysis: ${error.message}`);
      return {};
    }
  }

  private parseTopicPredictions(response: string): TopicPrediction[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      
      const parsed = JSON.parse(jsonMatch[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      this.logger.warn(`Error parsing topic predictions: ${error.message}`);
      return [];
    }
  }

  private parseRecommendations(response: string): any[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      
      const parsed = JSON.parse(jsonMatch[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      this.logger.warn(`Error parsing recommendations: ${error.message}`);
      return [];
    }
  }

  // Utility methods
  private extractParticipantDataFromRAG(docs: any[]): any {
    // Extract participant data from RAG documents
    return {
      totalMeetings: docs.length,
      recentMeetings: docs.slice(0, 10).map(doc => ({
        id: doc.id,
        title: doc.metadata?.title || 'Unknown',
        date: doc.metadata?.date || new Date().toISOString(),
        duration: doc.metadata?.duration || 60,
        role: doc.metadata?.role || 'attendee'
      }))
    };
  }

  private extractMeetingContextFromDocument(doc: any): PreviousMeetingContext | null {
    try {
      return {
        id: doc.id,
        title: doc.metadata?.title || 'Unknown Meeting',
        date: doc.metadata?.date || new Date().toISOString(),
        duration: doc.metadata?.duration || 60,
        participants: doc.metadata?.participants || [],
        summary: doc.content,
        topics: doc.metadata?.topics || [],
        decisions: doc.metadata?.decisions || [],
        nextSteps: doc.metadata?.nextSteps || [],
        relatedMeetings: doc.metadata?.relatedMeetings || [],
        relevanceScore: doc.score || 0.5,
        actionItems: doc.metadata?.actionItems || []
      };
    } catch (error) {
      this.logger.warn(`Error extracting meeting context: ${error.message}`);
      return null;
    }
  }

  private createContextSummary(
    previousMeetings: PreviousMeetingContext[],
    participants: ParticipantHistory[],
    upcomingMeeting: CalendarEvent
  ): any {
    const allTopics = previousMeetings.flatMap(m => m.topics);
    const topicCounts = allTopics.reduce((acc, topic) => {
      acc[topic] = (acc[topic] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRelevantMeetings: previousMeetings.length,
      keyParticipants: participants.slice(0, 5).map(p => p.email),
      primaryTopics: Object.entries(topicCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([topic]) => topic),
      ongoingActionItems: previousMeetings.reduce((sum, m) => 
        sum + (m.actionItems?.filter(ai => ai.status === 'open' || ai.status === 'in_progress').length || 0), 0
      ),
      meetingFrequency: {
        similar: this.calculateSimilarMeetingFrequency(previousMeetings),
        withOrganizer: this.calculateOrganizerMeetingFrequency(previousMeetings, upcomingMeeting.organizer.email),
        withParticipants: this.calculateParticipantMeetingFrequency(previousMeetings, participants)
      }
    };
  }

  private calculateOverallConfidence(meetings: PreviousMeetingContext[], participants: ParticipantHistory[]): number {
    if (meetings.length === 0 && participants.length === 0) return 0.1;
    
    const meetingConfidence = meetings.length > 0 
      ? meetings.reduce((sum, m) => sum + m.relevanceScore, 0) / meetings.length 
      : 0;
    
    const participantConfidence = participants.length > 0 
      ? participants.reduce((sum, p) => sum + Math.min(p.totalMeetings / 10, 1), 0) / participants.length 
      : 0;
    
    return (meetingConfidence + participantConfidence) / 2;
  }

  private calculateSimilarMeetingFrequency(meetings: PreviousMeetingContext[]): number {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentMeetings = meetings.filter(m => new Date(m.date) >= thirtyDaysAgo);
    return recentMeetings.length;
  }

  private calculateOrganizerMeetingFrequency(meetings: PreviousMeetingContext[], organizer: string): number {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const organizerMeetings = meetings.filter(m => 
      new Date(m.date) >= thirtyDaysAgo && m.participants.includes(organizer)
    );
    return organizerMeetings.length;
  }

  private calculateParticipantMeetingFrequency(meetings: PreviousMeetingContext[], participants: ParticipantHistory[]): number {
    const participantEmails = participants.map(p => p.email);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const participantMeetings = meetings.filter(m => 
      new Date(m.date) >= thirtyDaysAgo && 
      m.participants.some(p => participantEmails.includes(p))
    );
    return participantMeetings.length;
  }

  private createMinimalContext(meeting: CalendarEvent, error: string): MeetingContext {
    return {
      meetingId: meeting.id,
      upcomingMeeting: {
        id: meeting.id,
        title: meeting.title,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        description: meeting.description,
        participants: meeting.attendees.map(a => a.email),
        organizer: meeting.organizer.email,
        location: meeting.location,
        meetingLink: meeting.meetingLink
      },
      participantHistories: [],
      previousMeetingContext: [],
      topicPredictions: [],
      contextSummary: {
        totalRelevantMeetings: 0,
        keyParticipants: [],
        primaryTopics: [],
        ongoingActionItems: 0,
        meetingFrequency: { similar: 0, withOrganizer: 0, withParticipants: 0 }
      },
      recommendations: [],
      retrievalMetadata: {
        retrievedAt: new Date().toISOString(),
        sources: ['error_fallback'],
        ragEnhanced: false,
        confidence: 0,
      }
    };
  }

  /**
   * Process state for LangGraph integration
   */
  async processState(state: any): Promise<any> {
    const meeting = state.upcomingMeeting || state.meeting || state.calendarEvent;
    const options = state.contextOptions || {};

    if (!meeting) {
      this.logger.warn('No meeting found in state for context gathering');
      return {
        ...state,
        meetingContext: null,
        error: 'No meeting data provided for context gathering'
      };
    }

    const meetingContext = await this.gatherMeetingContext(meeting, options);

    return {
      ...state,
      meetingContext,
      stage: 'meeting_context_completed'
    };
  }
} 