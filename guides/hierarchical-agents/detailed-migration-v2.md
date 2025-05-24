
# Proposed Architecture for Hierarchical Agent System

## Core Design Principles

Rather than immediately fixing the circular dependency, I agree we should rethink the architecture to better align with separation of concerns and reduce code duplication. Here's a comprehensive approach:

## 1. Graph Infrastructure Layer

### BaseGraphBuilder (Abstract Class)
```typescript
abstract class BaseGraphBuilder<T> {
  protected abstract buildNodes(): Record<string, Function>;
  protected abstract defineEdges(graph: any): void;
  public abstract buildGraph(): Promise<any>;
}
```

### GraphExecutionService
```typescript
@Injectable()
class GraphExecutionService {
  // Handles execution of any graph, progress tracking, and state transitions
  async executeGraph<T>(graph: any, initialState: T): Promise<T>
  // Handles state transitioning and progress tracking
  attachProgressTracker(graph: any, sessionId: string): void
}
```

## 2. Domain-Specific Graph Implementations

### MeetingAnalysisGraphBuilder
```typescript
@Injectable()
class MeetingAnalysisGraphBuilder extends BaseGraphBuilder<MeetingAnalysisState> {
  // Implements meeting-specific graph building
}
```

### EmailTriageGraphBuilder
```typescript
@Injectable()
class EmailTriageGraphBuilder extends BaseGraphBuilder<EmailTriageState> {
  // Implements email-specific graph building
}
```

### SupervisorGraphBuilder
```typescript
@Injectable()
class SupervisorGraphBuilder extends BaseGraphBuilder<SupervisorState> {
  // Builds supervisor graph with routing capabilities
  // References other graph builders by NODE NAME ONLY, not by implementation
}
```

## 3. Domain Services

### MeetingAnalysisService
```typescript
@Injectable()
class MeetingAnalysisService {
  constructor(
    private meetingAnalysisGraphBuilder: MeetingAnalysisGraphBuilder,
    private graphExecutionService: GraphExecutionService
  ) {}
  
  // Handles meeting analysis domain logic
  // Uses the graph builder and executor but focuses on domain
}
```

### EmailTriageService
```typescript
@Injectable()
class EmailTriageService {
  // Similar to MeetingAnalysisService but for email
}
```

## 4. Workflow Coordination

### WorkflowCoordinationService
```typescript
@Injectable()
class WorkflowCoordinationService {
  constructor(
    private supervisorGraphBuilder: SupervisorGraphBuilder,
    private graphExecutionService: GraphExecutionService,
    private meetingAnalysisService: MeetingAnalysisService,
    private emailTriageService: EmailTriageService
  ) {}
  
  // Responsible for initializing supervisor graph
  // Handling session creation, high-level orchestration
}
```

### TeamHandlerRegistry
```typescript
@Injectable()
class TeamHandlerRegistry {
  private handlers: Map<string, TeamHandler> = new Map();
  
  registerHandler(teamName: string, handler: TeamHandler): void
  getHandler(teamName: string): TeamHandler
}

interface TeamHandler {
  process(state: any): Promise<any>;
}
```

## 5. Implementation Approach

1. **Define State Interfaces**: Create clear interfaces for each domain's state

2. **Implement Graph Building Layer**:
   - Build `BaseGraphBuilder` with common functionality
   - Implement domain-specific builders
   - Ensure each builder only depends on its own domain

3. **Implement Graph Execution Service**:
   - Handle execution logic independent of domain
   - Track progress, handle state transitions
   - Decouple from building logic

4. **Implement Domain Services**:
   - Focus on domain logic, not graph implementation
   - Use the appropriate graph builder and executor
   - Handle domain-specific data processing

5. **Implement Team Handler Registry**:
   - Create a registry that maps team names to handlers
   - Each domain service implements the `TeamHandler` interface
   - Supervisor node uses registry to delegate to appropriate service

6. **Configure Dependency Injection**:
   - Set up modules with proper dependencies
   - Use interfaces to decouple implementations
   - Register team handlers during module initialization

## 6. Flow Execution

1. User sends request to `MeetingAnalysisController`
2. Controller delegates to `WorkflowCoordinationService`
3. `WorkflowCoordinationService` creates session and initializes supervisor graph
4. Supervisor determines input type and uses `TeamHandlerRegistry` to get handler
5. Team handler (e.g., `MeetingAnalysisService`) processes the input:
   - Builds appropriate graph via its builder
   - Executes graph via GraphExecutionService
   - Returns results
6. Supervisor incorporates results and completes
7. `WorkflowCoordinationService` saves results and returns to user

## 7. Benefits

1. **Clear Separation of Concerns**:
   - Graph building separate from execution
   - Domain logic separate from infrastructure
   - No circular dependencies

2. **Reduced Code Duplication**:
   - Common graph functionality in base classes
   - Execution logic centralized

3. **Extensibility**:
   - New team types can be added by implementing `TeamHandler`
   - Each domain can have specialized graph logic

4. **Testability**:
   - Each component can be tested in isolation
   - Dependencies are explicit and can be mocked

This architecture provides a clean way to implement the hierarchical agent flow while maintaining separation of concerns and avoiding circular dependencies. The key insight is separating graph building, execution, and domain logic into distinct layers with clear interfaces between them.
