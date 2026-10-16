import { parse } from "graphql";
import { courseService } from "../data/course-service.js";
import { checkPrerequisites } from "../data/prerequisites.js";

export const typeDefs = parse(`
  type Term { code: String!, name: String! }
  type Course {
    code: String!
    title: String!
    description: String!
    requirementsDescription: String!
    termCode: String!
    termName: String!
    prerequisiteGroups: [[String!]!]!
    offeringStatus: String!
    sourceUrl: String!
    sourceLabel: String!
    dataMode: String!
  }
  type Source { label: String!, url: String! }
  type PrerequisiteCheck {
    target: Course!
    completedCourses: [String!]!
    status: String!
    missingGroups: [[String!]!]!
    explanation: String!
    checkedAt: String!
    sources: [Source!]!
  }
  type AppStatus {
    dataMode: String!
    apiConfigured: Boolean!
    activeTerm: Term!
    attribution: String!
    notice: String!
  }
  type Query {
    appStatus: AppStatus!
    courses(search: String!, termCode: String): [Course!]!
    course(code: String!, termCode: String): Course
    checkPrerequisites(courseCode: String!, completedCourses: [String!]!, termCode: String): PrerequisiteCheck
  }
`);

export const resolvers = {
  Query: {
    appStatus: () => courseService.getStatus(),
    courses: (_: unknown, args: { search: string; termCode?: string }) => courseService.searchCourses(args.search, args.termCode),
    course: (_: unknown, args: { code: string; termCode?: string }) => courseService.getCourse(args.code, args.termCode),
    checkPrerequisites: async (_: unknown, args: { courseCode: string; completedCourses: string[]; termCode?: string }) => {
      const course = await courseService.getCourse(args.courseCode, args.termCode);
      return course ? checkPrerequisites(course, args.completedCourses) : null;
    },
  },
};
