import "dotenv/config";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createCourseMcpServer } from "./server.js";

// stdio is protocol-only: diagnostics go to stderr, never stdout.
void serveStdio(createCourseMcpServer);
console.error("Waterloo Course Planner MCP server is ready.");
