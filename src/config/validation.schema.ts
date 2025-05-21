import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // Server configuration
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // Database configuration
  DATABASE_URL: Joi.string().optional(),
  MONGO_DB_URI: Joi.string().required(),
  MONGO_DB_USERNAME: Joi.string().required(),
  MONGO_DB_PASSWORD: Joi.string().required(),
  MONGO_DB_NAME: Joi.string().default('meeting-analysis'),

  // Authentication
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRATION: Joi.string().default('1d'),

  // LLM Configuration
  OPENAI_API_KEY: Joi.string().required(),
  MODEL_NAME: Joi.string().default('gpt-4'),

  // Pinecone Configuration
  PINECONE_API_KEY: Joi.string().required(),
  PINECONE_CLOUD: Joi.string().default('aws'),
  PINECONE_REGION: Joi.string().default('us-west-2'),

  // Embedding Configuration
  EMBEDDING_MODEL: Joi.string()
    .valid(
      'text-embedding-ada-002',
      'text-embedding-3-small',
      'text-embedding-3-large',
      'anthropic',
      'llama-text-embed-v2',
    )
    .default('text-embedding-3-large'),
  EMBEDDING_DIMENSIONS: Joi.number().default(1536),

  // RAG Configuration
  RAG_ENABLE: Joi.boolean().default(true),
  RAG_DEFAULT_NAMESPACE: Joi.string().default('meeting-analysis'),
  RAG_CACHE_TTL: Joi.number().default(3600),

  // Storage Configuration
  STORAGE_PATH: Joi.string().default('./data/file-storage'),
});
