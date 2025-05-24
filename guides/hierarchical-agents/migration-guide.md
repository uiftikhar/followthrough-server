
# Enhanced Migration Guide: Leveraging Existing LangGraph Infrastructure

The current implementation includes graph-based execution, progress tracking, event emission, and state management. This guide will focus on adapting your existing architecture to incorporate the unified supervisor approach.

## Part 1: Leverage Existing Graph Infrastructure

### Step 1: Create Master Graph Service

Extend your existing `GraphService` to include a master supervisor graph:

```typescript
// src/langgraph/graph/graph.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { StateGraph, END } from '@langchain/langgraph';

@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);

  constructor(
    // Existing dependencies
  ) {}

  // Existing methods like buildMeetingAnalysisGraph()

  /**
   * Build the master supervisor graph that routes between different workflows
   */
  async buildMasterSupervisorGraph() {
    this.logger.log('Building master supervisor graph');

    // Define the state graph with channels similar to your meeting analysis graph
    // Use annotations api like we have for other graphs
    const graph = new StateGraph();

    // Add nodes
    graph.addNode("supervisor", {
      invoke: async (state, config) => {
        const supervisorAgent = config.agentFactory.getMasterSupervisorAgent();
        const decision = await supervisorAgent.determineTeam(state.input);
        
        return {
          team: decision.team,
          reason: decision.reason,
          priority: decision.priority
        };
      }
    });

    // Add team nodes following your existing pattern
    graph.addNode("emailTriageTeam", {
      invoke: async (state, config) => {
        // Similar to how you execute meeting analysis graph
        const emailGraph = await this.buildEmailTriageGraph();
        const finalState = await this.executeGraph(emailGraph, {
          email: state.input,
          // Other needed state properties
        });
        
        return { result: finalState };
      }
    });

    graph.addNode("meetingAnalysisTeam", {
      invoke: async (state, config) => {
        // Reuse your existing meeting analysis graph
        const meetingGraph = await this.buildMeetingAnalysisGraph();
        const finalState = await this.executeGraph(meetingGraph, {
          transcript: state.input.transcript,
          // Other needed state properties
        });
        
        return { result: finalState };
      }
    });

    // Add conditional routing
    graph.addConditionalEdges(
      "supervisor",
      (state) => {
        if (state.team === "email_triage") return "emailTriageTeam";
        if (state.team === "meeting_analysis") return "meetingAnalysisTeam";
        return END;
      }
    );

    // Add final edges
    graph.addEdge("emailTriageTeam", END);
    graph.addEdge("meetingAnalysisTeam", END);

    return graph.compile();
  }

  /**
   * Build the email triage graph following your existing pattern for meeting analysis
   */
  async buildEmailTriageGraph() {
    this.logger.log('Building email triage graph');
    
    // Define nodes following your existing pattern for meeting analysis
    const nodeNames = {
      START: '__start__',
      CLASSIFICATION: 'classification',
      SUMMARIZATION: 'summarization',
      REPLY_DRAFT: 'reply_draft',
      RESULT_COLLECTION: 'result_collection',
      END: '__end__',
    };

    // Define the graph with channels
    const graph = new StateGraph({
      channels: {
        email: { value: {} },
        classification: { value: {} },
        summary: { value: "" },
        draft_reply: { value: "" },
        result: { value: {} }
      }
    });

    // Add nodes
    // Add worker nodes and edges following your existing pattern
    // ...

    return graph.compile();
  }
}
```

### Step 2: Create Master Supervisor Agent

Create a master supervisor agent similar to your existing supervisor agent:

```typescript
// src/langgraph/agents/master-supervisor.agent.ts
import { Injectable, Logger } from '@nestjs/common';
import { BaseAgent, AgentConfig } from './base-agent';
import { LlmService } from '../llm/llm.service';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export const MASTER_SUPERVISOR_PROMPT = `You are the Master Supervisor, responsible for routing incoming requests to the appropriate specialized team.
Your job is to analyze the input and determine which team should handle it based on its type and content.
Available teams:
1. Meeting Analysis Team - For processing meeting transcripts, extracting insights, and generating summaries
2. Email Triage Team - For processing incoming emails, classifying them, and generating appropriate responses

Make your routing decisions based solely on the content and metadata of the input. Be precise and consistent.`;

export interface RoutingDecision {
  team: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

@Injectable()
export class MasterSupervisorAgent extends BaseAgent {
  protected readonly logger = new Logger(MasterSupervisorAgent.name);

  constructor(protected readonly llmService: LlmService) {
    const config: AgentConfig = {
      name: 'MasterSupervisorAgent',
      systemPrompt: MASTER_SUPERVISOR_PROMPT,
      llmOptions: {
        temperature: 0.1,
        model: 'gpt-4o',
      },
    };
    super(llmService, config);
  }

  async determineTeam(input: any): Promise<RoutingDecision> {
    // Similar to your existing supervisor agent implementation
    const model = this.getChatModel();
    const inputDescription = this.formatInputForDecision(input);
    
    const messages = [
      new SystemMessage(MASTER_SUPERVISOR_PROMPT),
      new HumanMessage(`
      Analyze this input and determine which team should handle it.
      
      Input:
      ${inputDescription}
      
      Return a JSON object with:
      - team: The team that should handle this input (meeting_analysis, email_triage, or unknown)
      - reason: A brief explanation of why you chose this team
      - priority: The priority level for this request (high, medium, or low)
      `),
    ];

    const response = await model.invoke(messages);

    try {
      // Extract JSON decision from response using your existing pattern
      const content = response.content.toString();
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
                       content.match(/```\n([\s\S]*?)\n```/) ||
                       content.match(/(\{[\s\S]*\})/);

      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      return JSON.parse(jsonStr) as RoutingDecision;
    } catch (error) {
      this.logger.error(`Failed to parse routing decision: ${error.message}`);
      
      // Fallback decision
      return {
        team: this.determineTeamHeuristically(input),
        reason: 'Fallback decision due to parsing error',
        priority: 'medium',
      };
    }
  }

  private formatInputForDecision(input: any): string {
    // Format input for LLM decision making
    if (input.type === 'email') {
      return `
        Type: Email
        From: ${input.from || 'Unknown'}
        Subject: ${input.subject || 'No subject'}
        Body snippet: ${(input.body || '').substring(0, 200)}...
        Metadata: ${JSON.stringify(input.metadata || {})}
      `;
    } else if (input.type === 'meeting_transcript') {
      return `
        Type: Meeting Transcript
        Length: ${input.transcript ? input.transcript.length : 'Unknown'} characters
        Participants: ${input.participants?.join(', ') || 'Unknown'}
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
    if (input.type === 'email' || input.subject || input.from) {
      return 'email_triage';
    } else if (input.type === 'meeting_transcript' || input.transcript) {
      return 'meeting_analysis';
    }
    return 'unknown';
  }
}
```

### Step 3: Create a Unified Service

Create a unified service that leverages your existing infrastructure:
Before implementing this, analyze the existing workflow service we have at 
src/langgraph/graph/workflow.service.ts

If we can use and build upon that, we should.
```typescript
// src/langgraph/unified-workflow.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { GraphService } from './graph/graph.service';
import { StateService } from './state/state.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UnifiedWorkflowService {
  private readonly logger = new Logger(UnifiedWorkflowService.name);

  constructor(
    private readonly graphService: GraphService,
    private readonly stateService: StateService,
    private readonly eventEmitter: EventEmitter2,
    // Other dependencies from your existing services
  ) {}

  async processInput(input: any, metadata?: Record<string, any>, userId?: string): Promise<{
    sessionId: string;
    status: string;
  }> {
    // Generate session ID following your existing pattern
    const sessionId = uuidv4();
    const actualUserId = userId || 'system';
    
    this.logger.log(`Created new workflow session: ${sessionId} for user: ${actualUserId}`);

    try {
      // Create session record similar to your meeting analysis service
      
      // Initialize state using your existing StateService
      const initialState = await this.stateService.createInitialState({
        input,
        sessionId,
        userId: actualUserId,
        startTime: new Date().toISOString(),
        metadata: metadata || {},
      });
      
      // Build the master supervisor graph
      const graph = await this.graphService.buildMasterSupervisorGraph();
      
      // Attach progress tracking like in your meeting analysis service
      this.attachProgressTracker(graph, sessionId);
      
      // Execute graph in non-blocking fashion
      this.executeGraphAndSaveResults(graph, initialState, sessionId, actualUserId);
      
      return {
        sessionId,
        status: 'pending',
      };
    } catch (error) {
      this.logger.error(`Error initiating workflow: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async executeGraphAndSaveResults(graph: any, initialState: any, sessionId: string, userId: string): Promise<void> {
    try {
      // Execute graph following your existing pattern
      const finalState = await this.graphService.executeGraph(graph, initialState);
      
      // Save results based on the team that processed the request
      if (finalState.team === 'email_triage') {
        // Save email triage results
      } else if (finalState.team === 'meeting_analysis') {
        // Save meeting analysis results using your existing pattern
      }
      
      // Final progress update
      
    } catch (error) {
      // Error handling following your existing pattern
    }
  }

  private attachProgressTracker(graph: any, sessionId: string): void {
    // Implement progress tracking similar to your meeting analysis service
  }
}
```

## Part 2: Implement Email Triage Components

### Step 1: Create Email Worker Agents

Create email worker agents following your existing agent pattern:

```typescript
// src/langgraph/agents/email-triage/classification.agent.ts
import { Injectable, Logger } from '@nestjs/common';
import { BaseAgent, AgentConfig } from '../base-agent';
import { LlmService } from '../../llm/llm.service';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const CLASSIFICATION_PROMPT = `You are an Email Classification Specialist.
Your job is to analyze emails and determine their priority and category.
Priority levels: urgent, high, normal, low
Look for signals like:
- Sender importance (executives, clients, etc.)
- Time-sensitive language ("ASAP", "urgent", "deadline")
- Direct questions requiring responses
- Action items or requests
- Legal or compliance matters`;

@Injectable()
export class EmailClassificationAgent extends BaseAgent {
  protected readonly logger = new Logger(EmailClassificationAgent.name);

  constructor(protected readonly llmService: LlmService) {
    const config: AgentConfig = {
      name: 'EmailClassificationAgent',
      systemPrompt: CLASSIFICATION_PROMPT,
      llmOptions: {
        temperature: 0.1,
        model: 'gpt-4o',
      },
    };
    super(llmService, config);
  }

  async classify(email: any): Promise<{ priority: string; category: string }> {
    // Implementation following your existing agent pattern
    const model = this.getChatModel();
    
    const messages = [
      new SystemMessage(CLASSIFICATION_PROMPT),
      new HumanMessage(`
        Classify this email by priority and category:
        
        From: ${email.from}
        Subject: ${email.subject}
        Body:
        ${email.body}
        
        Respond with a JSON object containing:
        - priority: "urgent", "high", "normal", or "low"
        - category: A descriptive category for this email
        - reason: Brief explanation for this classification
      `),
    ];

    const response = await model.invoke(messages);
    
    // Parse response using your existing JSON extraction pattern
    try {
      const content = response.content.toString();
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
                       content.match(/```\n([\s\S]*?)\n```/) ||
                       content.match(/(\{[\s\S]*\})/);

      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      return JSON.parse(jsonStr);
    } catch (error) {
      this.logger.error(`Failed to parse classification result: ${error.message}`);
      return {
        priority: 'normal',
        category: 'uncategorized',
        reason: 'Error in classification'
      };
    }
  }
}

// Create similar agents for summarization and reply drafting
```

### Step 2: Create Email Triage Service

Create an email triage service similar to your meeting analysis service:

```typescript
// src/langgraph/email-triage/email-triage.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { GraphService } from '../graph/graph.service';
import { StateService } from '../state/state.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class EmailTriageService {
  private readonly logger = new Logger(EmailTriageService.name);
  
  // Node names for graph execution, similar to your meeting analysis service
  private readonly nodeNames = {
    START: '__start__',
    CLASSIFICATION: 'classification',
    SUMMARIZATION: 'summarization',
    REPLY_DRAFT: 'reply_draft',
    RESULT_COLLECTION: 'result_collection',
    END: '__end__',
  };

  constructor(
    // Dependencies similar to your meeting analysis service
  ) {}

  async processEmail(
    email: any,
    metadata?: Record<string, any>,
    userId?: string,
  ): Promise<{
    sessionId: string;
    status: string;
  }> {
    // Implementation similar to meeting analysis but for email triage
    // ...
  }

  // Other methods following your meeting analysis service pattern
}
```

## Part 3: Update Dependencies and Modules

### Step 1: Update Agent Factory

Update your existing `AgentFactory` to include email triage agents:

```typescript
// src/langgraph/agents/agent.factory.ts
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

// Import all your existing agents and new agents

@Injectable()
export class AgentFactory {
  constructor(private moduleRef: ModuleRef) {}

  // Existing methods
  
  // Add methods for the new agents
  getMasterSupervisorAgent(): MasterSupervisorAgent {
    return this.moduleRef.get(MasterSupervisorAgent);
  }
  
  getEmailClassificationAgent(): EmailClassificationAgent {
    return this.moduleRef.get(EmailClassificationAgent);
  }
  
  getEmailSummarizationAgent(): EmailSummarizationAgent {
    return this.moduleRef.get(EmailSummarizationAgent);
  }
  
  getEmailReplyDraftAgent(): EmailReplyDraftAgent {
    return this.moduleRef.get(EmailReplyDraftAgent);
  }
}
```

### Step 2: Update Module

Update your module to include all new components:

```typescript
// src/langgraph/langgraph.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Import all your existing services and agents
// Import all new services and agents

@Module({
  imports: [ConfigModule],
  providers: [
    // Existing providers
    
    // New providers
    MasterSupervisorAgent,
    EmailClassificationAgent,
    EmailSummarizationAgent,
    EmailReplyDraftAgent,
    EmailTriageService,
    UnifiedWorkflowService,
  ],
  exports: [
    // Existing exports
    
    // New exports
    UnifiedWorkflowService,
    EmailTriageService,
  ],
})
export class LangGraphModule {}
```

## Best Practices from Your Existing Implementation

Your current implementation already incorporates several best practices that should be maintained in the migration:

### 1. Graph Construction and Execution

Continue using your existing pattern for graph construction and execution. Your `GraphService` already handles this well, separating graph definition from execution.

```typescript
// Use your existing pattern with modifications for the new graphs
const graph = await this.graphService.buildMasterSupervisorGraph();
const result = await this.graphService.executeGraph(graph, initialState);
```

### 2. State Management

Continue using your `StateService` for creating and managing state. This ensures consistent state management across different workflows.

```typescript
// Use your existing state service pattern
const initialState = await this.stateService.createInitialState({
  input,
  sessionId,
  userId: actualUserId,
  startTime: new Date().toISOString(),
  metadata: metadata || {},
});
```

### 3. Progress Tracking

Your progress tracking implementation with state transition handlers and event emission is excellent. Continue using this approach for all workflows.

```typescript
// Keep your existing progress tracking pattern
graph.addStateTransitionHandler(async (prevState, newState, nodeName) => {
  // Calculate and publish progress updates
});
```

### 4. Session Management

Continue using your session management approach with MongoDB storage. This provides consistency and persistence across workflows.

```typescript
// Keep your existing session management pattern
await this.sessionRepository.createSession(sessionData);
await this.sessionRepository.updateSession(sessionId, updates);
```

### 5. Error Handling

Maintain your comprehensive error handling approach, including session updates and error logging.

```typescript
// Keep your existing error handling pattern
try {
  // Execute workflow
} catch (error) {
  this.logger.error(`Error: ${error.message}`, error.stack);
  await this.sessionRepository.updateSession(sessionId, {
    status: 'failed',
    errors: [{ step, error: error.message, timestamp: new Date().toISOString() }],
  });
}
```

## Migration Strategy

1. **Incremental Approach**: Implement the unified architecture while keeping the existing meeting analysis flow intact. This allows for gradual transition.

2. **Parallel Testing**: Run both the old and new implementations in parallel during the transition to ensure consistent results.

3. **Reuse Existing Code**: Leverage your existing graph execution, state management, and progress tracking code to maintain consistency.

4. **Start with Routing**: Begin by implementing the master supervisor and its routing graph, then integrate it with your existing meeting analysis flow before adding email triage.

This approach minimizes risk while leveraging the solid foundation you've already built. The unified supervisor architecture will enhance your system's capabilities while maintaining the best practices already in place.
