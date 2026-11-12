import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getJobRecommendations } from "../../services/authService";
import "../../styles/Jobs.css";

function JobRecommendations() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRecommendations = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getJobRecommendations());
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load recommendations right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    getJobRecommendations()
      .then((response) => { if (active) setData(response); })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || "Unable to load recommendations right now.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <main className="jobs-page">
      <section className="jobs-hero">
        <p className="eyebrow">Personalized for you</p>
        <h1>Recommended jobs</h1>
        <p>Matches are calculated from your saved skills and the job title, requirements, and description.</p>
      </section>
      {loading && <p className="jobs-message">Finding relevant opportunities...</p>}
      {error && <div className="jobs-message error-message" role="alert"><p>{error}</p><button className="recommendation-retry" type="button" onClick={loadRecommendations}>Try again</button></div>}
      {!loading && !error && data?.needsSkills && <div className="jobs-empty"><h2>Add your skills to get recommendations</h2><p>Update your candidate profile with skills such as React, Node.js, or Python, or analyze your saved resume.</p><Link className="recommendation-link" to="/profile">Update profile skills</Link></div>}
      {!loading && !error && !data?.needsSkills && data?.recommendations?.length === 0 && <div className="jobs-empty"><h2>No recommendations yet</h2><p>{data?.message || "New matching opportunities will appear here when they are posted."}</p><Link className="recommendation-link" to="/jobs">Browse all jobs</Link></div>}
      {!loading && !error && data?.recommendations?.length > 0 && <section className="jobs-results"><p className="recommendation-note">{data.message}</p><div className="job-card-grid">{data.recommendations.filter(({ job }) => job?._id).map(({ job, score, reasons }) => <article className="job-card recommendation-card" key={job._id}><div className="job-card-top"><div><p className="company-name">{job.company?.name || "Company"}</p><h2>{job.title}</h2></div><strong className="match-score" aria-label={`${score} percent match`}>{score}% match</strong></div><div className="job-meta"><span>{job.location}</span><span>{job.jobType}</span><span>{job.experienceLevel}</span></div><h3>Why it matches</h3>{Array.isArray(reasons) && reasons.length > 0 ? <ul className="match-reasons">{reasons.map((reason, index) => <li key={`${reason}-${index}`}>{reason}</li>)}</ul> : <p className="recommendation-note">This role aligns with your saved profile.</p>}<Link className="recommendation-link" to={`/jobs/${job._id}`}>View job details</Link></article>)}</div></section>}
    </main>
  );
}

export default JobRecommendations;
