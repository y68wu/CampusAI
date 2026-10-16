import type { AppStatus, Course } from "../../shared/types.js";
import { getDemoCourses } from "./demo-courses.js";
import { normalizeCourseCode, parsePrerequisiteGroups } from "./prerequisites.js";

const API_ROOT = "https://openapi.data.uwaterloo.ca/v3";
const ATTRIBUTION = "Course data provided by the University of Waterloo Open Data API. Waterloo data is reproduced for non-commercial use with attribution; review current API and university terms before distribution.";
const CACHE_MS = 10 * 60 * 1000;

interface WaterlooTerm { termCode?: string; name?: string; nameShort?: string; termBeginDate?: string; termEndDate?: string }
interface WaterlooCourse {
  courseId?: string;
  courseOfferNumber?: number;
  termCode?: string;
  termName?: string;
  subjectCode?: string;
  catalogNumber?: string;
  title?: string;
  description?: string;
  descriptionAbbreviated?: string;
  requirementsDescription?: string;
}

export class CourseService {
  private readonly cache = new Map<string, { expiresAt: number; value: unknown }>();
  private readonly apiKey = process.env.WATERLOO_API_KEY?.trim() ?? "";
  private demoTerm = { code: "1269", name: "Fall 2026" };
  private liveApiHealthy = false;

  get apiConfigured(): boolean { return Boolean(this.apiKey); }
  get dataMode(): "live" | "demo" { return this.apiConfigured && this.liveApiHealthy ? "live" : "demo"; }

  private async request<T>(path: string): Promise<T> {
    const cached = this.cache.get(path);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
    if (!this.apiKey) throw new Error("Waterloo Open Data API key is not configured.");

    const response = await fetch(`${API_ROOT}${path}`, {
      headers: { "X-API-KEY": this.apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Waterloo API returned ${response.status}.`);
    const value = await response.json() as T;
    this.cache.set(path, { expiresAt: Date.now() + CACHE_MS, value });
    this.liveApiHealthy = true;
    return value;
  }

  async getTerm(): Promise<{ code: string; name: string }> {
    if (!this.apiKey) return this.demoTerm;
    try {
      const terms = await this.request<WaterlooTerm[]>("/Terms");
      const term = terms.find((item) => item.termCode && (item.termEndDate == null || Date.parse(item.termEndDate) >= Date.now()));
      if (term?.termCode) {
        this.demoTerm = { code: term.termCode, name: term.name ?? term.nameShort ?? term.termCode };
        return this.demoTerm;
      }
    } catch (error) {
      this.liveApiHealthy = false;
      console.warn("Unable to resolve the active Waterloo term; showing demo fixtures.", error instanceof Error ? error.message : error);
    }
    return this.demoTerm;
  }

  async getStatus(): Promise<AppStatus> {
    const activeTerm = await this.getTerm();
    const live = this.dataMode === "live";
    return {
      dataMode: live ? "live" : "demo",
      apiConfigured: this.apiConfigured,
      activeTerm,
      attribution: ATTRIBUTION,
      notice: live
        ? "Course details are returned from Waterloo Open Data API v3. Prerequisite text is shown verbatim; automated parsing may miss special conditions."
        : this.apiConfigured
          ? "Waterloo API could not be reached. Showing clearly labelled demo data; prerequisite results are not verified."
          : "Showing clearly labelled demo data. Add WATERLOO_API_KEY to use official, live course records.",
    };
  }

  async searchCourses(query: string, termCode?: string): Promise<Course[]> {
    const term = termCode ? { code: termCode, name: termCode } : await this.getTerm();
    const raw = query.trim().toUpperCase().replace(/\s+/g, " ");
    const codeMatch = raw.match(/^([A-Z]{2,5})\s*(\d{3}[A-Z]?)$/);
    const normalized = codeMatch ? `${codeMatch[1]} ${codeMatch[2]}` : raw;
    if (!normalized) return [];

    if (this.apiKey) {
      try {
        const exact = normalized.match(/^([A-Z]{2,5})\s*(\d{3}[A-Z]?)$/);
        const endpoint = exact
          ? `/Courses/${encodeURIComponent(term.code)}/${encodeURIComponent(exact[1])}/${encodeURIComponent(exact[2])}`
          : `/Courses/${encodeURIComponent(term.code)}`;
        const records = await this.request<WaterlooCourse[]>(endpoint);
        const subjectOnly = /^[A-Z]{2,5}$/.test(normalized);
        const filtered = exact ? records : records.filter((record) => {
          const code = `${record.subjectCode ?? ""} ${record.catalogNumber ?? ""}`.toUpperCase();
          if (subjectOnly) return record.subjectCode?.toUpperCase() === normalized;
          return code.includes(normalized) || (record.title ?? "").toUpperCase().includes(normalized);
        });
        return filtered.slice(0, 20).map((record) => this.toCourse(record, term));
      } catch (error) {
        this.liveApiHealthy = false;
        console.warn("Waterloo course lookup failed; demo fixtures will be used.", error instanceof Error ? error.message : error);
      }
    }

    const demo = getDemoCourses(term.code, term.name);
    if (/^[A-Z]{2,5}$/.test(normalized)) {
      return demo.filter((course) => course.code.split(" ")[0] === normalized).slice(0, 20);
    }
    return demo.filter((course) => course.code === normalized || course.title.toUpperCase().includes(normalized)).slice(0, 20);
  }

  async getCourse(code: string, termCode?: string): Promise<Course | null> {
    const results = await this.searchCourses(code, termCode);
    return results.find((course) => course.code === normalizeCourseCode(code)) ?? results[0] ?? null;
  }

  private toCourse(record: WaterlooCourse, term: { code: string; name: string }): Course {
    const subject = (record.subjectCode ?? "").toUpperCase();
    const number = (record.catalogNumber ?? "").toUpperCase();
    const code = `${subject} ${number}`.trim();
    const sourceUrl = `${API_ROOT}/Courses/${encodeURIComponent(record.termCode ?? term.code)}/${encodeURIComponent(subject)}/${encodeURIComponent(number)}`;
    return {
      code,
      title: record.title?.trim() || "Course title not supplied",
      description: record.description?.trim() || record.descriptionAbbreviated?.trim() || "No course description supplied by the API.",
      requirementsDescription: record.requirementsDescription?.trim() ?? "",
      termCode: record.termCode ?? term.code,
      termName: record.termName ?? term.name,
      prerequisiteGroups: parsePrerequisiteGroups(record.requirementsDescription ?? ""),
      offeringStatus: "unknown",
      sourceUrl,
      sourceLabel: "University of Waterloo Open Data API v3 — official course record",
      dataMode: "live",
    };
  }
}

export const courseService = new CourseService();
