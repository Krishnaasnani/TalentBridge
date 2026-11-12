import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminApplicationById, getAdminApplications } from "../../services/authService.js";
import useAccessibleDialog from "../../components/common/useAccessibleDialog.js";
import "../../styles/AdminApplications.css";

const STATUSES = [
  ["", "All"],
  ["pending", "Pending"],
  ["accepted", "Shortlisted"],
  ["rejected", "Rejected"],
];

const formatDate = (date) => new Date(date).toLocaleDateString(undefined, {
  day: "numeric", month: "short", year: "numeric",
});
const formatTimestamp = (date) => new Date(date).toLocaleString(undefined, {
  day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
});

const formatStatus = (status) => (status === "accepted" ? "Shortlisted" : status.charAt(0).toUpperCase() + status.slice(1));

function AdminApplications() {
  const [applications, setApplications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const { closeButtonRef, closeDialog, dialogRef, openDialog } = useAccessibleDialog(Boolean(selectedId), () => {
    setSelectedId("");
    setDetails(null);
    setDetailsError("");
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((current) => ({ ...current, page: 1 }));
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    const loadApplications = async () => {
      setLoading(true);
      setError("");
      setApplications([]);

      try {
        const response = await getAdminApplications({
          page: pagination.page,
          limit: pagination.limit,
          ...(status && { status }),
          ...(search && { search }),
        });

        if (!cancelled) {
          setApplications(response.data.applications || []);
          setPagination((current) => ({ ...current, ...response.data.pagination }));
        }
      } catch {
        if (!cancelled) setError("Unable to load applications.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadApplications();
    return () => { cancelled = true; };
  }, [pagination.page, pagination.limit, search, status, retryKey]);

  const updateStatus = (nextStatus) => {
    setStatus(nextStatus);
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus("");
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const filtersActive = Boolean(search || searchInput || status);

  const loadDetails = async (applicationId, trigger) => {
    if (trigger) openDialog(trigger);
    setSelectedId(applicationId);
    setDetails(null);
    setDetailsError("");
    setDetailsLoading(true);
    try {
      const response = await getAdminApplicationById(applicationId);
      setDetails(response.data);
    } catch (requestError) {
      setDetailsError(requestError.response?.status === 404
        ? "This application is no longer available."
        : requestError.response?.data?.message || "Unable to load application details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  return (
    <main className="admin-applications-page">
        <header className="admin-applications-header">
          <div>
            <p className="eyebrow">Administration</p>
            <h1>Application Overview</h1>
            <p>View application activity across the platform.</p>
          </div>
          <Link to="/admin/dashboard">Back to dashboard</Link>
        </header>

        <section className="admin-applications-controls" aria-label="Application filters">
          <label className="admin-applications-search">
            <span>Search applications</span>
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search applicant, job, company..." />
          </label>
          <label className="admin-applications-status-filter">
            <span>Status</span>
            <select value={status} onChange={(event) => updateStatus(event.target.value)}>
              {STATUSES.map(([value, label]) => <option value={value} key={label}>{label}</option>)}
            </select>
          </label>
          {filtersActive && <button type="button" onClick={resetFilters}>Reset Filters</button>}
        </section>

        {loading && <section className="admin-applications-state" aria-live="polite">Loading applications...</section>}

        {!loading && error && (
          <section className="admin-applications-state admin-applications-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setRetryKey((key) => key + 1)}>Retry</button>
          </section>
        )}

        {!loading && !error && (
          <>
            <div className="admin-applications-results"><p>Showing {applications.length} of {pagination.total} applications</p></div>
            {applications.length === 0 ? (
              <section className="admin-applications-state">
                <p>{filtersActive ? "No applications match your current filters." : "No applications found."}</p>
                {filtersActive && <button type="button" onClick={resetFilters}>Reset Filters</button>}
              </section>
            ) : (
              <section className="admin-applications-table-wrap">
                <table className="admin-applications-table">
                  <thead><tr><th>Applicant</th><th>Job</th><th>Company</th><th>Status</th><th>Applied Date</th><th> </th></tr></thead>
                  <tbody>
                    {applications.map((application) => (
                      <tr key={application._id}>
                        <td data-label="Applicant"><strong>{application.applicant?.fullName || "Applicant unavailable"}</strong><span>{application.applicant?.email || "Email unavailable"}</span></td>
                        <td data-label="Job">{application.job?.title || "Job unavailable"}</td>
                        <td data-label="Company">{application.job?.company?.name || "Company unavailable"}</td>
                        <td data-label="Status"><span className={`admin-application-status status-${application.status}`}>{formatStatus(application.status)}</span></td>
                        <td data-label="Applied Date">{formatDate(application.createdAt)}</td>
                        <td data-label=""><button type="button" className="admin-application-details-button" onClick={(event) => loadDetails(application._id, event.currentTarget)}>View details</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {pagination.totalPages > 0 && (
              <nav className="admin-applications-pagination" aria-label="Application pages">
                <button type="button" disabled={pagination.page === 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
                <span>Page {pagination.page} of {pagination.totalPages}</span>
                <button type="button" disabled={pagination.page === pagination.totalPages} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
              </nav>
            )}
          </>
        )}

        {selectedId && <div className="admin-application-details-overlay" onMouseDown={closeDialog}><section className="admin-application-details-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="application-details-title" onMouseDown={(event) => event.stopPropagation()}><button ref={closeButtonRef} type="button" className="admin-application-details-close" aria-label="Close application details" onClick={closeDialog}>×</button><h2 id="application-details-title">Application details</h2>{detailsLoading && <section className="admin-application-details-state" aria-live="polite">Loading application details...</section>}{detailsError && <section className="admin-application-details-state admin-application-details-error" role="alert"><p>{detailsError}</p><button type="button" onClick={() => loadDetails(selectedId)}>Retry</button></section>}{details && <><header><p className="eyebrow">Application review</p><span className={`admin-application-status status-${details.status}`}>{formatStatus(details.status)}</span></header><div className="admin-application-detail-grid"><section><h3>Applicant</h3><p>{details.applicant?.fullName || "Applicant unavailable"}</p><p>{details.applicant?.email || "Email unavailable"}</p></section><section><h3>Employer</h3><p>{details.job?.employer?.fullName || "Employer unavailable"}</p><p>{details.job?.employer?.email || "Email unavailable"}</p></section><section><h3>Job</h3><p>{details.job?.title || "Job unavailable"}</p><p>{details.job?.company?.name || "Company unavailable"}</p></section><section><h3>Dates</h3><p><strong>Applied:</strong> {formatTimestamp(details.createdAt)}</p><p><strong>Updated:</strong> {formatTimestamp(details.updatedAt)}</p></section></div><section className="admin-application-history"><h3>Status history</h3>{details.statusHistory?.length ? <ol>{[...details.statusHistory].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).map((event, index) => <li key={`${event.status}-${event.timestamp}-${index}`}><strong>{formatStatus(event.status)}</strong><time dateTime={event.timestamp}>{formatTimestamp(event.timestamp)}</time><span>{event.actor?.fullName ? `By ${event.actor.fullName}${event.actor.email ? ` (${event.actor.email})` : ""}` : "Actor unavailable"}</span></li>)}</ol> : <p>No status history is available for this application.</p>}</section></>}</section></div>}
    </main>
  );
}

export default AdminApplications;
