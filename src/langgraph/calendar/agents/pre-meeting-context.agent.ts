import { Injectable, Inject, Logger } from "@nestjs/common";
import { BaseAgent } from "../../agents/base-agent";
import { LlmService } from "../../llm/llm.service";
import { RagService } from "../../../rag/rag.service";
import { RAG_SERVICE } from "../../../rag/constants/injection-tokens";
import { 
  CalendarWorkflowState, 
  CalendarWorkflowStage, 
  CalendarWorkflowStep,
  PreMeetingContext,
  ParticipantAnalysis,
  HistoricalMeetingContext,
  TopicPrediction,
  RiskAssessment,
  PreparationRecommendation
} from "../interfaces/calendar-workflow-state.interface";

@Injectable()
export class PreMeetingContextAgent extends BaseAgent {
  protected readonly ragService: RagService;

  constructor(
    llmService: LlmService,
    @Inject(RAG_SERVICE) ragService: RagService,
  ) {
    super(llmService, {
      name: "PreMeetingContextAgent",
      systemPrompt: `You are an advanced pre-meeting context analysis agent. Your role is to:

1. Analyze upcoming meetings and gather comprehensive context
2. Study participant histories and interaction patterns  
3. Identify relevant previous meetings and their outcomes
4. Predict likely discussion topics based on patterns and context
5. Assess potential risks and challenges for the meeting
6. Generate actionable preparation recommendations

You have access to:
- Historical meeting data and outcomes via RAG
- Participant interaction patterns and behavior analysis
- Previous meeting summaries and action items
- Calendar scheduling patterns and trends
- Topic and decision history across the organization

Your analysis should be:
- Comprehensive yet focused on actionable insights
- Data-driven using historical patterns and outcomes
- Risk-aware with practical mitigation strategies
- Participant-centric with personalized recommendations
- Context-rich leveraging organizational knowledge

Always provide practical, actionable insights that help participants prepare effectively and ensure meeting success.

Respond with valid JSON following the specified interface structures.`,
      llmOptions: {
        temperature: 0.3,
        model: "gpt-4o",
        maxTokens: 8000,
      },
    });
    this.ragService = ragService;
  }

  /**
   * Process calendar workflow state to gather comprehensive pre-meeting context
   */
  async processState(state: CalendarWorkflowState): Promise<CalendarWorkflowState> {
    this.logger.log(`Gathering pre-meeting context for session: ${state.sessionId}`);

    const startTime = Date.now();

    try {
      // Validate input
      if (!state.calendarEvent) {
        throw new Error("No calendar event provided for context gathering");
      }

      // Step 1: Gather participant analysis
      const participantAnalysis = await this.analyzeParticipants(
        state.calendarEvent.attendees || [],
        state.calendarEvent.organizer,
        state.userId
      );

      // Step 2: Retrieve historical meeting context
      const historicalContext = await this.gatherHistoricalContext(
        state.calendarEvent,
        participantAnalysis
      );

      // Step 3: Generate topic predictions
      const topicPredictions = await this.predictMeetingTopics(
        state.calendarEvent,
        historicalContext,
        participantAnalysis
      );

      // Step 4: Assess meeting risks
      const riskAssessment = await this.assessMeetingRisks(
        state.calendarEvent,
        participantAnalysis,
        historicalContext,
        topicPredictions
      );

      // Step 5: Generate preparation recommendations
      const preparationRecommendations = await this.generatePreparationRecommendations(
        state.calendarEvent,
        participantAnalysis,
        topicPredictions,
        riskAssessment
      );

      // Step 6: Calculate confidence score
      const confidence = this.calculateContextConfidence(
        participantAnalysis,
        historicalContext,
        topicPredictions
      );

      // Create comprehensive pre-meeting context
      const preContext: PreMeetingContext = {
        contextId: `context-${state.sessionId}-${Date.now()}`,
        meetingId: state.eventId,
        participantAnalysis,
        historicalContext,
        topicPredictions,
        riskAssessment,
        preparationRecommendations,
        confidence
      };

      // Update processing metadata
      const processingTime = Date.now() - startTime;
      const updatedState: CalendarWorkflowState = {
        ...state,
        preContext,
        stage: CalendarWorkflowStage.BRIEF_GENERATION,
        currentStep: CalendarWorkflowStep.GENERATE_BRIEF,
        progress: 30,
        processingMetadata: {
          ...state.processingMetadata,
          agentsUsed: [...state.processingMetadata.agentsUsed, this.name],
          ragEnhanced: true,
          performanceMetrics: {
            ...state.processingMetadata.performanceMetrics,
            preContextGenerationTimeMs: processingTime,
            participantAnalysisCount: participantAnalysis.length,
            historicalMeetingsAnalyzed: historicalContext.length,
            topicPredictionsGenerated: topicPredictions.length,
            contextConfidence: confidence
          }
        }
      };

      this.logger.log(
        `Pre-meeting context generated successfully for ${state.eventId} in ${processingTime}ms`
      );

      return updatedState;
    } catch (error) {
      this.logger.error(`Error gathering pre-meeting context: ${error.message}`);
      
      return {
        ...state,
        stage: CalendarWorkflowStage.ERROR,
        currentStep: CalendarWorkflowStep.END,
        error: `Pre-meeting context generation failed: ${error.message}`,
        processingMetadata: {
          ...state.processingMetadata,
          agentsUsed: [...state.processingMetadata.agentsUsed, this.name],
          performanceMetrics: {
            ...state.processingMetadata.performanceMetrics,
            preContextGenerationTimeMs: Date.now() - startTime,
            contextGenerationError: 1
          }
        }
      };
    }
  }

  /**
   * Analyze meeting participants for behavior patterns and expertise
   */
  private async analyzeParticipants(
    attendees: any[],
    organizer: any,
    userId: string
  ): Promise<ParticipantAnalysis[]> {
    this.logger.log(`Analyzing ${attendees.length} meeting participants`);

    const participantAnalyses: ParticipantAnalysis[] = [];

    // Include organizer in analysis if not already in attendees
    const allParticipants = [...attendees];
    if (!attendees.find(a => a.email === organizer.email)) {
      allParticipants.push({ ...organizer, responseStatus: 'accepted', organizer: true });
    }

    for (const participant of allParticipants) {
      try {
        const analysis = await this.analyzeIndividualParticipant(participant, userId);
        participantAnalyses.push(analysis);
      } catch (error) {
        this.logger.warn(`Error analyzing participant ${participant.email}: ${error.message}`);
        // Create minimal analysis for failed participants
        participantAnalyses.push(this.createMinimalParticipantAnalysis(participant));
      }
    }

    return participantAnalyses;
  }

  /**
   * Analyze individual participant patterns and history
   */
  private async analyzeIndividualParticipant(
    participant: any,
    userId: string
  ): Promise<ParticipantAnalysis> {
    this.logger.log(`Analyzing participant: ${participant.email}`);

    // Query RAG for participant history
    const participantQuery = `Meeting history and patterns for ${participant.email}`;
    const ragResults = await this.ragService.getContext(participantQuery, {
      indexName: "calendar-workflow",
      namespace: "participants",
      topK: 15,
      minScore: 0.4,
      filter: { participantEmail: participant.email }
    });

    // Generate participant analysis using LLM
    const prompt = this.buildParticipantAnalysisPrompt(participant, ragResults);
    const response = await this.processMessage(prompt);
    const analysisData = this.parseParticipantAnalysis(response);

    return {
      email: participant.email,
      displayName: participant.displayName || participant.email.split('@')[0],
      role: participant.organizer ? 'organizer' : 
            participant.optional ? 'optional' : 'attendee',
      meetingHistory: analysisData.meetingHistory || [],
      behaviorPatterns: analysisData.behaviorPatterns || [],
      expertiseAreas: analysisData.expertiseAreas || [],
      preferredMeetingStyles: analysisData.preferredMeetingStyles || [],
      preparednessScore: analysisData.preparednessScore || 0.5
    };
  }

  /**
   * Gather historical meeting context using RAG
   */
  private async gatherHistoricalContext(
    calendarEvent: any,
    participantAnalysis: ParticipantAnalysis[]
  ): Promise<HistoricalMeetingContext[]> {
    this.logger.log(`Gathering historical context for meeting: ${calendarEvent.title}`);

    const participantEmails = participantAnalysis.map(p => p.email);
    
    // Build contextual query
    const contextQuery = `
      Meeting history and context for: "${calendarEvent.title}"
      Participants: ${participantEmails.join(', ')}
      Description: ${calendarEvent.description || ''}
    `;

    // Query RAG for relevant historical meetings
    const ragResults = await this.ragService.getContext(contextQuery, {
      indexName: "calendar-workflow", 
      namespace: "meetings",
      topK: 20,
      minScore: 0.3,
      filter: {
        participants: { $in: participantEmails }
      }
    });

    // Process and rank historical meetings
    const historicalMeetings: HistoricalMeetingContext[] = [];
    
    for (const doc of ragResults) {
      try {
        const meetingContext = this.extractHistoricalMeetingFromRAG(doc, participantEmails);
        if (meetingContext && meetingContext.relevanceScore >= 0.3) {
          historicalMeetings.push(meetingContext);
        }
      } catch (error) {
        this.logger.warn(`Error processing historical meeting: ${error.message}`);
      }
    }

    // Sort by relevance score and limit results
    return historicalMeetings
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10);
  }

  /**
   * Predict likely meeting topics using context and patterns
   */
  private async predictMeetingTopics(
    calendarEvent: any,
    historicalContext: HistoricalMeetingContext[],
    participantAnalysis: ParticipantAnalysis[]
  ): Promise<TopicPrediction[]> {
    this.logger.log(`Predicting topics for meeting: ${calendarEvent.title}`);

    const prompt = this.buildTopicPredictionPrompt(
      calendarEvent,
      historicalContext,
      participantAnalysis
    );

    const response = await this.processMessage(prompt);
    const predictions = this.parseTopicPredictions(response);

    return predictions.filter(p => p.confidence >= 0.3).slice(0, 8);
  }

  /**
   * Assess potential meeting risks and challenges
   */
  private async assessMeetingRisks(
    calendarEvent: any,
    participantAnalysis: ParticipantAnalysis[],
    historicalContext: HistoricalMeetingContext[],
    topicPredictions: TopicPrediction[]
  ): Promise<RiskAssessment> {
    this.logger.log(`Assessing risks for meeting: ${calendarEvent.title}`);

    const prompt = this.buildRiskAssessmentPrompt(
      calendarEvent,
      participantAnalysis,
      historicalContext,
      topicPredictions
    );

    const response = await this.processMessage(prompt);
    return this.parseRiskAssessment(response);
  }

  /**
   * Generate actionable preparation recommendations
   */
  private async generatePreparationRecommendations(
    calendarEvent: any,
    participantAnalysis: ParticipantAnalysis[],
    topicPredictions: TopicPrediction[],
    riskAssessment: RiskAssessment
  ): Promise<PreparationRecommendation[]> {
    this.logger.log(`Generating preparation recommendations for: ${calendarEvent.title}`);

    const prompt = this.buildPreparationRecommendationsPrompt(
      calendarEvent,
      participantAnalysis,
      topicPredictions,
      riskAssessment
    );

    const response = await this.processMessage(prompt);
    const recommendations = this.parsePreparationRecommendations(response);

    return recommendations.slice(0, 10); // Limit to top 10 recommendations
  }

  // Prompt building methods
  private buildParticipantAnalysisPrompt(participant: any, ragResults: any[]): string {
    return `Analyze this meeting participant's patterns and behavior:

PARTICIPANT: ${participant.email} (${participant.displayName || 'Unknown'})
ROLE: ${participant.organizer ? 'Organizer' : participant.optional ? 'Optional' : 'Attendee'}

HISTORICAL DATA FROM RAG:
${ragResults.map(doc => `
Meeting: ${doc.metadata?.title || 'Unknown'}
Date: ${doc.metadata?.date || 'Unknown'}  
Role: ${doc.metadata?.role || 'Unknown'}
Participation: ${doc.metadata?.participation || 'Unknown'}
Content: ${doc.content?.substring(0, 200)}...
`).join('\n')}

Please analyze and return JSON with:
- meetingHistory: Array of recent meetings with titles, dates, roles, and outcomes
- behaviorPatterns: Array of observed patterns with frequency and context
- expertiseAreas: Array of areas where this participant demonstrates expertise
- preferredMeetingStyles: Array of meeting styles this participant prefers
- preparednessScore: Number between 0-1 indicating typical preparation level

Focus on actionable insights for meeting preparation and management.`;
  }

  private buildTopicPredictionPrompt(
    calendarEvent: any,
    historicalContext: HistoricalMeetingContext[],
    participantAnalysis: ParticipantAnalysis[]
  ): string {
    const duration = Math.round(
      (new Date(calendarEvent.endTime).getTime() - 
       new Date(calendarEvent.startTime).getTime()) / (1000 * 60)
    );

    return `Predict likely discussion topics for this upcoming meeting:

MEETING DETAILS:
Title: ${calendarEvent.title}
Description: ${calendarEvent.description || 'No description'}
Duration: ${duration} minutes
Participants: ${participantAnalysis.map(p => p.email).join(', ')}

HISTORICAL CONTEXT:
${historicalContext.slice(0, 5).map(h => `
Meeting: ${h.title} (${h.date})
Shared Participants: ${h.sharedParticipants.join(', ')}
Topics: ${h.sharedTopics.join(', ')}
Outcomes: ${h.outcomes.join(', ')}
`).join('\n')}

PARTICIPANT EXPERTISE:
${participantAnalysis.map(p => `
${p.email}: ${p.expertiseAreas.join(', ')}
`).join('\n')}

Generate 3-8 topic predictions with:
- topic: Clear topic description
- confidence: Score 0-1 based on evidence
- reasoning: Why this topic is likely to be discussed
- expectedDuration: Estimated minutes for this topic
- requiredPreparation: What participants should prepare
- potentialChallenges: Anticipated discussion challenges

Return JSON array of TopicPrediction objects.`;
  }

  private buildRiskAssessmentPrompt(
    calendarEvent: any,
    participantAnalysis: ParticipantAnalysis[],
    historicalContext: HistoricalMeetingContext[],
    topicPredictions: TopicPrediction[]
  ): string {
    return `Assess potential risks and challenges for this meeting:

MEETING: ${calendarEvent.title}
DURATION: ${Math.round((new Date(calendarEvent.endTime).getTime() - new Date(calendarEvent.startTime).getTime()) / (1000 * 60))} minutes
PARTICIPANTS: ${participantAnalysis.length} people

PARTICIPANT DYNAMICS:
${participantAnalysis.map(p => `
${p.email}: Role=${p.role}, Preparedness=${p.preparednessScore}, Patterns=${p.behaviorPatterns.length}
`).join('\n')}

PREDICTED TOPICS:
${topicPredictions.map(t => `- ${t.topic} (confidence: ${t.confidence})`).join('\n')}

HISTORICAL PATTERNS:
${historicalContext.slice(0, 3).map(h => `
${h.title}: Lessons=${h.lessonsLearned.join('; ')}
`).join('\n')}

Assess risks in these categories:
- Scheduling/Logistics risks
- Participant preparation risks  
- Communication/Conflict risks
- Decision-making risks
- Technical/Process risks

Return JSON with:
- overallRisk: "low", "medium", or "high"
- identifiedRisks: Array of risks with type, description, impact, probability, mitigation
- mitigationStrategies: Array of strategies with riskType, strategy, implementationTime, effectiveness`;
  }

  private buildPreparationRecommendationsPrompt(
    calendarEvent: any,
    participantAnalysis: ParticipantAnalysis[],
    topicPredictions: TopicPrediction[],
    riskAssessment: RiskAssessment
  ): string {
    return `Generate actionable preparation recommendations for this meeting:

MEETING: ${calendarEvent.title}
ORGANIZER: ${calendarEvent.organizer?.email}

PARTICIPANTS (${participantAnalysis.length}):
${participantAnalysis.map(p => `- ${p.email} (${p.role}, prep score: ${p.preparednessScore})`).join('\n')}

PREDICTED TOPICS:
${topicPredictions.map(t => `- ${t.topic} (${t.expectedDuration}min)`).join('\n')}

IDENTIFIED RISKS:
${riskAssessment.identifiedRisks.map(r => `- ${r.type}: ${r.description}`).join('\n')}

Generate recommendations for:
1. Agenda optimization and structure
2. Materials and documents to prepare  
3. Logistics and technical setup
4. Participant-specific preparation

Each recommendation should include:
- type: "agenda", "materials", "logistics", or "participants"
- priority: "high", "medium", or "low"
- recommendation: Clear actionable guidance
- timeRequired: Estimated minutes to implement
- responsibility: Who should implement this

Return JSON array of PreparationRecommendation objects.`;
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

  private parseRiskAssessment(response: string): RiskAssessment {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        overallRisk: parsed.overallRisk || "medium",
        identifiedRisks: parsed.identifiedRisks || [],
        mitigationStrategies: parsed.mitigationStrategies || []
      };
    } catch (error) {
      this.logger.warn(`Error parsing risk assessment: ${error.message}`);
      return {
        overallRisk: "medium",
        identifiedRisks: [],
        mitigationStrategies: []
      };
    }
  }

  private parsePreparationRecommendations(response: string): PreparationRecommendation[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      const parsed = JSON.parse(jsonMatch[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      this.logger.warn(`Error parsing preparation recommendations: ${error.message}`);
      return [];
    }
  }

  // Utility methods
  private extractHistoricalMeetingFromRAG(doc: any, participantEmails: string[]): HistoricalMeetingContext | null {
    try {
      const sharedParticipants = doc.metadata?.participants?.filter((p: string) => 
        participantEmails.includes(p)
      ) || [];

      return {
        meetingId: doc.id,
        title: doc.metadata?.title || "Unknown Meeting",
        date: doc.metadata?.date || new Date().toISOString(),
        relevanceScore: doc.score || 0.5,
        sharedParticipants,
        sharedTopics: doc.metadata?.topics || [],
        outcomes: doc.metadata?.outcomes || [],
        lessonsLearned: doc.metadata?.lessonsLearned || []
      };
    } catch (error) {
      this.logger.warn(`Error extracting historical meeting: ${error.message}`);
      return null;
    }
  }

  private createMinimalParticipantAnalysis(participant: any): ParticipantAnalysis {
    return {
      email: participant.email,
      displayName: participant.displayName || participant.email.split('@')[0],
      role: participant.organizer ? 'organizer' : 
            participant.optional ? 'optional' : 'attendee',
      meetingHistory: [],
      behaviorPatterns: [],
      expertiseAreas: [],
      preferredMeetingStyles: [],
      preparednessScore: 0.5
    };
  }

  private calculateContextConfidence(
    participantAnalysis: ParticipantAnalysis[],
    historicalContext: HistoricalMeetingContext[],
    topicPredictions: TopicPrediction[]
  ): number {
    let confidence = 0.3; // Base confidence

    // Add confidence based on data quality
    if (participantAnalysis.length > 0) confidence += 0.2;
    if (historicalContext.length > 0) confidence += 0.2;
    if (topicPredictions.length > 0) confidence += 0.1;

    // Add confidence based on data richness
    const avgHistoricalRelevance = historicalContext.length > 0 
      ? historicalContext.reduce((sum, h) => sum + h.relevanceScore, 0) / historicalContext.length
      : 0;
    confidence += avgHistoricalRelevance * 0.2;

    return Math.min(confidence, 1.0);
  }
} 