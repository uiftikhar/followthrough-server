import { Injectable } from '@nestjs/common';
import { MeetingContextAgent } from './meeting-context.agent';
import { MeetingBriefAgent } from './meeting-brief.agent';
import { FollowUpOrchestrationAgent } from './follow-up-orchestration.agent';

/**
 * CalendarAgentFactory
 * 
 * Factory for calendar workflow specific agents.
 * This provides access to calendar domain agents without circular dependencies.
 */
@Injectable()
export class CalendarAgentFactory {
  constructor(
    private readonly meetingContextAgent: MeetingContextAgent,
    private readonly meetingBriefAgent: MeetingBriefAgent,
    private readonly followUpOrchestrationAgent: FollowUpOrchestrationAgent,
  ) {}

  /**
   * Get the meeting context agent
   */
  getMeetingContextAgent(): MeetingContextAgent {
    return this.meetingContextAgent;
  }

  /**
   * Get the meeting brief agent
   */
  getMeetingBriefAgent(): MeetingBriefAgent {
    return this.meetingBriefAgent;
  }

  /**
   * Get the follow-up orchestration agent
   */
  getFollowUpOrchestrationAgent(): FollowUpOrchestrationAgent {
    return this.followUpOrchestrationAgent;
  }

  /**
   * Get all calendar agents
   */
  getAllCalendarAgents(): Array<MeetingContextAgent | MeetingBriefAgent | FollowUpOrchestrationAgent> {
    return [
      this.meetingContextAgent,
      this.meetingBriefAgent,
      this.followUpOrchestrationAgent,
    ];
  }
} 