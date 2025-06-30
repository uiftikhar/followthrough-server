
# LangGraph Agentic System Implementation Guide

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Agent Framework](#agent-framework)
   - [Base Agent Architecture](#base-agent-architecture)
   - [Specialized Agents](#specialized-agents)
   - [Supervisor-Manager-Worker Pattern](#supervisor-manager-worker-pattern)
3. [RAG-Enhanced Agents](#rag-enhanced-agents)
   - [RAG Architecture](#rag-architecture)
   - [Context Integration](#context-integration)
4. [LangGraph Implementation](#langgraph-implementation)
   - [State Management](#state-management)
   - [Graph Construction](#graph-construction)
   - [Workflow Patterns](#workflow-patterns)
5. [Retrieval System](#retrieval-system)
   - [Vector Storage with Pinecone](#vector-storage-with-pinecone)
   - [Embedding Generation](#embedding-generation)
   - [Retrieval Strategies](#retrieval-strategies)
6. [LLM Service Integration](#llm-service-integration)
   - [Model Management](#model-management)
   - [Performance Optimization](#performance-optimization)
7. [Implementation Examples](#implementation-examples)
   - [Meeting Analysis Workflow](#meeting-analysis-workflow)
   - [Agent Communication Patterns](#agent-communication-patterns)

## Architecture Overview

Our system implements a sophisticated agentic architecture using LangGraph, a framework for creating multi-agent workflows with state management. The core design follows a hierarchical pattern where specialized agents are coordinated by supervisor agents to process meeting transcripts, extract insights, and generate actionable outputs.

The system is built on several key components:

1. **Agentic Framework**: Hierarchical agent design with specialized capabilities
2. **LangGraph Implementation**: Directed graph structure for workflow management
3. **RAG Enhancement**: Context-aware processing through retrievals
4. **Vector Storage**: Pinecone integration for efficient similarity search
5. **LLM Integration**: Flexible model selection and API management

```mermaid
graph TD
    ALearn nho L
    
    C --> G[RAG Enhancement]
    D --> G
    E --> G
    F --> G
    
    G --> H[Context Integration]
    
    H --> I[Result Synthesis]
    I --> J[User Output]
    
    K[Pinecone Vector DB] --> G
```

## Agent Framework

### Base Agent Architecture

At the foundation of our system is the `BaseAgent` class which provides core functionality for all agents. This abstract class encapsulates common behavior:

```typescript
// From nestjs-server/src/langgraph/agents/base-agent.ts
export class BaseAgent {
  protected readonly logger: Logger;
  protected readonly name: string;
  protected readonly systemPrompt: string;
  protected readonly llmOptions: LLMOptions;

  constructor(
    protected readonly llmService: LlmService,
    config: AgentConfig,
  ) {
    this.name = config.name;
    this.systemPrompt = config.systemPrompt;
    this.llmOptions = config.llmOptions || {};
    this.logger = new Logger(`Agent:${this.name}`);
  }

  protected getChatModel(): BaseChatModel {
    return this.llmService.getChatModel(this.llmOptions);
  }

  async processMessage(message: string): Promise<string> {
    // Implementation for processing a single message
  }

  async processMessages(messages: BaseMessage[]): Promise<BaseMessage> {
    // Implementation for processing multiple messages
  }

  async processState(state: any): Promise<any> {
    // Core method for use in LangGraph nodes
  }
}
```

The `BaseAgent` provides:
- Unified logging interface
- Configuration management
- LLM integration
- State processing for LangGraph compatibility

### Specialized Agents

From this base, we've developed specialized agents to handle different aspects of meeting analysis:

1. **TopicExtractionAgent**: Identifies main topics discussed in meetings
2. **ActionItemAgent**: Extracts tasks, responsibilities, and deadlines
3. **SentimentAnalysisAgent**: Analyzes emotional tone and sentiment
4. **SummaryAgent**: Generates concise meeting summaries
5. **ParticipationAgent**: Analyzes speaker dynamics and engagement
6. **ContextIntegrationAgent**: Integrates external context with meeting content

Each agent implements a specialized version of the `processState` method, tailored to its specific task.

### Supervisor-Manager-Worker Pattern

Our system implements a hierarchical agent pattern with three tiers:

1. **Supervisor Agents**: Coordinate workflow and delegate tasks
2. **Manager Agents**: Handle specific domains and manage worker agents
3. **Worker Agents**: Execute specialized tasks

The `SupervisorAgent` class demonstrates this pattern:

```typescript
// From nestjs-server/src/langgraph/agents/supervisor/supervisor.agent.ts
export class SupervisorAgent extends BaseAgent {
  constructor(
    protected readonly llmService: LlmService,
    private readonly agentFactory: AgentFactory,
  ) {
    super(llmService, {
      name: 'SupervisorAgent',
      systemPrompt: COORDINATION_PROMPT,
      llmOptions: { temperature: 0.2, model: 'gpt-4o' },
    });
  }

  async determineNextStep(state: AnalysisState): Promise<SupervisorDecision> {
    // Supervisor logic to determine next step in the workflow
  }

  async executeStep(step: string, state: AnalysisState): Promise<AnalysisState> {
    // Execute a specific analysis step by delegating to a specialized agent
  }

  async runAnalysis(transcript: string, retrievedContext?: RetrievedContext[]): Promise<AnalysisState> {
    // Run a complete analysis process by coordinating multiple steps
  }
}
```

The supervisor coordinates the analysis process by:
1. Determining the next step based on current state
2. Delegating to the appropriate specialized agent
3. Collecting and integrating results
4. Making decisions about workflow progression

For team-based workflows, we use the `TeamFormationService` to dynamically assemble teams of agents:

```typescript
// From nestjs-server/src/langgraph/agents/team/team-formation.service.ts
export class TeamFormationService {
  formTeam(config: TeamConfig): Team {
    // Creates teams with specified agent types
  }

  formStandardAnalysisTeam(): Team {
    return this.formTeam({
      name: 'Standard Analysis Team',
      description: 'A complete team for comprehensive meeting analysis',
      members: [
        'topic_extraction',
        'action_item',
        'sentiment_analysis',
        'participation',
        'context_integration',
        'summary',
      ],
      supervisorEnabled: true,
    });
  }
}
```

## RAG-Enhanced Agents

### RAG Architecture

We've enhanced our agent system with RAG (Retrieval Augmented Generation) capabilities through the `RagEnhancedAgent` class:

```typescript
// From nestjs-server/src/rag/agents/rag-enhanced-agent.ts
export abstract class RagEnhancedAgent extends BaseAgent {
  constructor(
    @Inject(LLM_SERVICE) protected readonly llmService: LlmService,
    @Inject(STATE_SERVICE) protected readonly stateService: StateService,
    @Inject(RAG_SERVICE) protected readonly ragService: IRagService,
    config: RagAgentConfig,
  ) {
    super(llmService, {
      name: config.name,
      systemPrompt: config.systemPrompt,
      llmOptions: config.llmOptions,
    });

    // Set up RAG options with defaults
    const defaultOptions: RagAgentOptions = {
      includeRetrievedContext: true,
      useAdaptiveRetrieval: true,
    };

    this.ragOptions = { ...defaultOptions, ...config.ragOptions };
  }

  protected abstract extractQueryFromState(state: any): string;

  async processState(state: any): Promise<any> {
    // Enhanced version that includes RAG context retrieval and integration
  }

  protected async processWithContext(state: any, context: string): Promise<any> {
    // Process input with retrieved context
  }
}
```

This design allows any agent to be enhanced with contextual information by:
1. Extracting a meaningful query from the state
2. Retrieving relevant context
3. Integrating that context into the agent's reasoning

### Context Integration

The `RagMeetingAnalysisAgent` class extends this pattern for meeting-specific analysis:

```typescript
// From nestjs-server/src/langgraph/agentic-meeting-analysis/agents/enhanced/rag-meeting-agent.ts
export class RagMeetingAnalysisAgent extends RagEnhancedAgent {
  protected readonly expertise: AgentExpertise[];
  protected readonly expertisePrompts: Record<AgentExpertise, string>;

  protected extractQueryFromState(state: any): string {
    // Extract relevant query from meeting state
  }

  protected formatRetrievedContext(context: any): string {
    // Enhanced formatting specific to meeting analysis
    return `
RELEVANT MEETING CONTEXT:
------------------------
${context.documents
  .map((doc: any, index: number) => {
    const metadata = doc.metadata || {};
    const meetingId = metadata.meetingId || metadata.meeting_id || 'unknown';
    const date = metadata.date || 'unknown';
    const relevance = doc.score
      ? ` (Relevance: ${(doc.score * 100).toFixed(1)}%)`
      : '';

    return `[Meeting ${meetingId} - ${date}]${relevance}\n${doc.content}`;
  })
  .join('\n\n')}
------------------------
`;
  }

  async analyzeTranscript(
    transcript: string,
    options?: {
      meetingId?: string;
      participantNames?: string[];
      expertise?: AgentExpertise;
      retrievalOptions?: RetrievalOptions;
    },
  ): Promise<any> {
    // Process a transcript with RAG capabilities
  }
}
```

This specialized implementation provides meeting-specific enhancements:
1. Domain-specific context formatting for meetings
2. Expertise-focused prompting
3. Transcript-aware processing
4. Meeting metadata integration

## LangGraph Implementation

### State Management

Our LangGraph implementation uses a central state object that flows through the graph. We leverage the state service to create properly typed state annotations:

```typescript
// State definition example from nestjs-server/src/langgraph/agentic-meeting-analysis/interfaces/state.interface.ts
export interface MeetingAnalysisState {
  meetingId: string;
  transcript: string | MeetingTranscript;
  topics?: Topic[];
  actionItems?: ActionItem[];
  sentiment?: {
    overall: 'positive' | 'negative' | 'neutral' | 'mixed';
    score: number;
    segments?: Array<{
      text: string;
      sentiment: string;
      score: number;
    }>;
  };
  summary?: {
    brief: string;
    detailed?: string;
    keyPoints?: string[];
    decisions?: string[];
  };
  participants?: Array<{
    name: string;
    speakingTime?: number;
    contributions?: number;
    sentiment?: string;
  }>;
  retrievedContext?: RetrievedContext;
  errors?: Array<{
    step: string;
    error: string;
    timestamp: string;
  }>;
  status?: 'pending' | 'in_progress' | 'completed' | 'failed';
  currentStep?: string;
  completedSteps?: string[];
}
```

The state service helps create LangGraph-compatible state annotations:

```typescript
// State creation example
const MeetingAnalysisState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  transcript: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
  topics: Annotation<Topic[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  // Additional state fields
});
```

### Graph Construction

In the `GraphService`, we construct the LangGraph workflow:

```typescript
// Graph construction example
const workflow: any = new StateGraph<MeetingAnalysisState>({
  channels: MeetingAnalysisState,
});

// Add nodes
workflow
  .addNode("transcriptProcessor", transcriptProcessorNode)
  .addNode("topicExtractor", topicExtractorNode)
  .addNode("actionItemExtractor", actionItemExtractorNode)
  .addNode("decisionExtractor", decisionExtractorNode)
  .addNode("sentimentAnalyzer", sentimentAnalyzerNode)
  .addNode("summarizer", summarizerNode);

// Add edges
workflow
  .addEdge(START, "transcriptProcessor")
  .addEdge("transcriptProcessor", "topicExtractor")
  .addEdge("topicExtractor", "actionItemExtractor")
  .addEdge("actionItemExtractor", "decisionExtractor")
  .addEdge("decisionExtractor", "sentimentAnalyzer")
  .addEdge("sentimentAnalyzer", "summarizer")
  .addEdge("summarizer", END);

// Compile the graph
const meetingAnalysisApp = workflow.compile();
```

Each node in the graph corresponds to a function that processes the state and returns an updated version. Our agent nodes are wrapped functions that call the appropriate agent's `processState` method.

### Workflow Patterns

We implement several workflow patterns:

1. **Sequential Workflows**: Linear processing steps
2. **Conditional Workflows**: Branching logic based on state
3. **Parallel Processing**: Simultaneous execution of independent tasks
4. **Supervisor Coordination**: Dynamic task allocation

For conditional workflows:

```typescript
// Conditional workflow example
workflow.addConditionalEdges(
  "decisionPoint",
  (state) => {
    if (state.requiresDeepAnalysis) {
      return "deep_analysis";
    } else {
      return "quick_summary";
    }
  },
  {
    "deep_analysis": "comprehensiveAnalyzer",
    "quick_summary": "summarizer"
  }
);
```

## Retrieval System

### Vector Storage with Pinecone

Our retrieval system uses Pinecone as a vector database for efficient similarity search:

```typescript
// From nestjs-server/src/pinecone/pinecone.service.ts
export class PineconeService {
  async storeVector<T extends RecordMetadata = RecordMetadata>(
    indexName: string,
    id: string,
    vector: number[],
    metadata: T = {} as T,
    namespace?: string,
  ): Promise<void> {
    const ns = namespace || this.defaultNamespace;
    const record: VectorRecord<T> = { id, values: vector, metadata };

    await this.connectionService.upsertVectors(indexName, [record], ns);
  }

  async querySimilar<T extends RecordMetadata = RecordMetadata>(
    indexName: string,
    queryVector: number[],
    options: {
      topK?: number;
      filter?: Record<string, any>;
      includeValues?: boolean;
      minScore?: number;
      namespace?: string;
    } = {},
  ): Promise<
    Array<{
      id: string;
      score: number;
      metadata: T;
      values?: number[];
    }>
  > {
    // Implementation for similarity search
  }
}
```

We use a multi-index approach with dedicated indexes for different content types:

```typescript
// From nestjs-server/src/pinecone/pinecone-index.service.ts
export enum VectorIndexes {
  USER_CONTEXT = 'user-context',
  MEETING_ANALYSIS = 'meeting-analysis',
  TRANSCRIPT_EMBEDDINGS = 'transcript-embeddings',
}
```

### Embedding Generation

Our `EmbeddingService` handles vector generation:

```typescript
// From nestjs-server/src/embedding/embedding.service.ts
export class EmbeddingService {
  async generateEmbedding(
    text: string,
    options: EmbeddingOptions = {},
  ): Promise<number[]> {
    const requestedModel = options.model || this.defaultModel;
    const model = this.mapToSupportedModel(requestedModel);
    const useCaching = options.useCaching !== false; // Default to true

    // Check cache first if caching is enabled
    if (useCaching) {
      const cacheKey = this.generateCacheKey(text, model);
      const cachedEmbedding = await this.cacheManager.get<number[]>(cacheKey);

      if (cachedEmbedding) {
        return cachedEmbedding;
      }
    }

    // Generate embedding
    let embedding: number[];
    
    if (model === EmbeddingModel.OPENAI_ADA_002 || 
        model === EmbeddingModel.OPENAI_3_SMALL || 
        model === EmbeddingModel.OPENAI_3_LARGE) {
      // Use LangChain's embeddings
      const result = await this.openaiEmbeddings.embedQuery(text);
      embedding = result;
    } else {
      // Fallback to direct API calls
      embedding = await this.generateDirectEmbedding(text, model);
    }

    // Cache and return
    if (useCaching) {
      const cacheKey = this.generateCacheKey(text, model);
      await this.cacheManager.set(cacheKey, embedding);
    }

    return embedding;
  }
}
```

The service supports multiple embedding models and implements caching for efficiency.

### Retrieval Strategies

Our system implements several retrieval strategies:

1. **Semantic Retrieval**: Vector-based similarity search
2. **Keyword Retrieval**: Metadata-based filtering
3. **Hybrid Retrieval**: Combination of semantic and keyword approaches
4. **Adaptive Retrieval**: Dynamic strategy selection based on query characteristics

The `AdaptiveRagService` demonstrates the adaptive approach:

```typescript
// From nestjs-server/src/rag/adaptive-rag.service.ts
export class AdaptiveRagService implements IAdaptiveRagService {
  async determineRetrievalStrategy(query: string): Promise<{
    strategy: 'semantic' | 'keyword' | 'hybrid' | 'none';
    settings: Partial<RetrievalOptions>;
  }> {
    // Uses LLM to analyze query and determine optimal retrieval strategy
  }

  createAdaptiveRagNode<T extends Record<string, any>>(
    queryExtractor: (state: T) => string,
    baseOptions: RetrievalOptions = {},
  ): (state: T) => Promise<Partial<T>> {
    return async (state: T): Promise<Partial<T>> => {
      // Extract query from state
      const query = queryExtractor(state);

      // Determine retrieval strategy
      const { strategy, settings } = await this.determineRetrievalStrategy(query);

      // Merge settings with base options
      const options: RetrievalOptions = {
        ...baseOptions,
        ...settings,
      };

      // Retrieve based on strategy
      let documents;
      switch (strategy) {
        case 'semantic':
          documents = await this.retrievalService.retrieveDocuments(query, options);
          break;
        case 'keyword':
          documents = await this.retrievalService['keywordSearch'](query, options);
          break;
        case 'hybrid':
          documents = await this.retrievalService.hybridSearch(query, options);
          break;
        case 'none':
          documents = [];
          break;
      }

      return { 
        retrievedContext: {
          query, documents, strategy, timestamp: new Date().toISOString()
        }
      } as unknown as Partial<T>;
    };
  }
}
```

## LLM Service Integration

### Model Management

Our `LlmService` provides a unified interface to multiple LLM providers:

```typescript
// From nestjs-server/src/langgraph/llm/llm.service.ts
export class LlmService {
  getChatModel(options: LLMOptions = {}): BaseChatModel {
    const provider = options.provider || this.defaultProvider;
    const model = options.model || this.defaultModel;
    const temperature = options.temperature !== undefined ? options.temperature : 0.7;
    const maxTokens = options.maxTokens || undefined;

    switch (provider) {
      case 'openai':
        return this.getOpenAIModel({
          model,
          temperature,
          maxTokens,
        });
      case 'anthropic':
        return this.getAnthropicModel({
          model,
          temperature,
          maxTokens,
        });
      default:
        return this.getOpenAIModel({
          model,
          temperature,
          maxTokens,
        });
    }
  }
}
```

This allows agents to easily switch between different LLM providers and models based on their requirements.

### Performance Optimization

We implement several performance optimizations:

1. **Caching**: Reuse embeddings and LLM responses
2. **Batching**: Process multiple items in a single API call
3. **Streaming**: Process responses as they arrive
4. **Tiered Execution**: Use less expensive models for simpler tasks

## Implementation Examples

### Meeting Analysis Workflow

The full meeting analysis workflow combines all these components:

1. **Transcript Processing**: Meeting recording is transcribed
2. **RAG Enhancement**: Context is retrieved from previous meetings
3. **Topic Extraction**: Key discussion topics are identified
4. **Action Item Extraction**: Tasks and responsibilities are extracted
5. **Sentiment Analysis**: Emotional tone is analyzed
6. **Summary Generation**: Concise summary is created

This is implemented in the `AgenticMeetingAnalysisService`:

```typescript
// From nestjs-server/src/langgraph/agentic-meeting-analysis/agentic-meeting-analysis.service.ts
export class AgenticMeetingAnalysisService {
  async processMeetingTranscript(
    transcript: string | MeetingTranscript,
    options?: {
      meetingId?: string;
      analyzeTopics?: boolean;
      analyzeActionItems?: boolean;
      analyzeSentiment?: boolean;
      analyzeSummary?: boolean;
    },
  ): Promise<{
    meetingId: string;
    topics?: Topic[];
    retrievedContext?: RetrievedContext;
    [key: string]: any;
  }> {
    const meetingId = options?.meetingId || `meeting-${Date.now()}`;

    // Convert MeetingTranscript to string if needed
    const transcriptText =
      typeof transcript === 'string'
        ? transcript
        : this.formatTranscript(transcript);

    const result: any = {
      meetingId,
    };

    // Extract topics if requested (or by default)
    if (options?.analyzeTopics !== false) {
      result.topics = await this.extractTopics(transcriptText, { meetingId });
    }

    // Extract action items if requested
    if (options?.analyzeActionItems) {
      result.actionItems = await this.analyzeTranscript(
        transcriptText,
        AgentExpertise.ACTION_ITEM_EXTRACTION,
        { meetingId },
      );
    }

    // Analyze sentiment if requested
    if (options?.analyzeSentiment) {
      result.sentiment = await this.analyzeTranscript(
        transcriptText,
        AgentExpertise.SENTIMENT_ANALYSIS,
        { meetingId },
      );
    }

    // Generate summary if requested
    if (options?.analyzeSummary) {
      result.summary = await this.analyzeTranscript(
        transcriptText,
        AgentExpertise.SUMMARY_GENERATION,
        { meetingId },
      );
    }

    return result;
  }
}
```

### Agent Communication Patterns

The agents communicate through the state object, with each agent contributing specific insights:

1. **State Updates**: Each agent updates a specific part of the state
2. **Progressive Enhancement**: Agents build on each other's work
3. **Supervised Coordination**: The supervisor agent directs the flow

This is demonstrated in the `SupervisorAgent`'s `runAnalysis` method:

```typescript
// From nestjs-server/src/langgraph/agents/supervisor/supervisor.agent.ts
async runAnalysis(
  transcript: string,
  retrievedContext?: RetrievedContext[],
): Promise<AnalysisState> {
  // Initialize analysis state
  let state = this.initializeState(transcript);

  // Add retrieved context if available
  if (retrievedContext) {
    state.retrievedContext = retrievedContext;
  }

  // Continue until all steps are completed or an error occurs
  while (state.remaining_steps.length > 0) {
    // Determine next step
    const decision = await this.determineNextStep(state);

    // Check if analysis is complete
    if (decision.next_action === 'complete') {
      break;
    }

    // Execute the next step
    state = await this.executeStep(decision.next_action, state);

    // Handle errors
    if (state.errors && state.errors.length > 0) {
      this.logger.warn(
        `Errors encountered during analysis: ${JSON.stringify(state.errors)}`,
      );
    }
  }

  return state;
}
```

This approach allows for flexible, robust processing with error handling and dynamic workflow adaptation.

## Conclusion

Our LangGraph implementation provides a powerful, extensible framework for building complex, multi-agent workflows. The combination of specialized agents, hierarchical supervision, RAG enhancement, and flexible LLM integration allows us to tackle sophisticated tasks like meeting analysis with high accuracy and efficiency.

The system's modular design makes it easy to add new capabilities, integrate with external services, and adapt to changing requirements. The core architectural patterns—hierarchical agents, graph-based workflows, and RAG enhancement—can be applied to many other domains beyond meeting analysis.
