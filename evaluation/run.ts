import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluationQuestions } from "./questions.js";
import { getDemoCourses } from "../src/server/data/demo-courses.js";
import { getMissingPrerequisiteGroups } from "../src/server/data/prerequisites.js";

const here = dirname(fileURLToPath(import.meta.url));
const catalog = getDemoCourses("1269", "Fall 2026");
const latencies: number[] = [];
let correct = 0;
const rows = evaluationQuestions.map((question) => {
  const started = performance.now();
  const course = catalog.find((item) => item.code === question.courseCode);
  const actualMissing = course
    ? getMissingPrerequisiteGroups(course.prerequisiteGroups, question.completedCourses).length > 0
    : true;
  const latencyMs = Number((performance.now() - started).toFixed(3));
  latencies.push(latencyMs);
  const passed = actualMissing === question.expectedMissingPrerequisite;
  if (passed) correct += 1;
  return { ...question, actualMissingPrerequisite: actualMissing, passed, latencyMs };
});
const sorted = [...latencies].sort((a, b) => a - b);
const medianLatencyMs = sorted.length % 2
  ? sorted[Math.floor(sorted.length / 2)]
  : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
const report = {
  generatedAt: new Date().toISOString(),
  evaluationType: "synthetic demo-fixture prerequisite rule regression (not a live-data or LLM benchmark)",
  dataMode: "demo",
  sampleCount: rows.length,
  correctCount: correct,
  accuracy: rows.length ? correct / rows.length : 0,
  medianRuleEvaluationLatencyMs: Number(medianLatencyMs.toFixed(3)),
  pass: correct === rows.length,
  rows,
};
const reportPath = resolve(here, "latest-report.json");
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, rows: undefined, reportPath }, null, 2));
if (!report.pass) process.exitCode = 1;
