import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { deleteJob, getEmployerApplicationSummary, getMyApplications, getMyJobs } from "../../services/authService";
import useAccessibleDialog from "../../components/common/useAccessibleDialog.js";
import "../../styles/Dashboard.css";

function Dashboard() {
  const user = useSelector((state) => state.auth.user);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [employerJobs, setEmployerJobs] = useState([]);
  const [employerJobsLoading, setEmployerJobsLoading] = useState(true);
  const [employerJobsError, setEmployerJobsError] = useState("");
  const [employerSummary, setEmployerSummary] = useState({ totalApplications: 0, pendingApplications: 0, acceptedApplications: 0, rejectedApplications: 0 });
  const [employerSummaryLoading, setEmployerSummaryLoading] = useState(true);
  const [employerSummaryError, setEmployerSummaryError] = useState("");
  const [employerJobsReloadKey, setEmployerJobsReloadKey] = useState(0);
  const [employerSummaryReloadKey, setEmployerSummaryReloadKey] = useState(0);
  const [pendingJobDeletion, setPendingJobDeletion] = useState(null);
  const [deletingJobId, setDeletingJobId] = useState("");
  const [employerMessage, setEmployerMessage] = useState("");
  const { closeButtonRef, closeDialog, dialogRef, openDialog } = useAccessibleDialog(Boolean(pendingJobDeletion), () => setPendingJobDeletion(null));

  useEffect(() => {
    if (user?.role !== "candidate") {
      return;
    }

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

    loadApplications();
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "employer") return undefined;
    let active = true;

    const loadJobs = async () => {
      setEmployerJobsLoading(true);
      setEmployerJobsError("");
      try {
        const jobsData = await getMyJobs();
        if (active) setEmployerJobs(jobsData.jobs || []);
      } catch (requestError) {
        if (active) setEmployerJobsError(requestError.response?.data?.message || "Unable to load your jobs.");
      } finally {
        if (active) setEmployerJobsLoading(false);
      }
    };

    loadJobs();
    return () => { active = false; };
  }, [user?.role, employerJobsReloadKey]);

  useEffect(() => {
    if (user?.role !== "employer") return undefined;
    let active = true;

    const loadSummary = async () => {
      setEmployerSummaryLoading(true);
      setEmployerSummaryError("");
      try {
        const summaryData = await getEmployerApplicationSummary();
        if (active) setEmployerSummary({
          totalApplications: summaryData.totalApplications || 0,
          pendingApplications: summaryData.pendingApplications || 0,
          acceptedApplications: summaryData.acceptedApplications || 0,
          rejectedApplications: summaryData.rejectedApplications || 0,
        });
      } catch (requestError) {
        if (active) setEmployerSummaryError(requestError.response?.data?.message || "Unable to load application summary.");
      } finally {
        if (active) setEmployerSummaryLoading(false);
      }
    };

    loadSummary();
    return () => { active = false; };
  }, [user?.role, employerSummaryReloadKey]);

  const openDeleteDialog = (job, trigger) => {
    setEmployerMessage("");
    setPendingJobDeletion(job);
    openDialog(trigger);
  };

  const confirmDeleteJob = async () => {
    if (!pendingJobDeletion || deletingJobId) return;
    setDeletingJobId(pendingJobDeletion._id);
    setEmployerMessage("");
    try {
      await deleteJob(pendingJobDeletion._id);
      setEmployerJobs((current) => current.filter((job) => job._id !== pendingJobDeletion._id));
      setEmployerMessage("Job deleted successfully.");
      closeDialog();
      setEmployerJobsReloadKey((value) => value + 1);
      setEmployerSummaryReloadKey((value) => value + 1);
    } catch (requestError) {
      setEmployerMessage(requestError.response?.status === 404
        ? "This job no longer exists. Your list has been refreshed."
        : requestError.response?.data?.message || "Unable to delete this job.");
      if (requestError.response?.status === 404) {
        setEmployerJobs((current) => current.filter((job) => job._id !== pendingJobDeletion._id));
        closeDialog();
        setEmployerJobsReloadKey((value) => value + 1);
        setEmployerSummaryReloadKey((value) => value + 1);
      }
    } finally {
      setDeletingJobId("");
    }
  };

  if (user?.role === "employer") {
    const employerStats = [
      ["Jobs Posted", employerJobs.length],
      ["Total Applications", employerSummary.totalApplications],
      ["Pending Applications", employerSummary.pendingApplications],
      ["Accepted Applications", employerSummary.acceptedApplications],
      ["Rejected Applications", employerSummary.rejectedApplications],
    ];

    return (
      <main className="dashboard-page">
        <section className="dashboard-hero">
          <div>
            <p className="eyebrow">Employer dashboard</p>
            <h1>Welcome, {user.fullName}</h1>
            <p>Manage your hiring activity and keep track of your opportunities.</p>
          </div>
          <div className="dashboard-actions"><Link className="dashboard-secondary-action" to="/company-profile">Company profile</Link><Link className="dashboard-primary-action" to="/jobs/create">Post a Job</Link></div>
        </section>

        <section className="dashboard-stats dashboard-stats--employer" aria-label="Employer job statistics">
          {employerStats.map(([label, value]) => (
            <article key={label}><span>{label}</span><strong>{label === "Jobs Posted" ? employerJobsLoading ? "—" : value : employerSummaryLoading ? "—" : value}</strong></article>
          ))}
        </section>

        {employerSummaryError && <section className="dashboard-error dashboard-summary-error" role="alert"><p>{employerSummaryError}</p><button type="button" onClick={() => setEmployerSummaryReloadKey((value) => value + 1)}>Retry summary</button></section>}
        {employerMessage && <p className={`dashboard-message ${employerMessage === "Job deleted successfully." ? "dashboard-message--success" : "dashboard-message--error"}`} role={employerMessage === "Job deleted successfully." ? "status" : "alert"}>{employerMessage}</p>}

        <section className="dashboard-card empty-dashboard">
          <div className="section-row"><h2>Your Jobs</h2><span>{employerJobsLoading ? "Loading..." : `${employerJobs.length} jobs`}</span></div>
          {employerJobsLoading && <p className="dashboard-loading" aria-live="polite">Loading your jobs...</p>}
          {employerJobsError && <div className="dashboard-error" role="alert"><p>{employerJobsError}</p><button type="button" onClick={() => setEmployerJobsReloadKey((value) => value + 1)}>Retry jobs</button></div>}
          {!employerJobsLoading && !employerJobsError && employerJobs.length === 0 && (
            <div className="empty-state"><h3>No jobs posted yet</h3><p>You haven't posted any jobs yet.</p></div>
          )}
          {!employerJobsLoading && employerJobs.length > 0 && (
            <ul className="application-list">{employerJobs.map((job) => (
              <li key={job._id}><div><strong>{job.title}</strong><span>{job.company?.name || "Company"} · {job.location}</span>{job.moderationStatus === "hidden" && <p className="job-moderation-notice">This job is hidden from candidate discovery.{job.moderationReason ? ` Reason: ${job.moderationReason}` : ""}</p>}</div><div className="job-list-actions"><em>{job.jobType}</em>{job.moderationStatus !== "hidden" && <Link to={`/jobs/${job._id}/edit`}>Edit Job</Link>}<Link to={`/jobs/${job._id}/applicants`}>View Applicants</Link><button type="button" className="job-delete-button" onClick={(event) => openDeleteDialog(job, event.currentTarget)}>Delete</button></div></li>
            ))}</ul>
          )}
        </section>
        {pendingJobDeletion && <div className="job-delete-overlay" onMouseDown={() => { if (!deletingJobId) closeDialog(); }}><section className="job-delete-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="delete-job-title" aria-describedby="delete-job-description" onMouseDown={(event) => event.stopPropagation()}><h2 id="delete-job-title">Delete job?</h2><p id="delete-job-description">Delete <strong>{pendingJobDeletion.title}</strong>? This removes the job listing. Existing applications are not deleted.</p><div className="job-delete-actions"><button ref={closeButtonRef} type="button" onClick={closeDialog} disabled={Boolean(deletingJobId)}>Cancel</button><button type="button" onClick={confirmDeleteJob} disabled={Boolean(deletingJobId)}>{deletingJobId ? "Deleting..." : "Delete job"}</button></div></section></div>}
      </main>
    );
  }

  if (user?.role !== "candidate") return null;

  const stats = {
    total: applications.length,
    pending: applications.filter((application) => application.status === "pending").length,
    shortlisted: applications.filter((application) => application.status === "accepted").length,
    rejected: applications.filter((application) => application.status === "rejected").length,
  };

  const filledProfileFields = [user?.fullName, user?.phone, user?.location, user?.bio, user?.profileImage, user?.resume, user?.skills?.length].filter(Boolean).length;
  const profileCompletion = Math.round((filledProfileFields / 7) * 100);

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Candidate dashboard</p>
          <h1>Welcome, {user.fullName}</h1>
          <p>Track your job search and keep your profile ready for new opportunities.</p>
        </div>
        <div className="dashboard-actions dashboard-actions--candidate" aria-label="Candidate quick actions">
          <Link to="/profile" className="dashboard-secondary-action">Edit profile</Link>
          <Link to="/resume-analyzer" className="dashboard-secondary-action">Resume Analyzer</Link>
          <Link to="/job-match" className="dashboard-secondary-action">Analyze Job</Link>
          <Link to="/jobs" className="dashboard-secondary-action">Browse jobs</Link>
          <Link to="/applications" className="dashboard-primary-action">My applications</Link>
        </div>
      </section>

      <section className="dashboard-stats" aria-label="Application statistics">
        <article><span>Total applications</span><strong>{stats.total}</strong></article>
        <article><span>Pending</span><strong>{stats.pending}</strong></article>
        <article><span>Shortlisted</span><strong>{stats.shortlisted}</strong></article>
        <article><span>Rejected</span><strong>{stats.rejected}</strong></article>
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-card completion-card">
          <div className="section-row"><h2>Profile completion</h2><strong>{profileCompletion}%</strong></div>
          <div className="completion-track"><div style={{ width: `${profileCompletion}%` }} /></div>
          <p>Complete your profile to help employers understand your experience.</p>
          <Link to="/profile">Complete profile</Link>
        </article>

        <article className="dashboard-card completion-card">
          <div className="section-row"><h2>Job Description Match</h2></div>
          <p>Compare your resume with a specific job and identify strengths, gaps, and relevant keywords.</p>
          <Link to="/job-match">Analyze Job</Link>
        </article>

        <article className="dashboard-card recent-card">
          <div className="section-row"><h2>Recent applications</h2><span>{loading ? "Loading..." : `${applications.length} total`}</span></div>
          {error && <p className="dashboard-error" role="alert">{error}</p>}
          {!loading && !error && applications.length === 0 && (
            <div className="empty-state"><h3>No applications yet</h3><p>Start exploring roles and your submitted applications will appear here.</p><Link to="/jobs">Browse jobs</Link></div>
          )}
          {!loading && applications.length > 0 && (
            <ul className="application-list">
              {applications.slice(0, 4).map((application) => (
                <li key={application._id}>
                  <div><strong>{application.job?.title || "Job application"}</strong><span>{application.job?.company?.name || "Company"}</span></div>
                  <em>{application.status}</em>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </main>
  );
}

export default Dashboard;
