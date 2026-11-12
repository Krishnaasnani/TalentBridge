import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import { getMyApplications } from "../../services/authService";
import "../../styles/Applications.css";

const formatDate = (date) => new Date(date).toLocaleDateString(undefined, {
  day: "numeric", month: "short", year: "numeric",
});

const formatStatus = (status) => (status === "accepted" ? "Shortlisted" : status.charAt(0).toUpperCase() + status.slice(1));

const formatTimelineDate = (date) => new Date(date).toLocaleString(undefined, {
  day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
});

function Applications() {
  const user = useSelector((state) => state.auth.user);
  const location = useLocation();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadApplications = async () => {
      try {
        const data = await getMyApplications();
        setApplications(data.applications || []);
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to load your applications.");
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === "candidate") {
      loadApplications();
    }
  }, [user?.role]);

  if (user?.role !== "candidate") {
    return <main className="applications-page"><section className="applications-card applications-empty"><p className="eyebrow">My applications</p><h1>Candidate applications unavailable</h1><p>This page is available to candidate accounts only.</p></section></main>;
  }

  return (
    <main className="applications-page">
      <section className="applications-heading">
        <div><p className="eyebrow">Candidate activity</p><h1>My applications</h1><p>Track the roles you have applied for and their current status.</p></div>
        <Link to="/jobs" className="applications-browse-link">Browse jobs</Link>
      </section>

      {location.state?.message && <p className="applications-message applications-message--success" role="status">{location.state.message}</p>}
      {loading && <p className="applications-message">Loading your applications...</p>}
      {error && <p className="applications-message applications-message--error" role="alert">{error}</p>}
      {!loading && !error && applications.length === 0 && <section className="applications-card applications-empty"><h2>No applications yet.</h2><p>Explore open roles and submit your first application when you find a good match.</p><Link to="/jobs">Browse jobs</Link></section>}
      {!loading && applications.length > 0 && <section className="applications-list">{applications.map((application) => {
        const history = Array.isArray(application.statusHistory) ? application.statusHistory : [];
        return <article className="applications-card application-timeline-card" key={application._id}><div className="application-main"><p className="application-company-name">{application.job?.company?.name || "Company"}</p><h2>{application.job?.title || "Job application"}</h2><p className="application-meta">{application.job?.location || "Location not listed"} · Applied {formatDate(application.createdAt)}</p><section className="application-timeline" aria-label="Application status timeline"><h3>Status timeline</h3>{history.length > 0 ? <ol>{history.map((event, index) => <li key={`${event.status}-${event.timestamp}-${index}`}><span className={`application-timeline-dot application-timeline-dot--${event.status}`} aria-hidden="true" /><div><strong>{index === 0 && event.status === "pending" ? "Application submitted" : formatStatus(event.status)}</strong><time dateTime={event.timestamp}>{formatTimelineDate(event.timestamp)}</time></div></li>)}</ol> : <p className="timeline-legacy">Historical status changes are unavailable for this application. Current status: {formatStatus(application.status)}.</p>}</section></div><div className="application-side"><span className={`application-status application-status--${application.status}`}>{formatStatus(application.status)}</span>{application.job?._id && <Link to={`/jobs/${application.job._id}`}>View job</Link>}</div></article>;
      })}</section>}
    </main>
  );
}

export default Applications;
