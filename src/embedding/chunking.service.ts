import { Injectable, Logger } from '@nestjs/common';

export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separator?: string;
  splitBy?: 'token' | 'sentence' | 'paragraph';
  minChunkSize?: number;
}

/**
 * Service for chunking documents for embedding
 */
@Injectable()
export class ChunkingService {
  private readonly logger = new Logger(ChunkingService.name);

  /**
   * Chunk text by tokens (words)
   */
  chunkByTokens(
    text: string,
    options: {
      chunkSize?: number;
      chunkOverlap?: number;
      separator?: string;
      minChunkSize?: number;
    } = {},
  ): string[] {
    if (!text || text.trim().length === 0) {
      return [''];
    }

    const chunkSize = options.chunkSize || 1000;
    const chunkOverlap = options.chunkOverlap || 200;
    const separator = options.separator || ' ';
    const minChunkSize = options.minChunkSize || 1;

    const tokens = text.split(separator);

    // If text is shorter than chunk size, return as single chunk
    if (tokens.length <= chunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentChunkLength = 0;

    for (const token of tokens) {
      // Add token to current chunk
      currentChunk.push(token);
      currentChunkLength += 1;

      // If chunk is full, add it to chunks and start a new one with overlap
      if (currentChunkLength >= chunkSize) {
        chunks.push(currentChunk.join(separator));

        // Start new chunk with overlap
        const overlapTokens = currentChunk.slice(-chunkOverlap);
        currentChunk = [...overlapTokens];
        currentChunkLength = overlapTokens.length;
      }
    }

    // Add the last chunk if it's not empty and meets minimum size
    if (currentChunk.length > 0 && currentChunk.length >= minChunkSize) {
      chunks.push(currentChunk.join(separator));
    }

    return chunks;
  }

  /**
   * Chunk text by sentences
   */
  chunkBySentences(
    text: string,
    options: {
      chunkSize?: number;
      chunkOverlap?: number;
      minChunkSize?: number;
    } = {},
  ): string[] {
    const chunkSize = options.chunkSize || 5; // Number of sentences per chunk
    const chunkOverlap = options.chunkOverlap || 1; // Overlap in sentences
    const minChunkSize = options.minChunkSize || 1;

    // Simple sentence splitting - for production consider a more robust approach
    const sentences = text
      .replace(/([.!?])\s+/g, '$1|')
      .split('|')
      .filter((s) => s.trim());

    if (sentences.length <= chunkSize) {
      return [text];
    }

    const chunks: string[] = [];

    for (let i = 0; i < sentences.length; i += chunkSize - chunkOverlap) {
      const chunk = sentences
        .slice(i, Math.min(i + chunkSize, sentences.length))
        .join(' ');
      if (chunk.trim() && chunk.split(/[.!?]/).length >= minChunkSize) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  /**
   * Chunk text by paragraphs
   */
  chunkByParagraphs(
    text: string,
    options: {
      maxParagraphsPerChunk?: number;
      paragraphSeparator?: string;
      chunkOverlap?: number;
      minChunkSize?: number;
    } = {},
  ): string[] {
    const maxParagraphsPerChunk = options.maxParagraphsPerChunk || 3;
    const paragraphSeparator = options.paragraphSeparator || '\n\n';
    const chunkOverlap = options.chunkOverlap || 1;
    const minChunkSize = options.minChunkSize || 1;

    const paragraphs = text.split(paragraphSeparator).filter((p) => p.trim());

    if (paragraphs.length <= maxParagraphsPerChunk) {
      return [text];
    }

    const chunks: string[] = [];

    for (
      let i = 0;
      i < paragraphs.length;
      i += maxParagraphsPerChunk - chunkOverlap
    ) {
      const chunk = paragraphs
        .slice(i, Math.min(i + maxParagraphsPerChunk, paragraphs.length))
        .join('\n\n');

      if (
        chunk.trim() &&
        chunk.split(paragraphSeparator).filter((p) => p.trim()).length >=
          minChunkSize
      ) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  /**
   * Smart chunking based on content type
   */
  smartChunk(text: string, options: ChunkingOptions = {}): string[] {
    const splitBy = options.splitBy || 'token';

    switch (splitBy) {
      case 'sentence':
        return this.chunkBySentences(text, options);
      case 'paragraph':
        return this.chunkByParagraphs(text, {
          maxParagraphsPerChunk: options.chunkSize || 3,
          paragraphSeparator: options.separator || '\n\n',
          chunkOverlap: options.chunkOverlap,
          minChunkSize: options.minChunkSize,
        });
      case 'token':
      default:
        return this.chunkByTokens(text, options);
    }
  }

  /**
   * Process document with metadata for each chunk
   */
  chunkDocument(
    document: {
      id: string;
      content: string;
      metadata?: Record<string, any>;
    },
    options: ChunkingOptions = {},
  ): Array<{
    id: string;
    content: string;
    metadata: Record<string, any>;
  }> {
    const chunks = this.smartChunk(document.content, options);

    // If no chunks were generated, create at least one chunk with the original content
    if (chunks.length === 0) {
      this.logger.warn(
        `No chunks generated for document ${document.id}, using full content`,
      );
      chunks.push(document.content);
    }

    return chunks.map((chunk, index) => ({
      id: `${document.id}-chunk-${index}`,
      content: chunk,
      metadata: {
        ...document.metadata,
        document_id: document.id,
        chunk_index: index,
        chunk_count: chunks.length,
      },
    }));
  }

  /**
   * Recursively chunk document based on token limits
   * This approach is useful for very large documents
   */
  recursiveChunk(
    text: string,
    options: {
      maxChunkSize: number;
      minChunkSize?: number;
      separator?: string;
    },
  ): string[] {
    const maxChunkSize = options.maxChunkSize || 2000;
    const minChunkSize = options.minChunkSize || 100;
    const separator = options.separator || ' ';

    // If text is already small enough, return it as is
    if (text.length <= maxChunkSize) {
      return [text];
    }

    // Try to split at paragraph boundaries first
    const paragraphs = text.split('\n\n').filter((p) => p.trim());

    if (paragraphs.length > 1) {
      let currentChunk: string[] = [];
      const chunks: string[] = [];
      let currentLength = 0;

      for (const paragraph of paragraphs) {
        // If adding this paragraph exceeds max size and we have content, create a chunk
        if (
          currentLength + paragraph.length > maxChunkSize &&
          currentLength >= minChunkSize
        ) {
          chunks.push(currentChunk.join('\n\n'));
          currentChunk = [paragraph];
          currentLength = paragraph.length;
        } else {
          currentChunk.push(paragraph);
          currentLength += paragraph.length;
        }
      }

      // Add the last chunk if it's not empty
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n\n'));
      }

      return chunks;
    }

    // If we can't split by paragraphs, try sentences
    const sentenceSeparators = /(?<=[.!?])\s+/g;
    const sentences = text.split(sentenceSeparators).filter((s) => s.trim());

    if (sentences.length > 1) {
      let currentChunk: string[] = [];
      const chunks: string[] = [];
      let currentLength = 0;

      for (const sentence of sentences) {
        // If adding this sentence exceeds max size and we have content, create a chunk
        if (
          currentLength + sentence.length > maxChunkSize &&
          currentLength >= minChunkSize
        ) {
          chunks.push(currentChunk.join(' '));
          currentChunk = [sentence];
          currentLength = sentence.length;
        } else {
          currentChunk.push(sentence);
          currentLength += sentence.length;
        }
      }

      // Add the last chunk if it's not empty
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
      }

      return chunks;
    }

    // As a last resort, split by tokens
    const tokens = text.split(separator).filter((t) => t.trim());
    let currentChunk: string[] = [];
    const chunks: string[] = [];
    let currentLength = 0;

    for (const token of tokens) {
      // If adding this token exceeds max size and we have content, create a chunk
      if (
        currentLength + token.length > maxChunkSize &&
        currentLength >= minChunkSize
      ) {
        chunks.push(currentChunk.join(separator));
        currentChunk = [token];
        currentLength = token.length;
      } else {
        currentChunk.push(token);
        currentLength += token.length;
      }
    }

    // Add the last chunk if it's not empty
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(separator));
    }

    return chunks;
  }
}
