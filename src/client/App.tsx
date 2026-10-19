import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Check, CheckCircle2,
  ChevronDown, CircleHelp, Clock3, ExternalLink, FileText, GraduationCap,
  LayoutDashboard, LoaderCircle, MessageCircle, MoreHorizontal, Plus, Search,
  Send, Sparkles, SquarePen, Target,
} from "lucide-react";
import type { AppStatus, Course } from "../shared/types.js";
import {
  answerStaticQuestion,
  searchStaticCourses,
  STATIC_DEMO_ENABLED,
  staticDemoStatus,
} from "./static-demo.js";

type View = "Dashboard" | "Semester Planner" | "Course Search" | "Degree Progress";
type Source = { label: string; url: string; courseCode?: string };
type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  checks?: Array<{ courseCode: string; status: string; explanation: string }>;
  toolCalls?: string[];
  latencyMs?: number;
  mode?: "langchain-agent" | "rules-demo";
};

const navItems: Array<{ label: View; icon: typeof LayoutDashboard }> = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Semester Planner", icon: CalendarDays },
  { label: "Course Search", icon: Search },
  { label: "Degree Progress", icon: Target },
];

const starterPrompt = "I want to take CS 341 next term. What prerequisites am I missing?";
const initialMessage: Message = {
  role: "assistant",
  content: "Hi Emily! I can help you make sense of your next term. Ask me about a course, prerequisites, or how to build a balanced plan. I’ll show the course source alongside every catalog-based answer.",
};

async function graphQL<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  if (STATIC_DEMO_ENABLED && query.includes("SearchCourses")) {
    return { courses: searchStaticCourses(String(variables.search ?? "")) } as T;
  }
  const response = await fetch("/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json() as { data?: T; errors?: Array<{ message: string }> };
  if (!response.ok || payload.errors?.length) throw new Error(payload.errors?.[0]?.message ?? "Could not reach the course API.");
  if (!payload.data) throw new Error("The course API returned an empty response.");
  return payload.data;
}

function Sidebar({ active, onChange, onNewChat }: { active: View; onChange: (view: View) => void; onNewChat: () => void }) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); onChange("Dashboard"); }}>
        <span className="brand-mark"><Sparkles size={24} strokeWidth={2.4} /></span>
        <span><strong>Campus AI</strong><small>Academic planning</small></span>
      </a>
      <button className="new-chat" onClick={onNewChat}><SquarePen size={17} /> <span>New conversation</span><kbd>⌘ K</kbd></button>
      <div className="side-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        {navItems.map(({ label, icon: Icon }) => (
          <button key={label} className={`nav-item ${active === label ? "active" : ""}`} onClick={() => onChange(label)}>
            <Icon size={19} strokeWidth={1.9} /><span>{label}</span>
            {label === "Semester Planner" && <span className="nav-badge">4</span>}
          </button>
        ))}
      </nav>
      <div className="side-label recent-label">RECENT</div>
      <button className="recent-chat" onClick={() => onChange("Dashboard")}><MessageCircle size={16} /><span>Planning CS 341</span></button>
      <button className="recent-chat muted" onClick={() => onChange("Course Search")}><MessageCircle size={16} /><span>Fall term course ideas</span></button>
      <div className="sidebar-spacer" />
      <div className="advisor-card">
        <div className="advisor-icon"><CircleHelp size={17} /></div>
        <div><b>Need a human?</b><span>Connect with an advisor</span></div>
        <ArrowUpRight size={15} />
      </div>
      <button className="profile-row"><span className="avatar">E</span><span className="profile-copy"><b>Emily Chen</b><small>Computer Science · Year 2</small></span><MoreHorizontal size={19} /></button>
    </aside>
  );
}

function StatusPill({ status }: { status?: AppStatus }) {
  if (!status) return <span className="status-pill"><span className="status-dot amber" /> Connecting to catalog</span>;
  return status.dataMode === "live"
    ? <span className="status-pill"><span className="status-dot green" /> Waterloo catalog connected</span>
    : <span className="status-pill demo-pill"><span className="status-dot amber" /> Demo data</span>;
}

function ChatPanel({
  status, completedCourses, onUsePrompt, draftPrompt, clearDraft,
}: { status?: AppStatus; completedCourses: string[]; onUsePrompt: (prompt: string) => void; draftPrompt: string; clearDraft: () => void }) {
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [question, setQuestion] = useState("");
  const [courseInput, setCourseInput] = useState(completedCourses.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, busy]);
  useEffect(() => { setCourseInput(completedCourses.join(", ")); }, [completedCourses]);
  useEffect(() => {
    if (draftPrompt) {
      setQuestion(draftPrompt);
      clearDraft();
    }
  }, [draftPrompt, clearDraft]);

  const sendQuestion = async (rawQuestion: string) => {
    const prompt = rawQuestion.trim();
    if (!prompt || busy) return;
    setMessages((current) => [...current, { role: "user", content: prompt }]);
    setQuestion("");
    setError("");
    setBusy(true);
    try {
      const completed = courseInput.split(/[\n,;]+/).map((code) => code.trim()).filter(Boolean);
      let result: Omit<Message, "role" | "content"> & { answer?: string; content?: string; error?: string };
      if (STATIC_DEMO_ENABLED) {
        result = await answerStaticQuestion(prompt, completed);
      } else {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question: prompt,
            completedCourses: completed,
            messages: messages.filter((_, index) => index > 0).slice(-10).map(({ role, content }) => ({ role, content })),
          }),
        });
        result = await response.json() as Message & { answer?: string; error?: string };
        if (!response.ok) throw new Error(result.error ?? "The assistant couldn't answer just now.");
      }
      setMessages((current) => [...current, { ...result, role: "assistant", content: result.answer ?? result.content ?? "I couldn't produce an answer." }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect to Campus AI.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setMessages([initialMessage]); setError(""); setQuestion(""); };
  const quickPrompts = [
    { icon: Search, label: "Check a prerequisite", prompt: starterPrompt },
    { icon: CalendarDays, label: "Build a balanced term", prompt: "Help me build a balanced next-term plan with 4 courses. I have completed CS 136, MATH 135, and CS 240." },
    { icon: BookOpen, label: "Explore CS electives", prompt: "Suggest a few Computer Science courses related to AI, and show the official course sources." },
  ];

  return (
    <section className="assistant-card" aria-label="Course planning assistant">
      <div className="assistant-heading">
        <div className="assistant-title-wrap">
          <div className="assistant-avatar"><Sparkles size={19} fill="currentColor" /></div>
          <div><div className="assistant-title">Your planning assistant <span className="online-dot" /></div><div className="assistant-caption">{status?.dataMode === "live" ? "Grounded in Waterloo Open Data" : "Demo records are not live-verified"}</div></div>
        </div>
        <div className="assistant-actions"><StatusPill status={status} /><button className="icon-button" title="New conversation" onClick={reset}><SquarePen size={17} /></button></div>
      </div>
      <div className="chat-scroll" aria-live="polite">
        {messages.map((message, index) => (
          <div key={`${index}-${message.role}`} className={`message-row ${message.role}`}>
            {message.role === "assistant" && <div className="message-avatar"><Sparkles size={14} /></div>}
            <div className="message-body">
              <div className={`message-bubble ${message.role}`}>
                {message.role === "assistant"
                  ? <ReactMarkdown components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>{message.content}</ReactMarkdown>
                  : message.content}
              </div>
              {message.sources && message.sources.length > 0 && (
                <div className="sources-block">
                  <div className="sources-title"><FileText size={13} /> SOURCES <span>{message.sources.length}</span></div>
                  {message.sources.map((source, sourceIndex) => (
                    <a key={`${source.url}-${sourceIndex}`} className="source-link" href={source.url} target="_blank" rel="noreferrer">
                      <span className="source-index">{sourceIndex + 1}</span><span className="source-text"><b>{source.courseCode || source.label}</b><small>{source.label}</small></span><ExternalLink size={14} />
                    </a>
                  ))}
                </div>
              )}
              {message.toolCalls && message.toolCalls.length > 0 && <div className="tool-note"><CheckCircle2 size={13} /> {message.toolCalls.some((name) => name.startsWith("static_demo_")) ? "Browser demo tool" : "MCP tool call"} · {message.latencyMs} ms{message.mode === "langchain-agent" ? " · LangChain agent" : " · deterministic demo"}</div>}
            </div>
          </div>
        ))}
        {busy && <div className="message-row assistant"><div className="message-avatar"><Sparkles size={14} /></div><div className="message-bubble assistant thinking"><LoaderCircle size={15} className="spinner" /> Looking up course information…</div></div>}
        {error && <div className="chat-error"><CircleHelp size={15} /> {error}</div>}
        <div ref={bottomRef} />
      </div>
      {messages.length === 1 && (
        <div className="quick-prompts">
          {quickPrompts.map(({ icon: Icon, label, prompt }) => (
            <button key={label} className="quick-prompt" onClick={() => { onUsePrompt(prompt); setQuestion(prompt); }}><Icon size={15} /><span>{label}</span><ArrowUpRight size={13} /></button>
          ))}
        </div>
      )}
      <form className="composer" onSubmit={(event) => { event.preventDefault(); void sendQuestion(question); }}>
        <div className="composer-context"><span className="context-label">Completed courses</span><input aria-label="Completed courses" value={courseInput} onChange={(event) => setCourseInput(event.target.value)} placeholder="e.g. CS 136, MATH 135" /></div>
        <div className="composer-input-row"><textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendQuestion(question); } }} placeholder="Ask about a course or plan your next term…" rows={2} maxLength={2000} /><button className="send-button" type="submit" aria-label="Send message" disabled={!question.trim() || busy}>{busy ? <LoaderCircle className="spinner" size={17} /> : <Send size={17} />}</button></div>
        <div className="composer-foot"><span><span className="keyboard-key">↵</span> to send <span className="keyboard-key">⇧ ↵</span> for a new line</span><span>AI can make mistakes. Always verify before enrolling.</span></div>
      </form>
    </section>
  );
}

function CourseSearchView({ termCode }: { termCode?: string }) {
  const [query, setQuery] = useState("CS 341");
  const [results, setResults] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const lookup = async (search: string) => {
    if (!search.trim()) return;
    setLoading(true); setError("");
    try {
      const data = await graphQL<{ courses: Course[] }>("query SearchCourses($search: String!, $termCode: String) { courses(search: $search, termCode: $termCode) { code title description requirementsDescription termName sourceUrl sourceLabel dataMode } }", { search, termCode });
      setResults(data.courses);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Search failed."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void lookup("CS 341"); }, [termCode]);
  return (
    <div className="page-section">
      <div className="page-heading"><div><div className="eyebrow">EXPLORE THE CATALOG</div><h2>Find your next course</h2><p>Search official Waterloo course records and review prerequisite notes.</p></div><span className="term-chip"><CalendarDays size={15} /> {termCode ?? "Selected term"}</span></div>
      <form className="course-search" onSubmit={(event) => { event.preventDefault(); void lookup(query); }}><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Course code or title, e.g. CS 341" /><button className="primary-button" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spinner" size={16} /> : "Search courses"}</button></form>
      {error && <p className="inline-error">{error}</p>}
      <div className="course-results">{results.map((course) => <article className="course-result" key={`${course.termCode}-${course.code}`}><div className="course-result-top"><span className="course-code">{course.code}</span><span className={`data-tag ${course.dataMode}`}>{course.dataMode === "live" ? "Live catalog" : "Demo fixture"}</span></div><h3>{course.title}</h3><p>{course.description}</p>{course.requirementsDescription && <div className="requirement-box"><b>Requirements</b><span>{course.requirementsDescription}</span></div>}<a className="course-source" href={course.sourceUrl} target="_blank" rel="noreferrer"><FileText size={14} /> {course.sourceLabel} <ExternalLink size={13} /></a></article>)}</div>
      {!loading && !results.length && !error && <div className="empty-state"><Search size={26} /><b>No courses found</b><span>Try a subject code or a title keyword.</span></div>}
    </div>
  );
}

function PlannerView({ onAsk }: { onAsk: (prompt: string) => void }) {
  const courses = [
    { code: "CS 341", name: "Algorithms", units: "0.50 unit", color: "violet" },
    { code: "CS 350", name: "Operating Systems", units: "0.50 unit", color: "blue" },
    { code: "MATH 239", name: "Introduction to Combinatorics", units: "0.50 unit", color: "mint" },
    { code: "STAT 230", name: "Probability", units: "0.50 unit", color: "peach" },
  ];
  return <div className="page-section"><div className="page-heading"><div><div className="eyebrow">MAKE IT A GOOD TERM</div><h2>Semester planner</h2><p>A simple starting point. Check every requirement before you finalize your enrollment.</p></div><span className="term-chip"><CalendarDays size={15} /> Fall 2026</span></div><div className="planner-summary"><div><span>PLANNED LOAD</span><b>4 courses <i>·</i> 2.0 units</b></div><div><span>PLAN STATUS</span><b className="summary-warning"><span className="status-dot amber" /> Needs prerequisite review</b></div></div><div className="planner-list">{courses.map((course, index) => <div className="planner-course" key={course.code}><span className={`course-index ${course.color}`}>0{index + 1}</span><div className="planner-course-copy"><b>{course.code} <span>{course.name}</span></b><small>{course.units} <span>·</span> Fall term</small></div><button className="review-button" onClick={() => onAsk(`Check if I can take ${course.code}. I have completed CS 136 and MATH 135.`)}>Check prerequisites <ArrowRight size={14} /></button></div>)}</div><button className="add-course" onClick={() => onAsk("Help me build a balanced 4-course term. I have completed CS 136, MATH 135, and CS 240.")}><Plus size={16} /> Ask AI to review this plan</button><p className="disclaimer-line"><CircleHelp size={14} /> This is a planning aid, not an official enrollment decision.</p></div>;
}

function DegreeView() {
  const categories = [{ name: "Core CS courses", done: 12, total: 18, color: "violet" }, { name: "Mathematics", done: 6, total: 9, color: "blue" }, { name: "Communication & electives", done: 10, total: 12, color: "mint" }];
  return <div className="page-section"><div className="page-heading"><div><div className="eyebrow">YOUR BIGGER PICTURE</div><h2>Degree progress</h2><p>A sample progress view to help think about your path. Connect your academic record to personalize it.</p></div><span className="term-chip"><GraduationCap size={15} /> Computer Science</span></div><div className="degree-overview"><div className="progress-ring"><div><b>72%</b><span>estimated</span></div></div><div><div className="eyebrow">BACHELOR OF COMPUTER SCIENCE</div><h3>You're building momentum.</h3><p>28 of 39 sample requirements completed</p><span className="demo-footnote"><span className="status-dot amber" /> Sample progress · not connected to Quest</span></div></div><div className="requirement-list">{categories.map((item) => <div className="requirement-row" key={item.name}><div className={`requirement-icon ${item.color}`}><Check size={15} /></div><div className="requirement-content"><b>{item.name}</b><small>{item.done} of {item.total} requirements</small><div className="progress-track"><span className={item.color} style={{ width: `${(item.done / item.total) * 100}%` }} /></div></div><span className="requirement-percent">{Math.round((item.done / item.total) * 100)}%</span></div>)}</div><div className="advisor-note"><CircleHelp size={19} /><div><b>Use this as a conversation starter</b><p>Degree requirements change. Confirm your progress with the official Waterloo academic calendar or an academic advisor.</p></div></div></div>;
}

export default function App() {
  const [activeView, setActiveView] = useState<View>("Dashboard");
  const [status, setStatus] = useState<AppStatus>();
  const [statusError, setStatusError] = useState("");
  const [promptDraft, setPromptDraft] = useState("");
  const [clock, setClock] = useState(new Date());
  const completedCourses = useMemo(() => ["CS 136", "MATH 135"], []);

  useEffect(() => {
    let alive = true;
    if (STATIC_DEMO_ENABLED) setStatus(staticDemoStatus);
    else void fetch("/api/status").then(async (response) => {
      if (!response.ok) throw new Error("API offline");
      return await response.json() as AppStatus;
    }).then((value) => { if (alive) setStatus(value); }).catch(() => { if (alive) setStatusError("Start the development server to connect the course API."); });
    const interval = window.setInterval(() => setClock(new Date()), 60_000);
    return () => { alive = false; window.clearInterval(interval); };
  }, []);

  const openAssistant = (prompt = "") => {
    setActiveView("Dashboard");
    setPromptDraft(prompt);
    window.setTimeout(() => document.querySelector(".composer textarea")?.scrollIntoView({ behavior: "smooth", block: "center" }), 40);
  };

  const dateLabel = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric" }).format(clock);
  const firstName = (import.meta.env.VITE_STUDENT_NAME || "Emily").trim();

  return (
    <div className="app-shell">
      <Sidebar active={activeView} onChange={setActiveView} onNewChat={() => openAssistant()} />
      <main className="main-shell">
        <header className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><b>{activeView}</b></div><div className="topbar-right"><span className="date-label"><Clock3 size={15} /> {dateLabel}</span><button className="help-button"><CircleHelp size={16} /><span>Help</span></button><span className="top-avatar">{firstName[0]?.toUpperCase() ?? "E"}</span></div></header>
        <div className="main-content">
          {STATIC_DEMO_ENABLED && <div className="connection-banner"><CircleHelp size={15} /> Interactive GitHub Pages demo: answers use labeled fixtures and deterministic browser-side checks, not live enrollment data.</div>}
          {statusError && <div className="connection-banner"><CircleHelp size={15} /> {statusError} Check that the API is running on port 4000.</div>}
          {activeView === "Dashboard" && <>
            <section className="welcome-row"><div><div className="eyebrow">{dateLabel.toUpperCase()} <span className="eyebrow-dot">✦</span> YOUR ACADEMIC SNAPSHOT</div><h1>Good afternoon, {firstName}<span className="heading-period">.</span></h1><p>Make your next academic decision with a little more clarity.</p></div><button className="term-selector" onClick={() => setActiveView("Semester Planner")}><span className="term-icon"><CalendarDays size={16} /></span><span><small>PLANNING FOR</small><b>{status?.activeTerm.name ?? "Fall 2026"}</b></span><ChevronDown size={15} /></button></section>
            <section className="hero-banner"><div className="hero-orb orb-one" /><div className="hero-orb orb-two" /><div className="hero-content"><div className="hero-sparkle"><Sparkles size={18} /></div><div className="hero-copy"><span className="hero-kicker">A clearer path starts here</span><h2>Plan your next term<br /><span>with confidence.</span></h2><p>Course details, prerequisites, and source links — in one thoughtful place.</p><div className="hero-buttons"><button className="hero-button light" onClick={() => setActiveView("Semester Planner")}><CalendarDays size={17} /> Open semester planner <ArrowRight size={15} /></button><button className="hero-button translucent" onClick={() => setActiveView("Course Search")}><Search size={17} /> Explore courses</button></div></div></div><div className="hero-decoration"><div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="orbit-core"><GraduationCap size={32} /></div><span className="orbit-star star-a">✦</span><span className="orbit-star star-b">✧</span></div><div className="hero-foot"><span><span className="hero-live-dot" /> WATERLOO OPEN DATA INTEGRATION</span><span>Less guessing. More grounded decisions.</span></div></section>
            <section className="stats-grid"><article className="stat-card"><div className="stat-top"><span className="stat-icon purple"><Target size={17} /></span><span className="stat-muted">SAMPLE PROFILE</span></div><div className="stat-value">72<span>%</span></div><b>Degree progress</b><small>28 of 39 sample requirements</small><div className="mini-progress"><span /></div></article><article className="stat-card"><div className="stat-top"><span className="stat-icon blue"><CalendarDays size={17} /></span><span className="stat-muted">IN YOUR PLAN</span></div><div className="stat-value">4</div><b>Courses planned</b><small>Looking ahead to Fall 2026</small><div className="stat-course-dots"><span /><span /><span /><span /></div></article><article className="stat-card stat-highlight"><div className="stat-top"><span className="stat-icon peach"><BookOpen size={17} /></span><span className="stat-muted">ONE TO REVIEW</span></div><div className="stat-value compact">CS 341</div><b>Prerequisite check</b><small>Double-check before you enroll</small><button className="text-action" onClick={() => openAssistant(starterPrompt)}>Ask Campus AI <ArrowRight size={14} /></button></article></section>
            <section className="dashboard-lower"><div className="plan-card"><div className="card-heading"><div><div className="eyebrow">A FIRST DRAFT</div><h3>Current academic plan</h3><p>4 courses <span>·</span> 2.0 units <span>·</span> Fall 2026</p></div><button className="subtle-button" onClick={() => setActiveView("Semester Planner")}>View planner <ArrowRight size={14} /></button></div><div className="plan-course-list">{[{ code: "CS 341", name: "Algorithms", color: "violet" }, { code: "CS 350", name: "Operating Systems", color: "blue" }, { code: "MATH 239", name: "Introduction to Combinatorics", color: "mint" }, { code: "STAT 230", name: "Probability", color: "peach" }].map((course) => <button className="plan-course" key={course.code} onClick={() => openAssistant(`Check the official prerequisites for ${course.code}. I have completed CS 136 and MATH 135.`)}><span className={`course-swatch ${course.color}`} /><span className="plan-course-main"><b>{course.code}</b><small>{course.name}</small></span><span className="course-units">0.50 unit</span><ArrowUpRight size={15} className="course-arrow" /></button>)}</div><button className="add-course-link" onClick={() => setActiveView("Course Search")}><Plus size={15} /> Add a course</button></div><div className="insight-column"><div className="insight-card"><div className="insight-icon"><Sparkles size={18} /></div><div className="eyebrow">A GENTLE NUDGE</div><h3>Check the prerequisites,<br />not just the course title.</h3><p>We’ll show the catalog text and where it came from, so you can decide with context.</p><button className="insight-link" onClick={() => openAssistant(starterPrompt)}>Check CS 341 <ArrowRight size={14} /></button><div className="insight-decoration">✳</div></div><div className="source-note"><span className="source-note-icon"><FileText size={15} /></span><span><b>Sources matter.</b><small>Every catalog answer comes with a link you can verify.</small></span></div></div></section>
            <section className="assistant-section"><div className="section-title-row"><div><div className="eyebrow">ASK, CHECK, PLAN</div><h2>Let's figure it out together.</h2></div><span className="ai-badge"><span /> AI + official course sources</span></div><ChatPanel key="dashboard-chat" status={status} completedCourses={completedCourses} onUsePrompt={setPromptDraft} draftPrompt={promptDraft} clearDraft={() => setPromptDraft("")} /></section>
            <footer className="page-footer"><span>Campus AI <span>·</span> Academic planning, made more transparent.</span><button onClick={() => openAssistant("Where does your Waterloo course information come from?")}>About our sources <ArrowRight size={13} /></button></footer>
          </>}
          {activeView === "Course Search" && <CourseSearchView termCode={status?.activeTerm.code} />}
          {activeView === "Semester Planner" && <PlannerView onAsk={openAssistant} />}
          {activeView === "Degree Progress" && <DegreeView />}
        </div>
      </main>
      <button className="floating-assistant" onClick={() => openAssistant(starterPrompt)} aria-label="Ask Campus AI"><Sparkles size={19} /><span>Ask Campus AI</span></button>
    </div>
  );
}
