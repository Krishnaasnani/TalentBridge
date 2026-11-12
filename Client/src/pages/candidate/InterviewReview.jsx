import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getInterviewById } from "../../services/authService";
import "../../styles/InterviewReview.css";

const formatDate = (value) => {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
};

const isScore = (value) => Number.isFinite(Number(value));

const getScoreLabel = (score) => {
  if (!isScore(score)) return "";
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Strong";
  if (score >= 70) return "Good";
  if (score >= 60) return "Fair";
  return "Needs Improvement";
};

const uniqueSavedItems = (items) => [...new Set(items.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))];

function InterviewReview() {
  const { id } = useParams();
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchInterview = useCallback(async () => {
    const data = await getInterviewById(id);
    return data?.interview || null;
  }, [id]);

  useEffect(() => {
    let active = true;
    const loadReview = async () => {
      try {
        const savedInterview = await fetchInterview();
        if (active) setInterview(savedInterview);
      } catch (requestError) {
        if (!active) return;
        const status = requestError.response?.status;
        setError(status === 404 ? "not-found" : status === 401 || status === 403 ? "access" : "load");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadReview();
    return () => { active = false; };
  }, [fetchInterview]);

  const retry = async () => {
    setLoading(true);
    setError("");
    try {
      setInterview(await fetchInterview());
    } catch (requestError) {
      const status = requestError.response?.status;
      setError(status === 404 ? "not-found" : status === 401 || status === 403 ? "access" : "load");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <main className="interview-review-page"><section className="review-state" aria-live="polite"><span className="review-spinner" aria-hidden="true" /><h1>Loading interview result</h1><p>Retrieving your saved interview review.</p></section></main>;
  if (error || !interview) {
    const message = error === "not-found" ? "Interview not found" : error === "access" ? "You do not have access to this interview." : "Unable to load interview result.";
    return <main className="interview-review-page"><section className={`review-state ${error === "load" ? "review-error" : ""}`} role="alert"><h1>{message}</h1><p>{error === "load" ? "Please check your connection and try again." : "Return to your interview history to continue."}</p>{error === "load" && <button type="button" onClick={retry}>Retry</button>}<Link className="review-primary-link" to="/interview/history">Back to Interview History</Link></section></main>;
  }

  if (interview.status !== "completed") return <main className="interview-review-page"><section className="review-state"><p className="review-eyebrow">AI Interview</p><h1>Interview In Progress</h1><p>This interview has not been completed yet.</p><Link className="review-primary-link" to={`/interview/${id}`}>Continue Interview</Link><Link className="review-secondary-link" to="/interview/history">Back to Interview History</Link></section></main>;

  const feedback = interview.feedback && typeof interview.feedback === "object" ? interview.feedback : null;
  const scoreAvailable = isScore(interview.score);
  const context = interview.contextType === "job_description" ? "Job-Specific" : "Role-Based";
  const questions = Array.isArray(interview.questions) ? interview.questions : [];
  const keyStrengths = uniqueSavedItems(questions.flatMap((question) => question.evaluation?.strengths || []));
  const areasToImprove = uniqueSavedItems(questions.flatMap((question) => [ ...(question.evaluation?.weaknesses || []), question.evaluation?.improvement ]));

  return <main className="interview-review-page">
    <Link className="review-back-link" to="/interview/history">← Back to Interview History</Link>
    <header className="review-hero"><p className="review-eyebrow">Saved interview review</p><h1>AI Interview Result</h1><p>{interview.interviewType || "AI Interview"}</p>{interview.role && <h2>{interview.role}</h2>}<div className="review-hero-meta"><span>{interview.difficulty || "Difficulty not available"} · {isScore(interview.questionCount) ? `${interview.questionCount} Questions` : "Question count not available"}</span><span>{context} · Completed</span><span>Completed {formatDate(interview.updatedAt || interview.createdAt)}</span></div></header>

    <section className="review-overview">
      <article className="review-score-card"><span>Overall Score</span><strong>{scoreAvailable ? `${Math.round(Number(interview.score))} / 100` : "Not available"}</strong>{scoreAvailable && <><b>{getScoreLabel(Number(interview.score))}</b><div className="review-score-track" aria-label={`Overall score ${Math.round(Number(interview.score))} out of 100`}><span style={{ width: `${Math.max(0, Math.min(100, Number(interview.score)))}%` }} /></div></>}<small>Final score from your saved interview</small></article>
      <article className="review-feedback-card"><h2>Final Feedback</h2>{feedback ? <><p>{isScore(feedback.evaluatedQuestions) ? `${feedback.evaluatedQuestions} of ${feedback.totalQuestions || questions.length} questions evaluated.` : "Saved interview feedback"}</p>{Array.isArray(feedback.recommendations) && feedback.recommendations.length > 0 && <div><h3>Saved recommendations</h3><ul>{feedback.recommendations.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>}</> : <p>No final feedback is available.</p>}</article>
    </section>

    <section className="review-summary-card"><h2>Performance Summary</h2><dl><div><dt>Overall Score</dt><dd>{scoreAvailable ? `${Math.round(Number(interview.score))} / 100` : "Not available"}</dd></div><div><dt>Questions</dt><dd>{isScore(interview.questionCount) ? interview.questionCount : "Not available"}</dd></div><div><dt>Status</dt><dd>Completed</dd></div><div><dt>Completed</dt><dd>{formatDate(interview.updatedAt || interview.createdAt)}</dd></div>{isScore(feedback?.evaluatedQuestions) && <div><dt>Evaluated</dt><dd>{feedback.evaluatedQuestions} Questions</dd></div>}<div><dt>Context</dt><dd>{context}</dd></div></dl></section>

    {(keyStrengths.length > 0 || areasToImprove.length > 0) && <section className="review-insights"><article>{keyStrengths.length > 0 && <><h2>Key Strengths</h2><ul>{keyStrengths.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></>}</article><article>{areasToImprove.length > 0 && <><h2>Areas to Improve</h2><ul>{areasToImprove.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></>}</article></section>}

    <section className="review-questions"><header><p className="review-eyebrow">Detailed review</p><h2>Question-by-Question Review</h2></header>{questions.length > 0 ? questions.map((question, index) => {
      const evaluation = question.evaluation && typeof question.evaluation === "object" ? question.evaluation : null;
      return <article className="review-question-card" key={`${question.question}-${index}`}><div className="review-question-number">Question {index + 1}</div><div className="review-question-topline"><span>{question.category || "Category not available"}</span>{question.difficulty && <span>{question.difficulty}</span>}</div><h3>{question.question || "Question not available"}</h3><section className="review-answer"><h4>Your Answer</h4><p>{question.answer || "Not answered"}</p></section><section className="review-evaluation"><h4>AI Evaluation</h4>{evaluation ? <><div className="review-evaluation-score"><strong>{isScore(evaluation.score) ? `${Math.round(Number(evaluation.score))}/100` : "Score not available"}</strong>{evaluation.rating && <span>{evaluation.rating}</span>}</div>{Array.isArray(evaluation.strengths) && evaluation.strengths.length > 0 && <div><h5>Strengths</h5><ul>{evaluation.strengths.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{item}</li>)}</ul></div>}{Array.isArray(evaluation.weaknesses) && evaluation.weaknesses.length > 0 && <div><h5>Weaknesses</h5><ul>{evaluation.weaknesses.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{item}</li>)}</ul></div>}{evaluation.feedback && <div><h5>Feedback</h5><p>{evaluation.feedback}</p></div>}{evaluation.improvement && <div><h5>Improvement</h5><p>{evaluation.improvement}</p></div>}</> : <p>Not evaluated</p>}</section></article>;
    }) : <section className="review-no-questions">No saved questions are available for this interview.</section>}</section>
    <div className="review-footer"><Link className="review-primary-link" to="/interview/history">Back to Interview History</Link></div>
  </main>;
}

export default InterviewReview;
