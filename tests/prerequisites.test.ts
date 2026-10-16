import { describe, expect, it } from "vitest";
import { getDemoCourses } from "../src/server/data/demo-courses.js";
import { getMissingPrerequisiteGroups, normalizeCourseCode, parsePrerequisiteGroups, checkPrerequisites } from "../src/server/data/prerequisites.js";

const courses = getDemoCourses("1269", "Fall 2026");
const byCode = (code: string) => courses.find((course) => course.code === code)!;

describe("course-code normalization", () => {
  it.each([["cs341", "CS 341"], ["CS 341", "CS 341"], ["math-135", "MATH 135"]])("normalizes %s", (input, expected) => {
    expect(normalizeCourseCode(input)).toBe(expected);
  });
});

describe("prerequisite rule parsing", () => {
  it("splits AND groups and keeps OR alternatives together", () => {
    expect(parsePrerequisiteGroups("Prerequisites: CS 136 and (CS 251 or SE 251)."))
      .toEqual([["CS 136"], ["CS 251", "SE 251"]]);
  });

  it("recognizes a simple prerequisite", () => {
    expect(parsePrerequisiteGroups("Prerequisite: CS 240.")).toEqual([["CS 240"]]);
  });

  it("does not infer requirements from empty text", () => {
    expect(parsePrerequisiteGroups("")).toEqual([]);
  });
});

describe("deterministic prerequisite checks", () => {
  it("requires every prerequisite group", () => {
    expect(getMissingPrerequisiteGroups([["CS 136"], ["MATH 135"]], ["CS136"])).toEqual([["MATH 135"]]);
  });

  it("allows any course within an OR group", () => {
    expect(getMissingPrerequisiteGroups([["CS 251", "SE 251"]], ["SE251"])).toEqual([]);
  });

  it("does not claim demo data is verified", () => {
    const check = checkPrerequisites(byCode("CS 341"), ["CS 240"]);
    expect(check.status).toBe("unverified");
    expect(check.missingGroups).toEqual([]);
    expect(check.explanation).toContain("demo-catalog");
  });

  it("returns unknown when no prerequisite text was supplied", () => {
    const check = checkPrerequisites(byCode("CS 135"), []);
    expect(check.status).toBe("unverified");
    expect(check.missingGroups).toEqual([]);
  });
});
