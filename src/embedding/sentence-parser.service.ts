import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SentenceParserService {
  private readonly logger = new Logger(SentenceParserService.name);

  /**
   * Parse text into sentences using basic regex patterns
   */
  parseSentences(text: string): string[] {
    if (!text || typeof text !== 'string') {
      this.logger.warn('Empty or non-string text provided to parseSentences');
      return [];
    }

    try {
      this.logger.log(
        `Parsing text of length ${text.length} into sentences using basic method`,
      );

      // Basic sentence splitting by punctuation
      const sentenceRegex = /[^.!?]+[.!?]+/g;
      const matches = text.match(sentenceRegex) || [];

      // Clean up sentences
      const sentences = matches
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      this.logger.log(`Basic parsing found ${sentences.length} sentences`);

      if (sentences.length === 0) {
        this.logger.warn('No sentences found in text using basic parsing');
      } else if (sentences.length < 3 && text.length > 500) {
        this.logger.warn(
          `Unusually few sentences (${sentences.length}) for text length ${text.length}`,
        );
      }

      return sentences;
    } catch (error) {
      this.logger.error(
        `Error in basic sentence parsing: ${error.message}`,
        error.stack,
      );
      // Return text as single sentence in case of error
      return text.length > 0 ? [text] : [];
    }
  }

  /**
   * Advanced sentence parsing with better handling of edge cases
   */
  parseAdvancedSentences(text: string): string[] {
    if (!text || typeof text !== 'string') {
      this.logger.warn(
        'Empty or non-string text provided to parseAdvancedSentences',
      );
      return [];
    }

    try {
      this.logger.log(`Advanced parsing of text with length ${text.length}`);

      // Handle common abbreviations to avoid incorrect splitting
      const preprocessed = text
        .replace(/Mr\./g, 'Mr_DOT_')
        .replace(/Mrs\./g, 'Mrs_DOT_')
        .replace(/Dr\./g, 'Dr_DOT_')
        .replace(/Ph\.D\./g, 'PhD_DOT_')
        .replace(/i\.e\./g, 'ie_DOT_')
        .replace(/e\.g\./g, 'eg_DOT_')
        .replace(/vs\./g, 'vs_DOT_')
        .replace(/etc\./g, 'etc_DOT_')
        .replace(/(\d+)\.(\d+)/g, '$1_DOT_$2'); // Handle decimal numbers

      this.logger.log(
        'Text preprocessed to handle abbreviations and special cases',
      );

      // More comprehensive sentence regex
      const sentenceRegex = /[^.!?]+[.!?]+/g;
      const matches = preprocessed.match(sentenceRegex) || [];

      this.logger.log(`Found ${matches.length} raw sentence matches`);

      // Clean and restore the original text
      const sentences = matches
        .map((s) =>
          s
            .trim()
            .replace(/Mr_DOT_/g, 'Mr.')
            .replace(/Mrs_DOT_/g, 'Mrs.')
            .replace(/Dr_DOT_/g, 'Dr.')
            .replace(/PhD_DOT_/g, 'Ph.D.')
            .replace(/ie_DOT_/g, 'i.e.')
            .replace(/eg_DOT_/g, 'e.g.')
            .replace(/vs_DOT_/g, 'vs.')
            .replace(/etc_DOT_/g, 'etc.')
            .replace(/(\d+)_DOT_(\d+)/g, '$1.$2'),
        )
        .filter((s) => s.length > 0);

      this.logger.log(
        `Advanced parsing found ${sentences.length} sentences after processing`,
      );

      if (sentences.length === 0) {
        this.logger.warn('No sentences found in text using advanced parsing');
        if (text.trim().length > 0) {
          this.logger.log('Returning original text as single sentence');
          return [text.trim()];
        }
      } else if (sentences.length < 3 && text.length > 500) {
        this.logger.warn(
          `Unusually few sentences (${sentences.length}) for text length ${text.length}`,
        );
      }

      return sentences;
    } catch (error) {
      this.logger.error(
        `Error in advanced sentence parsing: ${error.message}`,
        error.stack,
      );
      // Return text as single sentence in case of error
      return text.length > 0 ? [text] : [];
    }
  }

  /**
   * Split text by semantic boundaries, considering both punctuation and content
   */
  splitBySemanticBoundaries(text: string): string[] {
    if (!text || typeof text !== 'string') {
      this.logger.warn(
        'Empty or non-string text provided to splitBySemanticBoundaries',
      );
      return [];
    }

    try {
      this.logger.log(
        `Splitting text by semantic boundaries, text length: ${text.length}`,
      );

      // First split by obvious paragraph boundaries
      const paragraphs = text
        .split(/\n\s*\n/)
        .filter((p) => p.trim().length > 0);
      this.logger.log(`Found ${paragraphs.length} paragraphs in text`);

      // Process each paragraph to extract sentences
      const allSentences: string[] = [];
      let longSentencesFound = 0;

      for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i];
        this.logger.log(
          `Processing paragraph ${i + 1}/${paragraphs.length}, length: ${paragraph.length}`,
        );

        const sentences = this.parseAdvancedSentences(paragraph);

        // For very long paragraphs with no sentence breaks, force split
        if (sentences.length === 1 && sentences[0].length > 1000) {
          this.logger.log(
            `Found long sentence (${sentences[0].length} chars), forcing split`,
          );
          longSentencesFound++;
          const forcedSplits = this.forceSplitLongSentence(sentences[0]);
          this.logger.log(
            `Split long sentence into ${forcedSplits.length} parts`,
          );
          allSentences.push(...forcedSplits);
        } else {
          allSentences.push(...sentences);
        }
      }

      this.logger.log(
        `Found ${allSentences.length} total semantic units in text`,
      );
      this.logger.log(
        `Forced splits applied to ${longSentencesFound} overly long sentences`,
      );

      if (allSentences.length === 0 && text.trim().length > 0) {
        this.logger.warn(
          'No semantic units found, returning original text as single unit',
        );
        return [text.trim()];
      }

      return allSentences;
    } catch (error) {
      this.logger.error(
        `Error in semantic boundary splitting: ${error.message}`,
        error.stack,
      );
      // Return text as single sentence in case of error
      return text.length > 0 ? [text] : [];
    }
  }

  /**
   * Force split very long sentences that might be incorrectly parsed
   */
  private forceSplitLongSentence(
    sentence: string,
    maxLength: number = 300,
  ): string[] {
    if (!sentence || sentence.length <= maxLength) {
      return [sentence];
    }

    try {
      this.logger.log(
        `Force splitting long sentence of length ${sentence.length} (max: ${maxLength})`,
      );

      const splits: string[] = [];
      let remainingText = sentence;
      let splitCount = 0;

      while (remainingText.length > maxLength) {
        splitCount++;
        // Try to find a reasonable breaking point (comma, semicolon, etc.)
        let breakPoint = -1;

        // Look for punctuation or conjunctions near the max length
        const searchStart = Math.max(0, maxLength - 100);
        const searchEnd = Math.min(remainingText.length, maxLength + 100);
        const searchRange = remainingText.substring(searchStart, searchEnd);

        this.logger.log(
          `Finding break point in search range ${searchStart}-${searchEnd}`,
        );

        const match = searchRange.match(
          /[,;:]|\sand\s|\sbut\s|\sor\s|\swhile\s|\sbecause\s/,
        );

        if (match && match.index !== undefined) {
          breakPoint = searchStart + match.index + match[0].length;
          this.logger.log(
            `Break point found at ${breakPoint} using pattern: "${match[0]}"`,
          );
        } else {
          // If no good breaking point, just split at a space near max length
          const lastSpace = remainingText.lastIndexOf(' ', maxLength);
          breakPoint = lastSpace > maxLength / 2 ? lastSpace : maxLength;
          this.logger.log(
            `No pattern found, using space at position ${breakPoint}`,
          );
        }

        splits.push(remainingText.substring(0, breakPoint).trim());
        remainingText = remainingText.substring(breakPoint).trim();

        if (splitCount > 20) {
          this.logger.warn(
            'Force split loop exceeded 20 iterations, breaking to avoid infinite loop',
          );
          // Add the remaining text and break
          if (remainingText.length > 0) {
            splits.push(remainingText);
          }
          break;
        }
      }

      if (remainingText.length > 0) {
        splits.push(remainingText);
      }

      this.logger.log(`Force split resulted in ${splits.length} segments`);
      return splits;
    } catch (error) {
      this.logger.error(
        `Error in force splitting sentence: ${error.message}`,
        error.stack,
      );
      // Return original sentence in case of error
      return [sentence];
    }
  }
}
