# Productive AI

An AI agent platform with specialized agents for various tasks, built with Node.js, TypeScript, and Next.js.

## Project Structure

- **server/** - Node.js backend with AI agents and services
- **client/** - Next.js 14 frontend for agent visualization and interaction

## Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Update the `.env` file with your API keys and settings:
   ```
   # Required
   MONGO_DB_URI=mongodb://localhost:27017/productive-ai
   OPENAI_API_KEY=your-openai-api-key
   PINECONE_API_KEY=your-pinecone-api-key
   PINECONE_REGION=your-pinecone-region
   PINECONE_CLOUD=aws
   
   # Optional (will use defaults if not specified)
   JWT_SECRET=your-jwt-secret
   DEFAULT_MODEL=gpt-4-turbo
   ```

3. The environment variables will be automatically loaded by Docker Compose.

## Development

### Quick Start

```bash
# Install dependencies
yarn install

# Start the development environment (both server and client)
yarn dev
```

The server will be available at http://localhost:3000
The client will be available at http://localhost:8080

### Development Workflow

- **Server Development**: `yarn dev:server`
- **Client Development**: `yarn dev:client`

## Production Deployment

```bash
# Build both server and client
yarn build

# Start in production mode
yarn start
```

## Docker Deployment

The project includes Docker configuration for both the server and client:

```bash
# Build and start containers
docker compose up -d

# View logs
docker compose logs -f

# Stop containers
docker compose down
```

### Environment Variables in Docker

Docker Compose will automatically load environment variables from the `.env` file at the root level. These variables are passed to the containers as specified in `docker-compose.yml`.

Default values are provided for some variables, but critical ones like API keys must be set in the `.env` file.

## Available Scripts

- `yarn dev` - Start development environment
- `yarn build` - Build both server and client
- `yarn start` - Start in production mode
- `yarn test` - Run tests
- `yarn lint` - Run linting

## Contributing

1. Create a new branch for your feature
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

MIT 