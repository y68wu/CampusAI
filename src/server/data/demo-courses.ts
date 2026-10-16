import type { Course } from "../../shared/types.js";

// Clearly marked, small demo fixtures only. These are not represented as a live or complete
// Waterloo catalog. Production answers use the official Open Data API response instead.
const demoRows = [
  { code: "CS 135", title: "Designing Functional Programs", description: "An introduction to program design and functional programming.", requirementsDescription: "", prerequisiteGroups: [] },
  { code: "CS 136", title: "Elementary Algorithm Design and Data Abstraction", description: "Algorithm design, data abstraction, and programming fundamentals.", requirementsDescription: "Prerequisite: CS 135.", prerequisiteGroups: [["CS 135"]] },
  { code: "CS 230", title: "Introduction to Computers and Computer Systems", description: "Computer organization and systems fundamentals.", requirementsDescription: "Prerequisite: CS 136.", prerequisiteGroups: [["CS 136"]] },
  { code: "CS 240", title: "Data Structures and Data Management", description: "Data structures, algorithm analysis, and data management.", requirementsDescription: "Prerequisites: CS 136 and MATH 135.", prerequisiteGroups: [["CS 136"], ["MATH 135"]] },
  { code: "CS 241", title: "Foundations of Sequential Programs", description: "Formal foundations for sequential programs and compilers.", requirementsDescription: "Prerequisites: CS 136 and CS 230.", prerequisiteGroups: [["CS 136"], ["CS 230"]] },
  { code: "CS 245", title: "Logic and Computation", description: "Logic, proof, and computability.", requirementsDescription: "Prerequisites: CS 136 and MATH 135.", prerequisiteGroups: [["CS 136"], ["MATH 135"]] },
  { code: "CS 246", title: "Object-Oriented Software Development", description: "Software development using object-oriented design and C++.", requirementsDescription: "Prerequisite: CS 136.", prerequisiteGroups: [["CS 136"]] },
  { code: "CS 251", title: "Computer Organization and Design", description: "Digital logic, computer architecture, and machine-level programming.", requirementsDescription: "Prerequisites: CS 136 and CS 230.", prerequisiteGroups: [["CS 136"], ["CS 230"]] },
  { code: "CS 341", title: "Algorithms", description: "Design and analysis of algorithms.", requirementsDescription: "Prerequisite: CS 240.", prerequisiteGroups: [["CS 240"]] },
  { code: "CS 350", title: "Operating Systems", description: "Processes, concurrency, memory, and operating system design.", requirementsDescription: "Prerequisites: CS 241 and CS 246.", prerequisiteGroups: [["CS 241"], ["CS 246"]] },
  { code: "CS 370", title: "Introduction to Artificial Intelligence", description: "Search, reasoning, and introductory machine learning.", requirementsDescription: "Prerequisites: CS 240 and MATH 239.", prerequisiteGroups: [["CS 240"], ["MATH 239"]] },
  { code: "MATH 135", title: "Algebra for Honours Mathematics", description: "Algebraic structures, proof, and mathematical reasoning.", requirementsDescription: "", prerequisiteGroups: [] },
  { code: "MATH 136", title: "Linear Algebra 1 for Honours Mathematics", description: "Vectors, matrices, linear systems, and vector spaces.", requirementsDescription: "Prerequisite: MATH 135.", prerequisiteGroups: [["MATH 135"]] },
  { code: "MATH 239", title: "Introduction to Combinatorics", description: "Counting, graph theory, and combinatorial reasoning.", requirementsDescription: "Prerequisite: MATH 136.", prerequisiteGroups: [["MATH 136"]] },
];

export function getDemoCourses(termCode: string, termName: string): Course[] {
  return demoRows.map((row) => ({
    ...row,
    termCode,
    termName,
    offeringStatus: "unknown" as const,
    sourceUrl: `https://openapi.data.uwaterloo.ca/api-docs/index.html#/Courses/get_v3_Courses__termCode__subject__catalogNumber_`,
    sourceLabel: "Waterloo Open Data API v3 — course endpoint (demo data; not live-verified)",
    dataMode: "demo" as const,
  }));
}
