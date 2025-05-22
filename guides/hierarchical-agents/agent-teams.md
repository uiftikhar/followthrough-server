
# Unified Supervisor Architecture for Multi-Team Agent System

You're absolutely right. Instead of creating separate supervisors for each workflow, we should implement a single, unified supervisor that routes to specialized teams like meeting-analysis and email-triage.

## Proposed Architecture

Looking at the LangGraph examples and your existing `SupervisorAgent`, I recommend implementing a hierarchical architecture:

```
                    ┌─────────────┐
                    │   Master    │
                    │ Supervisor  │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
┌──────────▼─────┐ ┌───────▼───────┐ ┌─────▼────────┐
│  Meeting Analysis│ │ Email Triage  │ │ Other Teams  │
│      Team       │ │     Team      │ │  (Future)    │
└──────────┬──────┘ └───────┬───────┘ └──────────────┘
           │                │
    ┌──────┴──────┐  ┌──────┴──────┐
    │ Topic Agent │  │Classification│
    │ Action Agent│  │Summarization│
    │ Summary etc.│  │Reply-Draft  │
    └─────────────┘  └─────────────┘
```

## Implementation Approach

### 1. Create a Master Supervisor

Refactor the existing `SupervisorAgent` to be a generic router:

```typescript
// src/langgraph/supervisor/master-supervisor.agent.ts
@Injectable()
export class MasterSupervisorAgent extends BaseAgent {
  constructor(
    protected readonly llmService: LlmService,
    private readonly agentFactory: AgentFactory,
  ) {
    super(llmService, {
      name: 'MasterSupervisorAgent',
      systemPrompt: MASTER_SUPERVISOR_PROMPT,
      llmOptions: { temperature: 0.1, model: 'gpt-4o' }
    });
  }

  async determineWorkflow(input: any): Promise<string> {
    // Logic to determine which team should handle the input
    // Based on input type, content, etc.
    if (input.type === 'email') {
      return 'email_triage';
    } else if (input.type === 'meeting_transcript') {
      return 'meeting_analysis';
    }
    // Default fallback
    return 'unknown';
  }

  async routeToTeam(workflowType: string, input: any): Promise<any> {
    switch(workflowType) {
      case 'email_triage':
        return this.agentFactory.getEmailTriageTeam().processEmail(input);
      
      case 'meeting_analysis':
        return this.agentFactory.getMeetingAnalysisTeam().analyzeTranscript(input);
      
      default:
        throw new Error(`Unknown workflow type: ${workflowType}`);
    }
  }

  async process(input: any): Promise<any> {
    const workflowType = await this.determineWorkflow(input);
    return this.routeToTeam(workflowType, input);
  }
}
```

### 2. Create Team Managers

Each specialized team should have its own manager:

```typescript
// src/langgraph/agents/email-triage/email-triage-team.agent.ts
@Injectable()
export class EmailTriageTeamAgent extends BaseAgent {
  constructor(
    protected readonly llmService: LlmService,
    private readonly agentFactory: AgentFactory,
  ) {
    super(llmService, {
      name: 'EmailTriageTeamAgent',
      systemPrompt: EMAIL_TRIAGE_TEAM_PROMPT,
      llmOptions: { temperature: 0.2, model: 'gpt-4o' }
    });
  }

  async processEmail(email: any): Promise<any> {
    // Initialize state
    const state = this.initializeState(email);
    
    // Coordinate the workers
    const [
      classificationResult,
      summarizationResult,
      replyDraftResult
    ] = await Promise.all([
      this.agentFactory.getEmailClassificationWorker().classify(email),
      this.agentFactory.getEmailSummarizationWorker().summarize(email),
      this.agentFactory.getEmailReplyDraftWorker().generateReply(email)
    ]);
    
    // Combine results
    return {
      message_id: email.id,
      priority: classificationResult.priority,
      summary: summarizationResult.summary,
      draft_reply: replyDraftResult.draft
    };
  }
}
```

### 3. Update Agent Factory

Extend your `AgentFactory` to create all team managers and specialized workers:

```typescript
// src/langgraph/agents/agent.factory.ts
@Injectable()
export class AgentFactory {
  // Existing methods for meeting analysis agents
  
  // Email triage team and workers
  getEmailTriageTeam(): EmailTriageTeamAgent {
    return this.moduleRef.get(EmailTriageTeamAgent);
  }
  
  getEmailClassificationWorker(): ClassificationWorkerAgent {
    return this.moduleRef.get(ClassificationWorkerAgent);
  }
  
  getEmailSummarizationWorker(): SummarizationWorkerAgent {
    return this.moduleRef.get(SummarizationWorkerAgent);
  }
  
  getEmailReplyDraftWorker(): ReplyDraftWorkerAgent {
    return this.moduleRef.get(ReplyDraftWorkerAgent);
  }
}
```

### 4. Implement Worker Agents

Then implement each worker agent following the same pattern as your existing agents:

```typescript
// src/langgraph/agents/email-triage/workers/classification.worker.ts
@Injectable()
export class ClassificationWorkerAgent extends BaseAgent {
  constructor(protected readonly llmService: LlmService) {
    super(llmService, {
      name: 'ClassificationWorkerAgent',
      systemPrompt: EMAIL_CLASSIFICATION_PROMPT,
      llmOptions: { temperature: 0.1, model: 'gpt-4o' }
    });
  }

  async classify(email: any): Promise<{ priority: string; category: string }> {
    const model = this.getChatModel();
    
    // Construct appropriate prompt for email classification
    const messages = [
      new SystemMessage(EMAIL_CLASSIFICATION_PROMPT),
      new HumanMessage(`
        Classify this email by priority and category:
        
        From: ${email.from}
        Subject: ${email.subject}
        Body: ${email.body}
        
        Return a JSON with:
        - priority: "urgent", "normal", or "low"
        - category: appropriate category for this email
      `)
    ];
    
    const response = await model.invoke(messages);
    
    // Parse response
    try {
      const content = response.content.toString();
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
                       content.match(/```\n([\s\S]*?)\n```/) ||
                       content.match(/(\{[\s\S]*\})/);
      
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      return JSON.parse(jsonStr);
    } catch (error) {
      // Fallback if parsing fails
      return { priority: 'normal', category: 'unknown' };
    }
  }
}
```

## Benefits of This Approach

1. **Single entry point**: The master supervisor provides a unified interface for processing any input.

2. **Modularity**: Each team operates independently, making it easier to add new teams or modify existing ones.

3. **Specialized expertise**: Each team and worker can focus on its specific domain.

4. **Scalability**: Teams can work in parallel when processing different inputs.

5. **Consistent governance**: A single supervisor enforces consistent policies across all workflows.

This architecture follows the patterns demonstrated in the LangGraph examples you referenced, particularly the hierarchical team structure in [`hierarchical_agent_teams.ipynb`](https://github.com/langchain-ai/langgraphjs/blob/main/examples/multi_agent/hierarchical_agent_teams.ipynb).

Would you like me to provide more detailed implementation for any particular component of this architecture?
