# syntax=docker/dockerfile:1

FROM node:20-alpine AS build

WORKDIR /app

RUN yarn global add @nestjs/cli

# Copy yarn.lock and package.json from the root of the server project
COPY yarn.lock ./
COPY package.json ./

RUN yarn install

# Copy server source code
COPY ./ ./

# Build the application
RUN yarn build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy yarn.lock and package.json from the root of the server project
COPY yarn.lock ./
COPY package.json ./

RUN yarn install --production

# Copy the built application from the build stage
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/main"]
