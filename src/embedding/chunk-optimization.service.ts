import { Injectable, Logger } from '@nestjs/common';
import { SimilarityUtilsService } from './similarity-utils.service';

interface SentenceWithIndex {
  text: string;
  index: number;
}

@Injectable()
export class ChunkOptimizationService {
  private readonly logger = new Logger(ChunkOptimizationService.name);

  constructor(private readonly similarityUtils: SimilarityUtilsService) {}

  /**
   * Create initial chunks based on similarity threshold
   */
  createInitialChunks(
    sentences: string[],
    similarityMatrix: number[][],
    threshold: number,
  ): number[][] {
    try {
      if (!sentences || sentences.length === 0) {
        this.logger.warn(
          'Empty sentences array provided to createInitialChunks',
        );
        return [];
      }

      if (!similarityMatrix || similarityMatrix.length === 0) {
        this.logger.warn(
          'Invalid similarity matrix provided to createInitialChunks',
        );
        return sentences.map((_, i) => [i]); // One sentence per chunk fallback
      }

      this.logger.log(
        `Creating initial chunks with similarity threshold ${threshold}`,
      );

      // Initialize arrays for tracking
      const visited = new Array(sentences.length).fill(false);
      const chunks: number[][] = [];

      let totalSentences = 0;
      let largestChunk = 0;
      let standaloneChunks = 0;

      for (let i = 0; i < sentences.length; i++) {
        // Skip already visited sentences
        if (visited[i]) continue;

        // Start a new chunk with the current sentence
        const currentChunk: number[] = [i];
        visited[i] = true;

        // Find similar sentences
        for (let j = 0; j < sentences.length; j++) {
          if (i === j || visited[j]) continue;

          // Check similarity with all sentences in the current chunk
          let isCompatible = true;
          for (const sentenceIdx of currentChunk) {
            try {
              if (similarityMatrix[sentenceIdx][j] < threshold) {
                isCompatible = false;
                break;
              }
            } catch (error) {
              this.logger.warn(
                `Error accessing similarity matrix at [${sentenceIdx},${j}]`,
              );
              isCompatible = false;
              break;
            }
          }

          // If compatible, add to chunk
          if (isCompatible) {
            currentChunk.push(j);
            visited[j] = true;
          }
        }

        // Store the chunk if it's not empty
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
          totalSentences += currentChunk.length;

          if (currentChunk.length > largestChunk) {
            largestChunk = currentChunk.length;
          }

          if (currentChunk.length === 1) {
            standaloneChunks++;
          }
        }
      }

      this.logger.log(
        `Created ${chunks.length} initial chunks, containing ${totalSentences}/${sentences.length} sentences`,
      );
      this.logger.log(
        `Chunk statistics - Largest: ${largestChunk} sentences, Standalone chunks: ${standaloneChunks}`,
      );

      if (chunks.length === 0) {
        this.logger.warn(
          'No chunks created, using fallback of one chunk containing all sentences',
        );
        return [Array.from(Array(sentences.length).keys())];
      }

      // Sort the chunks by sentence index to maintain document order
      chunks.forEach((chunk) => chunk.sort((a, b) => a - b));

      // Sort chunks themselves by their first sentence index
      chunks.sort((a, b) => a[0] - b[0]);

      // Check for unclustered sentences and log
      const allClusteredIndices = new Set(chunks.flat());
      const unclusteredCount = sentences.length - allClusteredIndices.size;
      if (unclusteredCount > 0) {
        this.logger.warn(
          `${unclusteredCount} sentences were not clustered into any chunk`,
        );
      }

      return chunks;
    } catch (error) {
      this.logger.error(
        `Error creating initial chunks: ${error.message}`,
        error.stack,
      );
      // Return safe default - one chunk per sentence
      return sentences.map((_, i) => [i]);
    }
  }

  /**
   * Optimize and rebalance chunks for better size distribution
   */
  optimizeAndRebalanceChunks(
    chunks: number[][],
    similarityMatrix: number[][],
    minChunkSize: number,
    maxChunkSize: number,
  ): number[][] {
    try {
      if (chunks.length === 0) {
        this.logger.warn(
          'Empty chunks array provided to optimizeAndRebalanceChunks',
        );
        return [];
      }

      if (!similarityMatrix || similarityMatrix.length === 0) {
        this.logger.warn(
          'Invalid similarity matrix provided to optimizeAndRebalanceChunks',
        );
        return chunks; // Return input chunks as fallback
      }

      this.logger.log(
        `Optimizing chunks with min size ${minChunkSize}, max size ${maxChunkSize}`,
      );
      this.logger.log(
        `Initial state: ${chunks.length} chunks with sizes: ${chunks.map((c) => c.length).join(', ')}`,
      );

      // First merge small chunks that are similar
      let optimizedChunks = this.mergeSmallChunks(
        chunks,
        similarityMatrix,
        minChunkSize,
        maxChunkSize,
      );
      this.logger.log(
        `After merging small chunks: ${optimizedChunks.length} chunks`,
      );

      // Then split large chunks
      optimizedChunks = this.splitLargeChunks(
        optimizedChunks,
        similarityMatrix,
        maxChunkSize,
        minChunkSize,
      );
      this.logger.log(
        `After splitting large chunks: ${optimizedChunks.length} chunks`,
      );

      // Final rebalancing pass for any remaining small chunks
      optimizedChunks = this.rebalanceChunks(
        optimizedChunks,
        similarityMatrix,
        minChunkSize,
        maxChunkSize,
      );

      // Log statistics about the optimized chunks
      const sizes = optimizedChunks.map((c) => c.length);
      const avgSize =
        sizes.reduce((sum, size) => sum + size, 0) / sizes.length || 0;
      const minSize = Math.min(...sizes);
      const maxSize = Math.max(...sizes);

      this.logger.log(
        `Optimization complete: ${chunks.length} chunks -> ${optimizedChunks.length} balanced chunks`,
      );
      this.logger.log(
        `Final chunk statistics - Avg size: ${avgSize.toFixed(1)}, Min: ${minSize}, Max: ${maxSize}`,
      );

      return optimizedChunks;
    } catch (error) {
      this.logger.error(
        `Error optimizing chunks: ${error.message}`,
        error.stack,
      );
      return chunks; // Return input chunks in case of error
    }
  }

  /**
   * Split chunks that exceed the maximum size
   */
  splitLargeChunks(
    chunks: number[][],
    similarityMatrix: number[][],
    maxChunkSize: number,
    minChunkSize: number,
  ): number[][] {
    if (chunks.length === 0) {
      return [];
    }

    const result: number[][] = [];

    for (const chunk of chunks) {
      if (chunk.length <= maxChunkSize) {
        // Keep chunks that are within size limit
        result.push([...chunk]);
        continue;
      }

      this.logger.debug(`Splitting large chunk with ${chunk.length} sentences`);

      // For larger chunks, we need to split them optimally
      // Sort the chunk indices to ensure we maintain sequence
      const sortedIndices = [...chunk].sort((a, b) => a - b);

      // Split into sub-chunks based on similarity
      let currentSubChunk: number[] = [sortedIndices[0]];

      for (let i = 1; i < sortedIndices.length; i++) {
        // If adding this sentence would exceed max size, finalize the chunk
        if (currentSubChunk.length >= maxChunkSize) {
          result.push([...currentSubChunk]);
          currentSubChunk = [sortedIndices[i]];
          continue;
        }

        // Check average similarity with current chunk
        let avgSimilarity = 0;
        for (const idx of currentSubChunk) {
          avgSimilarity += similarityMatrix[idx][sortedIndices[i]];
        }
        avgSimilarity /= currentSubChunk.length;

        // If similarity is high, add to current chunk, otherwise start new chunk
        if (avgSimilarity > 0.6) {
          // Lower threshold for splitting
          currentSubChunk.push(sortedIndices[i]);
        } else if (currentSubChunk.length >= minChunkSize) {
          // Only create a new chunk if current one meets min size
          result.push([...currentSubChunk]);
          currentSubChunk = [sortedIndices[i]];
        } else {
          // If current chunk is too small, add anyway
          currentSubChunk.push(sortedIndices[i]);
        }
      }

      // Add the final sub-chunk if it's not empty
      if (currentSubChunk.length > 0) {
        result.push(currentSubChunk);
      }
    }

    return result;
  }

  /**
   * Merge small chunks that have high similarity
   */
  mergeSmallChunks(
    chunks: number[][],
    similarityMatrix: number[][],
    minChunkSize: number,
    maxChunkSize: number,
  ): number[][] {
    if (chunks.length <= 1) {
      return [...chunks];
    }

    // Find small chunks
    const smallChunks = chunks.filter((chunk) => chunk.length < minChunkSize);
    const normalChunks = chunks.filter((chunk) => chunk.length >= minChunkSize);

    if (smallChunks.length === 0) {
      return chunks; // No small chunks to merge
    }

    this.logger.debug(`Found ${smallChunks.length} small chunks to merge`);

    // Try to merge small chunks with each other first
    const mergedChunks: number[][] = [...normalChunks];
    let remainingSmallChunks = [...smallChunks];

    // Compute chunk similarities
    const chunkSimilarities: Record<string, number> = {};
    for (let i = 0; i < smallChunks.length; i++) {
      for (let j = i + 1; j < chunks.length; j++) {
        const sim = this.similarityUtils.calculateGroupsSimilarity(
          smallChunks[i],
          chunks[j],
          similarityMatrix,
        );
        chunkSimilarities[`${i}-${j}`] = sim;
      }
    }

    // Greedily merge small chunks
    while (remainingSmallChunks.length > 0) {
      const currentChunk = remainingSmallChunks[0];
      remainingSmallChunks = remainingSmallChunks.slice(1);

      // Find best chunk to merge with
      let bestMatch = -1;
      let bestSim = 0;

      // First try other small chunks
      for (let i = 0; i < remainingSmallChunks.length; i++) {
        const key = `${smallChunks.indexOf(currentChunk)}-${smallChunks.indexOf(remainingSmallChunks[i])}`;
        const sim =
          chunkSimilarities[key] ||
          this.similarityUtils.calculateGroupsSimilarity(
            currentChunk,
            remainingSmallChunks[i],
            similarityMatrix,
          );

        if (
          sim > bestSim &&
          currentChunk.length + remainingSmallChunks[i].length <= maxChunkSize
        ) {
          bestSim = sim;
          bestMatch = i;
        }
      }

      // Then try normal chunks
      for (let i = 0; i < mergedChunks.length; i++) {
        const sim = this.similarityUtils.calculateGroupsSimilarity(
          currentChunk,
          mergedChunks[i],
          similarityMatrix,
        );

        if (
          sim > bestSim &&
          currentChunk.length + mergedChunks[i].length <= maxChunkSize
        ) {
          bestSim = sim;
          bestMatch = i + remainingSmallChunks.length; // Offset for merged chunks
        }
      }

      // If good match found, merge
      if (bestMatch >= 0 && bestSim > 0.5) {
        if (bestMatch < remainingSmallChunks.length) {
          // Merge with another small chunk
          const chunkToMerge = remainingSmallChunks[bestMatch];
          const merged = [...currentChunk, ...chunkToMerge].sort(
            (a, b) => a - b,
          );

          // Remove the merged chunk and add the new one to remaining
          remainingSmallChunks.splice(bestMatch, 1);
          remainingSmallChunks.push(merged);
        } else {
          // Merge with a normal chunk
          const normalIdx = bestMatch - remainingSmallChunks.length;
          mergedChunks[normalIdx] = [
            ...mergedChunks[normalIdx],
            ...currentChunk,
          ].sort((a, b) => a - b);
        }
      } else {
        // No good match, keep as is
        mergedChunks.push(currentChunk);
      }
    }

    return mergedChunks;
  }

  /**
   * Rebalance chunks to ensure they meet minimum size requirements
   */
  rebalanceChunks(
    chunks: number[][],
    similarityMatrix: number[][],
    minChunkSize: number,
    maxChunkSize: number,
  ): number[][] {
    if (chunks.length <= 1) {
      return chunks;
    }

    const balanced: number[][] = [];
    let currentSmall: number[] = [];

    // Process chunks in order
    for (const chunk of chunks) {
      if (chunk.length < minChunkSize) {
        // Collect small chunks
        currentSmall = [...currentSmall, ...chunk];

        // If we've accumulated enough sentences, create a new chunk
        if (currentSmall.length >= minChunkSize) {
          balanced.push([...currentSmall].sort((a, b) => a - b));
          currentSmall = [];
        }
      } else {
        // For normal chunks, check if we can merge with accumulated small chunks
        if (currentSmall.length > 0) {
          const similarity = this.similarityUtils.calculateGroupsSimilarity(
            currentSmall,
            chunk,
            similarityMatrix,
          );

          if (
            similarity > 0.5 &&
            currentSmall.length + chunk.length <= maxChunkSize
          ) {
            // Merge with current chunk
            balanced.push([...currentSmall, ...chunk].sort((a, b) => a - b));
            currentSmall = [];
          } else {
            // Keep small chunk if it's big enough, otherwise hold for later
            if (currentSmall.length >= minChunkSize / 2) {
              balanced.push([...currentSmall].sort((a, b) => a - b));
            }
            balanced.push(chunk);
            currentSmall = [];
          }
        } else {
          // No small chunks accumulated, just add the normal chunk
          balanced.push(chunk);
        }
      }
    }

    // Handle any remaining small chunks
    if (currentSmall.length > 0) {
      if (balanced.length > 0 && currentSmall.length < minChunkSize) {
        // Add to the last chunk if it would still be reasonably sized
        const lastChunk = balanced[balanced.length - 1];
        if (lastChunk.length + currentSmall.length <= maxChunkSize) {
          balanced[balanced.length - 1] = [...lastChunk, ...currentSmall].sort(
            (a, b) => a - b,
          );
        } else {
          balanced.push([...currentSmall].sort((a, b) => a - b));
        }
      } else {
        balanced.push([...currentSmall].sort((a, b) => a - b));
      }
    }

    return balanced;
  }

  /**
   * Apply context prefix to chunks to enhance their meaning
   */
  applyContextPrefixToChunks(
    chunks: string[][],
    sentences: string[],
    originalText: string,
  ): string[] {
    return chunks.map((chunkIndices, index) => {
      // Get the sentences in this chunk
      const chunkSentences = chunkIndices.map((idx) => sentences[idx]);
      const chunkText = chunkSentences.join(' ');

      // Determine if this is the first chunk
      const isFirst = index === 0;

      // For the first chunk, add the document title if available
      if (isFirst) {
        const possibleTitle = this.extractDocumentTitle(originalText);
        if (possibleTitle) {
          return `${possibleTitle}\n\n${chunkText}`;
        }
      }

      // For other chunks, try to add some context from preceding chunk
      if (index > 0) {
        const prevChunkIndices = chunks[index - 1];
        const lastSentenceIdx = prevChunkIndices[prevChunkIndices.length - 1];

        // Add the last sentence from previous chunk as context
        if (sentences[lastSentenceIdx]) {
          return `Context: ${sentences[lastSentenceIdx]}\n\n${chunkText}`;
        }
      }

      return chunkText;
    });
  }

  /**
   * Extract a possible title from the document
   */
  private extractDocumentTitle(text: string): string | null {
    // Simple title extraction - first non-blank line
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l);

    if (lines.length > 0) {
      // Check if first line looks like a title (short, no punctuation at end)
      const firstLine = lines[0];
      if (firstLine.length < 100 && !firstLine.match(/[.!?;]$/)) {
        return firstLine;
      }
    }

    return null;
  }
}
