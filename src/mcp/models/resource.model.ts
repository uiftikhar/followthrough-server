export interface ResourceMetadata {
  id: string;
  name: string;
  type: string;
  description?: string;
  created?: string;
  modified?: string;
  [key: string]: any;
}

export class Resource {
  id: string;
  name: string;
  type: string;
  description?: string;
  metadata: ResourceMetadata;
  content?: any;
  uri?: string;

  constructor(data: Partial<Resource>) {
    this.id = data.id || '';
    this.name = data.name || '';
    this.type = data.type || '';
    this.description = data.description;
    this.metadata = data.metadata || { id: this.id, name: this.name, type: this.type };
    this.content = data.content;
    this.uri = data.uri;
  }

  static fromMcpResource(mcpResource: any): Resource {
    return new Resource({
      id: mcpResource.id || mcpResource.uri,
      name: mcpResource.name,
      type: mcpResource.type,
      description: mcpResource.description,
      uri: mcpResource.uri,
      metadata: mcpResource.metadata || {},
      content: mcpResource.content,
    });
  }

  toJSON(): any {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      description: this.description,
      uri: this.uri,
      metadata: this.metadata,
    };
  }
} 