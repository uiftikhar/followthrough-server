import * as Joi from "joi";

export const configValidationSchema = Joi.object({
  // Server configuration
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),

  // Database configuration
  DATABASE_URL: Joi.string().optional(),
  MONGO_DB_URI: Joi.string().required(),
  MONGO_DB_USERNAME: Joi.string().required(),
  MONGO_DB_PASSWORD: Joi.string().required(),
  MONGO_DB_NAME: Joi.string().default("meeting-analysis"),

  // Authentication
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRATION: Joi.string().default("1d"),

  // LLM Configuration
  OPENAI_API_KEY: Joi.string().required(),
  MODEL_NAME: Joi.string().default("gpt-4"),

  // Pinecone Configuration
  PINECONE_API_KEY: Joi.string().required(),
  PINECONE_CLOUD: Joi.string().default("aws"),
  PINECONE_REGION: Joi.string().default("us-west-2"),
  PINECONE_DIMENSIONS: Joi.number().default(1024),

  // OpenAI Embedding Generation Configuration (used by EmbeddingService)
  OPENAI_EMBEDDING_MODEL: Joi.string()
    .valid(
      "text-embedding-ada-002",
      "text-embedding-3-small",
      "text-embedding-3-large",
    )
    .default("text-embedding-3-large"),
  OPENAI_EMBEDDING_DIMENSIONS: Joi.number().default(1024),

  // Pinecone Index Embedding Model Configuration (metadata only for index creation)
  PINECONE_EMBEDDING_MODEL: Joi.string()
    .valid(
      "multilingual-e5-large",
      "pinecone-sparse-english-v0",
      "text-embedding-3-large",
      "text-embedding-ada-002",
      "llama-text-embed-v2",
    )
    .default("text-embedding-3-large"),

  // Legacy support (will map to new variables)
  EMBEDDING_MODEL: Joi.string()
    .valid(
      "text-embedding-ada-002",
      "text-embedding-3-small",
      "text-embedding-3-large",
      "anthropic",
      "llama-text-embed-v2",
      "multilingual-e5-large",
    )
    .optional(),
  EMBEDDING_DIMENSIONS: Joi.number().optional(),

  // RAG Configuration
  RAG_ENABLE: Joi.boolean().default(true),
  RAG_DEFAULT_NAMESPACE: Joi.string().default("meeting-analysis"),
  RAG_CACHE_TTL: Joi.number().default(3600),

  // Storage Configuration
  STORAGE_PATH: Joi.string().default("./data/file-storage"),

  // Google OAuth and Gmail Configuration
  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),
  GOOGLE_CLOUD_PROJECT_ID: Joi.string().required(),
  GMAIL_PUBSUB_TOPIC: Joi.string().default("gmail-notifications"),
  GOOGLE_REMOVE_ACTIVE_WATCHERS: Joi.boolean().default(false),

  // Google Service Account Credentials (either file path or JSON content)
  GOOGLE_APPLICATION_CREDENTIALS: Joi.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON: Joi.string().optional(),

  // Secret Manager configuration
  USE_SECRET_MANAGER: Joi.boolean().default(false),
  GOOGLE_SECRET_NAME: Joi.string().default("gmail-service-account"),
});
