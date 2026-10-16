import { describe, expect, it } from "vitest";
import { CourseService } from "../src/server/data/course-service.js";

describe("demo course search", () => {
  it("matches a subject code as a course subject, not as a title substring", async () => {
    const service = new CourseService();
    const courses = await service.searchCourses("CS");
    expect(courses.length).toBeGreaterThan(0);
    expect(courses.every((course) => course.code.startsWith("CS "))).toBe(true);
  });

  it("normalizes an unspaced course code", async () => {
    const service = new CourseService();
    const course = await service.getCourse("cs341");
    expect(course?.code).toBe("CS 341");
  });
});
