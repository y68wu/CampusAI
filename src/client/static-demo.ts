import { getDemoCourses } from "../server/data/demo-courses.js";
import { checkPrerequisites, normalizeCourseCode } from "../server/data/prerequisites.js";
import type { AppStatus, Course } from "../shared/types.js";

export const STATIC_DEMO_ENABLED = import.meta.env.VITE_STATIC_DEMO === "true";

const ACTIVE_TERM = { code: "1269", name: "Fall 2026" };
const courses = getDemoCourses(ACTIVE_TERM.code, ACTIVE_TERM.name);

export const staticDemoStatus: AppStatus = {
  dataMode: "demo",
  apiConfigured: false,
  activeTerm: ACTIVE_TERM,
  attribution: "University of Waterloo Open Data API v3 course endpoint",
  notice: "Interactive static demo using a small, labeled fixture. Results are deterministic and not live-verified.",
};

type DemoSource = { label: string; url: string; courseCode?: string };

export interface StaticChatResult {
  answer: string;
  sources: DemoSource[];
  checks: Array<{ courseCode: string; status: string; explanation: string }>;
  toolCalls: string[];
  latencyMs: number;
  mode: "rules-demo";
}

export function searchStaticCourses(search: string): Course[] {
  const query = search.trim().toUpperCase();
  if (!query) return [];
  return courses.filter((course) =>
    course.code.includes(query)
    || course.title.toUpperCase().includes(query)
    || course.description.toUpperCase().includes(query),
  ).slice(0, 8);
}

function courseCodes(text: string): string[] {
  return [...text.matchAll(/\b([A-Z]{2,5})\s*[- ]?\s*(\d{3}[A-Z]?)\b/gi)]
    .map((match) => normalizeCourseCode(`${match[1]} ${match[2]}`));
}

function sourceFor(course: Course): DemoSource {
  return { label: course.sourceLabel, url: course.sourceUrl, courseCode: course.code };
}

export async function answerStaticQuestion(
  question: string,
  completedCourses: string[],
): Promise<StaticChatResult> {
  const startedAt = performance.now();
  const codes = courseCodes(question);
  const targetCode = codes[0];

  if (!targetCode) {
    const matches = /\b(ai|artificial|machine learning)\b/i.test(question)
      ? courses.filter((course) => /artificial intelligence|machine learning/i.test(`${course.title} ${course.description}`))
      : courses.filter((course) => course.code.startsWith("CS ")).slice(0, 6);
    const lines = matches.map((course) =>
      `- **${course.code} - ${course.title}**: ${course.requirementsDescription || "No course prerequisite text is listed in this demo record."}`,
    );
    return {
      answer: [
        "### Demo courses to explore",
        ...lines,
        "",
        "> **Interactive static demo:** these labeled fixtures demonstrate the planning workflow; they are not live course offerings or enrollment advice.",
      ].join("\n"),
      sources: matches.map(sourceFor),
      checks: [],
      toolCalls: ["static_demo_search_courses"],
      latencyMs: Math.round(performance.now() - startedAt),
      mode: "rules-demo",
    };
  }

  const target = courses.find((course) => course.code === targetCode);
  if (!target) {
    return {
      answer: `I couldn't find **${targetCode}** in this small demo fixture. Try **CS 341**, **CS 350**, or the course-search view.`,
      sources: [],
      checks: [],
      toolCalls: ["static_demo_get_course"],
      latencyMs: Math.round(performance.now() - startedAt),
      mode: "rules-demo",
    };
  }

  const check = checkPrerequisites(target, completedCourses);
  const missing = check.missingGroups.length
    ? `Based on the courses you entered, the unsatisfied demo group${check.missingGroups.length > 1 ? "s are" : " is"}: **${check.missingGroups.map((group) => group.join(" or ")).join("; ")}**.`
    : check.target.prerequisiteGroups.length
      ? "The courses you entered satisfy every course-code group in this demo rule."
      : "This demo record does not list a course-code prerequisite."

  return {
    answer: [
      `### ${target.code} - ${target.title}`,
      target.description,
      "",
      `**Catalog text in the demo fixture:** ${target.requirementsDescription || "No prerequisite text listed."}`,
      `**Planning check:** ${missing}`,
      "",
      "> **Unverified demo result:** this GitHub Pages version runs deterministic prerequisite logic in your browser. Confirm current requirements in the official Waterloo catalog and with an advisor before enrolling.",
    ].join("\n"),
    sources: [sourceFor(target)],
    checks: [{ courseCode: target.code, status: "unverified", explanation: check.explanation }],
    toolCalls: ["static_demo_check_prerequisites"],
    latencyMs: Math.round(performance.now() - startedAt),
    mode: "rules-demo",
  };
}
