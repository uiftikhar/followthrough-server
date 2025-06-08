# Agent Development Guide

## Table of Contents
1. [Overview](#overview)
2. [Base Agent Architecture](#base-agent-architecture)
3. [Creating Basic Agents](#creating-basic-agents)
4. [Specialized Agents](#specialized-agents)
5. [RAG-Enhanced Agents](#rag-enhanced-agents)
6. [Agent Factory Integration](#agent-factory-integration)
7. [Testing Agents](#testing-agents)
8. [Best Practices](#best-practices)

## Overview

Our agent system is built on a hierarchical architecture where all agents inherit from a `BaseAgent` class. This provides consistent interfaces for LLM interaction, state management, and error handling while allowing specialization for specific tasks.

## Base Agent Architecture

### Core Components

```typescript
// src/langgraph/agents/base-agent.ts
export interface AgentConfig {
  name: string;
  systemPrompt: string;
  llmOptions?: LLMOptions;
}

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

  // Core methods available to all agents
  async processMessage(content: string): Promise<string>
  async processState(state: any): Promise<any>
  protected getChatModel(): BaseChatModel
}
```

### Key Features of BaseAgent

1. **Consistent Logging**: Each agent gets its own namespaced logger
2. **LLM Integration**: Built-in access to language models via `LlmService`
3. **Configurable Options**: Flexible configuration for temperature, model selection, etc.
4. **Error Handling**: Standard error handling patterns
5. **State Processing**: Methods for processing both raw messages and state objects

## Creating Basic Agents

### Step 1: Define Agent Configuration

```typescript
// Example: Creating a basic summarization agent
const summaryAgentConfig: AgentConfig = {
  name: "SummaryAgent",
  systemPrompt: `You are a specialized agent for creating concise summaries of meeting transcripts. 
    Focus on key decisions, main topics, and important outcomes.
    Format your response as structured JSON with clear sections.`,
  llmOptions: {
    temperature: 0.3,
    model: "gpt-4o",
    maxTokens: 2000
  }
};
```

### Step 2: Create the Agent Class

```typescript
// src/langgraph/agents/summary.agent.ts
import { Injectable } from "@nestjs/common";
import { BaseAgent } from "./base-agent";
import { LlmService } from "../llm/llm.service";

export interface MeetingSummary {
  meetingTitle: string;
  summary: string;
  keyDecisions: string[];
  participants: string[];
  duration?: string;
  nextSteps?: string[];
}

@Injectable()
export class SummaryAgent extends BaseAgent {
  constructor(llmService: LlmService) {
    super(llmService, {
      name: "SummaryAgent",
      systemPrompt: `You are a specialized meeting summary agent. Create comprehensive summaries that capture:
        - Main discussion topics
        - Key decisions made
        - Action items identified
        - Participant engagement
        - Important outcomes
        
        Always respond with valid JSON matching the MeetingSummary interface.`,
      llmOptions: {
        temperature: 0.3,
        model: "gpt-4o"
      }
    });
  }

  /**
   * Generate a meeting summary from transcript
   */
  async generateSummary(transcript: string, metadata?: any): Promise<MeetingSummary> {
    this.logger.log(`Generating summary for transcript of length ${transcript.length}`);
    
    try {
      const prompt = this.buildSummaryPrompt(transcript, metadata);
      const response = await this.processMessage(prompt);
      
      // Parse and validate the response
      const summary = this.parseSummaryResponse(response);
      
      this.logger.log(`Successfully generated summary: ${summary.meetingTitle}`);
      return summary;
    } catch (error) {
      this.logger.error(`Error generating summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build the prompt for summary generation
   */
  private buildSummaryPrompt(transcript: string, metadata?: any): string {
    const basePrompt = `Please analyze the following meeting transcript and create a comprehensive summary:

TRANSCRIPT:
${transcript}

${metadata ? `MEETING METADATA:
${JSON.stringify(metadata, null, 2)}` : ''}

Please provide a structured summary in JSON format following the MeetingSummary interface.`;

    return basePrompt;
  }

  /**
   * Parse and validate the summary response
   */
  private parseSummaryResponse(response: string): MeetingSummary {
    try {
      // Extract JSON from response (handle cases where LLM adds extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      const required = ['meetingTitle', 'summary'];
      for (const field of required) {
        if (!parsed[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      return {
        meetingTitle: parsed.meetingTitle,
        summary: parsed.summary,
        keyDecisions: parsed.keyDecisions || [],
        participants: parsed.participants || [],
        duration: parsed.duration,
        nextSteps: parsed.nextSteps || []
      };
    } catch (error) {
      this.logger.error(`Error parsing summary response: ${error.message}`);
      // Return fallback summary
      return {
        meetingTitle: "Meeting Summary",
        summary: "Unable to generate detailed summary",
        keyDecisions: [],
        participants: []
      };
    }
  }

  /**
   * Process state for LangGraph integration
   */
  async processState(state: any): Promise<any> {
    const transcript = state.transcript || state.content || "";
    const metadata = state.metadata || {};

    if (!transcript) {
      this.logger.warn("No transcript found in state");
      return {
        ...state,
        summary: {
          meetingTitle: "No Content",
          summary: "No transcript provided for summarization",
          keyDecisions: [],
          participants: []
        }
      };
    }

    const summary = await this.generateSummary(transcript, metadata);
    
    return {
      ...state,
      summary
    };
  }
}
```

## Specialized Agents

### Advanced Agent: Topic Extraction

```typescript
// src/langgraph/agents/topic-extraction.agent.ts
export interface Topic {
  name: string;
  relevance: number;          // 0-1 score
  keyPoints: string[];
  participants: string[];
  timeSegments?: {
    start: string;
    end: string;
  }[];
}

@Injectable()
export class TopicExtractionAgent extends BaseAgent {
  constructor(llmService: LlmService) {
    super(llmService, {
      name: "TopicExtractionAgent", 
      systemPrompt: TOPIC_EXTRACTION_SYSTEM_PROMPT,
      llmOptions: {
        temperature: 0.2,
        model: "gpt-4o"
      }
    });
  }

  async extractTopics(transcript: string): Promise<Topic[]> {
    this.logger.log("Extracting topics from transcript");
    
    // For long transcripts, use chunking strategy
    if (transcript.length > 8000) {
      return this.extractTopicsFromChunks(transcript);
    }
    
    return this.extractTopicsFromText(transcript);
  }

  private async extractTopicsFromChunks(transcript: string): Promise<Topic[]> {
    // Split transcript into manageable chunks
    const chunks = this.chunkTranscript(transcript);
    
    // Extract topics from each chunk
    const chunkTopics = await Promise.all(
      chunks.map(chunk => this.extractTopicsFromText(chunk))
    );
    
    // Merge and deduplicate topics
    return this.mergeTopics(chunkTopics.flat());
  }

  private async extractTopicsFromText(text: string): Promise<Topic[]> {
    const prompt = `Extract the main topics discussed in this meeting transcript:

${text}

Return a JSON array of topics with the following structure:
[{
  "name": "Topic name",
  "relevance": 0.8,
  "keyPoints": ["Point 1", "Point 2"],
  "participants": ["Speaker 1", "Speaker 2"]
}]`;

    const response = await this.processMessage(prompt);
    return this.parseTopicsResponse(response);
  }

  private chunkTranscript(transcript: string, chunkSize: number = 6000): string[] {
    // Simple chunking - in production, use semantic chunking
    const chunks = [];
    for (let i = 0; i < transcript.length; i += chunkSize) {
      chunks.push(transcript.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private mergeTopics(topics: Topic[]): Topic[] {
    // Group similar topics and merge them
    const topicMap = new Map<string, Topic>();
    
    for (const topic of topics) {
      const key = topic.name.toLowerCase();
      if (topicMap.has(key)) {
        const existing = topicMap.get(key)!;
        existing.keyPoints = [...new Set([...existing.keyPoints, ...topic.keyPoints])];
        existing.participants = [...new Set([...existing.participants, ...topic.participants])];
        existing.relevance = Math.max(existing.relevance, topic.relevance);
      } else {
        topicMap.set(key, { ...topic });
      }
    }
    
    return Array.from(topicMap.values())
      .sort((a, b) => b.relevance - a.relevance);
  }

  private parseTopicsResponse(response: string): Topic[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      
      const topics = JSON.parse(jsonMatch[0]);
      return topics.map((topic: any) => ({
        name: topic.name || "Unknown Topic",
        relevance: Math.max(0, Math.min(1, topic.relevance || 0)),
        keyPoints: Array.isArray(topic.keyPoints) ? topic.keyPoints : [],
        participants: Array.isArray(topic.participants) ? topic.participants : []
      }));
    } catch (error) {
      this.logger.error(`Error parsing topics: ${error.message}`);
      return [];
    }
  }

  async processState(state: any): Promise<any> {
    const transcript = state.transcript || "";
    const topics = await this.extractTopics(transcript);
    
    return {
      ...state,
      topics
    };
  }
}
```

## RAG-Enhanced Agents

### Creating RAG-Aware Agents

```typescript
// src/langgraph/agents/rag-agents/rag-topic-extraction-agent.ts
@Injectable()
export class RagTopicExtractionAgent extends BaseAgent {
  constructor(
    llmService: LlmService,
    @Inject(RAG_SERVICE) private readonly ragService: RagService,
    @Inject(RAG_TOPIC_EXTRACTION_CONFIG) 
    private readonly config: RagTopicExtractionConfig
  ) {
    super(llmService, {
      name: config.name,
      systemPrompt: config.systemPrompt,
      llmOptions: config.llmOptions
    });
  }

  async extractTopicsWithContext(
    transcript: string, 
    options?: RagOptions
  ): Promise<Topic[]> {
    this.logger.log("Extracting topics with RAG context");
    
    try {
      // 1. Retrieve relevant context from previous meetings
      const ragOptions = {
        ...this.config.ragOptions?.retrievalOptions,
        ...options?.retrievalOptions
      };
      
      const contextQuery = this.buildContextQuery(transcript);
      const retrievedDocs = await this.ragService.getContext(contextQuery, ragOptions);
      
      this.logger.log(`Retrieved ${retrievedDocs.length} relevant documents`);
      
      // 2. Build enhanced prompt with context
      const enhancedPrompt = this.buildEnhancedPrompt(transcript, retrievedDocs);
      
      // 3. Process with context
      const response = await this.processMessage(enhancedPrompt);
      const topics = this.parseTopicsResponse(response);
      
      // 4. Enrich topics with context metadata
      return this.enrichTopicsWithContext(topics, retrievedDocs);
      
    } catch (error) {
      this.logger.error(`RAG topic extraction failed: ${error.message}`);
      // Fallback to basic extraction
      return this.fallbackExtraction(transcript);
    }
  }

  private buildContextQuery(transcript: string): string {
    // Extract key terms for context retrieval
    const previewText = transcript.substring(0, 500);
    return `Topics and themes similar to: ${previewText}`;
  }

  private buildEnhancedPrompt(
    transcript: string, 
    context: RetrievedDocument[]
  ): string {
    const contextText = context
      .map(doc => `Context: ${doc.content}`)
      .join('\n\n');

    return `You are analyzing a meeting transcript for topic extraction. 
Use the following context from previous meetings to identify patterns and recurring themes:

HISTORICAL CONTEXT:
${contextText}

CURRENT TRANSCRIPT:
${transcript}

Extract topics considering both the current transcript and historical patterns. 
Focus on:
1. Recurring themes across meetings
2. New topics that emerged
3. Evolution of discussed topics
4. Cross-meeting topic relationships

Return JSON array of topics with enhanced context awareness.`;
  }

  private enrichTopicsWithContext(
    topics: Topic[], 
    context: RetrievedDocument[]
  ): Topic[] {
    return topics.map(topic => ({
      ...topic,
      contextSources: context
        .filter(doc => this.isRelevantToTopic(topic, doc))
        .map(doc => ({
          id: doc.id,
          relevanceScore: doc.score || 0,
          source: doc.metadata?.source || 'unknown'
        }))
    }));
  }

  private isRelevantToTopic(topic: Topic, doc: RetrievedDocument): boolean {
    const topicTerms = topic.name.toLowerCase().split(' ');
    const docContent = doc.content.toLowerCase();
    
    return topicTerms.some(term => docContent.includes(term));
  }

  private async fallbackExtraction(transcript: string): Promise<Topic[]> {
    this.logger.warn("Using fallback topic extraction without RAG");
    const basicPrompt = `Extract main topics from this transcript: ${transcript}`;
    const response = await this.processMessage(basicPrompt);
    return this.parseTopicsResponse(response);
  }

  async processState(state: any): Promise<any> {
    const transcript = state.transcript || "";
    const ragOptions = state.ragOptions || {};
    
    const topics = await this.extractTopicsWithContext(transcript, ragOptions);
    
    return {
      ...state,
      topics,
      ragEnhanced: true
    };
  }
}
```

### RAG Configuration

```typescript
// RAG agent configuration interface
export interface RagTopicExtractionConfig {
  name: string;
  systemPrompt: string;
  expertise: AgentExpertise[];
  ragOptions: {
    includeRetrievedContext: boolean;
    retrievalOptions: {
      indexName: string;
      namespace: string;
      topK: number;
      minScore: number;
    };
  };
  specializedQueries: Record<AgentExpertise, string>;
}

// Configuration provider
{
  provide: RAG_TOPIC_EXTRACTION_CONFIG,
  useFactory: (): RagTopicExtractionConfig => ({
    name: "RAG Topic Extraction Agent",
    systemPrompt: TOPIC_EXTRACTION_SYSTEM_PROMPT,
    expertise: [AgentExpertise.TOPIC_ANALYSIS],
    ragOptions: {
      includeRetrievedContext: true,
      retrievalOptions: {
        indexName: "meeting-analysis",
        namespace: "topics",
        topK: 5,
        minScore: 0.7,
      },
    },
    specializedQueries: {
      [AgentExpertise.TOPIC_ANALYSIS]: 
        "Extract topics, themes, and discussion patterns from meeting transcripts"
    },
  }),
}
```

## Agent Factory Integration

### Registering Agents with the Factory

```typescript
// src/langgraph/agents/agent.factory.ts
@Injectable()
export class AgentFactory {
  constructor(
    private readonly llmService: LlmService,
    // Inject all agent instances
    private readonly topicExtractionAgent: TopicExtractionAgent,
    private readonly summaryAgent: SummaryAgent,
    private readonly ragTopicExtractionAgent: RagTopicExtractionAgent,
    // ... other agents
  ) {}

  // Basic agent getters
  getTopicExtractionAgent(): TopicExtractionAgent {
    return this.topicExtractionAgent;
  }

  getSummaryAgent(): SummaryAgent {
    return this.summaryAgent;
  }

  // RAG agent getters
  getRagTopicExtractionAgent(): RagTopicExtractionAgent {
    return this.ragTopicExtractionAgent;
  }

  // Dynamic agent creation
  createCustomAgent(config: AgentConfig): BaseAgent {
    return new BaseAgent(this.llmService, config);
  }

  // Get all available agents
  getAllAgents(): BaseAgent[] {
    return [
      this.topicExtractionAgent,
      this.summaryAgent,
      this.ragTopicExtractionAgent,
      // ... other agents
    ];
  }

  // Get agents by capability
  getAgentsByCapability(capability: string): BaseAgent[] {
    const capabilityMap = {
      'topic_extraction': [this.topicExtractionAgent, this.ragTopicExtractionAgent],
      'summarization': [this.summaryAgent],
      // ... other mappings
    };
    
    return capabilityMap[capability] || [];
  }
}
```

### Module Registration

```typescript
// In your module file
@Module({
  providers: [
    // Basic agents
    TopicExtractionAgent,
    SummaryAgent,
    
    // RAG agents
    RagTopicExtractionAgent,
    
    // RAG configurations
    {
      provide: RAG_TOPIC_EXTRACTION_CONFIG,
      useFactory: () => ({ /* config */ })
    },
    
    // Agent factory
    AgentFactory,
  ],
  exports: [
    AgentFactory,
    TopicExtractionAgent,
    SummaryAgent,
    RagTopicExtractionAgent,
  ]
})
export class AgentsModule {}
```

## Testing Agents

### Unit Testing

```typescript
// src/langgraph/agents/summary.agent.spec.ts
describe('SummaryAgent', () => {
  let agent: SummaryAgent;
  let mockLlmService: jest.Mocked<LlmService>;

  beforeEach(async () => {
    mockLlmService = {
      getChatModel: jest.fn().mockReturnValue({
        invoke: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            meetingTitle: "Test Meeting",
            summary: "Test summary",
            keyDecisions: ["Decision 1"],
            participants: ["User 1"]
          })
        })
      })
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        SummaryAgent,
        { provide: LlmService, useValue: mockLlmService }
      ]
    }).compile();

    agent = module.get<SummaryAgent>(SummaryAgent);
  });

  it('should generate summary from transcript', async () => {
    const transcript = "This is a test meeting transcript";
    const result = await agent.generateSummary(transcript);

    expect(result.meetingTitle).toBe("Test Meeting");
    expect(result.summary).toBe("Test summary");
    expect(result.keyDecisions).toEqual(["Decision 1"]);
  });

  it('should handle state processing', async () => {
    const state = { transcript: "test transcript" };
    const result = await agent.processState(state);

    expect(result.summary).toBeDefined();
    expect(result.transcript).toBe("test transcript");
  });

  it('should handle errors gracefully', async () => {
    mockLlmService.getChatModel().invoke.mockRejectedValue(
      new Error("LLM Error")
    );

    await expect(agent.generateSummary("test")).rejects.toThrow("LLM Error");
  });
});
```

### Integration Testing

```typescript
// Integration test for RAG agents
describe('RagTopicExtractionAgent Integration', () => {
  let agent: RagTopicExtractionAgent;
  let ragService: RagService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        SharedCoreModule  // Provides all RAG services
      ],
      providers: [
        RagTopicExtractionAgent,
        {
          provide: RAG_TOPIC_EXTRACTION_CONFIG,
          useValue: testConfig
        }
      ]
    }).compile();

    agent = module.get<RagTopicExtractionAgent>(RagTopicExtractionAgent);
    ragService = module.get<RagService>(RAG_SERVICE);
  });

  it('should extract topics with RAG context', async () => {
    // Setup: Store test documents in RAG
    await ragService.processDocumentsForRag([{
      id: 'test-doc',
      content: 'Previous meeting discussed project timeline and budget',
      metadata: { type: 'meeting_transcript' }
    }]);

    const transcript = "Today we need to finalize the project timeline";
    const topics = await agent.extractTopicsWithContext(transcript);

    expect(topics.length).toBeGreaterThan(0);
    expect(topics[0].contextSources).toBeDefined();
  });
});
```

## Best Practices

### 1. Agent Design Principles

```typescript
// ✅ Good: Single responsibility
class TopicExtractionAgent extends BaseAgent {
  async extractTopics(transcript: string): Promise<Topic[]> {
    // Focus only on topic extraction
  }
}

// ❌ Bad: Multiple responsibilities
class AnalysisAgent extends BaseAgent {
  async analyzeEverything(transcript: string): Promise<any> {
    // Does topics, sentiment, action items, etc.
  }
}
```

### 2. Error Handling

```typescript
class RobustAgent extends BaseAgent {
  async processWithFallback(input: string): Promise<Result> {
    try {
      return await this.primaryProcessing(input);
    } catch (error) {
      this.logger.error(`Primary processing failed: ${error.message}`);
      
      try {
        return await this.fallbackProcessing(input);
      } catch (fallbackError) {
        this.logger.error(`Fallback failed: ${fallbackError.message}`);
        return this.createErrorResult(error, fallbackError);
      }
    }
  }
}
```

### 3. Prompt Engineering

```typescript
class WellPromptedAgent extends BaseAgent {
  private buildPrompt(input: string, context?: any): string {
    return `
ROLE: You are a specialized ${this.name} with expertise in ${this.expertise}.

TASK: ${this.getTaskDescription()}

CONTEXT: ${context ? JSON.stringify(context) : 'None'}

INPUT:
${input}

REQUIREMENTS:
- Respond in valid JSON format
- Include confidence scores where applicable
- Provide reasoning for key decisions
- Handle edge cases gracefully

OUTPUT SCHEMA:
${this.getOutputSchema()}
`;
  }
}
```

### 4. Performance Optimization

```typescript
class OptimizedAgent extends BaseAgent {
  private readonly cache = new Map<string, any>();
  
  async processWithCaching(input: string): Promise<any> {
    const cacheKey = this.generateCacheKey(input);
    
    if (this.cache.has(cacheKey)) {
      this.logger.debug('Returning cached result');
      return this.cache.get(cacheKey);
    }
    
    const result = await this.process(input);
    this.cache.set(cacheKey, result);
    
    return result;
  }
  
  private generateCacheKey(input: string): string {
    // Generate deterministic key based on input
    return `${this.name}:${this.hashInput(input)}`;
  }
}
```

### 5. Monitoring and Observability

```typescript
class MonitoredAgent extends BaseAgent {
  async processWithMetrics(input: string): Promise<any> {
    const startTime = Date.now();
    const inputSize = input.length;
    
    try {
      const result = await this.process(input);
      
      this.recordMetrics({
        duration: Date.now() - startTime,
        inputSize,
        outputSize: JSON.stringify(result).length,
        success: true
      });
      
      return result;
    } catch (error) {
      this.recordMetrics({
        duration: Date.now() - startTime,
        inputSize,
        success: false,
        error: error.message
      });
      throw error;
    }
  }
}
```

This guide provides a comprehensive foundation for developing agents in our system. Follow these patterns to create robust, maintainable, and performant agents that integrate seamlessly with our agentic workflow architecture. 