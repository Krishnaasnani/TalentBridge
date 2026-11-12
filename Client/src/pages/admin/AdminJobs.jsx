import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminJobs, moderateAdminJob } from "../../services/authService.js";
import useAccessibleDialog from "../../components/common/useAccessibleDialog.js";
import "../../styles/AdminJobs.css";

const formatDate = (date) => new Date(date).toLocaleDateString(undefined, {
  day: "numeric", month: "short", year: "numeric",
});

const formatSalary = (salary) => {
  if (typeof salary === "number" && Number.isFinite(salary)) return `₹${salary.toLocaleString()}`;
  return typeof salary === "string" && salary.trim() ? salary : "Not listed";
};

function AdminJobs() {
  const [jobs, setJobs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [pendingModeration, setPendingModeration] = useState(null);
  const [moderationReason, setModerationReason] = useState("");
  const [moderatingId, setModeratingId] = useState("");
  const [message, setMessage] = useState("");
  const { closeButtonRef, closeDialog, dialogRef, openDialog } = useAccessibleDialog(Boolean(pendingModeration), () => setPendingModeration(null));

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((current) => ({ ...current, page: 1 }));
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    const loadJobs = async () => {
      setLoading(true);
      setError("");
      setJobs([]);

      try {
        const response = await getAdminJobs({
          page: pagination.page,
          limit: pagination.limit,
          ...(search && { search }),
        });

        if (!cancelled) {
          setJobs(response.data.jobs || []);
          setPagination((current) => ({ ...current, ...response.data.pagination }));
        }
      } catch {
        if (!cancelled) setError("Unable to load jobs.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadJobs();
    return () => { cancelled = true; };
  }, [pagination.page, pagination.limit, search, retryKey]);

  const resetSearch = () => {
    setSearchInput("");
    setSearch("");
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const hasSearch = Boolean(search || searchInput);

  const openModeration = (job, trigger) => {
    openDialog(trigger);
    setPendingModeration(job);
    setModerationReason(job.moderationStatus === "hidden" ? job.moderationReason || "" : "");
    setMessage("");
  };

  const submitModeration = async () => {
    if (!pendingModeration || moderatingId) return;
    const status = pendingModeration.moderationStatus === "hidden" ? "active" : "hidden";
    setModeratingId(pendingModeration._id);
    setMessage("");
    try {
      const response = await moderateAdminJob(pendingModeration._id, { status, reason: moderationReason });
      setJobs((current) => current.map((job) => job._id === pendingModeration._id ? { ...job, ...response.job } : job));
      setMessage(response.message);
      setPendingModeration(null);
    } catch (requestError) {
      setMessage(requestError.response?.data?.message || "Unable to update job moderation.");
    } finally {
      setModeratingId("");
    }
  };

  return (
    <main className="admin-jobs-page">
        <header className="admin-jobs-header">
          <div>
            <p className="eyebrow">Administration</p>
            <h1>Job Management</h1>
            <p>View jobs posted across the platform.</p>
          </div>
          <Link to="/admin/dashboard">Back to dashboard</Link>
        </header>

        <section className="admin-jobs-controls" aria-label="Job search">
          <label>
            <span>Search jobs</span>
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search title, company, location..." />
          </label>
          {hasSearch && <button type="button" onClick={resetSearch}>Reset search</button>}
        </section>
        {message && <p className={`admin-jobs-message ${message.includes("successfully") ? "success-message" : "error-message"}`} role={message.includes("successfully") ? "status" : "alert"}>{message}</p>}

        {loading && <section className="admin-jobs-state" aria-live="polite">Loading jobs...</section>}

        {!loading && error && (
          <section className="admin-jobs-state admin-jobs-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setRetryKey((key) => key + 1)}>Retry</button>
          </section>
        )}

        {!loading && !error && (
          <>
            <div className="admin-jobs-results"><p>Showing {jobs.length} of {pagination.total} jobs</p></div>
            {jobs.length === 0 ? (
              <section className="admin-jobs-state">
                <p>{hasSearch ? "No jobs match your search." : "No jobs found."}</p>
                {hasSearch && <button type="button" onClick={resetSearch}>Reset search</button>}
              </section>
            ) : (
              <section className="admin-jobs-table-wrap">
                <table className="admin-jobs-table">
                  <thead><tr><th>Job Title</th><th>Company</th><th>Location</th><th>Job Type</th><th>Experience Level</th><th>Salary</th><th>Status</th><th>Posted Date</th><th>Employer / Owner</th><th> </th></tr></thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr key={job._id}>
                        <td data-label="Job Title">{job.title}</td>
                        <td data-label="Company">{job.company?.name || "Company unavailable"}</td>
                        <td data-label="Location">{job.location || job.company?.location || "Not provided"}</td>
                        <td data-label="Job Type">{job.jobType || "Not listed"}</td>
                        <td data-label="Experience Level">{job.experienceLevel || "Not listed"}</td>
                        <td data-label="Salary">{formatSalary(job.salary)}</td>
                        <td data-label="Status"><span className={`admin-job-status status-${job.moderationStatus || "active"}`}>{job.moderationStatus === "hidden" ? "Hidden" : "Active"}</span></td>
                        <td data-label="Posted Date">{formatDate(job.createdAt)}</td>
                        <td data-label="Employer / Owner">{job.createdBy?.fullName || "Owner unavailable"}</td>
                        <td data-label="" className="admin-job-actions">{job.moderationStatus !== "hidden" && <Link className="admin-view-job" to={`/jobs/${job._id}`}>View Job</Link>}<button type="button" onClick={(event) => openModeration(job, event.currentTarget)} disabled={moderatingId === job._id}>{job.moderationStatus === "hidden" ? "Restore" : "Hide"}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {pagination.totalPages > 0 && (
              <nav className="admin-jobs-pagination" aria-label="Job pages">
                <button type="button" disabled={pagination.page === 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
                <span>Page {pagination.page} of {pagination.totalPages}</span>
                <button type="button" disabled={pagination.page === pagination.totalPages} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
              </nav>
            )}
          </>
        )}

        {pendingModeration && <div className="admin-moderation-overlay" onMouseDown={closeDialog}><section className="admin-moderation-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="moderation-title" aria-describedby="moderation-description" onMouseDown={(event) => event.stopPropagation()}><h2 id="moderation-title">{pendingModeration.moderationStatus === "hidden" ? "Restore job" : "Hide job"}</h2><p id="moderation-description">{pendingModeration.moderationStatus === "hidden" ? "Restore this job to candidate job discovery?" : "Hide this job from candidate job discovery and new applications?"}</p><label>Reason <span>(optional)</span><textarea value={moderationReason} onChange={(event) => setModerationReason(event.target.value)} maxLength="500" disabled={Boolean(moderatingId)} /></label><div className="admin-moderation-actions"><button ref={closeButtonRef} type="button" onClick={closeDialog} disabled={Boolean(moderatingId)}>Cancel</button><button type="button" onClick={submitModeration} disabled={Boolean(moderatingId)}>{moderatingId ? "Saving..." : pendingModeration.moderationStatus === "hidden" ? "Restore Job" : "Hide Job"}</button></div></section></div>}
    </main>
  );
}

export default AdminJobs;
