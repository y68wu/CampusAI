export interface Course {
  code: string;
  title: string;
  description: string;
  requirementsDescription: string;
  termCode: string;
  termName: string;
  prerequisiteGroups: string[][];
  offeringStatus: "offered" | "not_listed" | "unknown";
  sourceUrl: string;
  sourceLabel: string;
  dataMode: "live" | "demo";
}

export type PrerequisiteStatus =
  | "eligible"
  | "missing_prerequisites"
  | "no_prerequisite_listed"
  | "unverified";

export interface PrerequisiteCheck {
  target: Course;
  completedCourses: string[];
  status: PrerequisiteStatus;
  missingGroups: string[][];
  explanation: string;
  checkedAt: string;
  sources: Array<{ label: string; url: string }>;
}

export interface AppStatus {
  dataMode: "live" | "demo";
  apiConfigured: boolean;
  activeTerm: { code: string; name: string };
  attribution: string;
  notice: string;
}
