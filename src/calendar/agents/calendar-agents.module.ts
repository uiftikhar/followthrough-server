import { Module } from "@nestjs/common";
import { SharedCoreModule } from "../../shared/shared-core.module";

// Calendar-Specific Agents
import { MeetingContextAgent } from "./meeting-context.agent";
import { MeetingBriefAgent } from "./meeting-brief.agent";
import { FollowUpOrchestrationAgent } from "./follow-up-orchestration.agent";
import { CalendarAgentFactory } from "./calendar-agent.factory";

/**
 * CalendarAgentsModule
 *
 * Contains all agents specifically used for calendar workflows:
 * - Pre-meeting intelligence (context and brief generation)
 * - Post-meeting orchestration (follow-up coordination)
 *
 * This module is self-contained and has no circular dependencies.
 */
@Module({
  imports: [
    SharedCoreModule, // For LLM services, RAG services, and base infrastructure
  ],
  providers: [
    // Calendar workflow agents
    MeetingContextAgent,
    MeetingBriefAgent,
    FollowUpOrchestrationAgent,
    // Calendar agent factory
    CalendarAgentFactory,
  ],
  exports: [
    // Export all calendar agents
    MeetingContextAgent,
    MeetingBriefAgent,
    FollowUpOrchestrationAgent,
    // Export factory for easy access
    CalendarAgentFactory,
  ],
})
export class CalendarAgentsModule {}
