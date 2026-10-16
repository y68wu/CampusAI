export interface EvaluationQuestion {
  id: string;
  question: string;
  courseCode: string;
  completedCourses: string[];
  expectedMissingPrerequisite: boolean;
}

// Synthetic regression prompts over the explicitly labelled demo-rule fixtures.
// This measures the deterministic parser/checker only; it is not a live-data or LLM accuracy claim.
export const evaluationQuestions: EvaluationQuestion[] = [
  { id: "Q01", question: "Can I take CS 341?", courseCode: "CS 341", completedCourses: [], expectedMissingPrerequisite: true },
  { id: "Q02", question: "I finished CS 240; check CS 341", courseCode: "CS 341", completedCourses: ["CS 240"], expectedMissingPrerequisite: false },
  { id: "Q03", question: "Does CS341 need anything if I only did CS136?", courseCode: "CS 341", completedCourses: ["CS136"], expectedMissingPrerequisite: true },
  { id: "Q04", question: "What am I missing for CS 240?", courseCode: "CS 240", completedCourses: [], expectedMissingPrerequisite: true },
  { id: "Q05", question: "I have CS 136, can I take CS 240?", courseCode: "CS 240", completedCourses: ["CS 136"], expectedMissingPrerequisite: true },
  { id: "Q06", question: "Completed MATH135 and CS136 for CS240", courseCode: "CS 240", completedCourses: ["MATH135", "CS136"], expectedMissingPrerequisite: false },
  { id: "Q07", question: "Can I enroll in CS 136 after CS 135?", courseCode: "CS 136", completedCourses: ["CS 135"], expectedMissingPrerequisite: false },
  { id: "Q08", question: "Check CS 136; I have not taken CS 135", courseCode: "CS 136", completedCourses: [], expectedMissingPrerequisite: true },
  { id: "Q09", question: "Am I ready for CS 241 with CS136 and CS230?", courseCode: "CS 241", completedCourses: ["CS 136", "CS 230"], expectedMissingPrerequisite: false },
  { id: "Q10", question: "I completed CS136 only. CS241?", courseCode: "CS 241", completedCourses: ["CS136"], expectedMissingPrerequisite: true },
  { id: "Q11", question: "Check CS350 with CS241 and CS246", courseCode: "CS 350", completedCourses: ["CS 241", "CS 246"], expectedMissingPrerequisite: false },
  { id: "Q12", question: "Can I take CS350 after CS241?", courseCode: "CS 350", completedCourses: ["CS 241"], expectedMissingPrerequisite: true },
  { id: "Q13", question: "Does CS350 need courses if I've done everything?", courseCode: "CS 350", completedCourses: ["CS241", "CS246", "CS136"], expectedMissingPrerequisite: false },
  { id: "Q14", question: "I have CS 136; what about CS 246?", courseCode: "CS 246", completedCourses: ["CS136"], expectedMissingPrerequisite: false },
  { id: "Q15", question: "Check CS246 with no completed courses", courseCode: "CS 246", completedCourses: [], expectedMissingPrerequisite: true },
  { id: "Q16", question: "Is CS 230 open after CS 136?", courseCode: "CS 230", completedCourses: ["CS 136"], expectedMissingPrerequisite: false },
  { id: "Q17", question: "What is needed for CS230?", courseCode: "CS 230", completedCourses: [], expectedMissingPrerequisite: true },
  { id: "Q18", question: "Can I take CS251? I completed CS136 and CS230", courseCode: "CS 251", completedCourses: ["CS136", "CS230"], expectedMissingPrerequisite: false },
  { id: "Q19", question: "Check CS251 after CS136", courseCode: "CS 251", completedCourses: ["CS136"], expectedMissingPrerequisite: true },
  { id: "Q20", question: "CS245 prerequisites with CS136 and MATH135 done", courseCode: "CS 245", completedCourses: ["CS136", "MATH135"], expectedMissingPrerequisite: false },
  { id: "Q21", question: "Can I do CS245 with CS136 only?", courseCode: "CS 245", completedCourses: ["CS136"], expectedMissingPrerequisite: true },
  { id: "Q22", question: "Can I take MATH136 after MATH135?", courseCode: "MATH 136", completedCourses: ["MATH135"], expectedMissingPrerequisite: false },
  { id: "Q23", question: "Check MATH136 with nothing completed", courseCode: "MATH 136", completedCourses: [], expectedMissingPrerequisite: true },
  { id: "Q24", question: "Do I meet MATH239 after MATH136?", courseCode: "MATH 239", completedCourses: ["MATH136"], expectedMissingPrerequisite: false },
  { id: "Q25", question: "What am I missing for MATH239?", courseCode: "MATH 239", completedCourses: ["MATH135"], expectedMissingPrerequisite: true },
  { id: "Q26", question: "Check CS370 with CS240 and MATH239", courseCode: "CS 370", completedCourses: ["CS240", "MATH239"], expectedMissingPrerequisite: false },
  { id: "Q27", question: "Can I take CS370 if I have CS240?", courseCode: "CS 370", completedCourses: ["CS240"], expectedMissingPrerequisite: true },
  { id: "Q28", question: "CS370 with MATH239 only?", courseCode: "CS 370", completedCourses: ["MATH239"], expectedMissingPrerequisite: true },
  { id: "Q29", question: "Can I take CS341 if I did CS 240 and CS 136?", courseCode: "CS 341", completedCourses: ["CS240", "CS136"], expectedMissingPrerequisite: false },
  { id: "Q30", question: "CS 240 with CS136 and MATH135 completed", courseCode: "CS 240", completedCourses: ["CS136", "MATH135"], expectedMissingPrerequisite: false },
  { id: "Q31", question: "CS 241 with CS230 only", courseCode: "CS 241", completedCourses: ["CS230"], expectedMissingPrerequisite: true },
  { id: "Q32", question: "Check CS350 with CS246 only", courseCode: "CS 350", completedCourses: ["CS246"], expectedMissingPrerequisite: true },
];
