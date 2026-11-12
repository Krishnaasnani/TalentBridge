import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { analyzeResume, getProfile } from "../../services/authService";
import "../../styles/ResumeAnalyzer.css";
import "../../styles/ResumeAnalyzerScore.css";

const categories = [["formatting", "Formatting", "▤"], ["contactInformation", "Contact Information", "✉"], ["professionalSummary", "Professional Summary", "◎"], ["skills", "Skills", "◆"], ["experience", "Experience", "▣"], ["projects", "Projects", "◈"], ["education", "Education", "▰"], ["linksAndKeywords", "Links & Keywords", "⌁"]];
const scoreStatus = (score) => score >= 90 ? ["excellent", "Excellent ATS compatibility"] : score >= 75 ? ["good", "Good ATS compatibility"] : score >= 60 ? ["needs-improvement", "Needs improvement"] : ["improvement-needed", "Major improvements recommended"];
const description = (score) => score >= 90 ? "A strong, ATS-friendly section." : score >= 75 ? "Clear overall, with room to refine." : score >= 60 ? "Present, but could be more complete." : "Needs focused attention in this resume.";

function ResumeAnalyzer() {
  const [hasResume, setHasResume] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { const loadProfile = async () => { try { const data = await getProfile(); setHasResume(Boolean(data.user?.resume)); } catch (requestError) { setError(requestError.response?.data?.message || "Unable to load your profile."); } finally { setLoading(false); } }; loadProfile(); }, []);
  const handleAnalyze = async () => { setAnalyzing(true); setError(""); try { const data = await analyzeResume(); setAnalysis(data.analysis); } catch (requestError) { setError(requestError.response?.data?.message || "Unable to analyze your resume right now."); } finally { setAnalyzing(false); } };
  if (loading) return <main className="resume-analyzer-page"><section className="analyzer-loading"><span className="loader" />Loading Resume Analyzer...</section></main>;
  const [scoreClass, scoreLabel] = scoreStatus(analysis?.overallScore ?? 0);

  return <main className="resume-analyzer-page">
    <header className="analyzer-hero"><div><p className="eyebrow">Candidate tools</p><h1>Resume ATS Analysis</h1><p>Understand how clearly your resume communicates with applicant tracking systems and recruiters.</p></div>{hasResume && <button type="button" className="resume-analyzer-button" onClick={handleAnalyze} disabled={analyzing}>{analyzing ? "Analyzing your resume..." : "Analyze My Resume"}</button>}</header>
    {error && <section className="analyzer-error" role="alert"><strong>We couldn’t complete your analysis.</strong><span>{error}</span></section>}
    {!hasResume ? <section className="resume-analyzer-empty"><div className="empty-icon">↑</div><h2>Upload your resume to unlock AI analysis.</h2><p>Save a PDF, DOC, or DOCX resume from your profile to receive ATS-focused feedback.</p><Link to="/profile">Go to Profile</Link></section> : analyzing ? <section className="analysis-progress" aria-live="polite"><span className="loader" /><div><h2>Analyzing your resume...</h2><p>✓ Resume uploaded</p><p>✓ Resume text extracted</p><p className="in-progress">→ AI analysis in progress</p></div></section> : analysis && <section className="resume-results" aria-live="polite">
      <section className={`score-hero ${scoreClass}`}><div><p className="eyebrow">ATS Compatibility Score</p><h2>{scoreLabel}</h2><p>AI-generated estimate based on resume structure, content completeness, readability, and ATS-friendly formatting.</p></div><div className="score-ring" style={{ "--score": `${analysis.overallScore}%` }} role="img" aria-label={`ATS compatibility score: ${analysis.overallScore} out of 100`}><div><strong>{analysis.overallScore}</strong><span>/ 100</span></div></div></section>
      {analysis.atsBreakdown && <section className="dashboard-section"><div className="section-heading"><p className="eyebrow">Detailed review</p><h2>ATS Compatibility Breakdown</h2></div><div className="breakdown-grid">{categories.map(([key, label, icon]) => { const score = analysis.atsBreakdown[key]; const [state] = scoreStatus(score); return <article className={`breakdown-card ${state}`} key={key}><span className="breakdown-icon">{icon}</span><div className="breakdown-title"><h3>{label}</h3><strong>{score}<small>/100</small></strong></div><div className="score-bar"><span style={{ width: `${score}%` }} /></div><p>{description(score)}</p></article>; })}</div></section>}
      {analysis.atsHighlights?.length > 0 && <section className="dashboard-section"><div className="section-heading"><p className="eyebrow">What is working</p><h2>ATS Highlights</h2></div><div className="highlight-grid">{analysis.atsHighlights.map((item) => <article key={item}>✓ <span>{item}</span></article>)}</div></section>}
      <section className="dashboard-section"><div className="section-heading"><p className="eyebrow">Detected from your resume</p><h2>Extracted Skills</h2></div>{analysis.extractedSkills?.length ? <div className="skill-pills">{analysis.extractedSkills.map((skill) => <span key={skill}>{skill}</span>)}</div> : <p className="muted">No skills were identified.</p>}</section>
      <div className="feedback-grid"><Feedback title="Strengths" eyebrow="Strong signals" items={analysis.strengths} type="strengths" marker="✓" /><Feedback title="Areas to Improve" eyebrow="Focus next" items={analysis.weaknesses} type="improvements" marker="!" /></div>
      <section className="dashboard-section suggestions"><div className="section-heading"><p className="eyebrow">Your next steps</p><h2>Actionable Suggestions</h2></div>{analysis.suggestions?.length ? <ol>{analysis.suggestions.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></li>)}</ol> : <p className="muted">No suggestions available.</p>}</section>
    </section>}
  </main>;
}

function Feedback({ title, eyebrow, items, type, marker }) { return <section className={`dashboard-section feedback-section ${type}`}><div className="section-heading"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{items?.length ? <ul>{items.map((item) => <li key={item}><b>{marker}</b>{item}</li>)}</ul> : <p className="muted">No feedback available.</p>}</section>; }
export default ResumeAnalyzer;
