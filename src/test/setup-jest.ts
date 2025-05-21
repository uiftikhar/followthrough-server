import { server } from './mocks/server';

// Establish API mocking before all tests
beforeAll(() => {
  // Start the interception
  server.listen({ onUnhandledRequest: 'warn' });
  console.log('🔶 MSW server started');
});

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests
afterEach(() => {
  server.resetHandlers();
});

// Clean up after the tests are finished
afterAll(() => {
  // Close the server to ensure tests don't hang
  server.close();
  console.log('🔶 MSW server stopped');
});
