# Integrating RAG with Specialized Agents

This section covers how to integrate the RAG capabilities with our specialized agents in the meeting analysis workflow.

## 1. RAG-Enhanced Agent Base Class

First, let's create a base class for RAG-enhanced agents:

```typescript
// src/langgraph/agents/rag-enhanced-agent.ts
import { Logger } from '@nestjs/common';
import { BaseAgent } from './base-agent';
import { RagService } from '../../rag/rag.service';
import { RetrievalOptions } from '../../rag/retrieval.service';
import { LlmService } from '../../langgraph/llm/llm.service';
import { StateService } from '../../langgraph/state/state.service';
import { RetrievedContext } from '../../rag/rag.service';

export interface RagAgentOptions {
  retrievalOptions?: RetrievalOptions;
  includeRetrievedContext?: boolean;
  useAdaptiveRetrieval?: boolean;
}

/**
 * Base class for agents enhanced with RAG capabilities
 */
export abstract class RagEnhancedAgent<TInput = any, TOutput = any> extends BaseAgent<TInput, TOutput> {
  protected readonly logger = new Logger(this.constructor.name);
  private readonly defaultOptions: RagAgentOptions = {
    includeRetrievedContext: true,
    useAdaptiveRetrieval: true,
  };

  constructor(
    protected readonly llmService: LlmService,
    protected readonly stateService: StateService,
    protected readonly ragService: RagService,
    protected readonly options: RagAgentOptions = {},
  ) {
    super(llmService, stateService);
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Extract query from state to use for RAG retrieval
   */
  protected abstract extractQueryFromState(state: any): string;

  /**
   * Process retrieved context into a format suitable for the agent
   */
  protected formatRetrievedContext(context: RetrievedContext): string {
    if (!context || !context.documents || context.documents.length === 0) {
      return '';
    }

    const formattedDocs = context.documents
      .map((doc, index) => {
        return `Document ${index + 1}: ${doc.content}`;
      })
      .join('\n\n');

    return `
RELEVANT CONTEXT:
----------------
${formattedDocs}
----------------
`;
  }

  /**
   * Enhanced version of processInput that includes RAG context
   */
  async processInput(state: any): Promise<TOutput> {
    try {
      // Only proceed with RAG if configured
      if (!this.options.includeRetrievedContext) {
        return super.processInput(state);
      }

      // Check if we already have retrieved context in the state
      let retrievedContext = state.retrievedContext as RetrievedContext | undefined;

      // If no context or we need fresh context, retrieve it
      if (!retrievedContext) {
        const query = this.extractQueryFromState(state);
        
        if (query) {
          // Retrieve context
          const documents = await this.ragService.getContext(
            query,
            this.options.retrievalOptions,
          );
          
          retrievedContext = {
            query,
            documents,
            timestamp: new Date().toISOString(),
          };
        }
      }

      // Enhance the agent's processing with context
      if (retrievedContext && retrievedContext.documents.length > 0) {
        // Format the context for the agent
        const formattedContext = this.formatRetrievedContext(retrievedContext);
        
        // Enhance the agent's reasoning with this context
        return this.processWithContext(state, formattedContext);
      }

      // Fall back to standard processing if no context
      return super.processInput(state);
    } catch (error) {
      this.logger.error(`Error in RAG-enhanced agent: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process input with retrieved context
   */
  protected async processWithContext(state: any, context: string): Promise<TOutput> {
    // Default implementation - override in subclasses for specialized processing
    const systemMessage = `${this.getSystemPrompt()}\n\n${context}`;
    
    return this.process(state, systemMessage);
  }

  /**
   * Override getSystemPrompt to add instructions for using retrieved context
   */
  protected getSystemPrompt(): string {
    return `${super.getSystemPrompt()}\n\nYou will be provided with relevant context from previous meetings and documents. Use this context to inform your analysis, but focus on the current meeting transcript.`;
  }
}
```

## 2. Enhancing the Topic Extraction Agent

Let's enhance the Topic Extraction Agent with RAG capabilities:

```typescript
// src/langgraph/agents/topic-extraction.agent.ts
// Modify to extend RagEnhancedAgent instead of BaseAgent

import { Injectable } from '@nestjs/common';
import { RagEnhancedAgent } from './rag-enhanced-agent';
import { LlmService } from '../llm/llm.service';
import { StateService } from '../state/state.service';
import { RagService } from '../../rag/rag.service';
import { RetrievalOptions } from '../../rag/retrieval.service';

export interface Topic {
  name: string;
  description: string;
  relevance: number;
  subtopics?: string[];
}

@Injectable()
export class TopicExtractionAgent extends RagEnhancedAgent<
  { transcript: string },
  Topic[]
> {
  constructor(
    protected readonly llmService: LlmService,
    protected readonly stateService: StateService,
    protected readonly ragService: RagService,
  ) {
    super(llmService, stateService, ragService, {
      retrievalOptions: {
        indexName: 'meeting-analysis',
        namespace: 'topics',
        topK: 3,
        minScore: 0.7,
      },
      includeRetrievedContext: true,
    });
  }

  protected extractQueryFromState(state: any): string {
    return state.transcript || '';
  }

  protected getSystemPrompt(): string {
    return `
You are a topic extraction expert. Your task is to identify the main topics discussed in a meeting transcript.

For each topic, provide:
- A concise name
- A brief description
- A relevance score from 1-10
- Subtopics (if any)

${super.getSystemPrompt()}

Focus on high-level themes rather than specific details. Look for patterns in the conversation that indicate important discussion points.

Output should be a JSON array of topic objects with the following structure:
[{ "name": "string", "description": "string", "relevance": number, "subtopics": ["string"] }]
`;
  }

  protected formatRetrievedContext(context: any): string {
    if (!context || !context.documents || context.documents.length === 0) {
      return '';
    }

    // Special formatting for topic extraction - focus on finding related topics
    return `
TOPICS FROM PREVIOUS MEETINGS:
-----------------------------
${context.documents.map((doc, i) => {
  const meta = doc.metadata || {};
  return `Meeting ${i+1} (${meta.date || 'unknown date'}): ${doc.content}`;
}).join('\n\n')}
-----------------------------

Use the above topics from previous meetings as context, but identify the topics specific to the current transcript. If a topic continues from a previous meeting, note the continuity and evolution of the discussion.
`;
  }

  // The rest of the agent implementation remains the same...
}
```

## 3. Enhancing the Action Item Agent

```typescript
// src/langgraph/agents/action-item.agent.ts
// Modify to extend RagEnhancedAgent instead of BaseAgent

import { Injectable } from '@nestjs/common';
import { RagEnhancedAgent } from './rag-enhanced-agent';
import { LlmService } from '../llm/llm.service';
import { StateService } from '../state/state.service';
import { RagService } from '../../rag/rag.service';
import { Topic } from './topic-extraction.agent';

export interface ActionItem {
  description: string;
  assignee: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  relatedTopics: string[];
}

@Injectable()
export class ActionItemAgent extends RagEnhancedAgent<
  { transcript: string; topics: Topic[] },
  ActionItem[]
> {
  constructor(
    protected readonly llmService: LlmService,
    protected readonly stateService: StateService,
    protected readonly ragService: RagService,
  ) {
    super(llmService, stateService, ragService, {
      retrievalOptions: {
        indexName: 'meeting-analysis',
        namespace: 'action-items',
        topK: 5,
      },
      includeRetrievedContext: true,
    });
  }

  protected extractQueryFromState(state: any): string {
    // Create a more focused query for action item retrieval
    const transcript = state.transcript || '';
    const topics = state.topics || [];
    
    const topicNames = topics.map(t => t.name).join(', ');
    
    return `Action items related to: ${topicNames}\n\nMeeting transcript: ${transcript.substring(0, 500)}`;
  }

  protected getSystemPrompt(): string {
    return `
You are an action item extraction expert. Your task is to identify action items mentioned in a meeting transcript.

For each action item, provide:
- A clear description of what needs to be done
- The person assigned to the task
- Due date (if mentioned)
- Priority (low, medium, high)
- Status (pending by default)
- Related topics

${super.getSystemPrompt()}

Pay special attention to commitments, assignments, and next steps discussed in the meeting. Infer priorities based on the urgency expressed.

Output should be a JSON array of action item objects with the following structure:
[{ "description": "string", "assignee": "string", "dueDate": "string", "priority": "low|medium|high", "status": "pending", "relatedTopics": ["string"] }]
`;
  }

  protected formatRetrievedContext(context: any): string {
    if (!context || !context.documents || context.documents.length === 0) {
      return '';
    }

    // Special formatting for action items - focus on ongoing and past action items
    return `
PREVIOUS ACTION ITEMS:
--------------------
${context.documents.map((doc, i) => {
  const meta = doc.metadata || {};
  const status = meta.status || 'unknown';
  const assignee = meta.assignee || 'unassigned';
  return `Action Item ${i+1} (${status}, ${assignee}): ${doc.content}`;
}).join('\n')}
--------------------

Use the above action items from previous meetings as context. Check if any previous action items are being followed up on in this meeting. Also identify if any new action items are related to previous ones.
`;
  }

  // The rest of the agent implementation remains the same...
}
```

## 4. Updating the Graph Building Process

Now we need to update the graph building process to incorporate RAG:

```typescript
// src/langgraph/graph/graph.service.ts
// Add RagService to the constructor and integrate it

import { Injectable, Logger } from '@nestjs/common';
import { StateGraph } from '@langchain/langgraph';
import { StateService } from '../state/state.service';
import { AgentFactory } from '../agents/agent.factory';
import { RagService } from '../../rag/rag.service';
import { AdaptiveRagService } from '../../rag/adaptive-rag.service';
import { Topic } from '../agents/topic-extraction.agent';
import { ActionItem } from '../agents/action-item.agent';
import { SentimentAnalysis } from '../agents/sentiment-analysis.agent';
import { MeetingSummary } from '../agents/summary.agent';
import { 
  MeetingAnalysisState, 
  MeetingAnalysisStateType, 
  createInitialState 
} from './state/meeting-analysis-state';

@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);

  constructor(
    private readonly stateService: StateService,
    private readonly agentFactory: AgentFactory,
    private readonly ragService: RagService,
    private readonly adaptiveRagService: AdaptiveRagService,
  ) {}

  // Other methods...

  /**
   * Build a graph for meeting analysis with RAG integration
   */
  buildMeetingAnalysisGraph(): StateGraph<MeetingAnalysisStateType> {
    const topicAgent = this.agentFactory.createTopicExtractionAgent();
    const actionItemAgent = this.agentFactory.createActionItemAgent();
    const sentimentAgent = this.agentFactory.createSentimentAnalysisAgent();
    const summaryAgent = this.agentFactory.createSummaryAgent();

    // Create graph nodes
    const graph = new StateGraph<MeetingAnalysisStateType>({
      channels: this.stateService.createChannels({
        transcript: { value: '' as string },
        topics: { value: [] as Topic[] },
        actionItems: { value: [] as ActionItem[] },
        sentiment: { value: null as SentimentAnalysis | null },
        summary: { value: null as MeetingSummary | null },
        errors: { value: [] as Array<{ step: string; error: string, timestamp: string }> },
        retrievedContext: { 
          value: null as { 
            query: string; 
            documents: Array<{ id: string; content: string; metadata: any; score: number }>;
            timestamp: string;
          } | null 
        },
      }),
    });

    // Define nodes
    graph.addNode('topic_extraction', async (state) => {
      try {
        const topics = await topicAgent.processInput(state);
        return { topics };
      } catch (error) {
        this.logger.error(`Error in topic extraction: ${error.message}`);
        return {
          errors: [
            ...state.errors,
            { 
              step: 'topic_extraction', 
              error: error.message, 
              timestamp: new Date().toISOString() 
            },
          ],
        };
      }
    });

    graph.addNode('action_item_extraction', async (state) => {
      try {
        const actionItems = await actionItemAgent.processInput(state);
        return { actionItems };
      } catch (error) {
        this.logger.error(`Error in action item extraction: ${error.message}`);
        return {
          errors: [
            ...state.errors,
            { 
              step: 'action_item_extraction', 
              error: error.message, 
              timestamp: new Date().toISOString() 
            },
          ],
        };
      }
    });

    graph.addNode('sentiment_analysis', async (state) => {
      try {
        const sentiment = await sentimentAgent.processInput(state);
        return { sentiment };
      } catch (error) {
        this.logger.error(`Error in sentiment analysis: ${error.message}`);
        return {
          errors: [
            ...state.errors,
            { 
              step: 'sentiment_analysis', 
              error: error.message, 
              timestamp: new Date().toISOString() 
            },
          ],
        };
      }
    });

    graph.addNode('summary_generation', async (state) => {
      try {
        const summary = await summaryAgent.processInput(state);
        return { summary };
      } catch (error) {
        this.logger.error(`Error in summary generation: ${error.message}`);
        return {
          errors: [
            ...state.errors,
            { 
              step: 'summary_generation', 
              error: error.message, 
              timestamp: new Date().toISOString() 
            },
          ],
        };
      }
    });

    // Add the adaptive RAG node
    this.adaptiveRagService.addAdaptiveRagToGraph(graph, {
      indexName: 'meeting-analysis',
      namespace: 'transcripts',
    });

    // Define edges - with RAG first
    graph.addEdge('adaptive_rag', 'topic_extraction');
    graph.addEdge('topic_extraction', 'action_item_extraction');
    graph.addEdge('action_item_extraction', 'sentiment_analysis');
    graph.addEdge('sentiment_analysis', 'summary_generation');

    // Set the entry point
    graph.setEntryPoint('adaptive_rag');

    // Compile the graph
    return graph.compile();
  }
}
```

## 5. Updating the Meeting Analysis Service

```typescript
// src/langgraph/meeting-analysis/meeting-analysis.service.ts
// Update to include RAG processing capabilities

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { GraphService } from '../graph/graph.service';
import { StateService } from '../state/state.service';
import { WorkflowService, SessionInfo } from '../graph/workflow.service';
import { Topic } from '../agents/topic-extraction.agent';
import { ActionItem } from '../agents/action-item.agent';
import { SentimentAnalysis } from '../agents/sentiment-analysis.agent';
import { MeetingSummary } from '../agents/summary.agent';
import { DocumentProcessorService } from '../../embedding/document-processor.service';
import { RagService } from '../../rag/rag.service';
import { VectorIndexes } from '../../pinecone/pinecone-index.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class MeetingAnalysisService {
  private readonly logger = new Logger(MeetingAnalysisService.name);

  constructor(
    private readonly graphService: GraphService,
    private readonly stateService: StateService,
    private readonly workflowService: WorkflowService,
    private readonly documentProcessor: DocumentProcessorService,
    private readonly ragService: RagService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Analyze a meeting transcript
   */
  async analyzeTranscript(
    transcript: string,
    metadata: Record<string, any> = {},
  ): Promise<{
    sessionId: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
  }> {
    try {
      // Create a session
      const sessionId = uuidv4();
      const startTime = new Date();
      
      // Create initial session info
      await this.workflowService.createSession({
        id: sessionId,
        startTime,
        status: 'pending',
        metadata,
      });
      
      // Start analysis in background
      this.performAnalysis(sessionId, transcript, metadata).catch((error) => {
        this.logger.error(`Analysis failed: ${error.message}`, error.stack);
        this.workflowService.updateSession(sessionId, {
          status: 'failed',
          endTime: new Date(),
        });
      });
      
      return {
        sessionId,
        status: 'pending',
      };
    } catch (error) {
      this.logger.error(`Error starting analysis: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process transcript for RAG before analysis
   */
  private async processTranscriptForRag(
    sessionId: string,
    transcript: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    try {
      // Process and store transcript for RAG
      await this.documentProcessor.processAndStoreDocument(
        {
          id: `transcript-${sessionId}`,
          content: transcript,
          metadata: {
            ...metadata,
            sessionId,
            type: 'transcript',
            timestamp: new Date().toISOString(),
          },
        },
        {
          indexName: VectorIndexes.TRANSCRIPT_EMBEDDINGS,
          namespace: 'transcripts',
          chunkingOptions: {
            splitBy: 'paragraph',
            chunkSize: 3,
          },
        },
      );
      
      this.logger.log(`Processed transcript for RAG: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error processing transcript for RAG: ${error.message}`);
      // Continue with analysis even if RAG processing fails
    }
  }

  /**
   * Perform analysis in the background
   */
  private async performAnalysis(
    sessionId: string,
    transcript: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    try {
      // Update session status
      await this.workflowService.updateSession(sessionId, {
        status: 'in_progress',
      });
      
      // Process transcript for RAG
      await this.processTranscriptForRag(sessionId, transcript, metadata);
      
      // Emit progress event
      this.eventEmitter.emit('analysis.progress', {
        sessionId,
        phase: 'preparation',
        progress: 10,
        status: 'in_progress',
        message: 'Processed transcript for retrieval',
        timestamp: new Date().toISOString(),
      });
      
      // Create graph
      const graph = this.graphService.buildMeetingAnalysisGraph();
      
      // Run the workflow
      const result = await this.workflowService.runWorkflow(
        sessionId,
        graph,
        { transcript },
      );
      
      // Update session status
      await this.workflowService.updateSession(sessionId, {
        status: result.errors?.length ? 'failed' : 'completed',
        endTime: new Date(),
      });
      
      // Emit completion event
      this.eventEmitter.emit('analysis.completed', {
        sessionId,
        status: result.errors?.length ? 'failed' : 'completed',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Error in analysis: ${error.message}`);
      
      // Update session status
      await this.workflowService.updateSession(sessionId, {
        status: 'failed',
        endTime: new Date(),
      });
      
      // Emit error event
      this.eventEmitter.emit('analysis.error', {
        sessionId,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Other methods remain the same...
}
```

## 6. Update the Module Dependencies

Finally, update the Meeting Analysis Module to inject the new dependencies:

```typescript
// src/langgraph/meeting-analysis/meeting-analysis.module.ts
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MeetingAnalysisController } from './meeting-analysis.controller';
import { MeetingAnalysisService } from './meeting-analysis.service';
import { MeetingAnalysisGateway } from './meeting-analysis.gateway';
import { GraphModule } from '../graph/graph.module';
import { StateModule } from '../state/state.module';
import { AgentModule } from '../agents/agent.module';
import { SupervisorModule } from '../agents/supervisor/supervisor.module';
import { TeamModule } from '../agents/team/team.module';
import { RagModule } from '../../rag/rag.module';
import { EmbeddingModule } from '../../embedding/embedding.module';
import { PineconeModule } from '../../pinecone/pinecone.module';

@Module({
  imports: [
    GraphModule,
    StateModule,
    AgentModule,
    SupervisorModule,
    TeamModule,
    RagModule,
    EmbeddingModule,
    PineconeModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [MeetingAnalysisController],
  providers: [MeetingAnalysisService, MeetingAnalysisGateway],
  exports: [MeetingAnalysisService],
})
export class MeetingAnalysisModule {}
```

## 7. Update the LangGraph Module

Update the LangGraph Module to include the RAG and Embedding modules:

```typescript
// src/langgraph/langgraph.module.ts
import { Module } from '@nestjs/common';
import { LlmModule } from './llm/llm.module';
import { ToolModule } from './tools/tool.module';
import { StateModule } from './state/state.module';
import { AgentModule } from './agents/agent.module';
import { SupervisorModule } from './agents/supervisor/supervisor.module';
import { TeamModule } from './agents/team/team.module';
import { GraphModule } from './graph/graph.module';
import { MeetingAnalysisModule } from './meeting-analysis/meeting-analysis.module';
import { ExternalIntegrationModule } from './tools/external-integration.module';
import { RagModule } from '../rag/rag.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { PineconeModule } from '../pinecone/pinecone.module';

@Module({
  imports: [
    LlmModule,
    ToolModule,
    StateModule,
    AgentModule,
    SupervisorModule,
    TeamModule,
    GraphModule,
    MeetingAnalysisModule,
    ExternalIntegrationModule,
    RagModule,
    EmbeddingModule,
    PineconeModule,
  ],
  exports: [
    LlmModule,
    ToolModule,
    StateModule,
    AgentModule,
    SupervisorModule,
    TeamModule,
    GraphModule,
    MeetingAnalysisModule,
    ExternalIntegrationModule,
    RagModule,
    EmbeddingModule,
  ],
})
export class LangGraphModule {}
```

## 8. Update the Migration Guide

Update the NestJS migration guide to mark RAG integration as completed:

```markdown
## Phase 6: RAG and Vector Integration (2-3 weeks)

### Milestone 6.1: Vector Database Setup

- [x] Set up Pinecone integration
- [x] Implement vector embedding services
- [x] Create data persistence layer for embeddings
- [x] Implement chunking strategies for documents

### Milestone 6.2: RAG Implementation

- [x] Implement RAG service and components
- [x] Create agents with RAG capabilities
- [x] Implement hybrid search mechanisms
- [x] Set up adaptive retrieval strategies

### Milestone 6.3: Integration with Meeting Analysis

- [x] Enhance meeting analysis with RAG
- [x] Store and retrieve historical meeting data
- [x] Add context-aware processing to agents
- [x] Implement multi-step RAG patterns
```

## 9. Updates to the .env Example File

Update your `.env.example` file to include RAG and Pinecone configuration:

```
# LLM Configuration
OPENAI_API_KEY=your-openai-api-key
MODEL_NAME=gpt-4

# Pinecone Configuration
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_CLOUD=aws
PINECONE_REGION=us-west-2

# Embedding Configuration
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=1536

# RAG Configuration
RAG_ENABLE=true
RAG_DEFAULT_NAMESPACE=meeting-analysis
RAG_CACHE_TTL=3600
```

## 10. Key Benefits of RAG Integration

Our RAG integration provides several key benefits:

1. **Enhanced Agent Understanding**: Agents can leverage historical context from previous meetings
2. **Continuity in Analysis**: Track and relate topics and action items across multiple meetings
3. **Improved Accuracy**: Contextual information leads to better topic extraction and summarization
4. **Adaptive Retrieval**: Different retrieval strategies based on the nature of the query
5. **Persistent Knowledge**: Meeting insights are preserved and reused
6. **Efficient Resource Usage**: Smart caching and batching for optimal performance

The integration follows the best practices outlined in the LangGraph documentation and maintains the NestJS architectural patterns for maintainability and extensibility.

## 11. Testing and Validation

To validate the RAG integration:

1. **Unit Testing**: Create tests for each component (embedding, chunking, retrieval)
2. **Integration Testing**: Test the full RAG pipeline with the meeting analysis workflow
3. **Performance Testing**: Measure retrieval latency and accuracy
4. **Scalability Testing**: Test with large document collections

This completes the RAG and Pinecone integration for our meeting analysis system. The implementation provides a solid foundation for context-aware processing and can be extended with more advanced RAG patterns in the future. 