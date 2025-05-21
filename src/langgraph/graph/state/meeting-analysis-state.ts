import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import { Topic } from '../../agents/topic-extraction.agent';
import { ActionItem } from '../../agents/action-item.agent';
import { SentimentAnalysis } from '../../agents/sentiment-analysis.agent';
import { ParticipationAnalysis } from '../../agents/participation.agent';
import { MeetingSummary } from '../../agents/summary.agent';
import {
  EnrichedContext,
  RetrievedContext,
} from '../../agents/context-integration.agent';

/**
 * Meeting analysis state definition using LangGraph Annotations API
 */
export const MeetingAnalysisState = Annotation.Root({
  // Messages for communication between nodes
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),

  // Raw meeting transcript
  transcript: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),

  // Analysis results
  topics: Annotation<Topic[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),

  actionItems: Annotation<ActionItem[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),

  sentiment: Annotation<SentimentAnalysis | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  participation: Annotation<ParticipationAnalysis | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  retrievedContext: Annotation<RetrievedContext[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),

  enrichedContext: Annotation<EnrichedContext | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  summary: Annotation<MeetingSummary | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  // Workflow state
  currentPhase: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => 'initialization',
  }),

  // Execution tracking
  completed_steps: Annotation<string[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),

  in_progress_steps: Annotation<string[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),

  remaining_steps: Annotation<string[]>({
    reducer: (x, y) => y ?? x, // Complete replacement
    default: () => [
      'topic_extraction',
      'action_item_extraction',
      'sentiment_analysis',
      'participation_analysis',
      'context_integration',
      'summary_generation',
    ],
  }),

  errors: Annotation<{ step: string; error: string; timestamp: string }[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),

  // Routing
  next_step: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => 'topic_extraction',
  }),

  // Metadata
  metadata: Annotation<Record<string, any>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
});

// Type for the state that will be passed through the graph
export type MeetingAnalysisStateType = typeof MeetingAnalysisState.State;

/**
 * Create default initial state for meeting analysis
 */
export function createInitialState(
  transcript: string,
): MeetingAnalysisStateType {
  return {
    transcript,
    messages: [],
    topics: [],
    actionItems: [],
    sentiment: null,
    participation: null,
    retrievedContext: [],
    enrichedContext: null,
    summary: null,
    currentPhase: 'initialization',
    completed_steps: [],
    in_progress_steps: [],
    remaining_steps: [
      'topic_extraction',
      'action_item_extraction',
      'sentiment_analysis',
      'participation_analysis',
      'context_integration',
      'summary_generation',
    ],
    errors: [],
    next_step: 'topic_extraction',
    metadata: {},
  };
}
