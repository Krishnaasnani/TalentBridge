import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { analyzeJobMatch, getProfile } from "../../services/authService";
import "../../styles/JobMatch.css";

const MAX_DESCRIPTION_LENGTH = 10_000;

function JobMatch() {
  const navigate = useNavigate();
  const [hasResume, setHasResume] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await getProfile();
        setHasResume(Boolean(data.user?.resume));
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to load your profile.");
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleChange = (event) => {
    const value = event.target.value;
    setJobDescription(value);
    setError(value.length > MAX_DESCRIPTION_LENGTH ? "Job description must be 10,000 characters or fewer." : "");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!jobDescription.trim()) return setError("Please enter a job description.");
    if (jobDescription.length > MAX_DESCRIPTION_LENGTH) return setError("Job description must be 10,000 characters or fewer.");

    setAnalyzing(true);
    setError("");
    try {
      const data = await analyzeJobMatch(jobDescription.trim());
      navigate("/job-match/results", { state: { result: data.analysis, jobDescription: jobDescription.trim() } });
    } catch (requestError) {
      setError(requestError.response?.status === 503
        ? "AI service is temporarily unavailable. Please try again."
        : requestError.response?.data?.message || "Unable to analyze this job match. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) return <main className="job-match-page"><section className="job-match-loading">Loading Job Match...</section></main>;
  return <main className="job-match-page">
    <header className="job-match-hero"><p className="eyebrow">Candidate tools</p><h1>Job Description Match</h1><p>Compare your resume with a job description to understand how closely your skills and experience align with the role.</p></header>
    {error && !hasResume && <section className="job-match-error" role="alert">{error}</section>}
    {!hasResume ? <section className="resume-required-card"><div className="resume-required-icon">↑</div><div><h2>Upload your resume first</h2><p>Please upload your resume in Profile before using Job Match.</p><Link to="/profile">Go to Profile</Link></div></section> : <>
      <section className="job-match-form-card"><div className="job-match-form-heading"><div><h2>Paste Job Description</h2><p>Paste the complete job description, including responsibilities, requirements, skills, and qualifications.</p></div><span className="resume-status">✓ Resume uploaded</span></div><form onSubmit={handleSubmit}><textarea value={jobDescription} onChange={handleChange} maxLength={MAX_DESCRIPTION_LENGTH} placeholder="Paste the job description here..." aria-describedby="character-count" /><div className="form-footer"><div><span id="character-count" className="character-count">{jobDescription.length.toLocaleString()} / 10,000 characters</span>{error && <p className="job-match-field-error" role="alert">{error}</p>}</div><button type="submit" className="job-match-button" disabled={analyzing || !jobDescription.trim() || jobDescription.length > MAX_DESCRIPTION_LENGTH}>{analyzing ? "Analyzing..." : "Analyze Job"}</button></div></form></section>
      <section className="how-it-works"><p className="eyebrow">How it works</p><ol><li><span>01</span><p>Paste the job description</p></li><li><span>02</span><p>TalentBridge compares it with your resume</p></li><li><span>03</span><p>Review matched skills, gaps, and recommendations</p></li></ol></section>
    </>}
  </main>;
}
export default JobMatch;
