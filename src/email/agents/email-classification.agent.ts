import { Injectable, Inject, Logger } from "@nestjs/common";
import { LLM_SERVICE } from "../../langgraph/llm/constants/injection-tokens";
import { LlmService } from "../../langgraph/llm/llm.service";
import { EMAIL_CLASSIFICATION_CONFIG } from "./constants/injection-tokens";
import {
  EmailClassification,
  EmailClassificationConfig,
} from "../dtos/email-triage.dto";

@Injectable()
export class EmailClassificationAgent {
  private readonly logger = new Logger(EmailClassificationAgent.name);

  constructor(
    @Inject(LLM_SERVICE) private readonly llmService: LlmService,
    @Inject(EMAIL_CLASSIFICATION_CONFIG)
    private readonly config: EmailClassificationConfig,
  ) {}

  async classifyEmail(
    emailContent: string,
    metadata: any,
  ): Promise<EmailClassification> {
    this.logger.log(`Classifying email: ${metadata.subject}`);

    const prompt = `Email to classify:
Subject: ${metadata.subject}
From: ${metadata.from}
Body: ${emailContent}

Classify this email with:
1. Priority: ${this.config.priorities.join(", ")}
2. Category: ${this.config.categories.join(", ")}
3. Reasoning: Brief explanation

Respond in JSON format:
{
  "priority": "urgent|high|normal|low",
  "category": "bug_report|feature_request|question|complaint|praise|other",
  "reasoning": "explanation",
  "confidence": 0.95
}`;

    try {
      const model = this.llmService.getChatModel({
        temperature: 0.1,
        maxTokens: 200,
      });

      const messages = [
        { role: "system", content: this.config.systemPrompt },
        { role: "user", content: prompt },
      ];

      const response = await model.invoke(messages);
      const content = response.content.toString();

      // Try to parse JSON from response
      let parsedContent = content;
      const jsonMatch =
        content.match(/```json\n([\s\S]*?)\n```/) ||
        content.match(/```\n([\s\S]*?)\n```/) ||
        content.match(/(\{[\s\S]*\})/);

      if (jsonMatch) {
        parsedContent = jsonMatch[1];
      }

      const classification = JSON.parse(parsedContent);

      this.logger.log(
        `Email classified as ${classification.priority} priority, ${classification.category} category`,
      );
      return classification;
    } catch (error) {
      this.logger.error(`Failed to classify email: ${error.message}`);

      // Return default classification on error
      return {
        priority: "normal",
        category: "other",
        reasoning: "Failed to classify email automatically",
        confidence: 0.0,
      };
    }
  }

  /**
   * Enhanced classification logic with better keyword detection
   */
  private classifyEmailContent(content: string, metadata: any): EmailClassification {
    const combinedText = `${metadata.subject || ''} ${content}`.toLowerCase();
    
    // Enhanced keyword patterns for better detection
    const urgentKeywords = [
      'urgent', 'asap', 'emergency', 'critical', 'immediately', 'priority', 'deadline',
      'bug', 'bug fix', 'bug fixes', 'error', 'issue', 'problem', 'failure', 'crash',
      'down', 'outage', 'broken', 'not working', 'fix needed', 'hotfix'
    ];
    
    const importantKeywords = [
      'important', 'meeting', 'deadline', 'review', 'approval', 'decision',
      'action required', 'please respond', 'fyi', 'follow up', 'update'
    ];
    
    const spamKeywords = [
      'promotion', 'sale', 'discount', 'offer', 'free', 'unsubscribe',
      'click here', 'limited time', 'congratulations', 'winner'
    ];

    // Category classification with enhanced bug detection
    let category = 'other';
    let priority = 'normal';
    
    // Priority classification (check urgent first)
    if (urgentKeywords.some(keyword => combinedText.includes(keyword))) {
      priority = 'urgent';
      
      // More specific categorization for urgent items
      if (combinedText.includes('bug') || combinedText.includes('fix') || 
          combinedText.includes('error') || combinedText.includes('issue')) {
        category = 'bug_report';
      } else if (combinedText.includes('question') || combinedText.includes('how')) {
        category = 'question';
      } else {
        category = 'other';
      }
    } else if (importantKeywords.some(keyword => combinedText.includes(keyword))) {
      priority = 'high';
      
      if (combinedText.includes('feature') || combinedText.includes('enhancement')) {
        category = 'feature_request';
      } else if (combinedText.includes('question') || combinedText.includes('how')) {
        category = 'question';
      } else {
        category = 'other';
      }
    } else if (spamKeywords.some(keyword => combinedText.includes(keyword))) {
      priority = 'low';
      category = 'other';
    }

    // Enhanced category detection
    if (combinedText.includes('complain') || combinedText.includes('problem') || combinedText.includes('issue')) {
      category = 'complaint';
    } else if (combinedText.includes('thank') || combinedText.includes('great') || combinedText.includes('excellent')) {
      category = 'praise';
    } else if (combinedText.includes('feature') || combinedText.includes('request') || combinedText.includes('enhancement')) {
      category = 'feature_request';
    } else if (combinedText.includes('question') || combinedText.includes('how') || combinedText.includes('what') || combinedText.includes('why')) {
      category = 'question';
    }

    this.logger.log(`📊 Enhanced Classification Result:
      - Priority: ${priority} (detected keywords: ${urgentKeywords.filter(k => combinedText.includes(k)).join(', ')})
      - Category: ${category}
      - Subject: "${metadata.subject}"
      - Content preview: "${combinedText.substring(0, 100)}..."`);

    return {
      priority: priority as 'urgent' | 'high' | 'normal' | 'low',
      category: category as 'bug_report' | 'feature_request' | 'question' | 'complaint' | 'praise' | 'other',
      confidence: this.calculateConfidence(combinedText, priority, category),
      reasoning: this.generateReasoning(combinedText, priority, category)
    };
  }

  /**
   * Calculate confidence score based on keyword matches and content analysis
   */
  private calculateConfidence(text: string, priority: string, category: string): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence based on keyword matches
    const keywordMatches = [
      'urgent', 'bug', 'fix', 'error', 'important', 'meeting'
    ].filter(keyword => text.includes(keyword)).length;
    
    confidence += (keywordMatches * 0.1);
    
    // Adjust based on text length and structure
    if (text.length > 100) confidence += 0.1;
    if (text.includes('@') && text.includes('.')) confidence += 0.1;
    
    return Math.min(confidence, 0.95); // Cap at 95%
  }

  /**
   * Generate human-readable reasoning for the classification
   */
  private generateReasoning(text: string, priority: string, category: string): string {
    const keywords = [
      'urgent', 'bug', 'fix', 'error', 'important', 'meeting', 'deadline'
    ].filter(keyword => text.includes(keyword));
    
    if (keywords.length > 0) {
      return `Classified as ${priority}/${category} due to keywords: ${keywords.join(', ')}`;
    }
    
    return `Classified as ${priority}/${category} based on content analysis`;
  }
}
