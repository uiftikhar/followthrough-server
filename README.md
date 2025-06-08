# FollowThrough AI - Advanced Agentic Workflow Platform

An enterprise-grade AI agent platform featuring hierarchical multi-agent systems for meeting analysis, email triage, and workflow automation. Built with NestJS, TypeScript, and cutting-edge agentic AI technologies.

## 🚀 Key Features

- **🤖 Hierarchical Agent System**: Master Supervisor routing to specialized agent teams
- **📊 Meeting Analysis**: Comprehensive transcript analysis with topic extraction, action items, and sentiment analysis
- **📧 Email Triage**: Intelligent email classification, prioritization, and automated response generation
- **🧠 RAG-Enhanced Intelligence**: Semantic chunking, vector embeddings, and contextual knowledge retrieval
- **⚡ Real-time Processing**: WebSocket-based progress tracking and live updates
- **🔗 External Integrations**: Gmail, Google OAuth, PubSub notifications, and extensible connector framework

## 📚 Documentation

For comprehensive guides on the agentic workflow system, architecture, and development patterns:

**➡️ [Complete Agentic Workflows Documentation](./guides/agentic-workflows/README.md)**

This includes detailed guides on:
- System Architecture & Design Patterns
- Agent Development & RAG Integration  
- Meeting Analysis & Email Triage Workflows
- Developer Onboarding & Best Practices

## 🛠 Quick Start

### Prerequisites

- **Node.js** 18+ and **yarn**
- **MongoDB** (local or cloud)
- **API Keys**: OpenAI, Pinecone
- **Optional**: Google Cloud credentials for Gmail integration

### 1. Clone and Install

```bash
git clone <repository-url>
cd followthrough-server
yarn install
```

### 2. Environment Configuration

```bash
# Copy the example environment file
cp .env.example .env
```

Update `.env` with your credentials:

```env
# Database
MONGO_DB_URI=mongodb://localhost:27017/followthrough-ai
MONGO_DB_USERNAME=your-username
MONGO_DB_PASSWORD=your-password

# AI Services
OPENAI_API_KEY=sk-your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-key (optional)

# Vector Database
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=your-pinecone-environment
PINECONE_INDEX_NAME=followthrough-vectors

# Authentication
JWT_SECRET=your-secure-jwt-secret
JWT_EXPIRES_IN=7d

# Google Integration (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# Application
NODE_ENV=development
PORT=3000
```

### 3. Database Setup

**Local MongoDB:**
```bash
# Install MongoDB locally or use Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**Cloud MongoDB:**
Update `MONGO_DB_URI` with your MongoDB Atlas connection string.

### 4. Vector Database Setup

1. Create a [Pinecone](https://pinecone.io) account
2. Create an index named `followthrough-vectors` with:
   - **Dimensions**: 3072 (for OpenAI text-embedding-3-large)
   - **Metric**: cosine
   - **Pod Type**: Starter (or higher for production)

### 5. Start Development

```bash
# Start the development server
yarn start:dev

# The server will be available at http://localhost:3000
```

## 🧪 Testing the System

### Meeting Analysis Test

```bash
curl -X POST http://localhost:3000/langgraph/meeting-analysis/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Meeting started. John discussed the quarterly results. Sarah raised concerns about the budget. We decided to schedule a follow-up meeting next week to review the financial projections.",
    "metadata": {
      "meeting_id": "test-001",
      "participants": ["John", "Sarah"]
    }
  }'
```

### Email Triage Test

```bash
curl -X POST http://localhost:3000/email/triage \
  -H "Content-Type: application/json" \
  -d '{
    "emailData": {
      "body": "Hi, I found a critical bug in the payment system that needs immediate attention. Users cannot complete purchases.",
      "metadata": {
        "subject": "URGENT: Payment System Bug",
        "from": "user@example.com"
      }
    }
  }'
```

## 🏗 Development Workflow

### Project Structure

```
src/
├── langgraph/              # Core agentic framework
│   ├── agents/            # Specialized AI agents
│   ├── core/              # Graph building and execution
│   └── meeting-analysis/  # Meeting analysis workflow
├── email/                 # Email triage system
│   ├── agents/           # Email processing agents
│   └── workflow/         # Email workflow orchestration
├── rag/                  # RAG system implementation
├── embedding/            # Vector embeddings and chunking
├── database/             # Data models and repositories
└── integrations/         # External service connectors
```

### Development Commands

```bash
# Development with hot reload
yarn start:dev

# Run tests
yarn test
yarn test:e2e

# Linting and formatting
yarn lint
yarn format

# Build for production
yarn build
yarn start:prod
```

### Adding New Agents

1. **Create Agent Class**: Extend `BaseAgent` or `RagEnhancedAgent`
2. **Register Team Handler**: Implement `TeamHandler` interface
3. **Configure Dependencies**: Add to appropriate module
4. **Test Integration**: Create integration tests

See [Agent Development Guide](./guides/agentic-workflows/AGENT-DEVELOPMENT-GUIDE.md) for detailed instructions.

## 🚀 Production Deployment

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Scale services
docker-compose up -d --scale app=3
```

### Environment Variables for Production

```env
NODE_ENV=production
LOG_LEVEL=info
RATE_LIMIT_ENABLED=true
CORS_ORIGINS=https://your-domain.com
ENABLE_MONITORING=true
```

### Health Checks

The application exposes health check endpoints:

- `/health` - Basic health status
- `/health/detailed` - Comprehensive system health
- `/metrics` - Application metrics (Prometheus format)

## 🔧 Configuration

### LLM Configuration

Configure different LLM providers in your environment:

```env
# Primary LLM
DEFAULT_LLM_PROVIDER=openai
DEFAULT_MODEL=gpt-4-turbo

# Fallback configuration
ENABLE_FALLBACK_MODEL=true
FALLBACK_MODEL=gpt-3.5-turbo
```

### RAG Configuration

```env
# Vector search settings
RAG_TOP_K=10
RAG_MIN_SCORE=0.7
RAG_CHUNK_SIZE=1000
RAG_CHUNK_OVERLAP=200

# Adaptive RAG
ENABLE_ADAPTIVE_RAG=true
RAG_QUALITY_THRESHOLD=0.8
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Follow the development guides**: See [Developer Onboarding](./guides/agentic-workflows/DEVELOPER-ONBOARDING.md)
4. **Write tests**: Ensure comprehensive test coverage
5. **Submit a pull request**: Include detailed description and testing instructions

### Code Style

- Use TypeScript with strict mode enabled
- Follow NestJS conventions and decorators
- Implement comprehensive error handling
- Add JSDoc comments for public APIs
- Write integration tests for agent workflows

## 📊 Monitoring and Observability

### Logging

The application uses structured logging with different levels:

```typescript
// Use the built-in Logger from NestJS
private readonly logger = new Logger(YourService.name);

this.logger.log('Operation completed successfully');
this.logger.warn('Performance threshold exceeded');
this.logger.error('Failed to process request', error.stack);
```

### Metrics

Key metrics are automatically collected:

- **Agent Performance**: Execution time, success rate, error count
- **RAG Efficiency**: Retrieval accuracy, context relevance
- **System Health**: Memory usage, database connections, API response times

## 🔍 Troubleshooting

### Common Issues

**MongoDB Connection Failed:**
```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Verify connection string
mongo "mongodb://localhost:27017/followthrough-ai"
```

**OpenAI API Errors:**
```bash
# Test API key
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models
```

**Pinecone Vector Issues:**
```bash
# Verify index configuration
# Check dimensions match your embedding model (3072 for text-embedding-3-large)
```

For more troubleshooting guidance, see the [Architecture Overview](./guides/agentic-workflows/ARCHITECTURE-OVERVIEW.md).

## 📞 Support

- **Documentation**: [Agentic Workflows Guides](./guides/agentic-workflows/README.md)
- **Issues**: Create GitHub issues for bugs and feature requests
- **Development**: Follow the [Developer Onboarding Guide](./guides/agentic-workflows/DEVELOPER-ONBOARDING.md)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Ready to build intelligent agentic workflows?** Start with the [Quick Start](#-quick-start) above, then dive into our [comprehensive documentation](./guides/agentic-workflows/README.md) for advanced usage patterns and development guidelines. 