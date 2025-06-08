# LangGraph Development Guide for Meeting Analysis Systems

## Table of Contents

1. [Introduction to LangGraph](#1-introduction-to-langgraph)
2. [Core Architectural Patterns](#2-core-architectural-patterns)
   - [State Management](#state-management)
   - [Annotations API](#annotations-api)
   - [Graph Construction](#graph-construction)
   - [Message Passing](#message-passing)
3. [Multi-Agent Patterns](#3-multi-agent-patterns)
   - [Basic Multi-Agent Collaboration](#basic-multi-agent-collaboration)
   - [Agent Supervisor Pattern](#agent-supervisor-pattern)
   - [Hierarchical Agent Teams](#hierarchical-agent-teams)
   - [Team Composition Techniques](#team-composition-techniques)
4. [Tool Integration](#4-tool-integration)
   - [Tool Node Pattern](#tool-node-pattern)
   - [Tool Error Handling](#tool-error-handling)
   - [Parallel Tool Execution](#parallel-tool-execution)
   - [ReAct Agent Pattern](#react-agent-pattern)
5. [Workflow Patterns](#5-workflow-patterns)
   - [Sequential Workflows](#sequential-workflows)
   - [Conditional Workflows](#conditional-workflows)
   - [Memory and State Management](#memory-and-state-management)
   - [Graph Composition](#graph-composition)
6. [Meeting Analysis-Specific Implementation](#6-meeting-analysis-specific-implementation)
   - [Transcript Processing Flow](#transcript-processing-flow)
   - [Agent Specializations](#agent-specializations)
   - [Result Synthesis](#result-synthesis)
   - [Cross-Team Communication](#cross-team-communication)
7. [Best Practices](#7-best-practices)
   - [Testing Strategies](#testing-strategies)
   - [Debugging Workflows](#debugging-workflows)
   - [Performance Optimization](#performance-optimization)
   - [Error Recovery Patterns](#error-recovery-patterns)

## 1. Introduction to LangGraph

LangGraph is a framework for building stateful, multi-agent applications using LLMs. It provides a structured way to build complex workflows by representing them as graphs, where nodes can be LLMs, tools, or other components, and edges represent transitions between states.

### Key Concepts

- **StateGraph**: The core class representing a workflow as a directed graph
- **Nodes**: Components in the graph that perform operations
- **Edges**: Connections between nodes, defining the flow of execution
- **State**: The data that flows through the graph and is modified by nodes
- **Annotations**: A type-safe way to define state structure with reducers

## 2. Core Architectural Patterns

### State Management

LangGraph uses a centralized state management approach. The state is a structured object passed between nodes, with each node potentially modifying it.

```typescript
// Define your state type with a TypeScript interface
interface MeetingAnalysisState {
  messages: Message[];
  transcript?: string;
  topics?: Topic[];
  actions?: ActionItem[];
  summary?: string;
  currentPhase?: string;
}

// Create a state graph with this type
const workflow: any = new StateGraph<MeetingAnalysisState>({
  channels: {
    messages: { value: [], reducer: pushMessages },
    transcript: { value: undefined },
    // other channels...
  }
});
```

All state modifications should happen through well-defined reducers to maintain predictability.

### Annotations API

The recommended approach is to use the Annotations API for defining typed state with built-in reducers:

```typescript
import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";

// Define state schema with annotations
const MeetingAnalysisState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  transcript: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
  topics: Annotation<Topic[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  actions: Annotation<ActionItem[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  currentPhase: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "transcriptProcessing",
  }),
});

// Create a graph using this annotation
const graph: any = new StateGraph(MeetingAnalysisState);
```

The Annotations API provides several advantages:
- Type safety for state definition
- Built-in reducers for common operations
- Default values for state initialization
- Cleaner state management code

### Graph Construction

Graphs are built by adding nodes and connecting them with edges:

```typescript
// Add nodes
workflow
  .addNode("transcriptAnalyzer", transcriptAnalyzerNode)
  .addNode("topicExtractor", topicExtractorNode)
  .addNode("actionItemExtractor", actionItemExtractorNode)
  .addNode("summarizer", summarizerNode);

// Add edges
workflow
  .addEdge(START, "transcriptAnalyzer")
  .addEdge("transcriptAnalyzer", "topicExtractor")
  .addConditionalEdges(
    "topicExtractor",
    shouldExtractActions,
    {
      "true": "actionItemExtractor",
      "false": "summarizer"
    }
  )
  .addEdge("actionItemExtractor", "summarizer")
  .addEdge("summarizer", END);
```

### Message Passing

Agents communicate through a standardized message format:

```typescript
interface Message {
  role: "human" | "ai" | "tool" | "system";
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
}
```

Messages should be stored in the state and passed between nodes as needed.

## 3. Multi-Agent Patterns

### Basic Multi-Agent Collaboration

For simple collaboration, agents can communicate through shared state:

```typescript
// Using Annotations API for clean state definition
const CollaborationState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
});

const workflow: any = new StateGraph(CollaborationState);

workflow
  .addNode("agent1", agent1Node)
  .addNode("agent2", agent2Node)
  .addEdge(START, "agent1")
  .addEdge("agent1", "agent2")
  .addEdge("agent2", END);
```

### Agent Supervisor Pattern

The supervisor pattern uses a central agent to coordinate other specialized agents:

```typescript
// Define supervisor state with routing control
const SupervisorState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  next: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "SUPERVISOR",
  }),
  instructions: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "Analyze the request and decide which agent to call.",
  }),
});

// Create the supervisor agent
const supervisorAgent = await createTeamSupervisor(
  llm,
  "You are a supervisor tasked with coordinating specialized agents:" +
    " {team_members}. Given the user request and current state," +
    " respond with which agent should act next. When the task is complete," +
    " respond with FINISH.",
  ["RESEARCH", "ANALYSIS", "SUMMARY"],
);

// Create the supervision node
const supervisorNode = (state: typeof SupervisorState.State) => {
  return supervisorAgent(state);
};;

// Add all nodes
workflow
  .addNode("SUPERVISOR", supervisorNode)
  .addNode("RESEARCH", researchNode)
  .addNode("ANALYSIS", analysisNode)
  .addNode("SUMMARY", summaryNode);

// Route based on supervisor decisions
workflow
  .addEdge(START, "SUPERVISOR")
  .addConditionalEdges(
    "SUPERVISOR",
    (state) => state.next,
    {
      "RESEARCH": "RESEARCH",
      "ANALYSIS": "ANALYSIS",
      "SUMMARY": "SUMMARY",
      "FINISH": END,
    }
  );

// After each agent completes, return to supervisor
workflow
  .addEdge("RESEARCH", "SUPERVISOR")
  .addEdge("ANALYSIS", "SUPERVISOR")
  .addEdge("SUMMARY", "SUPERVISOR");
```

### Hierarchical Agent Teams

For complex tasks, organize agents into hierarchical teams:

```typescript
// Define team-specific state
const ResearchTeamState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  team_members: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => ["Search", "WebScraper"],
  }),
  next: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "supervisor",
  }),
  instructions: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "Research the given topic thoroughly.",
  }),
});

// Create team supervisor
const supervisorAgent = await createTeamSupervisor(
  llm,
  "You are a research team supervisor managing these workers: {team_members}." +
    " Given the current state and request, decide which worker should act next." +
    " When the research is complete, respond with FINISH.",
  ["Search", "WebScraper"],
);

// Create team worker nodes
const searchNode = (state: typeof ResearchTeamState.State) => {
  const stateModifier = agentStateModifier(
    "You are a research assistant who can search for up-to-date information.",
    [searchTool],
    state.team_members ?? ["Search"],
  );
  const searchAgent = createReactAgent({
    llm,
    tools: [searchTool],
    stateModifier,
  });
  return runAgentNode({ state, agent: searchAgent, name: "Search" });
};

const webScraperNode = (state: typeof ResearchTeamState.State) => {
  const stateModifier = agentStateModifier(
    "You are a research assistant who can scrape webpages for detailed information.",
    [scrapeWebpageTool],
    state.team_members ?? ["WebScraper"],
  );
  const scraperAgent = createReactAgent({
    llm,
    tools: [scrapeWebpageTool],
    stateModifier,
  });
  return runAgentNode({ state, agent: scraperAgent, name: "WebScraper" });
};

// Create team graph
const researchTeam: any = new StateGraph(ResearchTeamState);

// Add nodes to team graph
researchTeam
  .addNode("supervisor", (state) => supervisorAgent(state))
  .addNode("Search", searchNode)
  .addNode("WebScraper", webScraperNode);

// Add routing logic
researchTeam
  .addEdge(START, "supervisor")
  .addConditionalEdges(
    "supervisor",
    (state) => state.next,
    {
      "Search": "Search",
      "WebScraper": "WebScraper",
      "FINISH": END,
    }
  );

// Return to supervisor after each action
researchTeam
  .addEdge("Search", "supervisor")
  .addEdge("WebScraper", "supervisor");

// Compile the team
const researchTeamRunnable = researchTeam.compile();

// Create similar teams for analysis and summary...

// Create the main graph with all teams
const TopLevelState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  next: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "supervisor",
  }),
  instructions: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "Complete the assigned task.",
  }),
});

const mainGraph: any = new StateGraph({
  channels: TopLevelState,
});

// Create a top-level supervisor
const topSupervisorAgent = await createTeamSupervisor(
  llm,
  "You are the chief supervisor coordinating specialized teams: {team_members}." +
    " Based on the request and current state, which team should act next?" +
    " When the task is complete, respond with FINISH.",
  ["ResearchTeam", "AnalysisTeam", "SummaryTeam"],
);

// Add all teams to main graph
mainGraph
  .addNode("supervisor", (state) => topSupervisorAgent(state))
  .addNode("ResearchTeam", RunnableWithMessageHistory.from(researchTeamRunnable))
  .addNode("AnalysisTeam", RunnableWithMessageHistory.from(analysisTeamRunnable))
  .addNode("SummaryTeam", RunnableWithMessageHistory.from(summaryTeamRunnable));

// Add routing logic
mainGraph
  .addEdge(START, "supervisor")
  .addConditionalEdges(
    "supervisor",
    (state) => state.next,
    {
      "ResearchTeam": "ResearchTeam",
      "AnalysisTeam": "AnalysisTeam",
      "SummaryTeam": "SummaryTeam",
      "FINISH": END,
    }
  );

// Return to supervisor after each team completes
mainGraph
  .addEdge("ResearchTeam", "supervisor")
  .addEdge("AnalysisTeam", "supervisor")
  .addEdge("SummaryTeam", "supervisor");
```

### Team Composition Techniques

Different ways to build and compose agent teams:

1. **Horizontal Teams**: Peers with different skills collaborating on a task
2. **Vertical Teams**: Hierarchical structure with supervisors and workers
3. **Dynamic Teams**: Teams formed based on task requirements
4. **Specialized Teams**: Teams organized around specific domains or functions

Example of creating a team supervisor function:

```typescript
// Helper function to create team supervisors
async function createTeamSupervisor(
  llm: ChatModel,
  systemPrompt: string,
  teamMembers: string[],
) {
  return async (state: any) => {
    const formattedPrompt = systemPrompt.replace(
      "{team_members}",
      teamMembers.join(", "),
    );
    
    // Get last message or use instructions
    const lastMessage = state.messages.length > 0 
      ? state.messages[state.messages.length - 1]
      : { content: state.instructions };
    
    // Call LLM for decision
    const result = await llm.invoke([
      { role: "system", content: formattedPrompt },
      { role: "user", content: lastMessage.content },
    ]);
    
    // Extract decision
    const decision = result.content.trim();
    let nextNode = decision;
    
    if (teamMembers.includes(decision)) {
      nextNode = decision;
    } else if (decision.includes("FINISH")) {
      nextNode = "FINISH";
    }
    
    // Return state update
    return { next: nextNode };
  };
}
```

## 4. Tool Integration

### Tool Node Pattern

Use the `ToolNode` to standardize tool calling:

```typescript
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Define tools
const extractTopics = tool(
  async (input) => {
    // Implement topic extraction logic
    return JSON.stringify({ topics: ["Topic 1", "Topic 2"] });
  },
  {
    name: "extract_topics",
    description: "Extract topics from meeting transcript",
    schema: z.object({
      transcript: z.string().describe("The meeting transcript")
    })
  }
);

const extractActionItems = tool(
  async (input) => {
    // Implement action item extraction logic
    return JSON.stringify({ actionItems: ["Action 1", "Action 2"] });
  },
  {
    name: "extract_action_items",
    description: "Extract action items from meeting transcript",
    schema: z.object({
      transcript: z.string().describe("The meeting transcript")
    })
  }
);

// Create a tool node with these tools
const toolNode = new ToolNode([extractTopics, extractActionItems]);

// Add to graph
workflow.addNode("tools", toolNode);

// Define a condition to check if we need to call tools
const shouldCallTools = (state) => {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage.role === "ai" && lastMessage.tool_calls?.length > 0) {
    return "tools";
  }
  return "no_tools";
};

// Add conditional edge for tool calling
workflow.addConditionalEdges(
  "agent",
  shouldCallTools,
  {
    "tools": "tools",
    "no_tools": "next_step"
  }
);
```

### Tool Error Handling

Handle tool errors gracefully:

```typescript
// Define a tool with error handling
const searchTool = tool(
  async (input) => {
    try {
      // Attempt to search
      const results = await searchApi(input.query);
      return JSON.stringify(results);
    } catch (error) {
      // Handle error gracefully
      return JSON.stringify({ 
        error: true, 
        message: `Search failed: ${error.message}`
      });
    }
  },
  {
    name: "search",
    description: "Search for information",
    schema: z.object({
      query: z.string().describe("The search query")
    })
  }
);

// Create a node to check for tool errors
const handleToolErrors = (state) => {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage.role === "tool" && lastMessage.content.includes("error")) {
    // Handle error - add a system message explaining the issue
    return {
      messages: [
        ...state.messages,
        {
          role: "system",
          content: "There was an error with the tool call. Please try a different approach."
        }
      ]
    };
  }
  return state;
};

workflow
  .addNode("tools", toolNode)
  .addNode("errorHandler", handleToolErrors)
  .addEdge("tools", "errorHandler");
```

### Parallel Tool Execution

For efficiency, execute tools in parallel when appropriate:

```typescript
// Process multiple tool calls in parallel
const messageWithMultipleToolCalls = new AIMessage({
  content: "",
  tool_calls: [
    {
      name: "extract_topics",
      args: { transcript: "..." },
      id: "tool_call_id_1",
      type: "tool_call",
    },
    {
      name: "extract_action_items",
      args: { transcript: "..." },
      id: "tool_call_id_2",
      type: "tool_call",
    }
  ]
});

// ToolNode will process these in parallel
const result = await toolNode.invoke({ 
  messages: [messageWithMultipleToolCalls] 
});
```

### ReAct Agent Pattern

Use the prebuilt `createReactAgent` function for agents that need to reason and act:

```typescript
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { z } from "zod";

// Define a state modifier function
const stateModifier = agentStateModifier(
  "You are a transcript analysis specialist who can extract key information.",
  [extractTopicsTool, extractActionItemsTool],
  ["Analyzer"]
);

// Create a ReAct agent
const analyzerAgent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4" }),
  tools: [extractTopicsTool, extractActionItemsTool],
  stateModifier,
});

// Create a node using the ReAct agent
const analyzerNode = (state) => {
  return runAgentNode({ 
    state, 
    agent: analyzerAgent, 
    name: "Analyzer"
  });
};

// Helper function to run an agent node
function runAgentNode({ state, agent, name }) {
  // Special processing for first-time messages
  const messages = state.messages || [];
  const lastMessage = messages.length > 0 
    ? messages[messages.length - 1] 
    : { role: "user", content: state.instructions || "Analyze the transcript" };
  
  // Invoke the agent
  return agent.invoke({
    messages: [...messages],
    name
  });
}
```

## 5. Workflow Patterns

### Sequential Workflows

For simple linear processes:

```typescript
workflow
  .addEdge(START, "step1")
  .addEdge("step1", "step2")
  .addEdge("step2", "step3")
  .addEdge("step3", END);
```

### Conditional Workflows

For branching logic:

```typescript
const checkCondition = (state) => {
  // Check some condition and return a string key
  if (state.someCondition) {
    return "condition_met";
  } else {
    return "condition_not_met";
  }
};

workflow
  .addConditionalEdges(
    "decision_point",
    checkCondition,
    {
      "condition_met": "path_a",
      "condition_not_met": "path_b"
    }
  );
```

### Memory and State Management

Maintain persistent memory across runs:

```typescript
import { MemoryManager } from "@langchain/langgraph/memory";

// Create a memory manager
const memoryManager = new MemoryManager({
  storage: new RedisStorage({ client: redisClient }),
  ttl: 3600 // 1 hour time-to-live
});

// Define state with history tracking
const PersistentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  memory: Annotation<Record<string, any>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
});

// Use memory in your graph
const workflow: any = new StateGraph(PersistentState);

// Load previous state before running
const sessionId = "user123";
const previousState = await memoryManager.load(sessionId);
const initialState = previousState || PersistentState.getDefaultValue();

// Run graph
const result = await workflow.invoke(initialState);

// Save state after running
await memoryManager.save(sessionId, result);
```

### Graph Composition

Combine multiple graphs together for complex workflows:

```typescript
// Create subgraphs for different processing stages
const preprocessingGraph: any = new StateGraph(PreprocessingState).compile();

const analysisGraph: any = new StateGraph(AnalysisState).compile();

const synthesisGraph: any = new StateGraph(SynthesisState).compile();

// Create a main graph that composes the subgraphs
const mainGraph: any = new StateGraph(MainState);

// Add the subgraphs as nodes
mainGraph
  .addNode("preprocessing", preprocessingGraph)
  .addNode("analysis", analysisGraph)
  .addNode("synthesis", synthesisGraph);

// Connect the subgraphs sequentially
mainGraph
  .addEdge(START, "preprocessing")
  .addEdge("preprocessing", "analysis")
  .addEdge("analysis", "synthesis")
  .addEdge("synthesis", END);

// Or add conditional routing between subgraphs
mainGraph
  .addEdge(START, "preprocessing")
  .addConditionalEdges(
    "preprocessing",
    (state) => state.needsAnalysis ? "analysis" : "synthesis",
    {
      "true": "analysis",
      "false": "synthesis"
    }
  )
  .addEdge("analysis", "synthesis")
  .addEdge("synthesis", END);
```

## 6. Meeting Analysis-Specific Implementation

### Transcript Processing Flow

A typical meeting analysis flow:

```typescript
// Define state with annotations
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
  actionItems: Annotation<ActionItem[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  decisions: Annotation<Decision[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  sentiment: Annotation<SentimentAnalysis>({
    reducer: (x, y) => y ?? x,
  }),
  summary: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
});

// Create the graph
const meetingAnalysis: any = new StateGraph(MeetingAnalysisState);

// Define all nodes
meetingAnalysis
  .addNode("transcriptProcessor", transcriptProcessorNode)
  .addNode("topicExtractor", topicExtractorNode)
  .addNode("actionItemExtractor", actionItemExtractorNode)
  .addNode("decisionExtractor", decisionExtractorNode)
  .addNode("sentimentAnalyzer", sentimentAnalyzerNode)
  .addNode("summarizer", summarizerNode);

// Connect nodes with edges
meetingAnalysis
  .addEdge(START, "transcriptProcessor")
  .addEdge("transcriptProcessor", "topicExtractor")
  .addEdge("topicExtractor", "actionItemExtractor")
  .addEdge("actionItemExtractor", "decisionExtractor")
  .addEdge("decisionExtractor", "sentimentAnalyzer")
  .addEdge("sentimentAnalyzer", "summarizer")
  .addEdge("summarizer", END);

// Compile the graph
const meetingAnalysisApp = meetingAnalysis.compile();
```

### Agent Specializations

Define specialized agents for different aspects of meeting analysis:

```typescript
// Create a specialized agent for topic extraction using ReAct pattern
const topicExtractionAgent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4" }),
  tools: [extractTopicsTool],
  stateModifier: agentStateModifier(
    "You are a topic extraction specialist. Given a meeting transcript, identify the key topics discussed.",
    [extractTopicsTool],
    ["TopicExtractor"],
  ),
});

// Create a specialized agent for action items
const actionItemAgent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4" }),
  tools: [extractActionItemsTool],
  stateModifier: agentStateModifier(
    "You are an action item specialist. Given a meeting transcript, identify all action items, their assignees, and deadlines.",
    [extractActionItemsTool],
    ["ActionItemExtractor"],
  ),
});

// Create nodes using these agents
const topicNode = (state) => {
  return runAgentNode({
    state,
    agent: topicExtractionAgent,
    name: "TopicExtractor",
  });
};

const actionItemNode = (state) => {
  return runAgentNode({
    state,
    agent: actionItemAgent,
    name: "ActionItemExtractor",
  });
};
```

### Result Synthesis

Combine outputs from different agents:

```typescript
const synthesizeResults = async (state) => {
  // Gather all analysis results
  const { transcript, topics, actionItems, decisions, sentiment } = state;
  
  // Create a prompt for the summarization agent
  const prompt = `
    Please synthesize the following meeting analysis results:
    
    Topics: ${JSON.stringify(topics)}
    Action Items: ${JSON.stringify(actionItems)}
    Decisions: ${JSON.stringify(decisions)}
    Sentiment: ${JSON.stringify(sentiment)}
    
    Create a comprehensive executive summary of the meeting.
  `;
  
  // Call the LLM
  const model = new ChatOpenAI({ model: "gpt-4" });
  const response = await model.invoke([
    { role: "system", content: "You are a meeting analysis expert." },
    { role: "user", content: prompt }
  ]);
  
  // Update state with the summary
  return {
    summary: response.content
  };
};

// Add as a node in the graph
meetingAnalysis.addNode("resultSynthesizer", synthesizeResults);
```

### Cross-Team Communication

Facilitate communication between different teams in a hierarchical system:

```typescript
// Define a cross-team message format
interface TeamMessage {
  fromTeam: string;
  toTeam: string;
  subject: string;
  content: string;
  metadata?: Record<string, any>;
}

// Add a message passing channel to state
const CrossTeamState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  teamMessages: Annotation<TeamMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});

// Create a message routing node
const messageRouter = (state: typeof CrossTeamState.State) => {
  const { teamMessages } = state;
  if (teamMessages.length === 0) return state;
  
  // Process the latest team message
  const latestMessage = teamMessages[teamMessages.length - 1];
  
  // Create a message for the target team
  const targetTeamMessage: BaseMessage = {
    role: "system",
    content: `Message from ${latestMessage.fromTeam}: ${latestMessage.content}`,
    name: latestMessage.fromTeam,
  };
  
  // Add message to state and remove from queue
  return {
    messages: [targetTeamMessage],
    teamMessages: teamMessages.slice(0, -1),
  };
};

// Add message routing to the workflow
workflow
  .addNode("messageRouter", messageRouter)
  .addConditionalEdges(
    "supervisor",
    (state) => state.teamMessages.length > 0 ? "route_message" : "proceed",
    {
      "route_message": "messageRouter",
      "proceed": determinateNextStep,
    }
  );
```

## 7. Best Practices

### Testing Strategies

Test your graph components independently:

```typescript
// Test a single node
test("Topic extractor node should extract topics correctly", async () => {
  const state = MeetingAnalysisState.create({
    transcript: "Let's discuss the project timeline and budget concerns...",
    topics: [],
  });
  
  const result = await topicExtractorNode(state);
  
  expect(result.topics).toHaveLength(2);
  expect(result.topics[0].name).toBe("Project Timeline");
  expect(result.topics[1].name).toBe("Budget Concerns");
});

// Test a subgraph
test("Analysis subgraph should process transcript correctly", async () => {
  const initialState = MeetingAnalysisState.create({
    transcript: "Let's discuss the project timeline and budget concerns...",
  });
  
  const result = await analysisSubgraph.invoke(initialState);
  
  expect(result.topics).toBeDefined();
  expect(result.actionItems).toBeDefined();
});

// Test conditional edges
test("Conditional edge should route correctly", async () => {
  const state = MeetingAnalysisState.create({
    someCondition: true,
  });
  
  const route = checkCondition(state);
  expect(route).toBe("condition_met");
});
```

### Debugging Workflows

Use callbacks for debugging:

```typescript
// Create a logger callback
const loggerCallback = {
  handleChainStart: async (chain, inputs) => {
    console.log(`Starting ${chain.id}`, JSON.stringify(inputs, null, 2));
  },
  handleChainEnd: async (chain, outputs) => {
    console.log(`Finished ${chain.id}`, JSON.stringify(outputs, null, 2));
  },
  handleChainError: async (chain, error) => {
    console.error(`Error in ${chain.id}`, error);
  },
  handleToolStart: async (tool, input) => {
    console.log(`Starting tool ${tool.name}`, input);
  },
  handleToolEnd: async (tool, output) => {
    console.log(`Tool ${tool.name} returned:`, output);
  },
  handleToolError: async (tool, error) => {
    console.error(`Error in tool ${tool.name}`, error);
  },
};

// Use the callback when invoking the graph
const result = await workflow.invoke(initialState, {
  callbacks: [loggerCallback],
});

// Create a visualization of the graph
const graphViz = await workflow.drawMermaid("full");
console.log(graphViz);
```

# 8. Retrieval Augmented Generation (RAG) Implementation

## 8.1 RAG Architecture in LangGraph

Retrieval Augmented Generation (RAG) enhances LLM responses by providing relevant context from external knowledge sources. In our meeting analysis system, RAG enables agents to:

- Reference historical meeting information
- Retrieve relevant context from transcripts
- Support agents with domain-specific knowledge
- Provide evidence-based responses

### Key Components of RAG

```mermaid
graph TD
    A[User Query/Transcript] --> B[Query Analysis]
    B --> C[Vector Embedding Generation]
    C --> D[Similarity Search in Vector DB]
    D --> E[Context Retrieval]
    E --> F[Context Integration]
    F --> G[LLM Response Generation]
    G --> H[Response Delivery]
    
    I[Document Processing] -.-> J[Document Chunking]
    J -.-> K[Embedding Generation]
    K -.-> L[Vector Storage]
    L -.-> D
```

### RAG Implementation Patterns

LangGraph supports several RAG implementation patterns:

1. **Basic RAG**: Simple retrieval and generation
2. **Adaptive RAG**: Dynamically decides retrieval strategy
3. **Agentic RAG**: Uses agents to process and enhance retrieval
4. **CRAG (Critic RAG)**: Uses a critic to evaluate and refine retrievals
5. **Self-RAG**: The model evaluates and improves its own retrievals

## 8.2 RAG Integration with Agents

In our system, RAG is integrated with the agent architecture through:

```typescript
// Define RAG-enabled state in LangGraph
const MeetingAnalysisWithRAGState = Annotation.Root({
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
  context: Annotation<RetrievedContext[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  // Other state properties
});

// Example of agent node with RAG capability
const topicExtractionWithContextNode = async (state: typeof MeetingAnalysisWithRAGState.State) => {
  // 1. Extract potential search terms from transcript
  const searchTerms = extractSearchTerms(state.transcript);
  
  // 2. Retrieve context for each search term
  const context = await ragService.retrieveContext(searchTerms);
  
  // 3. Extract topics with enhanced context
  const topics = await topicAgent.extractTopicsWithContext(state.transcript, context);
  
  // 4. Update state with topics and context
  return {
    ...state,
    topics,
    context,
  };
};
```

## 8.3 Pinecone Integration for RAG

Pinecone serves as our vector database for RAG implementation. It stores:

1. **Meeting Transcript Embeddings**: Vector representations of transcript chunks
2. **User Context Embeddings**: Contextual information specific to users
3. **Previous Analysis Results**: Embeddings of summaries, topics, action items
4. **Domain Knowledge**: Industry-specific information to support analysis

### Setting Up Pinecone Service in NestJS

```typescript
@Injectable()
export class PineconeService {
  private readonly indexes: Record<string, Index>;
  
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger
  ) {
    this.initializeIndexes();
  }
  
  private async initializeIndexes() {
    // Initialize Pinecone client and indexes
  }
  
  async storeEmbeddings(indexName: string, documents: Document[]): Promise<void> {
    // Store document embeddings in Pinecone
  }
  
  async retrieveSimilar(indexName: string, query: string, options?: QueryOptions): Promise<Document[]> {
    // Retrieve similar documents from Pinecone
  }
}
```

## 8.4 Dynamic RAG Graph Implementation

Our meeting analysis system uses a dynamic graph approach for RAG:

```typescript
@Injectable()
export class DynamicRAGService {
  constructor(
    private readonly pineconeService: PineconeService,
    private readonly embeddingService: EmbeddingService,
    private readonly stateService: StateService,
    private readonly logger: LoggerService
  ) {}
  
  async createRAGGraph(): Promise<DynamicGraphService<RAGState>> {
    const graph = new DynamicGraphService<RAGState>();
    
    // Add query analysis node
    await graph.applyModification({
      id: uuidv4(),
      type: GraphModificationType.ADD_NODE,
      timestamp: Date.now(),
      node: {
        id: 'queryAnalysis',
        type: 'processor',
        label: 'Query Analysis',
        handler: this.queryAnalysisNode.bind(this)
      }
    });
    
    // Add context retrieval node
    await graph.applyModification({
      id: uuidv4(),
      type: GraphModificationType.ADD_NODE,
      timestamp: Date.now(),
      node: {
        id: 'contextRetrieval',
        type: 'processor',
        label: 'Context Retrieval',
        handler: this.contextRetrievalNode.bind(this)
      }
    });
    
    // Add response generation node
    await graph.applyModification({
      id: uuidv4(),
      type: GraphModificationType.ADD_NODE,
      timestamp: Date.now(),
      node: {
        id: 'responseGeneration',
        type: 'processor',
        label: 'Response Generation',
        handler: this.responseGenerationNode.bind(this)
      }
    });
    
    // Add edges connecting nodes
    await graph.applyModification({
      id: uuidv4(),
      type: GraphModificationType.ADD_EDGE,
      timestamp: Date.now(),
      edge: {
        id: 'start_to_query',
        source: START,
        target: 'queryAnalysis',
        label: 'Start → Query Analysis'
      }
    });
    
    // Add remaining edges
    // ...
    
    return graph;
  }
  
  // Node handler implementations
  // ...
}
```

## 8.5 RAG Implementation Best Practices

1. **Chunk Documents Intelligently**:
   - Use semantic chunking based on meaning, not just token count
   - Maintain context between chunks
   - Create overlapping chunks to avoid missing information at boundaries

2. **Optimize Embedding Strategy**:
   - Use appropriate embedding models for your domain
   - Consider hybrid search (combining semantic and keyword search)
   - Use dimension reduction techniques for better performance

3. **Implement Caching**:
   - Cache embeddings to reduce API calls
   - Cache frequent query results
   - Implement TTL for cache entries

4. **Context Integration**:
   - Use citation-aware prompting techniques
   - Sort retrieved context by relevance
   - Limit context size to balance relevance and token consumption

5. **Evaluate RAG Performance**:
   - Track retrieval precision and recall
   - Measure end-to-end response quality
   - Compare different chunking and embedding strategies

### Performance Optimization

Optimize performance through parallelization and caching:

```typescript
// Run independent analyses in parallel
const parallelAnalysis = async (state) => {
  const { transcript } = state;
  
  // Run extractions in parallel
  const [topics, actionItems, sentiment] = await Promise.all([
    extractTopics(transcript),
    extractActionItems(transcript),
    analyzeSentiment(transcript),
  ]);
  
  // Return a comprehensive state update
  return {
    topics,
    actionItems,
    sentiment,
  };
};

// Use caching for expensive operations
import { cacheable } from "@langchain/core/caching";

const cachedTranscriptProcessor = cacheable(
  async (transcript) => {
    // Expensive processing
    return processedTranscript;
  },
  {
    ttl: 3600, // 1 hour cache
    namespace: "transcript-processing",
  }
);

// Add timeout handling for long-running operations
const withTimeout = async (promise, timeoutMs) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

// Use with a node
const reliableNode = async (state) => {
  try {
    const result = await withTimeout(
      expensiveOperation(state),
      10000 // 10 second timeout
    );
    return result;
  } catch (error) {
    console.error("Operation failed or timed out", error);
    return { error: "Processing failed, using fallback approach" };
  }
};
```

### Error Recovery Patterns

Implement resilient error handling for multi-agent systems:

```typescript
// Define an error recovery node
const errorRecoveryNode = async (state) => {
  const { error, lastSuccessfulState } = state;
  
  if (!error) return state;
  
  // Log the error
  console.error("Recovering from error:", error);
  
  // Create a diagnostic message
  const diagnosticMessage = {
    role: "system",
    content: `An error occurred: ${error.message}. Attempting recovery...`,
  };
  
  // Attempt to recover using last known good state
  return {
    ...lastSuccessfulState,
    messages: [...lastSuccessfulState.messages, diagnosticMessage],
    recovery: {
      attempted: true,
      timestamp: Date.now(),
      errorDetails: error.message,
    },
  };
};

// Add error tracking to state
const ResilientState = Annotation.Root({
  // Regular state fields...
  error: Annotation<Error | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  lastSuccessfulState: Annotation<any>({
    reducer: (x, y) => y ?? x,
    default: () => ({}),
  }),
  recovery: Annotation<Record<string, any>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
});

// Add try/catch wrappers around node execution
const withErrorHandling = (node) => async (state) => {
  try {
    // Save current state as last successful before running
    const newState = {
      ...state,
      lastSuccessfulState: { ...state },
    };
    
    // Run the node
    const result = await node(newState);
    
    // Clear any error state
    return {
      ...result,
      error: null,
    };
  } catch (error) {
    // Capture error in state
    return {
      ...state,
      error,
    };
  }
};

// Wrap nodes with error handling
workflow
  .addNode("riskySomeNode", withErrorHandling(someNode))
  .addNode("errorRecovery", errorRecoveryNode);

// Add conditional edge for error handling
workflow
  .addConditionalEdges(
    "riskySomeNode",
    (state) => state.error ? "error" : "success",
    {
      "error": "errorRecovery",
      "success": "nextNode",
    }
  );
```

---

By following these patterns and best practices, you can build a robust, maintainable, and efficient meeting analysis system using LangGraph.