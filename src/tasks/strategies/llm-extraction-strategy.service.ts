import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../../langgraph/llm/llm.service';
import { Email } from '../../email/models/email.model';
import { Task, TaskPriority, TaskStatus } from '../models/task.model';
import { IExtractionStrategy } from './extraction-strategy.interface';

@Injectable()
export class LlmExtractionStrategy implements IExtractionStrategy {
  private readonly logger = new Logger(LlmExtractionStrategy.name);

  constructor(
    private llmService: LlmService,
  ) {}

  /**
   * Extract tasks from an email using LLM
   */
  async extractTasks(email: Email): Promise<Task[]> {
    try {
      // Get the chat model with appropriate settings for structured output
      const model = this.llmService.getChatModel({
        temperature: 0.1,  // Low temperature for more consistent, factual responses
        model: 'gpt-4o',   // Use most capable model for better analysis
      });
      
      // Prepare the content for analysis
      const content = this.prepareEmailContent(email);
      
      // Prepare the system prompt with instructions
      const systemPrompt = this.getSystemPrompt();
      
      // Call the LLM to extract tasks
      const response = await model.invoke([
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content,
        }
      ]);
      
      // Parse the response to extract tasks
      return this.parseTasksFromResponse(response.content.toString(), email);
    } catch (error) {
      this.logger.error(`Failed to extract tasks with LLM strategy: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Prepare the email content for LLM analysis
   */
  private prepareEmailContent(email: Email): string {
    return `
SUBJECT: ${email.subject}

FROM: ${email.from.toString()}
TO: ${email.to.map(to => to.toString()).join(', ')}
DATE: ${email.date}

${email.body}
`;
  }
  
  /**
   * Get the system prompt with instructions for task extraction
   */
  private getSystemPrompt(): string {
    return `You are a task extraction assistant. Your job is to identify tasks, action items, and 
requests from emails and output them in a structured JSON format. Focus only on actionable items 
that require a response or action.

Rules for task extraction:
1. Identify direct requests or implied tasks in the email.
2. Determine appropriate priority (URGENT, HIGH, MEDIUM, LOW) based on language and context.
3. Extract any mentioned deadlines or due dates.
4. Only extract real, actionable tasks - not general information or statements.

Output format should be a JSON array of task objects with the following structure:
[
  {
    "title": "The task title/description",
    "priority": "URGENT|HIGH|MEDIUM|LOW",
    "dueDate": "YYYY-MM-DD" or null if no date mentioned,
    "context": "Brief context about this task from the email"
  }
]

If no tasks are found, return an empty array: []`;
  }
  
  /**
   * Parse the response from the LLM to extract tasks
   */
  private parseTasksFromResponse(responseText: string, email: Email): Task[] {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }
      
      const jsonString = jsonMatch[0];
      const parsedTasks = JSON.parse(jsonString);
      
      if (!Array.isArray(parsedTasks)) {
        return [];
      }
      
      // Convert parsed tasks to Task objects
      return parsedTasks.map(taskData => {
        // Map the priority string to TaskPriority enum
        let priority: TaskPriority;
        switch (taskData.priority?.toUpperCase()) {
          case 'URGENT':
            priority = TaskPriority.URGENT;
            break;
          case 'HIGH':
            priority = TaskPriority.HIGH;
            break;
          case 'MEDIUM':
            priority = TaskPriority.MEDIUM;
            break;
          case 'LOW':
            priority = TaskPriority.LOW;
            break;
          default:
            priority = TaskPriority.MEDIUM;
        }
        
        // Create the task object
        return new Task({
          id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
          title: taskData.title,
          description: taskData.context,
          status: TaskStatus.TO_DO,
          priority,
          dueDate: taskData.dueDate || undefined,
          createdAt: new Date().toISOString(),
          metadata: {
            source: {
              type: 'email',
              id: email.id,
              threadId: email.threadId,
            },
            extractionMethod: 'llm',
          },
        });
      });
    } catch (error) {
      this.logger.error(`Failed to parse tasks from LLM response: ${error.message}`);
      return [];
    }
  }
} 