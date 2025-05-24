import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  RagEnhancedAgent,
  RagAgentConfig,
  RagAgentOptions,
  AgentExpertise
} from '../../../rag/agents/rag-enhanced-agent';
import { IRagService } from '../../../rag/interfaces/rag-service.interface';
import { RetrievalOptions } from '../../../rag/retrieval.service';
import { RAG_SERVICE } from '../../../rag/constants/injection-tokens';
import { LLM_SERVICE } from '../../llm/constants/injection-tokens';
import { STATE_SERVICE } from '../../state/constants/injection-tokens';
import { LlmService } from '../../llm/llm.service';
import { StateService } from '../../state/state.service';
import {
  MEETING_CHUNK_ANALYSIS_PROMPT,
  MEETING_CHUNK_SUMMARY_PROMPT,
  FINAL_MEETING_SUMMARY_PROMPT,
} from '../../../instruction-promtps';
import { RagService } from '../../../rag/rag.service';
import { ChunkingService } from '../../../embedding/chunking.service';

// Define token locally to avoid circular dependency
export const RAG_MEETING_ANALYSIS_CONFIG = 'RAG_MEETING_ANALYSIS_CONFIG';

export interface RagMeetingAnalysisConfig extends RagAgentConfig {
  chunkSize?: number;
  chunkOverlap?: number;
}

// Define the output interfaces for summary generation workflow
export interface Decision {
  title: string;
  content: string;
}

export interface MeetingSummary {
  meetingTitle: string;
  summary: string;
  decisions: Decision[];
  next_steps?: string[];
}

export interface ChunkAnalysis {
  actionItems: any[];
  decisions: any[];
  questions: any[];
  keyTopics: any[];
}

export interface ChunkSummary {
  summary: string;
  meetingTitle: string;
  decisionPoints: any[];
}

/**
 * RAG-enhanced agent specialized ONLY for meeting summary generation
 * 
 * Workflow:
 * 1. Chunk large transcripts into manageable pieces
 * 2. Generate analysis for each chunk using MEETING_CHUNK_ANALYSIS_PROMPT
 * 3. Generate summary for each chunk using MEETING_CHUNK_SUMMARY_PROMPT  
 * 4. Combine all chunk summaries into final summary using FINAL_MEETING_SUMMARY_PROMPT
 */
@Injectable()
export class RagMeetingAnalysisAgent extends RagEnhancedAgent {
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;
  private readonly ragConfiguration: RagAgentOptions;
  protected readonly logger = new Logger(RagMeetingAnalysisAgent.name);

  constructor(
    @Inject(LLM_SERVICE) protected readonly llmService: LlmService,
    @Inject(STATE_SERVICE) protected readonly stateService: StateService,
    @Inject(RAG_SERVICE) protected readonly ragService: RagService,
    @Inject(RAG_MEETING_ANALYSIS_CONFIG) config: RagMeetingAnalysisConfig,
    private readonly chunkingService: ChunkingService,
  ) {
    // Configure for summary generation only
    const ragConfig = config.ragOptions || {
      includeRetrievedContext: true,
      retrievalOptions: {
        indexName: 'meeting-analysis',
        namespace: 'summaries', // Focus on summary-related context
        topK: 3,
        minScore: 0.7,
      },
    };

    super(llmService, stateService, ragService, {
      name: config.name || 'Meeting Summary Agent',
      systemPrompt: 'You are an AI assistant specialized in generating comprehensive meeting summaries.',
      llmOptions: config.llmOptions,
      ragOptions: ragConfig,
    });

    this.chunkSize = config.chunkSize || 4000; // ~4k tokens per chunk
    this.chunkOverlap = config.chunkOverlap || 200; // 200 token overlap
    this.ragConfiguration = ragConfig;
  }

  /**
   * Main method to generate a complete meeting summary from transcript
   */
  async generateMeetingSummary(
    transcript: string,
    options?: {
      meetingId?: string;
      participantNames?: string[];
      retrievalOptions?: RetrievalOptions;
    },
  ): Promise<MeetingSummary> {
    try {
      this.logger.log('Starting meeting summary generation');
      const meetingId = options?.meetingId || `meeting-${Date.now()}`;

      // Step 1: Chunk the transcript into manageable pieces
      const chunks = await this.chunkTranscript(transcript);
      this.logger.log(`Created ${chunks.length} chunks from transcript`);

      // Step 2: Process each chunk to generate analysis and summary
      const chunkSummaries: ChunkSummary[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        this.logger.log(`Processing chunk ${i + 1}/${chunks.length}`);
        
        // Generate chunk analysis first
        const chunkAnalysis = await this.analyzeChunk(chunks[i], {
          chunkNumber: i + 1,
          totalChunks: chunks.length,
          meetingId,
          ...options,
        });

        // Generate chunk summary based on analysis
        const chunkSummary = await this.summarizeChunk(chunkAnalysis, chunks[i], {
          chunkNumber: i + 1,
          totalChunks: chunks.length,
          meetingId,
          ...options,
        });

        chunkSummaries.push(chunkSummary);
      }

      // Step 3: Generate final comprehensive summary from all chunk summaries
      const finalSummary = await this.generateFinalSummary(chunkSummaries, {
        meetingId,
        originalTranscriptLength: transcript.length,
        ...options,
      });

      this.logger.log('Meeting summary generation completed');
      return finalSummary;

    } catch (error) {
      this.logger.error(`Error generating meeting summary: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Step 1: Chunk the transcript into manageable pieces
   */
  private async chunkTranscript(transcript: string): Promise<string[]> {
    try {
      // Use the chunking service to break down the transcript
      const chunks = this.chunkingService.smartChunk(transcript, {
        chunkSize: this.chunkSize,
        chunkOverlap: this.chunkOverlap,
        splitBy: 'sentence' // Use sentence-based chunking for better context
      });

      return chunks;
    } catch (error) {
      this.logger.warn(`Error using chunking service: ${error.message}. Using simple chunking.`);
      // Fallback to simple chunking
      return this.simpleChunk(transcript);
    }
  }

  /**
   * Simple fallback chunking method
   */
  private simpleChunk(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      let end = start + this.chunkSize;
      
      // Try to break at a sentence boundary
      if (end < text.length) {
        const sentenceEnd = text.lastIndexOf('.', end);
        if (sentenceEnd > start + this.chunkSize * 0.7) {
          end = sentenceEnd + 1;
        }
      }
      
      chunks.push(text.slice(start, end));
      start = end - this.chunkOverlap;
    }
    
    return chunks;
  }

  /**
   * Step 2a: Analyze a single chunk using MEETING_CHUNK_ANALYSIS_PROMPT
   */
  private async analyzeChunk(
    chunk: string,
    options: {
      chunkNumber: number;
      totalChunks: number;
      meetingId: string;
      participantNames?: string[];
      retrievalOptions?: RetrievalOptions;
    }
  ): Promise<ChunkAnalysis> {
    try {
      this.logger.log(`Analyzing chunk ${options.chunkNumber}/${options.totalChunks}`);

      // Create state for this chunk
      const state = {
        transcript: chunk,
        meetingId: options.meetingId,
        chunkNumber: options.chunkNumber,
        totalChunks: options.totalChunks,
        participantNames: options.participantNames || [],
      };

      // Enhance with RAG context
      const query = `Meeting chunk analysis: ${chunk.substring(0, 200)}...`;
      const enhancedState = await this.ragService.enhanceStateWithContext(
        state,
        query,
        options.retrievalOptions || this.ragConfiguration.retrievalOptions,
      );

      // Generate the prompt for chunk analysis
      const prompt = `${MEETING_CHUNK_ANALYSIS_PROMPT}

Meeting Transcript (Chunk ${options.chunkNumber}/${options.totalChunks}):
${chunk}

Please analyze this chunk and extract action items, decisions, questions, and key topics in the specified JSON format.`;

      // Execute LLM request
      const result = await this.executeLlmRequest(prompt, enhancedState);
      
      // Process and validate the result
      return this.processChunkAnalysisResult(result);

    } catch (error) {
      this.logger.error(`Error analyzing chunk ${options.chunkNumber}: ${error.message}`);
      // Return empty analysis on error
      return {
        actionItems: [],
        decisions: [],
        questions: [],
        keyTopics: []
      };
    }
  }

  /**
   * Step 2b: Summarize a chunk using MEETING_CHUNK_SUMMARY_PROMPT
   */
  private async summarizeChunk(
    chunkAnalysis: ChunkAnalysis,
    originalChunk: string,
    options: {
      chunkNumber: number;
      totalChunks: number;
      meetingId: string;
      participantNames?: string[];
      retrievalOptions?: RetrievalOptions;
    }
  ): Promise<ChunkSummary> {
    try {
      this.logger.log(`Summarizing chunk ${options.chunkNumber}/${options.totalChunks}`);

      // Create state for this chunk summary
      const state = {
        chunkAnalysis,
        originalChunk,
        meetingId: options.meetingId,
        chunkNumber: options.chunkNumber,
        totalChunks: options.totalChunks,
        participantNames: options.participantNames || [],
      };

      // Enhance with RAG context focused on summaries
      const query = `Meeting chunk summary: ${originalChunk.substring(0, 200)}...`;
      const enhancedState = await this.ragService.enhanceStateWithContext(
        state,
        query,
        { ...this.ragConfiguration.retrievalOptions, namespace: 'summaries' },
      );

      // Generate the prompt for chunk summary
      const prompt = `${MEETING_CHUNK_SUMMARY_PROMPT}

Chunk Analysis Results:
${JSON.stringify(chunkAnalysis, null, 2)}

Original Meeting Transcript (Chunk ${options.chunkNumber}/${options.totalChunks}):
${originalChunk}

Please generate a comprehensive summary for this chunk in the specified JSON format.`;

      // Execute LLM request
      const result = await this.executeLlmRequest(prompt, enhancedState);
      
      // Process and validate the result
      return this.processChunkSummaryResult(result);

    } catch (error) {
      this.logger.error(`Error summarizing chunk ${options.chunkNumber}: ${error.message}`);
      // Return basic summary on error
      return {
        summary: `Summary for chunk ${options.chunkNumber}: ${originalChunk.substring(0, 200)}...`,
        meetingTitle: `Meeting Chunk ${options.chunkNumber}`,
        decisionPoints: []
      };
    }
  }

  /**
   * Step 3: Generate final comprehensive summary using FINAL_MEETING_SUMMARY_PROMPT
   */
  private async generateFinalSummary(
    chunkSummaries: ChunkSummary[],
    options: {
      meetingId: string;
      originalTranscriptLength: number;
      participantNames?: string[];
      retrievalOptions?: RetrievalOptions;
    }
  ): Promise<MeetingSummary> {
    try {
      this.logger.log('Generating final comprehensive meeting summary');

      // Create state for final summary
      const state = {
        chunkSummaries,
        meetingId: options.meetingId,
        totalChunks: chunkSummaries.length,
        transcriptLength: options.originalTranscriptLength,
        participantNames: options.participantNames || [],
      };

      // Enhance with RAG context from previous meetings
      const query = `Final meeting summary: ${chunkSummaries.map(cs => cs.summary).join(' ').substring(0, 300)}...`;
      const enhancedState = await this.ragService.enhanceStateWithContext(
        state,
        query,
        { ...this.ragConfiguration.retrievalOptions, namespace: 'final-summaries' },
      );

      // Generate the prompt for final summary
      const prompt = `${FINAL_MEETING_SUMMARY_PROMPT}

Chunk Summaries from ${chunkSummaries.length} chunks:
${chunkSummaries.map((summary, index) => 
  `\n--- Chunk ${index + 1} Summary ---\n${JSON.stringify(summary, null, 2)}`
).join('\n')}

Please combine all these chunk summaries into one comprehensive final meeting summary in the specified JSON format.`;

      // Execute LLM request
      const result = await this.executeLlmRequest(prompt, enhancedState);
      
      // Process and validate the result
      return this.processFinalSummaryResult(result);

    } catch (error) {
      this.logger.error(`Error generating final summary: ${error.message}`);
      // Return basic summary on error
      return {
        meetingTitle: 'Meeting Summary',
        summary: chunkSummaries.map(cs => cs.summary).join(' '),
        decisions: chunkSummaries.flatMap(cs => cs.decisionPoints || []).map(dp => ({
          title: dp.title || 'Decision',
          content: dp.content || dp.description || 'Decision content'
        }))
      };
    }
  }

  /**
   * Process chunk analysis result from LLM
   */
  private processChunkAnalysisResult(result: any): ChunkAnalysis {
    try {
      // Try to parse as JSON first
      let parsed = result;
      if (typeof result === 'string') {
        // Clean and parse JSON
        const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        parsed = JSON.parse(cleaned);
      }

      return {
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
        questions: Array.isArray(parsed.questions) ? parsed.questions : [],
        keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics : []
      };
    } catch (error) {
      this.logger.warn(`Failed to parse chunk analysis result: ${error.message}`);
      return {
        actionItems: [],
        decisions: [],
        questions: [],
        keyTopics: []
      };
    }
  }

  /**
   * Process chunk summary result from LLM
   */
  private processChunkSummaryResult(result: any): ChunkSummary {
    try {
      // Try to parse as JSON first
      let parsed = result;
      if (typeof result === 'string') {
        // Clean and parse JSON
        const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        parsed = JSON.parse(cleaned);
      }

      return {
        summary: parsed.summary || 'No summary available',
        meetingTitle: parsed.meetingTitle || 'Meeting Chunk',
        decisionPoints: Array.isArray(parsed.decisionPoints) ? parsed.decisionPoints : []
      };
    } catch (error) {
      this.logger.warn(`Failed to parse chunk summary result: ${error.message}`);
      return {
        summary: typeof result === 'string' ? result.substring(0, 500) : 'No summary available',
        meetingTitle: 'Meeting Chunk',
        decisionPoints: []
      };
    }
  }

  /**
   * Process final summary result from LLM
   */
  private processFinalSummaryResult(result: any): MeetingSummary {
    try {
      // Try to parse as JSON first
      let parsed = result;
      if (typeof result === 'string') {
        // Clean and parse JSON
        const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        parsed = JSON.parse(cleaned);
      }

      return {
        meetingTitle: parsed.meetingTitle || 'Meeting Summary',
        summary: parsed.summary || 'No summary available',
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map((d: any) => ({
          title: d.title || 'Decision',
          content: d.content || d.description || 'Decision content'
        })) : [],
        next_steps: Array.isArray(parsed.next_steps) ? parsed.next_steps : undefined
      };
    } catch (error) {
      this.logger.warn(`Failed to parse final summary result: ${error.message}`);
      return {
        meetingTitle: 'Meeting Summary',
        summary: typeof result === 'string' ? result.substring(0, 1000) : 'No summary available',
        decisions: []
      };
    }
  }

  /**
   * Extract query from state (simplified for summary focus)
   */
  protected extractQueryFromState(state: any): string {
    if (state.transcript) {
      return `Meeting summary context: ${state.transcript.substring(0, 300)}...`;
    }
    return 'Meeting summary generation';
  }

  /**
   * Execute LLM request with enhanced context
   */
  protected async executeLlmRequest(prompt: string, state: any): Promise<any> {
    try {
      // Set up LLM options for summary generation
      const llmOptions = {
        model: 'gpt-4o',
        temperature: 0.3, // Lower temperature for more consistent summaries
      };
      
      const llm = this.llmService.getChatModel(llmOptions);
      
      // Add retrieved context if available
      let promptWithContext = prompt;
      if (state.retrievedContext) {
        const formattedContext = this.formatRetrievedContext(state.retrievedContext);
        if (formattedContext) {
          promptWithContext = `${formattedContext}\n\n${prompt}`;
        }
      }
      
      // Invoke the LLM
      const messages = [
        { role: 'system', content: 'You are an expert at generating structured meeting summaries. Always respond with valid JSON in the exact format requested.' },
        { role: 'user', content: promptWithContext }
      ];
      
      const response = await llm.invoke(messages);
      return response.content.toString();
      
    } catch (error) {
      this.logger.error(`Error executing LLM request: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Format retrieved context for summary generation
   */
  protected formatRetrievedContext(context: any): string {
    if (!context || !context.documents || context.documents.length === 0) {
      return '';
    }

    return `
RELEVANT MEETING SUMMARIES FROM PREVIOUS MEETINGS:
------------------------------------------------
${context.documents
  .map((doc: any, index: number) => {
    const metadata = doc.metadata || {};
    const meetingId = metadata.meetingId || 'unknown';
    const date = metadata.date || 'unknown';
    return `[Meeting ${meetingId} - ${date}]\n${doc.content}`;
  })
  .join('\n\n')}
------------------------------------------------

Use the above context to inform your summary generation, but focus on the current meeting content.
`;
  }
} 