# Using Mock Service Worker (MSW) for API Testing

This project uses [Mock Service Worker (MSW)](https://mswjs.io/) for intercepting and mocking API requests during testing. MSW allows us to test our code that makes external API calls without actually hitting those endpoints.

## How MSW is Set Up

1. **Handler Definitions**: Located in `src/test/mocks/handlers.ts`, these define how MSW responds to various API requests.

2. **Server Setup**: Located in `src/test/mocks/server.ts`, this creates the MSW server using the handlers.

3. **Jest Integration**: The MSW server is automatically started before tests run and stopped after tests complete via the setup file at `src/test/setup-jest.ts`.

## Using MSW in Your Tests

### Basic Usage

The MSW server is automatically started for all tests. By default, it will use the handlers defined in `src/test/mocks/handlers.ts`.

```typescript
// Your test will automatically use the MSW handlers
it('should make an API call', async () => {
  const result = await yourService.makeApiCall();
  expect(result).toBeDefined();
});
```

### Custom Handlers for Specific Tests

You can define custom handlers for specific tests by using `server.use()`:

```typescript
import { server } from '../test/mocks/server';
import { http, HttpResponse } from 'msw';

it('should handle a specific response', async () => {
  // Create a custom handler for this test only
  server.use(
    http.post('https://api.example.com/data', () => {
      return HttpResponse.json({
        customData: 'test value'
      });
    })
  );
  
  const result = await yourService.makeApiCall();
  expect(result.customData).toBe('test value');
});
```

### Testing Error Responses

You can simulate API errors using MSW:

```typescript
import { server } from '../test/mocks/server';
import { http, HttpResponse } from 'msw';

it('should handle API errors', async () => {
  // Simulate a 500 error
  server.use(
    http.post('https://api.example.com/data', () => {
      return new HttpResponse(null, { status: 500 });
    })
  );
  
  await expect(yourService.makeApiCall()).rejects.toThrow();
});
```

## Mocking AI API Responses

When testing AI services like OpenAI, there are some special considerations:

### Handling OpenAI Embeddings

For embedding services, the response format should match the OpenAI API:

```typescript
// In handlers.ts or in a test-specific handler
http.post('https://api.openai.com/v1/embeddings', () => {
  return HttpResponse.json({
    data: [
      {
        embedding: Array(384).fill(0.1), // Use the appropriate dimension size
        index: 0,
        object: 'embedding'
      }
    ],
    model: 'text-embedding-3-large',
    object: 'list',
    usage: { prompt_tokens: 10, total_tokens: 10 }
  });
})
```

### Writing Robust Tests for AI Services

When writing tests for AI services, especially those that call external APIs:

1. **Use Flexible Assertions**: Since AI model responses can change, avoid strict equality checks:

```typescript
// Good - more flexible
expect(Array.isArray(result)).toBe(true);
expect(result.length).toBeGreaterThan(0);

// Avoid - too strict
expect(result).toEqual(exactExpectedArray);
```

2. **Add Debug Logging**: When testing AI services, add debug logs to help diagnose issues:

```typescript
console.log('Response received:', typeof response, Array.isArray(response) ? `length: ${response.length}` : '');
if (Array.isArray(response) && response.length > 0) {
  console.log('First few items:', response.slice(0, 5));
}
```

3. **Handle Different Dimensions**: AI models often return different dimensional embeddings across versions:

```typescript
// In your test
server.use(
  http.post('https://api.openai.com/v1/embeddings', () => {
    // The dimension may vary based on model versions
    const embedding = Array(96).fill(0);
    return HttpResponse.json({
      data: [{ embedding, index: 0, object: 'embedding' }],
      model: 'text-embedding-3-large',
      object: 'list',
      usage: { prompt_tokens: 10, total_tokens: 10 }
    });
  })
);
```

## Adding New API Mocks

To add mocks for new APIs:

1. Add new handlers to `src/test/mocks/handlers.ts`:

```typescript
export const handlers = [
  // Existing handlers...
  
  // New handler
  http.get('https://api.newservice.com/data', () => {
    return HttpResponse.json({
      data: 'mocked response'
    });
  }),
];
```

2. Use the mocked API in your tests as normal.

## Best Practices

1. **Keep Mock Responses Realistic**: Ensure your mock responses closely match the actual API responses.

2. **Reset Handlers Between Tests**: The `afterEach` hook in `setup-jest.ts` calls `server.resetHandlers()` to ensure test isolation.

3. **Mock Only External APIs**: Use MSW for external APIs rather than for internal service methods.

4. **Custom Handlers for Edge Cases**: Create specific handlers for tests that need to verify error handling or edge cases.

5. **Catch-all Handlers**: For APIs that are called but not explicitly mocked, add a catch-all handler:

```typescript
// Warning handler for unmocked requests
http.all('*', ({ request }) => {
  console.warn(`Unmocked request: ${request.method} ${request.url}`);
  return HttpResponse.json({ error: 'Not mocked' }, { status: 501 });
})
```

## Debugging

If you encounter issues with MSW:

1. Check the console for warnings about unhandled requests
2. Ensure your request URL exactly matches the one in your handler
3. Verify that the request method matches (GET, POST, etc.)
4. Confirm that content types match if you're using request matching based on body content 