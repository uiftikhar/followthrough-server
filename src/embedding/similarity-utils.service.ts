import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SimilarityUtilsService {
  private readonly logger = new Logger(SimilarityUtilsService.name);

  /**
   * Calculate cosine similarity between two vectors
   */
  calculateCosineSimilarity(a: number[], b: number[]): number {
    try {
      if (!a || !b) {
        this.logger.warn(
          'Received null or undefined vectors for similarity calculation',
        );
        return 0;
      }

      if (a.length !== b.length) {
        const error = `Vectors must have the same dimensions: ${a.length} vs ${b.length}`;
        this.logger.error(error);
        throw new Error(error);
      }

      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }

      const normProduct = Math.sqrt(normA) * Math.sqrt(normB);
      if (normProduct === 0) {
        this.logger.warn(
          'Zero norm product in cosine similarity calculation, returning 0',
        );
        return 0;
      }

      const similarity = dotProduct / normProduct;

      // Handle potential numerical errors
      if (similarity < -1) {
        this.logger.warn(
          `Calculated similarity ${similarity} less than -1, clamping to -1`,
        );
        return -1;
      }
      if (similarity > 1) {
        this.logger.warn(
          `Calculated similarity ${similarity} greater than 1, clamping to 1`,
        );
        return 1;
      }

      return similarity;
    } catch (error) {
      this.logger.error(
        `Error calculating cosine similarity: ${error.message}`,
        error.stack,
      );
      return 0; // Safe default in case of error
    }
  }

  /**
   * Compute similarity matrix between all sentences
   */
  computeSimilarityMatrix(embeddings: number[][]): number[][] {
    try {
      if (
        !embeddings ||
        !Array.isArray(embeddings) ||
        embeddings.length === 0
      ) {
        this.logger.warn(
          'Invalid embeddings array provided to computeSimilarityMatrix',
        );
        return [[]];
      }

      const numSentences = embeddings.length;
      this.logger.log(
        `Computing similarity matrix for ${numSentences} sentences`,
      );

      const startTime = Date.now();

      // Initialize matrix with zeros
      const similarityMatrix = Array(numSentences)
        .fill(0)
        .map(() => Array(numSentences).fill(0));

      // Set diagonal to 1 (self-similarity)
      for (let i = 0; i < numSentences; i++) {
        similarityMatrix[i][i] = 1;
      }

      // Track similarity distribution for diagnostics
      let totalSimilarity = 0;
      let similarityCount = 0;
      let maxSimilarity = 0;
      let minSimilarity = 1;

      // Compute similarity for each pair
      for (let i = 0; i < numSentences; i++) {
        // Only compute upper triangle to save time (matrix is symmetric)
        for (let j = i + 1; j < numSentences; j++) {
          let similarity;

          try {
            similarity = this.calculateCosineSimilarity(
              embeddings[i],
              embeddings[j],
            );
          } catch (error) {
            this.logger.warn(
              `Error computing similarity for pair (${i},${j}): ${error.message}`,
            );
            similarity = 0; // Default in case of error
          }

          // Update matrix (symmetric)
          similarityMatrix[i][j] = similarity;
          similarityMatrix[j][i] = similarity;

          // Update statistics
          totalSimilarity += similarity;
          similarityCount++;
          maxSimilarity = Math.max(maxSimilarity, similarity);
          minSimilarity = Math.min(minSimilarity, similarity);
        }

        // Log progress for large matrices
        if (numSentences > 100 && i % 20 === 0) {
          this.logger.log(
            `Similarity computation progress: ${Math.round((i / numSentences) * 100)}%`,
          );
        }
      }

      const endTime = Date.now();
      const avgSimilarity =
        similarityCount > 0 ? totalSimilarity / similarityCount : 0;

      this.logger.log(`Similarity matrix computed in ${endTime - startTime}ms`);
      this.logger.log(
        `Similarity stats - Avg: ${avgSimilarity.toFixed(3)}, Min: ${minSimilarity.toFixed(3)}, Max: ${maxSimilarity.toFixed(3)}`,
      );

      return similarityMatrix;
    } catch (error) {
      this.logger.error(
        `Error computing similarity matrix: ${error.message}`,
        error.stack,
      );
      // Return minimal valid matrix in case of error
      return [[1]];
    }
  }

  /**
   * Adjust threshold based on content characteristics
   */
  adjustThreshold(
    similarities: number[][],
    initialThreshold: number,
    contentLength: number,
    targetChunkCount: number,
  ): number {
    try {
      if (!similarities || similarities.length === 0) {
        this.logger.warn(
          'Invalid similarities matrix provided to adjustThreshold',
        );
        return initialThreshold;
      }

      this.logger.log(
        `Adjusting similarity threshold from base value ${initialThreshold}`,
      );
      this.logger.log(
        `Content parameters - Length: ${contentLength}, Target chunks: ${targetChunkCount}`,
      );

      // Calculate average similarity across all pairs
      let totalSimilarity = 0;
      let count = 0;

      for (let i = 0; i < similarities.length; i++) {
        for (let j = i + 1; j < similarities.length; j++) {
          totalSimilarity += similarities[i][j];
          count++;
        }
      }

      const avgSimilarity = count > 0 ? totalSimilarity / count : 0;
      this.logger.log(
        `Average similarity across ${count} pairs: ${avgSimilarity.toFixed(3)}`,
      );

      // Adjust threshold based on:
      // 1. Average similarity (higher avg similarity -> higher threshold)
      // 2. Content length (longer content -> lower threshold)
      // 3. Target chunk count (more chunks -> lower threshold)

      let adjustedThreshold = initialThreshold;
      let adjustmentReason = '';

      // Adjust for average similarity
      if (avgSimilarity > 0.8) {
        adjustedThreshold += 0.05;
        adjustmentReason += 'high average similarity (+0.05), ';
      } else if (avgSimilarity < 0.4) {
        adjustedThreshold -= 0.05;
        adjustmentReason += 'low average similarity (-0.05), ';
      }

      // Adjust for content length
      if (contentLength > 10000) {
        adjustedThreshold -= 0.03;
        adjustmentReason += 'long content (-0.03), ';
      }

      // Adjust for target chunk count
      const estimatedChunkCount = Math.ceil(contentLength / 1000);
      if (
        targetChunkCount > 0 &&
        estimatedChunkCount > targetChunkCount * 1.5
      ) {
        adjustedThreshold -= 0.05;
        adjustmentReason += 'high estimated chunk count (-0.05), ';
      }

      // Ensure threshold stays in reasonable bounds
      const boundedThreshold = Math.max(0.3, Math.min(0.95, adjustedThreshold));

      if (boundedThreshold !== adjustedThreshold) {
        adjustmentReason += `bounded from ${adjustedThreshold.toFixed(2)} to ${boundedThreshold.toFixed(2)}`;
      } else {
        // Remove trailing comma and space if exists
        adjustmentReason = adjustmentReason.replace(/, $/, '');
      }

      this.logger.log(
        `Adjusted similarity threshold to ${boundedThreshold.toFixed(2)}. Reasons: ${adjustmentReason}`,
      );

      return boundedThreshold;
    } catch (error) {
      this.logger.error(
        `Error adjusting threshold: ${error.message}`,
        error.stack,
      );
      return initialThreshold; // Return initial threshold in case of error
    }
  }

  /**
   * Calculate average similarity between two groups of sentences
   */
  calculateGroupsSimilarity(
    group1Indices: number[],
    group2Indices: number[],
    similarityMatrix: number[][],
  ): number {
    try {
      if (!group1Indices || !group2Indices || !similarityMatrix) {
        this.logger.warn('Invalid inputs to calculateGroupsSimilarity');
        return 0;
      }

      if (group1Indices.length === 0 || group2Indices.length === 0) {
        this.logger.debug('Empty group provided to calculateGroupsSimilarity');
        return 0;
      }

      let totalSimilarity = 0;
      let pairCount = 0;
      let outOfBoundsErrors = 0;

      for (const i of group1Indices) {
        for (const j of group2Indices) {
          try {
            if (
              i < 0 ||
              j < 0 ||
              i >= similarityMatrix.length ||
              j >= similarityMatrix[0].length
            ) {
              outOfBoundsErrors++;
              continue;
            }

            totalSimilarity += similarityMatrix[i][j];
            pairCount++;
          } catch (error) {
            this.logger.warn(
              `Error accessing similarity matrix at [${i},${j}]: ${error.message}`,
            );
          }
        }
      }

      if (outOfBoundsErrors > 0) {
        this.logger.warn(
          `${outOfBoundsErrors} out-of-bounds errors in calculateGroupsSimilarity`,
        );
      }

      return pairCount > 0 ? totalSimilarity / pairCount : 0;
    } catch (error) {
      this.logger.error(
        `Error calculating groups similarity: ${error.message}`,
        error.stack,
      );
      return 0; // Safe default in case of error
    }
  }

  /**
   * Compute advanced similarity scores between chunks
   */
  computeAdvancedSimilarities(
    chunks: number[][],
    similarityMatrix: number[][],
  ): number[][] {
    try {
      if (!chunks || !similarityMatrix) {
        this.logger.warn('Invalid inputs to computeAdvancedSimilarities');
        return [[]];
      }

      const numChunks = chunks.length;
      this.logger.log(
        `Computing advanced similarities between ${numChunks} chunks`,
      );

      const chunkSimilarities = Array(numChunks)
        .fill(0)
        .map(() => Array(numChunks).fill(0));

      // Set diagonal to 1 (self-similarity)
      for (let i = 0; i < numChunks; i++) {
        chunkSimilarities[i][i] = 1;
      }

      // Compute similarity between each pair of chunks
      for (let i = 0; i < numChunks; i++) {
        for (let j = i + 1; j < numChunks; j++) {
          const similarity = this.calculateGroupsSimilarity(
            chunks[i],
            chunks[j],
            similarityMatrix,
          );

          chunkSimilarities[i][j] = similarity;
          chunkSimilarities[j][i] = similarity; // Matrix is symmetric
        }
      }

      // Calculate statistics for logging
      let totalSim = 0;
      let count = 0;
      let minSim = 1;
      let maxSim = 0;

      for (let i = 0; i < numChunks; i++) {
        for (let j = i + 1; j < numChunks; j++) {
          totalSim += chunkSimilarities[i][j];
          count++;
          minSim = Math.min(minSim, chunkSimilarities[i][j]);
          maxSim = Math.max(maxSim, chunkSimilarities[i][j]);
        }
      }

      const avgSim = count > 0 ? totalSim / count : 0;
      this.logger.log(
        `Chunk similarity stats - Avg: ${avgSim.toFixed(3)}, Min: ${minSim.toFixed(3)}, Max: ${maxSim.toFixed(3)}`,
      );

      return chunkSimilarities;
    } catch (error) {
      this.logger.error(
        `Error computing advanced similarities: ${error.message}`,
        error.stack,
      );
      // Return minimal valid matrix in case of error
      return [[1]];
    }
  }
}
