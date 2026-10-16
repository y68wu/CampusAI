import type { Course, PrerequisiteCheck } from "../../shared/types.js";

const COURSE_CODE = /\b([A-Z]{2,5})\s*[- ]?\s*(\d{3}[A-Z]?)\b/gi;

export function normalizeCourseCode(value: string): string {
  const match = value.toUpperCase().match(/([A-Z]{2,5})\s*[- ]?\s*(\d{3}[A-Z]?)/);
  return match ? `${match[1]} ${match[2]}` : value.trim().toUpperCase();
}

/** Convert the catalog's readable prerequisite text into AND-of-OR groups. */
export function parsePrerequisiteGroups(text: string): string[][] {
  if (!text.trim()) return [];
  const normalized = text
    .replace(/\b(?:anti[- ]?requisites?|co[- ]?requisites?|corequisites?|prerequisites?)\s*:?/gi, " ")
    .replace(/\bone\s+of\b/gi, " ");
  const conjunctions = normalized
    .split(/[,;]|\b(?:and|plus)\b/gi)
    .map((part) => part.trim())
    .filter(Boolean);
  const groups: string[][] = [];

  for (const clause of conjunctions) {
    const alternatives = clause
      .split(/\b(?:or|either)\b|\//gi)
      .map((part) => [...part.matchAll(COURSE_CODE)].map((match) => `${match[1].toUpperCase()} ${match[2].toUpperCase()}`))
      .flat();
    const unique = [...new Set(alternatives)];
    if (unique.length) groups.push(unique);
  }
  return groups;
}

export function getMissingPrerequisiteGroups(groups: string[][], completedCourses: string[]): string[][] {
  const completed = new Set(completedCourses.map(normalizeCourseCode));
  return groups.filter((group) => !group.some((code) => completed.has(normalizeCourseCode(code))));
}

export function checkPrerequisites(
  target: Course,
  completedCourseCodes: string[],
  now: Date = new Date(),
): PrerequisiteCheck {
  const completedCourses = [...new Set(completedCourseCodes.map(normalizeCourseCode).filter(Boolean))];
  const source = { label: target.sourceLabel, url: target.sourceUrl };
  const groups = target.prerequisiteGroups.length
    ? target.prerequisiteGroups
    : parsePrerequisiteGroups(target.requirementsDescription);
  const missingGroups = getMissingPrerequisiteGroups(groups, completedCourses);

  if (target.dataMode === "demo") {
    return {
      target,
      completedCourses,
      status: "unverified",
      missingGroups,
      explanation: "This is a demo-catalog result. No eligibility conclusion is verified against live Waterloo data. Add a Waterloo Open Data API key to check the official catalog response.",
      checkedAt: now.toISOString(),
      sources: [source],
    };
  }

  if (!groups.length) {
    return {
      target,
      completedCourses,
      status: "no_prerequisite_listed",
      missingGroups: [],
      explanation: target.requirementsDescription
        ? "The official catalog lists requirements, but they could not be parsed into course-code rules. Review the cited requirement text before enrolling."
        : "No course-code prerequisite was listed in the returned catalog record. Check the official course page for non-course requirements or updates.",
      checkedAt: now.toISOString(),
      sources: [source],
    };
  }

  return {
    target,
    completedCourses,
    status: missingGroups.length ? "missing_prerequisites" : "eligible",
    missingGroups,
    explanation: missingGroups.length
      ? `The catalog requires at least one course from each missing group: ${missingGroups.map((group) => group.join(" or ")).join("; ")}.`
      : "Your completed-course list satisfies the parsed prerequisite groups shown in the cited Waterloo catalog record. Confirm your academic standing and enrollment eligibility with an advisor.",
    checkedAt: now.toISOString(),
    sources: [source],
  };
}
