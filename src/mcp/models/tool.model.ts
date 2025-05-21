export interface ToolParameter {
  name: string;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  default?: any;
  enum?: string[];
  items?: {
    type: string;
  };
  properties?: Record<string, ToolParameter>;
}

export interface ToolSchema {
  name: string;
  description?: string;
  parameters: Record<string, ToolParameter>;
  returns?: {
    type: string;
    description?: string;
    properties?: Record<string, any>;
  };
}

export class Tool {
  id: string;
  name: string;
  description?: string;
  schema: ToolSchema;
  handler?: (...args: any[]) => Promise<any>;

  constructor(data: Partial<Tool>) {
    this.id = data.id || '';
    this.name = data.name || '';
    this.description = data.description;
    this.schema = data.schema || { name: this.name, parameters: {} };
    this.handler = data.handler;
  }

  static fromMcpTool(mcpTool: any): Tool {
    return new Tool({
      id: mcpTool.id || mcpTool.name,
      name: mcpTool.name,
      description: mcpTool.description,
      schema: {
        name: mcpTool.name,
        description: mcpTool.description,
        parameters: mcpTool.parameters || {},
        returns: mcpTool.returns,
      },
    });
  }

  toJSON(): any {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      schema: this.schema,
    };
  }
} 