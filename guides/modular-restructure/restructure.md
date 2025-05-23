
I'll analyze the current module structure and dependencies to identify the circular dependency issues and propose a better architecture.

Ran tool


Ran tool


Ran tool


Ran tool


Ran tool


Read file: src/database/database.module.ts

## Module Dependency Analysis Report

Based on my analysis of the codebase, I've identified the circular dependency issues and the current module structure. Here's a comprehensive breakdown:

## Current Circular Dependencies

### Primary Issue: RAG-Agents Circular Dependency
**Error Chain**: `AppModule → LanggraphModule → AgentsModule → RagAgentsModule → RagModule → MeetingAnalysisModule → AgentsModule`

**Root Cause**: 
- `RagAgentsModule` imports `RagModule` (with `forwardRef`)
- `RagModule` imports `MeetingAnalysisModule` (with `forwardRef`)  
- `MeetingAnalysisModule` imports `AgentsModule` (with `forwardRef`)
- `AgentsModule` imports `RagAgentsModule`

This creates a 4-way circular dependency that `forwardRef()` cannot resolve.

## Current Module Dependencies

### Core Infrastructure Modules (No Dependencies)
1. **ConfigModule** - Global configuration
2. **DatabaseModule** 
   - Imports: `ConfigModule`, `MeetingModule`
3. **StorageModule**
   - Imports: `ConfigModule`
4. **PineconeModule**
   - Imports: `ConfigModule`
5. **AuthModule**
   - Imports: `PassportModule`, `JwtModule`, `UserModule`

### Foundation Modules (Basic Dependencies)
6. **LlmModule**
   - Imports: `ConfigModule`
7. **StateModule**
   - Imports: `LangGraphPersistenceModule`
8. **EmbeddingModule**
   - Imports: `ConfigModule`, `LlmModule`, `PineconeModule`, `CacheModule`

### Complex Interdependent Modules (Circular Dependencies)
9. **RagModule** ⚠️
   - Imports: `ConfigModule`, `PineconeModule`, `EmbeddingModule`, `LlmModule`, `StateModule`, `LanggraphCoreModule`, `CacheModule`
   - **Circular**: `forwardRef(() => MeetingAnalysisModule)`

10. **RagAgentsModule** ⚠️
    - Imports: `LlmModule`, `StateModule`
    - **Circular**: `forwardRef(() => RagModule)`

11. **AgentsModule** ⚠️
    - Imports: `LlmModule`, `RagAgentsModule`

12. **LanggraphCoreModule**
    - Imports: `DatabaseModule`, `ConfigModule`, `LangGraphPersistenceModule`, `EventEmitterModule`

13. **MeetingAnalysisModule** ⚠️
    - Imports: `DatabaseModule`, `EventEmitterModule`, `LanggraphCoreModule`, `LlmModule`, `PineconeModule`, `EmbeddingModule`
    - **Circular**: `forwardRef(() => AgentsModule)`, `forwardRef(() => RagModule)`

14. **LanggraphModule**
    - Imports: `LanggraphCoreModule`, `EmbeddingModule`, `DatabaseModule`, `LlmModule`, `AgentsModule`, `EventEmitterModule`

15. **AppModule** (Root)
    - Imports: Most other modules

## Shared Functionality Analysis

### Common Services Used Across Multiple Modules:
1. **RAG Services** - Used by: `RagModule`, `RagAgentsModule`, `MeetingAnalysisModule`
2. **LLM Services** - Used by: `LlmModule`, `EmbeddingModule`, `RagModule`, `AgentsModule`, `MeetingAnalysisModule`
3. **State Management** - Used by: `StateModule`, `RagModule`, `AgentsModule`
4. **Graph Execution** - Used by: `LanggraphCoreModule`, `MeetingAnalysisModule`
5. **Agent Factory** - Used by: `AgentsModule`, `MeetingAnalysisModule`
6. **Embedding Services** - Used by: `EmbeddingModule`, `RagModule`, `PineconeModule`

## Proposed Solution: Shared Core Module Architecture

### 1. Create `SharedCoreModule` (Root Level)
This module will contain all shared functionality that multiple modules depend on:

```typescript
// src/shared/shared-core.module.ts
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    StorageModule,
    PineconeModule,
    LlmModule,
    StateModule,
    EmbeddingModule,
    CacheModule.register({
      ttl: 1800,
      max: 100,
    }),
  ],
  providers: [
    // RAG Services
    RetrievalService,
    RagService,
    AdaptiveRagService,
    
    // Agent Infrastructure
    AgentFactory,
    
    // Graph Infrastructure
    GraphExecutionService,
    TeamHandlerRegistry,
    EnhancedGraphService,
    
    // Token-based providers
    { provide: RAG_SERVICE, useClass: RagService },
    { provide: RETRIEVAL_SERVICE, useClass: RetrievalService },
    { provide: ADAPTIVE_RAG_SERVICE, useExisting: AdaptiveRagService },
  ],
  exports: [
    // Export all shared services
    RetrievalService,
    RagService,
    AdaptiveRagService,
    AgentFactory,
    GraphExecutionService,
    TeamHandlerRegistry,
    EnhancedGraphService,
    
    // Export tokens
    RAG_SERVICE,
    RETRIEVAL_SERVICE,
    ADAPTIVE_RAG_SERVICE,
    
    // Export imported modules for re-use
    ConfigModule,
    DatabaseModule,
    StorageModule,
    PineconeModule,
    LlmModule,
    StateModule,
    EmbeddingModule,
  ],
})
export class SharedCoreModule {}
```

### 2. Restructured Module Dependencies

#### **Feature Modules** (Import SharedCoreModule)
- **AgentsModule** - Only agent implementations, no RAG dependencies
- **MeetingAnalysisModule** - Business logic only
- **RagEnhancedAgentsModule** - RAG-specific agents

#### **Infrastructure Modules** (Used by SharedCoreModule)
- **ConfigModule**
- **DatabaseModule** 
- **StorageModule**
- **PineconeModule**
- **LlmModule**
- **StateModule**
- **EmbeddingModule**

### 3. Dependency Flow (No Circles)
```
AppModule
├── SharedCoreModule (contains all shared services)
│   ├── ConfigModule
│   ├── DatabaseModule
│   ├── StorageModule
│   ├── PineconeModule
│   ├── LlmModule
│   ├── StateModule
│   └── EmbeddingModule
├── AgentsModule (imports SharedCoreModule)
├── RagEnhancedAgentsModule (imports SharedCoreModule)
├── MeetingAnalysisModule (imports SharedCoreModule)
└── LanggraphModule (imports SharedCoreModule)
```

### 4. Benefits of This Architecture
1. **Eliminates Circular Dependencies** - All shared services are in one place
2. **Single Source of Truth** - Common services have one definition
3. **Easier Testing** - Mock SharedCoreModule for unit tests
4. **Better Performance** - Services are singletons across the app
5. **Cleaner Dependencies** - Feature modules only import what they need
6. **Scalable** - Easy to add new shared services

### 5. Migration Plan
1. **Phase 1**: Create `SharedCoreModule` with core services
2. **Phase 2**: Remove circular dependencies by moving shared services to `SharedCoreModule`
3. **Phase 3**: Update all feature modules to import `SharedCoreModule`
4. **Phase 4**: Clean up now-unused `forwardRef()` calls
5. **Phase 5**: Verify no circular dependencies remain

Would you like me to proceed with implementing this `SharedCoreModule` architecture to resolve the circular dependencies?
