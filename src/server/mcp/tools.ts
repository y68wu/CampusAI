import type { CourseService } from "../data/course-service.js";
import { checkPrerequisites } from "../data/prerequisites.js";

export function createCourseTools(courseService: CourseService) {
  return {
    search_courses: async (query: string) => {
      const courses = await courseService.searchCourses(query);
      return {
        courses,
        sources: courses.map(({ code, sourceLabel, sourceUrl }) => ({ courseCode: code, label: sourceLabel, url: sourceUrl })),
      };
    },
    get_course: async (courseCode: string) => {
      const course = await courseService.getCourse(courseCode);
      if (!course) return { found: false, courseCode, message: "No matching course was found in the selected term's catalog." };
      return { found: true, course, source: { label: course.sourceLabel, url: course.sourceUrl } };
    },
    check_prerequisites: async (courseCode: string, completedCourses: string[]) => {
      const course = await courseService.getCourse(courseCode);
      if (!course) return { found: false, courseCode, message: "No matching course was found. Do not infer its requirements." };
      const result = checkPrerequisites(course, completedCourses);
      return { found: true, ...result };
    },
  };
}
