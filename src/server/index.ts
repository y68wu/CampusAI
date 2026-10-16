import "dotenv/config";
import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { answerCourseQuestion, type ChatHistoryItem } from "./ai/chat.js";
import { courseService } from "./data/course-service.js";
import { resolvers, typeDefs } from "./graphql/schema.js";
import { createCourseMcpServer } from "./mcp/server.js";

const port = Number(process.env.PORT ?? 4000);
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mcpHandler = createMcpHandler(createCourseMcpServer);
const mcpNodeHandler = toNodeHandler(mcpHandler);

// Reject browser-originated cross-host MCP requests (DNS-rebinding defense).
// Non-browser MCP clients without an Origin header are still supported.
app.use("/mcp", (req, res, next) => {
  const origin = req.header("origin");
  const host = req.header("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        res.status(403).json({ error: "Cross-origin MCP request rejected." });
        return;
      }
    } catch {
      res.status(403).json({ error: "Invalid Origin header." });
      return;
    }
  }
  next();
});
app.all("/mcp", (req, res) => {
  void mcpNodeHandler(req, res, req.body);
});

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/status", async (_req, res, next) => {
  try { res.json(await courseService.getStatus()); } catch (error) { next(error); }
});

const chatWindows = new Map<string, { startedAt: number; count: number }>();
app.post("/api/chat", express.json({ limit: "12kb" }), async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const window = chatWindows.get(ip);
  if (!window || now - window.startedAt > 60_000) chatWindows.set(ip, { startedAt: now, count: 1 });
  else if (++window.count > 20) {
    res.status(429).json({ error: "Too many chat requests. Please try again in a minute." });
    return;
  }

  const question = typeof req.body?.question === "string" ? req.body.question.trim().slice(0, 2_000) : "";
  const completedCourses = Array.isArray(req.body?.completedCourses)
    ? req.body.completedCourses.filter((course: unknown): course is string => typeof course === "string").slice(0, 80)
    : [];
  const history: ChatHistoryItem[] = Array.isArray(req.body?.messages)
    ? req.body.messages.slice(-10).flatMap((message: unknown) => {
        if (!message || typeof message !== "object") return [];
        const item = message as Record<string, unknown>;
        return (item.role === "user" || item.role === "assistant") && typeof item.content === "string"
          ? [{ role: item.role, content: item.content.slice(0, 2_000) }]
          : [];
      })
    : [];
  if (!question) {
    res.status(400).json({ error: "Enter a course-planning question." });
    return;
  }
  if (!mcpClient) {
    res.status(503).json({ error: "Course tools are starting up. Please try again shortly." });
    return;
  }

  try {
    res.json(await answerCourseQuestion(mcpClient, question, completedCourses, history));
  } catch (error) {
    console.error("Chat request failed:", error);
    res.status(502).json({ error: "The course assistant could not complete that request. Please try again." });
  }
});

const apollo = new ApolloServer({ typeDefs, resolvers, introspection: process.env.NODE_ENV !== "production" });
await apollo.start();
app.use("/graphql", express.json({ limit: "20kb" }), expressMiddleware(apollo));

if (process.env.NODE_ENV === "production") {
  const clientBuild = path.resolve(__dirname, "../../dist/client");
  app.use(express.static(clientBuild, { maxAge: "1h", index: false }));
  app.get("/{*path}", (_req, res) => res.sendFile(path.join(clientBuild, "index.html")));
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Request failed:", error);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

let mcpClient: Client | undefined;
const httpServer = app.listen(port, "0.0.0.0", async () => {
  console.log(`Campus AI server listening on port ${port}`);
  console.log(`GraphQL endpoint: http://localhost:${port}/graphql`);
  console.log(`MCP endpoint: http://localhost:${port}/mcp`);
  mcpClient = new Client({ name: "campus-ai-langchain-host", version: "0.1.0" });
  try {
    await mcpClient.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
    console.log("LangChain host connected to the Waterloo MCP server.");
  } catch (error) {
    console.error("Could not connect the internal MCP client:", error);
    mcpClient = undefined;
  }
});

async function shutdown() {
  await apollo.stop();
  await mcpClient?.close();
  httpServer.close(() => process.exit(0));
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
