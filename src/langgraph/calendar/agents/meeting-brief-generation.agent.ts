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
  TopicPrediction
} from "../interfaces/calendar-workflow-state.interface";
import { MeetingBrief } from "../../../calendar/interfaces/meeting-brief.interface";

@Injectable()
export class MeetingBriefGenerationAgent extends BaseAgent {
  protected readonly ragService: RagService;

  constructor(
    llmService: LlmService,
    @Inject(RAG_SERVICE) ragService: RagService,
  ) {
    super(llmService, {
      name: "MeetingBriefGenerationAgent",
      systemPrompt: `You are an advanced meeting brief generation agent responsible for creating comprehensive, actionable meeting briefs using pre-meeting context analysis.`,
      llmOptions: {
        temperature: 0.2,
        model: "gpt-4o", 
        maxTokens: 12000,
      },
    });
    this.ragService = ragService;
  }

  /**
   * Process calendar workflow state to generate comprehensive meeting briefs
   */
  async processState(state: CalendarWorkflowState): Promise<CalendarWorkflowState> {
    this.logger.log(`Generating meeting brief for session: ${state.sessionId}`);

    const startTime = Date.now();

    try {
      // Validate input
      if (!state.preContext) {
        throw new Error("No pre-meeting context available for brief generation");
      }

      if (!state.calendarEvent) {
        throw new Error("No calendar event provided for brief generation");
      }

      // Generate main meeting brief
      const mainBrief = await this.generateMainMeetingBrief(
        state.calendarEvent,
        state.preContext
      );

      // Create meeting brief object using existing interface
      const meetingBrief: MeetingBrief = {
        meetingId: state.eventId,
        briefId: `brief-${state.sessionId}-${Date.now()}`,
        meetingDetails: {
          title: state.calendarEvent.title,
          startTime: state.calendarEvent.startTime,
          endTime: state.calendarEvent.endTime,
          organizer: state.calendarEvent.organizer?.email || "",
          participants: state.preContext.participantAnalysis.map(p => p.email),
          description: state.calendarEvent.description
        },
        executiveSummary: {
          purpose: mainBrief.summary,
          keyOutcomes: mainBrief.successCriteria,
          preparation: "Review pre-meeting materials",
          duration: Math.round((new Date(state.calendarEvent.endTime).getTime() - new Date(state.calendarEvent.startTime).getTime()) / (1000 * 60)),
          complexity: "medium"
        },
        objectives: {
          primary: mainBrief.title,
          secondary: mainBrief.keyDecisions,
          successMetrics: [],
          expectedDecisions: mainBrief.keyDecisions,
          potentialRisks: []
        },
        enhancedAgenda: mainBrief.agenda || [],
        participantPreparations: [],
        timeManagement: {
          totalDuration: Math.round((new Date(state.calendarEvent.endTime).getTime() - new Date(state.calendarEvent.startTime).getTime()) / (1000 * 60)),
          suggestedSchedule: [],
          criticalTimings: []
        },
        contextualInsights: {
          relevantHistory: [],
          ongoingProjects: [],
          stakeholderInterests: [],
          decisionDependencies: []
        },
        recommendations: [],
        deliveryOptions: {
          email: {
            subject: `Meeting Brief: ${state.calendarEvent.title}`,
            body: mainBrief.summary
          },
          slack: {
            message: mainBrief.summary
          },
          calendar: {
            description: mainBrief.summary,
            agendaUpdate: mainBrief.title
          }
        },
        generationMetadata: {
          generatedAt: new Date().toISOString(),
          baseContext: {
            previousMeetings: state.preContext.historicalContext.length,
            participantHistories: state.preContext.participantAnalysis.length,
            topicPredictions: state.preContext.topicPredictions.length
          },
          confidence: 0.8,
          ragEnhanced: true,
          customizations: []
        }
      };

      // Update processing metadata
      const processingTime = Date.now() - startTime;
      const updatedState: CalendarWorkflowState = {
        ...state,
        meetingBrief,
        stage: CalendarWorkflowStage.BRIEF_DELIVERY,
        currentStep: CalendarWorkflowStep.DELIVER_BRIEF,
        progress: 60,
        processingMetadata: {
          ...state.processingMetadata,
          agentsUsed: [...state.processingMetadata.agentsUsed, this.name],
          performanceMetrics: {
            ...state.processingMetadata.performanceMetrics,
            briefGenerationTimeMs: processingTime,
            briefConfidence: 0.8
          }
        }
      };

      this.logger.log(
        `Meeting brief generated successfully for ${state.eventId} in ${processingTime}ms`
      );

      return updatedState;
    } catch (error) {
      this.logger.error(`Error generating meeting brief: ${error.message}`);
      
      return {
        ...state,
        stage: CalendarWorkflowStage.ERROR,
        currentStep: CalendarWorkflowStep.END,
        error: `Meeting brief generation failed: ${error.message}`,
        processingMetadata: {
          ...state.processingMetadata,
          agentsUsed: [...state.processingMetadata.agentsUsed, this.name],
          performanceMetrics: {
            ...state.processingMetadata.performanceMetrics,
            briefGenerationTimeMs: Date.now() - startTime,
            briefGenerationError: 1
          }
        }
      };
    }
  }

  /**
   * Generate the main meeting brief structure
   */
  private async generateMainMeetingBrief(
    calendarEvent: any,
    preContext: PreMeetingContext
  ): Promise<{
    title: string;
    summary: string;
    objectives: any[];
    agenda: any[];
    sections: any[];
    keyDecisions: string[];
    successCriteria: string[];
  }> {
    this.logger.log(`Generating main brief for: ${calendarEvent.title}`);

    const prompt = `Generate a meeting brief for:
Title: ${calendarEvent.title}
Description: ${calendarEvent.description || 'No description'}
Participants: ${preContext.participantAnalysis.length}
Topics: ${preContext.topicPredictions.map(t => t.topic).join(', ')}

Return JSON with title, summary, objectives array, agenda array, sections array, keyDecisions array, successCriteria array.`;

    const response = await this.processMessage(prompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      
      return {
        title: parsed.title || `Meeting Brief: ${calendarEvent.title}`,
        summary: parsed.summary || `Meeting to discuss ${calendarEvent.title}`,
        objectives: parsed.objectives || [],
        agenda: parsed.agenda || [],
        sections: parsed.sections || [],
        keyDecisions: parsed.keyDecisions || [],
        successCriteria: parsed.successCriteria || []
      };
    } catch (error) {
      this.logger.warn(`Error parsing brief response: ${error.message}`);
      return {
        title: `Meeting Brief: ${calendarEvent.title}`,
        summary: `Meeting to discuss ${calendarEvent.title}`,
        objectives: [],
        agenda: [],
        sections: [],
        keyDecisions: [],
        successCriteria: []
      };
    }
  }
} 