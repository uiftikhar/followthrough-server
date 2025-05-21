import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Service for adapting embedding dimensions to match index requirements
 */
@Injectable()
export class DimensionAdapterService {
  private readonly logger = new Logger(DimensionAdapterService.name);
  private readonly targetDimension: number;

  constructor(private readonly configService: ConfigService) {
    // Get the target dimension from config, default to 1024 (which is what Pinecone seems to expect)
    this.targetDimension = this.configService.get<number>(
      'PINECONE_DIMENSIONS',
      1024,
    );
    this.logger.log(
      `Dimension adapter initialized with target dimension: ${this.targetDimension}`,
    );
  }

  /**
   * Adapt embedding vector to target dimension
   *
   * This performs dimension reduction if needed to match the target dimension.
   * Current implementation uses a simple truncation or padding approach, but
   * more sophisticated methods like PCA could be implemented in the future.
   */
  adaptDimension(embedding: number[], sourceDimension?: number): number[] {
    const currentDimension = embedding.length;

    // If dimensions already match, no adaptation needed
    if (currentDimension === this.targetDimension) {
      return embedding;
    }

    this.logger.debug(
      `Adapting embedding from dimension ${currentDimension} to ${this.targetDimension}`,
    );

    if (currentDimension > this.targetDimension) {
      // Truncate: Take only the first targetDimension values
      const truncated = embedding.slice(0, this.targetDimension);
      this.logger.debug(
        `Truncated embedding from ${currentDimension} to ${truncated.length} dimensions`,
      );
      return truncated;
    } else {
      // Padding: Add zeros to reach targetDimension
      const padded = [
        ...embedding,
        ...Array(this.targetDimension - currentDimension).fill(0),
      ];
      this.logger.debug(
        `Padded embedding from ${currentDimension} to ${padded.length} dimensions`,
      );
      return padded;
    }
  }

  /**
   * Check if embedding needs dimension adaptation
   */
  needsAdaptation(dimensionSize: number): boolean {
    return dimensionSize !== this.targetDimension;
  }

  /**
   * Get the target dimension size
   */
  getTargetDimension(): number {
    return this.targetDimension;
  }
}
