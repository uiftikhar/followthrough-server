import { Injectable, Logger } from "@nestjs/common";
import { BaseAgent, AgentConfig } from "./base-agent";
import { LlmService } from "../llm/llm.service";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export const MASTER_SUPERVISOR_PROMPT = `You are the Master Supervisor, responsible for routing incoming requests to the appropriate specialized team.
Your job is to analyze the input and determine which team should handle it based on its type and content.
Available teams:
1. Meeting Analysis Team - For processing meeting transcripts, extracting insights, and generating summaries
2. Email Triage Team - For processing incoming emails, classifying them, and generating appropriate responses
3. Calendar Workflow Team - For calendar synchronization, meeting preparation, and meeting brief generation

Make your routing decisions based solely on the content and metadata of the input. Be precise and consistent.`;

export interface RoutingDecision {
  team: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

@Injectable()
export class MasterSupervisorAgent extends BaseAgent {
  protected readonly logger = new Logger(MasterSupervisorAgent.name);

  constructor(protected readonly llmService: LlmService) {
    const config: AgentConfig = {
      name: "MasterSupervisorAgent",
      systemPrompt: MASTER_SUPERVISOR_PROMPT,
      llmOptions: {
        temperature: 0.1,
        model: "gpt-4o",
      },
    };
    super(llmService, config);
  }

  async determineTeam(input: any): Promise<RoutingDecision> {
    const model = this.getChatModel();
    const inputDescription = this.formatInputForDecision(input);

    const messages = [
      new SystemMessage(MASTER_SUPERVISOR_PROMPT),
      new HumanMessage(`
      Analyze this input and determine which team should handle it.
      
      Input:
      ${inputDescription}
      
      Return a JSON object with:
      - team: The team that should handle this input (meeting_analysis, email_triage, calendar_workflow, or unknown)
      - reason: A brief explanation of why you chose this team
      - priority: The priority level for this request (high, medium, or low)
      `),
    ];

    const response = await model.invoke(messages);

    try {
      // Extract JSON decision from response
      const content = response.content.toString();
      const jsonMatch =
        content.match(/```json\n([\s\S]*?)\n```/) ||
        content.match(/```\n([\s\S]*?)\n```/) ||
        content.match(/(\{[\s\S]*\})/);

      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      return JSON.parse(jsonStr) as RoutingDecision;
    } catch (error) {
      this.logger.error(`Failed to parse routing decision: ${error.message}`);

      // Fallback decision
      return {
        team: this.determineTeamHeuristically(input),
        reason: "Fallback decision due to parsing error",
        priority: "medium",
      };
    }
  }

  private formatInputForDecision(input: any): string {
    // Handle case where input might be undefined
    if (!input) {
      return `
        Type: Unknown
        Content: Input is undefined or null
      `;
    }

    // Format input for LLM decision making
    if (input.type === "email") {
      return `
        Type: Email
        From: ${input.from || "Unknown"}
        Subject: ${input.subject || "No subject"}
        Body snippet: ${(input.body || "").substring(0, 200)}...
        Metadata: ${JSON.stringify(input.metadata || {})}
      `;
    } else if (input.type === "meeting_transcript") {
      return `
        Type: Meeting Transcript
        Length: ${input.transcript ? input.transcript.length : "Unknown"} characters
        Participants: ${input.participants?.join(", ") || "Unknown"}
        Metadata: ${JSON.stringify(input.metadata || {})}
      `;
    } else if (input.type === "calendar_sync" || input.type === "meeting_brief" || input.type === "meeting_prep" || input.action === "sync" || input.calendarEvent || input.eventId) {
      return `
        Type: Calendar Workflow
        Action: ${input.type || input.action || "Unknown"}
        Event ID: ${input.eventId || "None"}
        User ID: ${input.userId || "Unknown"}
        Metadata: ${JSON.stringify(input.metadata || {})}
      `;
    } else {
      return `
        Type: Unknown
        Content: ${JSON.stringify(input).substring(0, 300)}...
      `;
    }
  }

  private determineTeamHeuristically(input: any): string {
    // Handle case where input might be undefined
    if (!input) {
      return "unknown";
    }

    if (input.type === "email" || input.subject || input.from) {
      return "email_triage";
    } else if (input.type === "meeting_transcript" || input.transcript) {
      return "meeting_analysis";
    } else if (input.type === "calendar_sync" || input.type === "meeting_brief" || input.type === "meeting_prep" || input.action === "sync" || input.calendarEvent || input.eventId) {
      return "calendar_workflow";
    }
    return "unknown";
  }
}
