import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMyInterviews } from "../../services/authService";
import "../../styles/InterviewHistory.css";

const statusLabels = {
  in_progress: "In Progress",
  completed: "Completed",
};

const formatDate = (value) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
};

function InterviewHistory() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchInterviews = useCallback(async () => {
    const data = await getMyInterviews();
    return Array.isArray(data?.interviews) ? data.interviews : [];
  }, []);

  useEffect(() => {
    let active = true;
    const loadInitialInterviews = async () => {
      try {
        const history = await fetchInterviews();
        if (active) setInterviews(history);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadInitialInterviews();
    return () => { active = false; };
  }, [fetchInterviews]);

  const retry = async () => {
    setLoading(true);
    setError(false);
    try {
      setInterviews(await fetchInterviews());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    const completed = interviews.filter((interview) => interview.status === "completed");
    const scored = completed.filter((interview) => Number.isFinite(Number(interview.score)));
    return {
      total: interviews.length,
      completed: completed.length,
      inProgress: interviews.filter((interview) => interview.status === "in_progress").length,
      average: scored.length ? Math.round(scored.reduce((total, interview) => total + Number(interview.score), 0) / scored.length) : null,
    };
  }, [interviews]);

  return <main className="interview-history-page">
    <header className="interview-history-hero">
      <div><p className="interview-history-eyebrow">Candidate tools</p><h1>Interview History</h1><p>Review your previous AI interview sessions and results.</p></div>
      <Link className="history-start-link" to="/interview">Start AI Interview</Link>
    </header>

    {loading ? <section className="history-state" aria-live="polite"><span className="history-spinner" aria-hidden="true" /><h2>Loading interview history</h2><p>Fetching your interview sessions and results.</p></section> : error ? <section className="history-state history-error" role="alert"><h2>Unable to load interview history.</h2><p>Please check your connection and try again.</p><button type="button" onClick={retry}>Retry</button></section> : interviews.length === 0 ? <section className="history-state"><div className="history-empty-icon" aria-hidden="true">⌁</div><h2>No interviews yet</h2><p>Your AI interview sessions will appear here after you complete or start one.</p><Link className="history-start-link" to="/interview">Start AI Interview</Link></section> : <>
      <section className="history-summary" aria-label="Interview summary">
        <article><span>Total Interviews</span><strong>{summary.total}</strong></article>
        <article><span>Completed</span><strong>{summary.completed}</strong></article>
        <article><span>In Progress</span><strong>{summary.inProgress}</strong></article>
        <article><span>Average Score</span><strong>{summary.average === null ? "—" : `${summary.average}/100`}</strong><small>{summary.average === null ? "No completed scores yet" : "Completed interviews"}</small></article>
      </section>

      <section className="history-list" aria-label="Interview sessions">
        {interviews.map((interview) => {
          const completed = interview.status === "completed";
          const hasScore = completed && Number.isFinite(Number(interview.score));
          const isJobSpecific = interview.contextType === "job_description";
          return <article className="history-interview-card" key={interview._id || `${interview.createdAt}-${interview.interviewType}`}>
            <div className="history-card-main"><div className="history-card-heading"><div><p className="history-card-type">{interview.interviewType || "AI Interview"}</p><p className="history-card-context">{isJobSpecific ? "Job-Specific" : `Role-Based${interview.role ? ` • ${interview.role}` : ""}`}</p></div><span className={`history-status ${completed ? "completed" : "progress"}`}>{statusLabels[interview.status] || "In Progress"}</span></div><div className="history-meta"><span>{interview.difficulty || "Difficulty unavailable"}</span><span>{Number.isFinite(Number(interview.questionCount)) ? `${interview.questionCount} Questions` : "Question count unavailable"}</span><span>{formatDate(completed ? interview.updatedAt || interview.createdAt : interview.createdAt)}</span></div></div>
            <div className="history-card-score"><span>Score</span><strong>{hasScore ? `${Math.round(Number(interview.score))}/100` : "—"}</strong><small>{completed ? (hasScore ? "Final score" : "Score unavailable") : "Not completed"}</small></div>
            <div className="history-card-action">{completed ? <button type="button" onClick={() => navigate(`/interview/${interview._id}/review`)}>View Results</button> : <span>Interview in progress</span>}</div>
          </article>;
        })}
      </section>
    </>}
  </main>;
}

export default InterviewHistory;
