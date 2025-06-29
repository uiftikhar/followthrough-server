import { server } from "./mocks/server";

beforeAll(() => {
  server.listen({ onUnhandledRequest: "warn" });
  console.log("🔶 MSW server started");
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
  console.log("🔶 MSW server stopped");
});
