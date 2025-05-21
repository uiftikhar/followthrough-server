import { Injectable, Logger } from '@nestjs/common';
import { Email } from '../../email/models/email.model';
import { Task, TaskPriority, TaskStatus } from '../models/task.model';
import { IExtractionStrategy } from './extraction-strategy.interface';

@Injectable()
export class RuleBasedExtractionStrategy implements IExtractionStrategy {
  private readonly logger = new Logger(RuleBasedExtractionStrategy.name);
  
  // Task indicators are words or phrases that commonly indicate a task
  private readonly taskIndicators = [
    'please',
    'can you',
    'need to',
    'should',
    'must',
    'required',
    'action required',
    'to-do',
    'todo',
    'task',
    'assignment',
    'deadline',
    'by friday',
    'by monday',
    'by tomorrow',
    'asap',
  ];
  
  // Priority indicators map keywords to task priorities
  private readonly priorityIndicators: Record<string, TaskPriority> = {
    'urgent': TaskPriority.URGENT,
    'asap': TaskPriority.URGENT,
    'immediately': TaskPriority.URGENT,
    'high priority': TaskPriority.HIGH,
    'important': TaskPriority.HIGH,
    'critical': TaskPriority.HIGH,
    'medium priority': TaskPriority.MEDIUM,
    'normal priority': TaskPriority.MEDIUM,
    'low priority': TaskPriority.LOW,
    'whenever': TaskPriority.LOW,
    'when you get a chance': TaskPriority.LOW,
  };
  
  // Regex patterns for task extraction
  private readonly taskPatterns = [
    // Pattern for lines that start with "- [ ]" or "* [ ]" (markdown task)
    /^[-*]\s*\[\s*\]\s*(.+)$/gm,
    
    // Pattern for lines that start with "Todo:" or "Task:"
    /^(todo|task|action item):\s*(.+)$/gim,
    
    // Pattern for numbered lists with task-like content
    /^(\d+)[\.\)]\s*(.+\b(please|can you|need to|should|must)\b.+)$/gim,
    
    // Pattern for "Please do X" or "Can you do X" sentences
    /\b(please|can you|could you)\s+([^.?!]+[.?!])/gi,
  ];

  /**
   * Extract tasks from an email based on rule patterns
   */
  async extractTasks(email: Email): Promise<Task[]> {
    try {
      const tasks: Task[] = [];
      
      // Extract tasks from subject line
      this.extractTasksFromText(email.subject, tasks, true);
      
      // Extract tasks from email body
      this.extractTasksFromText(email.body, tasks);
      
      // Deduplicate and clean tasks
      return this.cleanAndDeduplicateTasks(tasks);
    } catch (error) {
      this.logger.error(`Failed to extract tasks with rule-based strategy: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Extract tasks from text content using pattern matching
   */
  private extractTasksFromText(text: string, tasks: Task[], isSubject = false): void {
    if (!text) return;
    
    // Check for task patterns
    for (const pattern of this.taskPatterns) {
      const matches = [...text.matchAll(pattern)];
      
      for (const match of matches) {
        // The task description is either in group 1 or 2 depending on the pattern
        const taskDescription = match[1] || match[2];
        if (taskDescription) {
          tasks.push(this.createTaskFromMatch(taskDescription, isSubject));
        }
      }
    }
    
    // Check for sentences with task indicators
    const sentences = text.split(/[.!?][\s\n]+/).filter(Boolean);
    
    for (const sentence of sentences) {
      if (this.containsTaskIndicator(sentence)) {
        tasks.push(this.createTaskFromMatch(sentence, isSubject));
      }
    }
  }
  
  /**
   * Check if a text contains any task indicators
   */
  private containsTaskIndicator(text: string): boolean {
    return this.taskIndicators.some(indicator => 
      text.toLowerCase().includes(indicator.toLowerCase())
    );
  }
  
  /**
   * Create a task object from a matched pattern
   */
  private createTaskFromMatch(text: string, isFromSubject = false): Task {
    // Determine priority based on indicators
    let priority = TaskPriority.MEDIUM;
    
    Object.entries(this.priorityIndicators).forEach(([indicator, level]) => {
      if (text.toLowerCase().includes(indicator)) {
        priority = level;
      }
    });
    
    // If task is from subject line, increase its priority
    if (isFromSubject && this.getPriorityValue(priority) < this.getPriorityValue(TaskPriority.URGENT)) {
      // Bump priority up one level
      const currentValue = this.getPriorityValue(priority);
      if (currentValue === this.getPriorityValue(TaskPriority.LOW)) {
        priority = TaskPriority.MEDIUM;
      } else if (currentValue === this.getPriorityValue(TaskPriority.MEDIUM)) {
        priority = TaskPriority.HIGH;
      }
    }
    
    return new Task({
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
      title: text.trim(),
      status: TaskStatus.TO_DO,
      priority,
      createdAt: new Date().toISOString(),
    });
  }
  
  /**
   * Clean and deduplicate tasks
   */
  private cleanAndDeduplicateTasks(tasks: Task[]): Task[] {
    // Clean task titles (remove leading dash, bullet, etc.)
    tasks.forEach(task => {
      task.title = task.title
        .replace(/^[-*•]\s+/, '') // Remove leading dash or bullet
        .replace(/^\[\s*\]\s*/, '') // Remove leading checkbox
        .replace(/^(todo|task|action item):\s*/i, '') // Remove leading "Todo:", "Task:", etc.
        .trim();
    });
    
    // Deduplicate tasks based on titles
    const uniqueTasks = new Map<string, Task>();
    
    tasks.forEach(task => {
      const key = task.title.toLowerCase();
      
      // If this is a duplicate, keep the one with higher priority
      if (uniqueTasks.has(key)) {
        const existingTask = uniqueTasks.get(key);
        if (existingTask && this.getPriorityValue(task.priority) > this.getPriorityValue(existingTask.priority)) {
          uniqueTasks.set(key, task);
        }
      } else {
        uniqueTasks.set(key, task);
      }
    });
    
    return Array.from(uniqueTasks.values());
  }
  
  /**
   * Convert priority enum to numeric value for comparison
   */
  private getPriorityValue(priority: TaskPriority): number {
    switch (priority) {
      case TaskPriority.URGENT: return 3;
      case TaskPriority.HIGH: return 2;
      case TaskPriority.MEDIUM: return 1;
      case TaskPriority.LOW: return 0;
      default: return 0;
    }
  }
} 