import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../../langgraph/llm/llm.service';
import { Email } from '../../email/models/email.model';
import { Task, TaskPriority } from '../models/task.model';
import { IExtractionStrategy } from '../strategies/extraction-strategy.interface';
import { LlmExtractionStrategy } from '../strategies/llm-extraction-strategy.service';
import { RuleBasedExtractionStrategy } from '../strategies/rule-based-extraction-strategy.service';

@Injectable()
export class EmailTaskExtractorService {
  private readonly logger = new Logger(EmailTaskExtractorService.name);
  private readonly strategies: IExtractionStrategy[];

  constructor(
    private llmService: LlmService,
    private llmStrategy: LlmExtractionStrategy,
    private ruleBasedStrategy: RuleBasedExtractionStrategy,
  ) {
    // Order matters - try rule-based first (faster), then LLM (more powerful but slower)
    this.strategies = [
      this.ruleBasedStrategy,
      this.llmStrategy,
    ];
  }

  /**
   * Extract tasks from an email
   */
  async extractTasks(email: Email): Promise<Task[]> {
    try {
      let tasks: Task[] = [];
      
      // Try each strategy in order until one succeeds
      for (const strategy of this.strategies) {
        tasks = await strategy.extractTasks(email);
        
        if (tasks.length > 0) {
          this.logger.debug(`Extracted ${tasks.length} tasks using ${strategy.constructor.name}`);
          break;
        }
      }
      
      // Enrich tasks with email context
      tasks.forEach(task => {
        task.metadata = {
          ...task.metadata,
          source: {
            type: 'email',
            id: email.id,
            threadId: email.threadId,
          },
        };
      });
      
      return tasks;
    } catch (error) {
      this.logger.error(`Failed to extract tasks from email: ${error.message}`);
      return [];
    }
  }

  /**
   * Validate and enrich a task with additional information
   */
  async validateAndEnrichTask(task: Partial<Task>): Promise<Task> {
    try {
      // Set default values for required fields
      if (!task.title) {
        throw new Error('Task must have a title');
      }
      
      // Create a due date if not set but mentioned in the description
      if (!task.dueDate && task.description) {
        const extractedDate = await this.extractDueDateFromText(task.description);
        task.dueDate = extractedDate !== null ? extractedDate : undefined;
      }
      
      // Ensure proper formatting
      if (task.dueDate && typeof task.dueDate === 'string') {
        try {
          const date = new Date(task.dueDate);
          // Format as ISO date string
          task.dueDate = date.toISOString();
        } catch (e) {
          // If the date is invalid, remove it
          task.dueDate = undefined;
        }
      }
      
      // Add default priority if not set
      if (!task.priority) {
        task.priority = TaskPriority.MEDIUM;
      }
      
      return new Task(task);
    } catch (error) {
      this.logger.error(`Failed to validate and enrich task: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Extract due date from text using LLM
   */
  private async extractDueDateFromText(text: string): Promise<string | null> {
    try {
      const model = this.llmService.getChatModel({
        temperature: 0.1,
        model: 'gpt-4o',
      });
      
      const response = await model.invoke([
        {
          role: 'system',
          content: 'You are a date extraction assistant. Extract any due dates or deadlines mentioned in the text. Return ONLY an ISO date string (YYYY-MM-DD) or "null" if no date is found.',
        },
        {
          role: 'user',
          content: text,
        },
      ]);
      
      const content = response.content.toString().trim();
      
      if (content === 'null' || !content) {
        return null;
      }
      
      return content;
    } catch (error) {
      this.logger.error(`Failed to extract due date: ${error.message}`);
      return null;
    }
  }
} 