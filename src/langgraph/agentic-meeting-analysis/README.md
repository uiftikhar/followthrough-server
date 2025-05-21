# RAG-Enhanced Meeting Analysis

This module provides context-aware meeting analysis capabilities using Retrieval Augmented Generation (RAG). It extends the base meeting analysis functionality with the ability to retrieve and use relevant information from previous meetings and documents.

## Key Features

- **Context-Aware Analysis**: Automatically retrieves relevant information from previous meetings
- **Multiple Analysis Types**: Topic extraction, action item identification, sentiment analysis, and summarization
- **Configurable Retrieval**: Fine-tune how much historical context to include
- **Enhanced Understanding**: Understands relationships between meetings over time

## Components

### Core Components

- **RagEnhancedAgent**: Base class that extends BaseAgent with RAG capabilities
- **RagMeetingAnalysisAgent**: Meeting-specific extension with specialized formatting and query mechanisms
- **RagTopicExtractionAgent**: Specialized agent for extracting topics with historical context

### Service Layer

- **AgenticMeetingAnalysisService**: Simplified interface for using the RAG-enhanced agents

## Usage Examples

```typescript
// Extract topics with historical context
const topics = await agenticMeetingAnalysisService.extractTopics(transcript, {
  meetingId: 'meeting-123',
  retrievalOptions: {
    includeHistoricalTopics: true,
    topK: 5,
    minScore: 0.7,
  }
});

// Process a meeting transcript with multiple analysis types
const result = await agenticMeetingAnalysisService.processMeetingTranscript(transcript, {
  meetingId: 'meeting-123',
  analyzeTopics: true,
  analyzeActionItems: true,
  analyzeSentiment: true,
  analyzeSummary: true,
});
```

## Architecture

The RAG-enhanced meeting analysis system uses a token-based dependency injection approach to avoid circular dependencies:

1. **Base Agent Layer**: The RagEnhancedAgent extends the BaseAgent with context retrieval capabilities
2. **Specialized Agents**: Agents like RagTopicExtractionAgent specialize in particular analysis tasks
3. **Service Layer**: The AgenticMeetingAnalysisService provides a simplified interface

## Configuration

You can configure the RAG behavior through:

- **Retrieval Options**: Control how many documents to retrieve and minimum relevance score
- **Expertise Selection**: Choose which type of analysis to perform
- **Specialized Queries**: Customize the queries used for retrieval

## Benefits of the RAG Approach

- **Improved Analysis Quality**: Access to historical context leads to more insightful analysis
- **Continuity Tracking**: Identify topics and action items that span multiple meetings
- **Relevant Context**: Automatically retrieve only the most relevant information
- **Flexible Integration**: Can be used standalone or integrated with the full meeting analysis pipeline 