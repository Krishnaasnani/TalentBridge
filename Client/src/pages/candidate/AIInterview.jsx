import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createInterview, getProfile } from "../../services/authService";
import "../../styles/AIInterview.css";

const interviewTypes = ["Technical Interview", "Behavioral Interview", "HR Interview"];
const MAX_DESCRIPTION_LENGTH = 10_000;
const MIN_ROLE_LENGTH = 2;
const MAX_ROLE_LENGTH = 120;
const interviewDifficulties = ["Beginner", "Intermediate", "Advanced", "Adaptive"];
const questionCounts = [5, 10, 15, 20];

function AIInterview() {
  const navigate = useNavigate();
  const [contextType, setContextType] = useState("role");
  const [role, setRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [interviewType, setInterviewType] = useState("");
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [questionCount, setQuestionCount] = useState(10);
  const [hasResume, setHasResume] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try { const data = await getProfile(); setHasResume(Boolean(data.user?.resume)); }
      catch (requestError) { setError(requestError.response?.data?.message || "Unable to load your profile."); }
      finally { setProfileLoading(false); }
    };
    loadProfile();
  }, []);

  const trimmedRole = role.trim();
  const trimmedDescription = jobDescription.trim();
  const hasValidContext = contextType === "role"
    ? trimmedRole.length >= MIN_ROLE_LENGTH && trimmedRole.length <= MAX_ROLE_LENGTH
    : trimmedDescription.length >= 1 && trimmedDescription.length <= MAX_DESCRIPTION_LENGTH;
  const canStartInterview = hasResume && hasValidContext && Boolean(interviewType);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!hasResume) return setError("Please upload your resume in Profile before starting an AI interview.");
    if (contextType === "role" && (trimmedRole.length < MIN_ROLE_LENGTH || trimmedRole.length > MAX_ROLE_LENGTH)) return setError("Role must be between 2 and 120 characters.");
    if (contextType === "job_description" && (trimmedDescription.length < 1 || trimmedDescription.length > MAX_DESCRIPTION_LENGTH)) return setError("Job description must be between 1 and 10,000 characters.");
    if (!interviewType) return setError("Please select an interview type.");
    setLoading(true); setError("");
    try {
      const data = await createInterview({ contextType, role: trimmedRole, jobDescription: trimmedDescription, interviewType, difficulty, questionCount });
      navigate(`/interview/${data.interview._id}`);
    } catch (requestError) { setError(requestError.response?.data?.message || "Unable to start an interview. Please try again."); }
    finally { setLoading(false); }
  };

  return <main className="ai-interview-page">
    <header className="ai-interview-hero"><p className="ai-interview-eyebrow">Candidate tools</p><h1>AI Interview</h1><p>Practice with an AI interviewer personalized to your role, resume, and target job.</p></header>
    <form className="ai-interview-setup" onSubmit={handleSubmit} noValidate>
      <section className="ai-interview-card"><h2>Interview context</h2><div className="context-toggle" role="group" aria-label="Interview context"><button type="button" className={contextType === "role" ? "active" : ""} onClick={() => setContextType("role")}>Role-Based</button><button type="button" className={contextType === "job_description" ? "active" : ""} onClick={() => setContextType("job_description")}>Job-Specific</button></div>{contextType === "role" ? <div className="setup-field"><label htmlFor="interview-role">Target role</label><input id="interview-role" value={role} onChange={(event) => setRole(event.target.value)} placeholder="e.g. Full Stack Developer" maxLength="120" disabled={loading} /></div> : <div className="setup-field"><label htmlFor="job-description">Job description</label><textarea id="job-description" value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste the target job description, including key responsibilities and requirements..." maxLength={MAX_DESCRIPTION_LENGTH} disabled={loading} /><span className="character-count">{jobDescription.length.toLocaleString()} / 10,000</span></div>}</section>
      <section className="ai-interview-card"><h2>Interview type</h2><div className="interview-type-options">{interviewTypes.map((type) => <button type="button" key={type} className={interviewType === type ? "active" : ""} onClick={() => setInterviewType(type)} disabled={loading}>{type.replace(" Interview", "")}</button>)}</div></section>
      <section className="ai-interview-card"><h2>Interview difficulty</h2><div className="interview-type-options">{interviewDifficulties.map((level) => <button type="button" key={level} className={difficulty === level ? "active" : ""} onClick={() => setDifficulty(level)} disabled={loading}>{level}</button>)}</div></section>
      <section className="ai-interview-card interview-count-card"><label htmlFor="question-count">Number of questions</label><select id="question-count" value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} disabled={loading}>{questionCounts.map((count) => <option key={count} value={count}>{count} questions</option>)}</select></section>
      <section className={`resume-context ${hasResume ? "available" : "missing"}`}><span aria-hidden="true">{hasResume ? "✓" : "!"}</span><div><h2>Resume</h2>{profileLoading ? <p>Checking your saved resume...</p> : hasResume ? <p>Your saved resume will be used to personalize the interview.</p> : <p>Upload your resume before starting an AI interview. <Link to="/profile">Go to Profile</Link></p>}</div></section>
      <section className="ai-interview-card ai-interview-how"><h2>How the AI interview works</h2><ol><li>AI analyzes your resume and interview context.</li><li>AI asks personalized questions.</li><li>Answer using your voice or text.</li><li>AI evaluates your responses and adapts the interview.</li><li>Receive a detailed performance report.</li></ol></section>
      {error && <p className="ai-interview-error" role="alert">{error}</p>}
      <button className="start-interview-button" type="submit" disabled={loading || profileLoading || !canStartInterview}>{loading ? "Preparing your interview..." : "Start AI Interview"}</button>
    </form>
  </main>;
}
export default AIInterview;
