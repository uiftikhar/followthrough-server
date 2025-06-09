import { Injectable, Inject, Logger } from '@nestjs/common';
import { BaseAgent } from '../../langgraph/agents/base-agent';
import { LlmService } from '../../langgraph/llm/llm.service';
import { RagService } from '../../rag/rag.service';
import { RAG_SERVICE } from '../../rag/constants/injection-tokens';
import {
  MeetingBrief,
  BriefGenerationOptions,
  AgendaItem,
  ParticipantPreparation,
  MeetingObjectives,
  TimeManagement,
  BriefTemplate
} from '../interfaces/meeting-brief.interface';
import { CalendarEvent } from '../interfaces/calendar-event.interface';
import { MeetingContext } from '../interfaces/meeting-context.interface';

@Injectable()
export class MeetingBriefAgent extends BaseAgent {
  protected readonly logger = new Logger(MeetingBriefAgent.name);

  constructor(
    llmService: LlmService,
    @Inject(RAG_SERVICE) private readonly ragService: RagService,
  ) {
    super(llmService, {
      name: 'MeetingBriefAgent',
      systemPrompt: `You are a specialized meeting brief generation agent. Your role is to:

1. Analyze upcoming meetings and create comprehensive preparation briefs
2. Enhance existing agendas with context and recommendations
3. Generate participant-specific preparation guidelines
4. Optimize meeting structure and time management
5. Create delivery-ready brief content for multiple formats

You excel at:
- Transforming basic meeting information into actionable insights
- Analyzing participant backgrounds to customize preparation
- Identifying potential meeting risks and optimization opportunities
- Creating clear, structured briefing materials
- Adapting content for different delivery methods (email, slack, calendar)

Always provide practical, actionable guidance that helps participants prepare effectively and ensures meeting success.

Respond with valid JSON following the specified interface structures.`,
      llmOptions: {
        temperature: 0.4,
        model: 'gpt-4o',
        maxTokens: 6000
      }
    });
  }

  /**
   * Generate a comprehensive meeting brief
   */
  async generateMeetingBrief(
    upcomingMeeting: CalendarEvent,
    meetingContext: MeetingContext,
    options: BriefGenerationOptions = {}
  ): Promise<MeetingBrief> {
    this.logger.log(`Generating meeting brief for: ${upcomingMeeting.title}`);

    const defaultOptions: Required<BriefGenerationOptions> = {
      includeDetailedAgenda: true,
      includeParticipantPrep: true,
      includeTimeManagement: true,
      includeDeliveryFormats: true,
      customizeForOrganizer: true,
      complexity: 'standard',
      focusAreas: ['agenda', 'preparation', 'objectives'],
      deliveryFormat: ['email', 'calendar'],
      useRAG: true,
      maxBriefLength: 2000,
      prioritizeActionItems: true
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      const briefId = `brief-${upcomingMeeting.id}-${Date.now()}`;

      // Step 1: Generate meeting objectives
      const objectives = await this.generateMeetingObjectives(upcomingMeeting, meetingContext, finalOptions);

      // Step 2: Enhance the agenda
      const enhancedAgenda = finalOptions.includeDetailedAgenda
        ? await this.enhanceAgenda(upcomingMeeting, meetingContext, objectives, finalOptions)
        : [];

      // Step 3: Generate participant preparations
      const participantPreparations = finalOptions.includeParticipantPrep
        ? await this.generateParticipantPreparations(upcomingMeeting, meetingContext, enhancedAgenda)
        : [];

      // Step 4: Create time management plan
      const timeManagement = finalOptions.includeTimeManagement
        ? await this.createTimeManagementPlan(upcomingMeeting, enhancedAgenda, finalOptions)
        : this.createBasicTimeManagement(upcomingMeeting);

      // Step 5: Generate contextual insights
      const contextualInsights = this.extractContextualInsights(meetingContext);

      // Step 6: Generate recommendations
      const recommendations = await this.generateMeetingRecommendations(
        upcomingMeeting,
        meetingContext,
        enhancedAgenda,
        participantPreparations,
        finalOptions
      );

      // Step 7: Create delivery formats
      const deliveryOptions = finalOptions.includeDeliveryFormats
        ? await this.createDeliveryFormats(upcomingMeeting, objectives, enhancedAgenda, participantPreparations, finalOptions)
        : this.createBasicDeliveryFormats(upcomingMeeting);

      // Step 8: Generate executive summary
      const executiveSummary = this.createExecutiveSummary(
        upcomingMeeting,
        objectives,
        enhancedAgenda,
        meetingContext
      );

      const meetingBrief: MeetingBrief = {
        meetingId: upcomingMeeting.id,
        briefId,
        meetingDetails: {
          title: upcomingMeeting.title,
          startTime: upcomingMeeting.startTime,
          endTime: upcomingMeeting.endTime,
          location: upcomingMeeting.location,
          meetingLink: upcomingMeeting.meetingLink,
          organizer: upcomingMeeting.organizer.email,
          participants: upcomingMeeting.attendees.map(a => a.email),
          description: upcomingMeeting.description
        },
        executiveSummary,
        objectives,
        enhancedAgenda,
        participantPreparations,
        timeManagement,
        contextualInsights,
        recommendations,
        deliveryOptions,
        generationMetadata: {
          generatedAt: new Date().toISOString(),
          baseContext: {
            previousMeetings: meetingContext.previousMeetingContext.length,
            participantHistories: meetingContext.participantHistories.length,
            topicPredictions: meetingContext.topicPredictions.length
          },
          confidence: this.calculateBriefConfidence(meetingContext, enhancedAgenda, participantPreparations),
          ragEnhanced: finalOptions.useRAG,
          customizations: this.extractCustomizations(finalOptions)
        }
      };

      this.logger.log(`Successfully generated meeting brief ${briefId} with ${enhancedAgenda.length} agenda items and ${participantPreparations.length} participant preparations`);
      
      return meetingBrief;

    } catch (error) {
      this.logger.error(`Error generating meeting brief: ${error.message}`);
      return this.createMinimalBrief(upcomingMeeting, meetingContext, error.message);
    }
  }

  /**
   * Generate clear meeting objectives based on context and patterns
   */
  private async generateMeetingObjectives(
    meeting: CalendarEvent,
    context: MeetingContext,
    options: Required<BriefGenerationOptions>
  ): Promise<MeetingObjectives> {
    this.logger.log('Generating meeting objectives');

    try {
      const prompt = this.buildObjectivesPrompt(meeting, context, options);
      const response = await this.processMessage(prompt);
      const objectives = this.parseObjectives(response);

      return objectives;

    } catch (error) {
      this.logger.warn(`Error generating objectives: ${error.message}`);
      return this.createDefaultObjectives(meeting);
    }
  }

  /**
   * Enhance the existing agenda with context and recommendations
   */
  private async enhanceAgenda(
    meeting: CalendarEvent,
    context: MeetingContext,
    objectives: MeetingObjectives,
    options: Required<BriefGenerationOptions>
  ): Promise<AgendaItem[]> {
    this.logger.log('Enhancing meeting agenda');

    try {
      // If there's an existing agenda in the description, parse it
      const existingAgenda = this.parseExistingAgenda(meeting.description || '');
      
      const prompt = this.buildAgendaEnhancementPrompt(meeting, context, objectives, existingAgenda, options);
      const response = await this.processMessage(prompt);
      const enhancedAgenda = this.parseAgendaItems(response);

      return enhancedAgenda;

    } catch (error) {
      this.logger.warn(`Error enhancing agenda: ${error.message}`);
      return this.createBasicAgenda(meeting, objectives);
    }
  }

  /**
   * Generate participant-specific preparation recommendations
   */
  private async generateParticipantPreparations(
    meeting: CalendarEvent,
    context: MeetingContext,
    agenda: AgendaItem[]
  ): Promise<ParticipantPreparation[]> {
    this.logger.log('Generating participant preparations');

    const preparations: ParticipantPreparation[] = [];

    for (const attendee of meeting.attendees) {
      try {
        const participantHistory = context.participantHistories.find(p => p.email === attendee.email);
        
        const prompt = this.buildParticipantPrepPrompt(attendee, participantHistory, agenda, context);
        const response = await this.processMessage(prompt);
        const preparation = this.parseParticipantPreparation(response, attendee);
        
        preparations.push(preparation);

      } catch (error) {
        this.logger.warn(`Error generating preparation for ${attendee.email}: ${error.message}`);
        // Add minimal preparation
        preparations.push(this.createMinimalParticipantPrep(attendee));
      }
    }

    return preparations;
  }

  /**
   * Create optimized time management plan
   */
  private async createTimeManagementPlan(
    meeting: CalendarEvent,
    agenda: AgendaItem[],
    options: Required<BriefGenerationOptions>
  ): Promise<TimeManagement> {
    this.logger.log('Creating time management plan');

    try {
      const duration = Math.round(
        (new Date(meeting.endTime).getTime() - new Date(meeting.startTime).getTime()) / (1000 * 60)
      );

      const prompt = this.buildTimeManagementPrompt(meeting, agenda, duration, options);
      const response = await this.processMessage(prompt);
      const timeManagement = this.parseTimeManagement(response, duration);

      return timeManagement;

    } catch (error) {
      this.logger.warn(`Error creating time management plan: ${error.message}`);
      return this.createBasicTimeManagement(meeting);
    }
  }

  /**
   * Generate actionable meeting recommendations
   */
  private async generateMeetingRecommendations(
    meeting: CalendarEvent,
    context: MeetingContext,
    agenda: AgendaItem[],
    preparations: ParticipantPreparation[],
    options: Required<BriefGenerationOptions>
  ): Promise<Array<{
    category: 'preparation' | 'agenda' | 'facilitation' | 'follow_up';
    priority: 'high' | 'medium' | 'low';
    recommendation: string;
    rationale: string;
    implementationTime: number;
  }>> {
    this.logger.log('Generating meeting recommendations');

    try {
      const prompt = this.buildRecommendationsPrompt(meeting, context, agenda, preparations, options);
      const response = await this.processMessage(prompt);
      const recommendations = this.parseRecommendations(response);

      return recommendations;

    } catch (error) {
      this.logger.warn(`Error generating recommendations: ${error.message}`);
      return [];
    }
  }

  /**
   * Create delivery-ready formats for different channels
   */
  private async createDeliveryFormats(
    meeting: CalendarEvent,
    objectives: MeetingObjectives,
    agenda: AgendaItem[],
    preparations: ParticipantPreparation[],
    options: Required<BriefGenerationOptions>
  ): Promise<{
    email: { subject: string; body: string; attachments?: string[] };
    slack: { channel?: string; message: string; threadMessage?: string };
    calendar: { description: string; agendaUpdate: string };
  }> {
    this.logger.log('Creating delivery formats');

    try {
      const prompt = this.buildDeliveryFormatsPrompt(meeting, objectives, agenda, preparations, options);
      const response = await this.processMessage(prompt);
      const deliveryFormats = this.parseDeliveryFormats(response);

      return deliveryFormats;

    } catch (error) {
      this.logger.warn(`Error creating delivery formats: ${error.message}`);
      return this.createBasicDeliveryFormats(meeting);
    }
  }

  // Prompt building methods
  private buildObjectivesPrompt(
    meeting: CalendarEvent,
    context: MeetingContext,
    options: Required<BriefGenerationOptions>
  ): string {
    return `Generate clear meeting objectives for this upcoming meeting:

MEETING DETAILS:
Title: ${meeting.title}
Description: ${meeting.description || 'No description provided'}
Duration: ${Math.round((new Date(meeting.endTime).getTime() - new Date(meeting.startTime).getTime()) / (1000 * 60))} minutes
Participants: ${meeting.attendees.length} attendees

CONTEXT INSIGHTS:
Previous relevant meetings: ${context.previousMeetingContext.length}
Predicted topics: ${context.topicPredictions.map(t => t.topic).join(', ')}
Ongoing action items: ${context.contextSummary.ongoingActionItems}

FOCUS AREAS: ${options.focusAreas.join(', ')}

Generate MeetingObjectives with:
- Clear primary objective
- 2-4 secondary objectives
- Success metrics
- Expected decisions
- Potential risks and mitigations

Return valid JSON following MeetingObjectives interface.`;
  }

  private buildAgendaEnhancementPrompt(
    meeting: CalendarEvent,
    context: MeetingContext,
    objectives: MeetingObjectives,
    existingAgenda: string[],
    options: Required<BriefGenerationOptions>
  ): string {
    return `Enhance the meeting agenda with detailed structure and recommendations:

MEETING: ${meeting.title}
DURATION: ${Math.round((new Date(meeting.endTime).getTime() - new Date(meeting.startTime).getTime()) / (1000 * 60))} minutes

OBJECTIVES:
Primary: ${objectives.primary}
Secondary: ${objectives.secondary.join(', ')}

EXISTING AGENDA:
${existingAgenda.length > 0 ? existingAgenda.join('\n') : 'No existing agenda items found'}

PREDICTED TOPICS:
${context.topicPredictions.map(t => `- ${t.topic} (confidence: ${t.confidence})`).join('\n')}

CONTEXT:
- ${context.previousMeetingContext.length} relevant previous meetings
- ${context.contextSummary.ongoingActionItems} ongoing action items

Create 4-8 detailed agenda items with:
- Clear titles and descriptions
- Appropriate time allocations
- Priority levels
- Expected outcomes
- Preparation requirements

Return JSON array of AgendaItem objects.`;
  }

  private buildParticipantPrepPrompt(
    attendee: any,
    history: any,
    agenda: AgendaItem[],
    context: MeetingContext
  ): string {
    return `Generate personalized preparation for this meeting participant:

PARTICIPANT: ${attendee.email} (${attendee.displayName || 'Unknown'})

PARTICIPANT HISTORY:
${history ? `
- Total meetings: ${history.totalMeetings}
- Common topics: ${history.commonTopics.join(', ')}
- Meeting behavior: ${JSON.stringify(history.meetingBehavior)}
- Recent meetings: ${history.recentMeetings.slice(0, 3).map(m => m.title).join(', ')}
` : 'Limited history available'}

MEETING AGENDA:
${agenda.map(item => `- ${item.title} (${item.duration}min, priority: ${item.priority})`).join('\n')}

PREDICTED TOPICS:
${context.topicPredictions.map(t => t.topic).join(', ')}

Generate PersonalizedPreparation with:
- Role-specific preparation tasks
- Relevant history and context
- Suggested questions to ask
- Key responsibilities
- Time estimates for preparation

Return valid JSON following ParticipantPreparation interface.`;
  }

  private buildTimeManagementPrompt(
    meeting: CalendarEvent,
    agenda: AgendaItem[],
    duration: number,
    options: Required<BriefGenerationOptions>
  ): string {
    return `Create an optimized time management plan for this meeting:

MEETING: ${meeting.title}
TOTAL DURATION: ${duration} minutes

AGENDA ITEMS:
${agenda.map(item => `- ${item.title}: ${item.duration} minutes (${item.priority} priority)`).join('\n')}

COMPLEXITY: ${options.complexity}

Create a detailed TimeManagement plan with:
- Suggested schedule with timing
- Buffer periods and breaks
- Critical timing considerations
- Fallback plans for shortened versions

Consider:
- Participant energy levels throughout the meeting
- Natural break points
- Decision-making windows
- Buffer time for overruns

Return valid JSON following TimeManagement interface.`;
  }

  private buildRecommendationsPrompt(
    meeting: CalendarEvent,
    context: MeetingContext,
    agenda: AgendaItem[],
    preparations: ParticipantPreparation[],
    options: Required<BriefGenerationOptions>
  ): string {
    return `Generate actionable recommendations for meeting success:

MEETING CONTEXT:
- Title: ${meeting.title}
- Duration: ${Math.round((new Date(meeting.endTime).getTime() - new Date(meeting.startTime).getTime()) / (1000 * 60))} minutes
- Participants: ${meeting.attendees.length}
- Agenda items: ${agenda.length}

CONTEXT INSIGHTS:
- Previous meetings: ${context.previousMeetingContext.length}
- Ongoing action items: ${context.contextSummary.ongoingActionItems}
- Participant engagement history available: ${preparations.filter(p => p.relevantHistory.length > 0).length}/${preparations.length}

FOCUS AREAS: ${options.focusAreas.join(', ')}

Generate 5-10 specific recommendations covering:
- Preparation optimization
- Agenda improvements
- Facilitation techniques
- Follow-up planning

Each recommendation should include category, priority, rationale, and implementation time.

Return JSON array following the recommendation structure.`;
  }

  private buildDeliveryFormatsPrompt(
    meeting: CalendarEvent,
    objectives: MeetingObjectives,
    agenda: AgendaItem[],
    preparations: ParticipantPreparation[],
    options: Required<BriefGenerationOptions>
  ): string {
    return `Create delivery-ready formats for this meeting brief:

MEETING: ${meeting.title}
WHEN: ${new Date(meeting.startTime).toLocaleString()}
PARTICIPANTS: ${meeting.attendees.length} attendees

PRIMARY OBJECTIVE: ${objectives.primary}

AGENDA SUMMARY:
${agenda.slice(0, 5).map(item => `- ${item.title} (${item.duration}min)`).join('\n')}

PREPARATION REQUIRED: ${preparations.some(p => p.preparationTasks.length > 0) ? 'Yes' : 'Minimal'}

DELIVERY FORMATS: ${options.deliveryFormat.join(', ')}
MAX LENGTH: ${options.maxBriefLength} words

Create three formats:
1. EMAIL: Professional subject line and structured body
2. SLACK: Concise message with key highlights
3. CALENDAR: Updated description and agenda for calendar entry

Make each format:
- Appropriate for the channel
- Actionable and clear
- Include key preparation items
- Professional but accessible

Return valid JSON with email, slack, and calendar objects.`;
  }

  // Parsing methods
  private parseObjectives(response: string): MeetingObjectives {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        primary: parsed.primary || 'Discuss meeting topics',
        secondary: parsed.secondary || [],
        successMetrics: parsed.successMetrics || [],
        expectedDecisions: parsed.expectedDecisions || [],
        potentialRisks: parsed.potentialRisks || []
      };
    } catch (error) {
      this.logger.warn(`Error parsing objectives: ${error.message}`);
      return {
        primary: 'Conduct productive meeting discussion',
        secondary: [],
        successMetrics: [],
        expectedDecisions: [],
        potentialRisks: []
      };
    }
  }

  private parseAgendaItems(response: string): AgendaItem[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      
      const parsed = JSON.parse(jsonMatch[0]);
      return Array.isArray(parsed) ? parsed.map((item, index) => ({
        id: item.id || `agenda-${index + 1}`,
        title: item.title || `Agenda Item ${index + 1}`,
        description: item.description,
        duration: item.duration || 15,
        priority: item.priority || 'medium',
        presenter: item.presenter,
        materials: item.materials || [],
        preparationRequired: item.preparationRequired || [],
        expectedOutcomes: item.expectedOutcomes || [],
        relatedTopics: item.relatedTopics || []
      })) : [];
    } catch (error) {
      this.logger.warn(`Error parsing agenda items: ${error.message}`);
      return [];
    }
  }

  private parseParticipantPreparation(response: string, attendee: any): ParticipantPreparation {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        participantEmail: attendee.email,
        participantName: attendee.displayName || attendee.email.split('@')[0],
        role: parsed.role || 'attendee',
        preparationTasks: parsed.preparationTasks || [],
        relevantHistory: parsed.relevantHistory || [],
        suggestedQuestions: parsed.suggestedQuestions || [],
        keyResponsibilities: parsed.keyResponsibilities || [],
        expertiseAreas: parsed.expertiseAreas || []
      };
    } catch (error) {
      this.logger.warn(`Error parsing participant preparation: ${error.message}`);
      return this.createMinimalParticipantPrep(attendee);
    }
  }

  private parseTimeManagement(response: string, duration: number): TimeManagement {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        totalDuration: duration,
        suggestedSchedule: parsed.suggestedSchedule || [],
        criticalTimings: parsed.criticalTimings || [],
        fallbackPlan: parsed.fallbackPlan
      };
    } catch (error) {
      this.logger.warn(`Error parsing time management: ${error.message}`);
      return {
        totalDuration: duration,
        suggestedSchedule: [],
        criticalTimings: [],
        fallbackPlan: undefined
      };
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

  private parseDeliveryFormats(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        email: parsed.email || { subject: '', body: '' },
        slack: parsed.slack || { message: '' },
        calendar: parsed.calendar || { description: '', agendaUpdate: '' }
      };
    } catch (error) {
      this.logger.warn(`Error parsing delivery formats: ${error.message}`);
      return this.createBasicDeliveryFormats({ title: 'Meeting' } as CalendarEvent);
    }
  }

  // Utility methods
  private parseExistingAgenda(description: string): string[] {
    // Simple agenda parsing - look for bullet points or numbered lists
    const lines = description.split('\n');
    const agendaItems: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[-*•]\s+/) || trimmed.match(/^\d+\.\s+/)) {
        agendaItems.push(trimmed.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, ''));
      }
    }
    
    return agendaItems;
  }

  private extractContextualInsights(context: MeetingContext): any {
    return {
      relevantHistory: context.previousMeetingContext.slice(0, 5).map(m => 
        `${m.title} (${new Date(m.date).toLocaleDateString()}): ${m.topics.join(', ')}`
      ),
      ongoingProjects: context.contextSummary.primaryTopics,
      stakeholderInterests: context.participantHistories.map(p => ({
        stakeholder: p.email,
        interests: p.commonTopics,
        concerns: []
      })),
      decisionDependencies: context.previousMeetingContext
        .flatMap(m => m.decisions)
        .filter((decision, index, arr) => arr.indexOf(decision) === index)
        .slice(0, 5)
    };
  }

  private createExecutiveSummary(
    meeting: CalendarEvent,
    objectives: MeetingObjectives,
    agenda: AgendaItem[],
    context: MeetingContext
  ): any {
    const duration = Math.round(
      (new Date(meeting.endTime).getTime() - new Date(meeting.startTime).getTime()) / (1000 * 60)
    );

    return {
      purpose: objectives.primary,
      keyOutcomes: objectives.expectedDecisions.slice(0, 3),
      preparation: agenda.some(a => a.preparationRequired && a.preparationRequired.length > 0) 
        ? 'Preparation required - see participant guidelines' 
        : 'Minimal preparation required',
      duration,
      complexity: duration > 90 || agenda.length > 6 ? 'high' : 
                   duration > 45 || agenda.length > 4 ? 'medium' : 'low'
    };
  }

  private calculateBriefConfidence(
    context: MeetingContext,
    agenda: AgendaItem[],
    preparations: ParticipantPreparation[]
  ): number {
    let confidence = 0.5; // Base confidence
    
    // Add confidence based on context
    if (context.previousMeetingContext.length > 0) confidence += 0.2;
    if (context.participantHistories.length > 0) confidence += 0.1;
    if (context.topicPredictions.length > 0) confidence += 0.1;
    
    // Add confidence based on generated content quality
    if (agenda.length > 0) confidence += 0.1;
    if (preparations.length > 0) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  private extractCustomizations(options: Required<BriefGenerationOptions>): string[] {
    const customizations: string[] = [];
    
    if (options.complexity !== 'standard') customizations.push(`complexity: ${options.complexity}`);
    if (options.focusAreas.length !== 3) customizations.push(`focus: ${options.focusAreas.join(',')}`);
    if (options.maxBriefLength !== 2000) customizations.push(`length: ${options.maxBriefLength}`);
    if (!options.prioritizeActionItems) customizations.push('no action item priority');
    
    return customizations;
  }

  // Fallback methods
  private createDefaultObjectives(meeting: CalendarEvent): MeetingObjectives {
    return {
      primary: `Conduct productive discussion for: ${meeting.title}`,
      secondary: ['Align on key topics', 'Make necessary decisions', 'Define next steps'],
      successMetrics: [],
      expectedDecisions: [],
      potentialRisks: []
    };
  }

  private createBasicAgenda(meeting: CalendarEvent, objectives: MeetingObjectives): AgendaItem[] {
    const duration = Math.round(
      (new Date(meeting.endTime).getTime() - new Date(meeting.startTime).getTime()) / (1000 * 60)
    );

    return [
      {
        id: 'agenda-1',
        title: 'Opening and Objectives',
        duration: Math.min(10, duration * 0.1),
        priority: 'high',
        expectedOutcomes: ['Clear meeting objectives', 'Agenda confirmation'],
        relatedTopics: []
      },
      {
        id: 'agenda-2',
        title: 'Main Discussion',
        duration: Math.max(20, duration * 0.7),
        priority: 'high',
        expectedOutcomes: [objectives.primary],
        relatedTopics: []
      },
      {
        id: 'agenda-3',
        title: 'Next Steps and Wrap-up',
        duration: Math.min(15, duration * 0.2),
        priority: 'medium',
        expectedOutcomes: ['Action items defined', 'Follow-up scheduled'],
        relatedTopics: []
      }
    ];
  }

  private createMinimalParticipantPrep(attendee: any): ParticipantPreparation {
    return {
      participantEmail: attendee.email,
      participantName: attendee.displayName || attendee.email.split('@')[0],
      role: 'attendee',
      preparationTasks: [],
      relevantHistory: [],
      suggestedQuestions: [],
      keyResponsibilities: [],
      expertiseAreas: []
    };
  }

  private createBasicTimeManagement(meeting: CalendarEvent): TimeManagement {
    const duration = Math.round(
      (new Date(meeting.endTime).getTime() - new Date(meeting.startTime).getTime()) / (1000 * 60)
    );

    return {
      totalDuration: duration,
      suggestedSchedule: [
        { startTime: '+0', endTime: `+${duration}`, activity: meeting.title, buffer: false }
      ],
      criticalTimings: [],
      fallbackPlan: undefined
    };
  }

  private createBasicDeliveryFormats(meeting: CalendarEvent): any {
    return {
      email: {
        subject: `Meeting Brief: ${meeting.title}`,
        body: `Upcoming meeting: ${meeting.title}\nTime: ${new Date(meeting.startTime).toLocaleString()}\n\nPlease review the agenda and prepare accordingly.`
      },
      slack: {
        message: `📅 Upcoming meeting: *${meeting.title}*\n⏰ ${new Date(meeting.startTime).toLocaleString()}\n\nPlease review and prepare!`
      },
      calendar: {
        description: `Meeting: ${meeting.title}`,
        agendaUpdate: meeting.description || ''
      }
    };
  }

  private createMinimalBrief(meeting: CalendarEvent, context: MeetingContext, error: string): MeetingBrief {
    const briefId = `brief-${meeting.id}-${Date.now()}`;
    
    return {
      meetingId: meeting.id,
      briefId,
      meetingDetails: {
        title: meeting.title,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        location: meeting.location,
        meetingLink: meeting.meetingLink,
        organizer: meeting.organizer.email,
        participants: meeting.attendees.map(a => a.email),
        description: meeting.description
      },
      executiveSummary: {
        purpose: meeting.title,
        keyOutcomes: [],
        preparation: 'Error generating detailed preparation',
        duration: Math.round((new Date(meeting.endTime).getTime() - new Date(meeting.startTime).getTime()) / (1000 * 60)),
        complexity: 'low'
      },
      objectives: this.createDefaultObjectives(meeting),
      enhancedAgenda: [],
      participantPreparations: [],
      timeManagement: this.createBasicTimeManagement(meeting),
      contextualInsights: { relevantHistory: [], ongoingProjects: [], stakeholderInterests: [], decisionDependencies: [] },
      recommendations: [],
      deliveryOptions: this.createBasicDeliveryFormats(meeting),
      generationMetadata: {
        generatedAt: new Date().toISOString(),
        baseContext: {
          previousMeetings: context.previousMeetingContext.length,
          participantHistories: context.participantHistories.length,
          topicPredictions: context.topicPredictions.length
        },
        confidence: 0.1,
        ragEnhanced: false,
        customizations: [`error: ${error}`]
      }
    };
  }

  /**
   * Process state for LangGraph integration
   */
  async processState(state: any): Promise<any> {
    const meeting = state.upcomingMeeting || state.meeting || state.calendarEvent;
    const context = state.meetingContext;
    const options = state.briefOptions || {};

    if (!meeting) {
      this.logger.warn('No meeting found in state for brief generation');
      return {
        ...state,
        meetingBrief: null,
        error: 'No meeting data provided for brief generation'
      };
    }

    if (!context) {
      this.logger.warn('No meeting context found in state for brief generation');
      return {
        ...state,
        meetingBrief: null,
        error: 'No meeting context provided for brief generation'
      };
    }

    const meetingBrief = await this.generateMeetingBrief(meeting, context, options);

    return {
      ...state,
      meetingBrief,
      stage: 'meeting_brief_completed'
    };
  }
} 