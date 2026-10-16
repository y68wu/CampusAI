import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { courseService } from "../data/course-service.js";
import { createCourseTools } from "./tools.js";

export function createCourseMcpServer(): McpServer {
  const server = new McpServer(
    { name: "waterloo-course-planner", version: "0.1.0" },
    { instructions: "Use official Waterloo course records when available. Always return source URLs and distinguish demo fixtures from live catalog data. Never treat missing or unparsed requirements as proof of eligibility." },
  );
  const tools = createCourseTools(courseService);

  server.registerTool(
    "search_courses",
    {
      title: "Search Waterloo courses",
      description: "Search Waterloo Open Data course records by course code or title for the active academic term. Returns course data and citations.",
      inputSchema: z.object({ query: z.string().min(2).max(80).describe("Course code such as CS 341 or a title fragment") }),
      outputSchema: z.object({ courses: z.array(z.unknown()), sources: z.array(z.object({ courseCode: z.string(), label: z.string(), url: z.string() })) }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ query }) => {
      const result = await tools.search_courses(query);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    },
  );

  server.registerTool(
    "get_course",
    {
      title: "Get a Waterloo course record",
      description: "Retrieve the official catalog title, description, prerequisite text, selected term, and source link for one course.",
      inputSchema: z.object({ courseCode: z.string().min(4).max(12).describe("Course code, for example CS 341") }),
      outputSchema: z.object({ found: z.boolean(), course: z.unknown().optional(), source: z.unknown().optional(), courseCode: z.string().optional(), message: z.string().optional() }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ courseCode }) => {
      const result = await tools.get_course(courseCode);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    },
  );

  server.registerTool(
    "check_prerequisites",
    {
      title: "Check course prerequisites",
      description: "Compare a student's completed courses with the target course's parsed catalog prerequisites. An AND-of-ORs rule is checked deterministically; demo data always returns unverified. Includes citations.",
      inputSchema: z.object({
        courseCode: z.string().min(4).max(12).describe("Target course code"),
        completedCourses: z.array(z.string().min(4).max(12)).max(80).describe("Course codes the student says they have completed"),
      }),
      outputSchema: z.object({ found: z.boolean(), target: z.unknown().optional(), status: z.string().optional(), missingGroups: z.array(z.array(z.string())).optional(), explanation: z.string().optional(), sources: z.array(z.unknown()).optional(), message: z.string().optional() }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ courseCode, completedCourses }) => {
      const result = await tools.check_prerequisites(courseCode, completedCourses);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    },
  );

  return server;
}
