import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { ChunkingService } from './chunking.service';
import { SentenceParserService } from './sentence-parser.service';
import { SimilarityUtilsService } from './similarity-utils.service';
import { ChunkOptimizationService } from './chunk-optimization.service';

export interface SemanticChunkingOptions {
  similarityThreshold?: number;
  minChunkSize?: number;
  maxChunkSize?: number;
  overlapStrategy?: 'none' | 'adjacent' | 'semantic';
  rebalanceChunks?: boolean;
  addContextPrefix?: boolean;
  parsingStrategy?: 'basic' | 'advanced' | 'semantic';
}

export interface ChunkedDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
}

@Injectable()
export class SemanticChunkingService {
  private readonly logger = new Logger(SemanticChunkingService.name);

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly chunkingService: ChunkingService,
    private readonly sentenceParser: SentenceParserService,
    private readonly similarityUtils: SimilarityUtilsService,
    private readonly chunkOptimization: ChunkOptimizationService,
  ) {
    this.logger.log('Semantic Chunking Service initialized');
  }

  /**
   * Process text into semantically coherent chunks
   */
  async chunkTextSemantically(
    text: string,
    options: SemanticChunkingOptions = {},
  ): Promise<string[]> {
    if (!text || text.trim().length === 0) {
      this.logger.warn('Empty text provided for semantic chunking');
      return [''];
    }

    this.logger.log(
      `Semantic chunking started for text of length ${text.length}`,
    );

    try {
      // Parse sentences based on strategy
      const strategy = options.parsingStrategy || 'advanced';
      this.logger.log(`Using parsing strategy: ${strategy}`);
      const sentences = this.parseSentences(text, strategy);
      this.logger.log(`Parsed ${sentences.length} sentences from text`);

      if (sentences.length <= 1) {
        this.logger.log(
          'Text contains only one sentence, returning without chunking',
        );
        return [text];
      }

      // Generate embeddings for each sentence
      this.logger.log('Generating embeddings for sentences');
      const embeddings = await this.generateSentenceEmbeddings(sentences);

      // If embedding generation failed, fall back to basic chunking
      if (!embeddings || embeddings.length !== sentences.length) {
        this.logger.warn(
          `Embedding generation failed or incomplete: expected ${sentences.length} embeddings but got ${embeddings ? embeddings.length : 0}`,
        );
        this.logger.warn('Falling back to basic chunking');
        return this.chunkingService.smartChunk(text, {
          chunkSize: options.maxChunkSize || 10,
          chunkOverlap: 2,
          splitBy: 'sentence',
        });
      }

      // Compute similarity matrix between sentences
      this.logger.log('Computing similarity matrix between sentences');
      const similarities =
        this.similarityUtils.computeSimilarityMatrix(embeddings);
      this.logger.log(
        `Similarity matrix computed with dimensions ${similarities.length}x${similarities[0]?.length || 0}`,
      );

      // Adjust threshold based on content if needed
      const baseThreshold = options.similarityThreshold || 0.75;
      const adjustedThreshold = this.similarityUtils.adjustThreshold(
        similarities,
        baseThreshold,
        text.length,
        Math.ceil(text.length / 1000), // Approximate target chunk count
      );

      this.logger.log(
        `Using similarity threshold: ${adjustedThreshold} (base: ${baseThreshold})`,
      );

      // Create initial chunks
      this.logger.log('Creating initial chunks based on similarity');
      const initialChunks = this.chunkOptimization.createInitialChunks(
        sentences,
        similarities,
        adjustedThreshold,
      );

      this.logger.log(`Created ${initialChunks.length} initial chunks`);

      // Skip optimization if not requested
      if (!options.rebalanceChunks) {
        // Convert index-based chunks to text
        const finalChunks = initialChunks.map((chunk) =>
          chunk.map((idx) => sentences[idx]).join(' '),
        );

        this.logger.log(`Returning ${finalChunks.length} unoptimized chunks`);
        return finalChunks;
      }

      // Optimize and rebalance chunks
      this.logger.log('Optimizing and rebalancing chunks');
      const optimizedChunks = this.chunkOptimization.optimizeAndRebalanceChunks(
        initialChunks,
        similarities,
        options.minChunkSize || 3,
        options.maxChunkSize || 15,
      );

      this.logger.log(`Produced ${optimizedChunks.length} optimized chunks`);

      // Convert to text chunks
      let finalChunks = optimizedChunks.map((chunk) =>
        chunk.map((idx) => sentences[idx]).join(' '),
      );

      // Apply context prefixes if requested
      if (options.addContextPrefix) {
        this.logger.log('Adding context prefixes to chunks');
        finalChunks = this.chunkOptimization.applyContextPrefixToChunks(
          optimizedChunks.map((chunk) => chunk.map((idx) => idx.toString())),
          sentences,
          text,
        );
      }

      this.logger.log(
        `Semantic chunking completed: ${finalChunks.length} chunks created`,
      );
      return finalChunks;
    } catch (error) {
      this.logger.error(
        `Error during semantic chunking: ${error.message}`,
        error.stack,
      );
      this.logger.warn('Falling back to basic chunking due to error');
      return this.chunkingService.smartChunk(text, {
        chunkSize: options.maxChunkSize || 10,
        chunkOverlap: 2,
        splitBy: 'sentence',
      });
    }
  }

  /**
   * Parse sentences based on the specified strategy
   */
  private parseSentences(
    text: string,
    strategy: 'basic' | 'advanced' | 'semantic',
  ): string[] {
    try {
      let sentences: string[] = [];
      switch (strategy) {
        case 'basic':
          this.logger.log('Using basic sentence parsing');
          sentences = this.sentenceParser.parseSentences(text);
          break;
        case 'semantic':
          this.logger.log('Using semantic boundary parsing');
          sentences = this.sentenceParser.splitBySemanticBoundaries(text);
          break;
        case 'advanced':
        default:
          this.logger.log('Using advanced sentence parsing');
          sentences = this.sentenceParser.parseAdvancedSentences(text);
          break;
      }

      this.logger.log(
        `Sentence parsing complete: ${sentences.length} sentences found`,
      );
      if (sentences.length === 0) {
        this.logger.warn(
          'No sentences found, using original text as single sentence',
        );
        return [text];
      }

      return sentences;
    } catch (error) {
      this.logger.error(
        `Error parsing sentences: ${error.message}`,
        error.stack,
      );
      this.logger.warn(
        'Returning original text as single sentence due to parsing error',
      );
      return [text];
    }
  }

  /**
   * Generate embeddings for sentences
   */
  private async generateSentenceEmbeddings(
    sentences: string[],
  ): Promise<number[][]> {
    try {
      this.logger.log(
        `Generating embeddings for ${sentences.length} sentences`,
      );

      // Process batches of sentences to avoid rate limits
      const batchSize = 20;
      const embeddingBatches: number[][] = [];
      let successfulEmbeddings = 0;
      let failedEmbeddings = 0;

      for (let i = 0; i < sentences.length; i += batchSize) {
        const batch = sentences.slice(i, i + batchSize);
        this.logger.log(
          `Processing embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(sentences.length / batchSize)}: ${batch.length} sentences`,
        );

        // Process each sentence in the batch
        const batchEmbeddings = await Promise.all(
          batch.map(async (sentence, batchIndex) => {
            try {
              // Generate embedding for this sentence
              const embedding =
                await this.embeddingService.generateEmbedding(sentence);
              successfulEmbeddings++;
              return embedding;
            } catch (error) {
              failedEmbeddings++;
              this.logger.error(
                `Error generating embedding for sentence ${i + batchIndex}: ${error.message}`,
              );
              // Return zero vector as fallback
              return new Array(1536).fill(0) as number[];
            }
          }),
        );

        embeddingBatches.push(...batchEmbeddings);
      }

      this.logger.log(
        `Embedding generation complete: ${successfulEmbeddings} successful, ${failedEmbeddings} failed`,
      );

      if (failedEmbeddings > 0) {
        this.logger.warn(
          `${failedEmbeddings}/${sentences.length} embeddings failed to generate`,
        );
      }

      return embeddingBatches;
    } catch (error) {
      this.logger.error(
        `Error in batch embedding generation: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Process a document with semantic chunking and metadata for each chunk
   */
  async chunkDocumentSemantically(
    document: {
      id: string;
      content: string;
      metadata?: Record<string, any>;
    },
    options: SemanticChunkingOptions = {},
  ): Promise<ChunkedDocument[]> {
    try {
      this.logger.log(
        `Processing document for semantic chunking: ${document.id}`,
      );
      const chunks = await this.chunkTextSemantically(
        document.content,
        options,
      );

      // If no chunks were generated, create at least one chunk with the original content
      if (chunks.length === 0) {
        this.logger.warn(
          `No semantic chunks generated for document ${document.id}, using full content`,
        );
        chunks.push(document.content);
      }

      const result = chunks.map((chunk, index) => ({
        id: `${document.id}-chunk-${index}`,
        content: chunk,
        metadata: {
          ...document.metadata,
          document_id: document.id,
          chunk_index: index,
          chunk_count: chunks.length,
          chunking_method: 'semantic',
        },
      }));

      this.logger.log(
        `Document chunking complete: ${result.length} chunks created for ${document.id}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error chunking document ${document.id}: ${error.message}`,
        error.stack,
      );
      // Create a single chunk as fallback
      return [
        {
          id: `${document.id}-chunk-0`,
          content: document.content,
          metadata: {
            ...document.metadata,
            document_id: document.id,
            chunk_index: 0,
            chunk_count: 1,
            chunking_method: 'fallback',
            error: error.message,
          },
        },
      ];
    }
  }

  /**
   * Process multiple documents with semantic chunking
   */
  async batchProcessDocuments(
    documents: Array<{
      id: string;
      content: string;
      metadata?: Record<string, any>;
    }>,
    options: SemanticChunkingOptions = {},
  ): Promise<ChunkedDocument[]> {
    this.logger.log(
      `Batch processing ${documents.length} documents with semantic chunking`,
    );

    const results: ChunkedDocument[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const doc of documents) {
      try {
        const docChunks = await this.chunkDocumentSemantically(doc, options);
        results.push(...docChunks);
        successCount++;
      } catch (error) {
        this.logger.error(
          `Error processing document ${doc.id}: ${error.message}`,
          error.stack,
        );
        // Add a fallback chunk
        results.push({
          id: `${doc.id}-chunk-error`,
          content: doc.content,
          metadata: {
            ...doc.metadata,
            document_id: doc.id,
            chunk_index: 0,
            chunk_count: 1,
            chunking_method: 'error_fallback',
            error: error.message,
          },
        });
        errorCount++;
      }
    }

    this.logger.log(
      `Generated ${results.length} semantic chunks from ${documents.length} documents`,
    );
    this.logger.log(
      `Processing summary: ${successCount} successful, ${errorCount} failed`,
    );

    return results;
  }
}
