import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getApplicantResume, getJobApplicants, updateApplicationStatus } from "../../services/authService";
import "../../styles/Applicants.css";

const STATUSES = ["pending", "accepted", "rejected"];
const initialFilters = { search: "", status: "", skills: "" };
const formatDate = (date) => new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const formatStatus = (status) => status === "accepted" ? "Shortlisted" : `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
function Applicants() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [activeFilters, setActiveFilters] = useState(initialFilters);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [openingResume, setOpeningResume] = useState(false);
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const detailsTriggerRef = useRef(null);

  useEffect(() => {
    const loadApplicants = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getJobApplicants(jobId, { ...activeFilters, page: pagination.page, limit: pagination.limit });
        setJob(data.job);
        setApplications(data.applications || []);
        setPagination((current) => ({ ...current, ...data.pagination }));
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to load applicants.");
      } finally { setLoading(false); }
    };
    loadApplicants();
  }, [jobId, activeFilters, pagination.page, pagination.limit, reloadKey]);

  const applyFilters = (event) => {
    event.preventDefault();
    setPagination((current) => ({ ...current, page: 1 }));
    setActiveFilters(filters);
  };
  const resetFilters = () => {
    setFilters(initialFilters);
    setActiveFilters(initialFilters);
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const saveStatus = async (applicationId, status) => {
    if (savingId) return;
    setSavingId(applicationId); setMessage("");
    try {
      const data = await updateApplicationStatus(applicationId, status);
      setApplications((current) => current.map((application) => application._id === applicationId ? { ...application, status: data.application.status } : application));
      setSelected((current) => current?._id === applicationId ? { ...current, status: data.application.status } : current);
      setMessage("Application status saved.");
    } catch (requestError) {
      setMessage(requestError.response?.data?.message || "Unable to update application status.");
    } finally { setSavingId(""); }
  };

  const closeDetails = () => {
    setSelected(null);
    window.requestAnimationFrame(() => detailsTriggerRef.current?.focus());
  };

  const openDetails = (application, trigger) => {
    detailsTriggerRef.current = trigger;
    setSelected(application);
  };

  useEffect(() => {
    if (!selected) return undefined;

    const focusDialog = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDetails();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('a[href], button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => { window.cancelAnimationFrame(focusDialog); document.removeEventListener("keydown", handleKeyDown); };
  }, [selected]);

  const openResume = async (applicationId) => {
    const resumeWindow = window.open("", "_blank");
    if (!resumeWindow) {
      setMessage("Allow pop-ups to open the resume.");
      return;
    }
    resumeWindow.opener = null;

    setOpeningResume(true);
    setMessage("");
    try {
      const resume = await getApplicantResume(applicationId);
      const resumeUrl = URL.createObjectURL(resume);
      resumeWindow.location.href = resumeUrl;
      window.setTimeout(() => URL.revokeObjectURL(resumeUrl), 60_000);
    } catch (requestError) {
      resumeWindow.close();
      setMessage(requestError.response?.data?.message || "Unable to open the resume.");
    } finally {
      setOpeningResume(false);
    }
  };

  if (loading) return <main className="applicants-page"><p className="applicants-message" aria-live="polite">Loading applicants...</p></main>;
  if (error) return <main className="applicants-page"><p className="applicants-message applicants-message--error" role="alert">{error}</p><button className="applicant-retry" type="button" onClick={() => setReloadKey((key) => key + 1)}>Try again</button><Link className="applicants-back-link" to="/dashboard">Back to dashboard</Link></main>;

  return <main className="applicants-page">
    <Link className="applicants-back-link" to="/dashboard">← Back to dashboard</Link>
    <section className="applicants-heading"><p className="eyebrow">Candidate management</p><h1>Applicants</h1><h2>{job?.title}</h2><p>{pagination.total} {pagination.total === 1 ? "applicant" : "applicants"}</p></section>
    {message && <p className={`applicants-message ${message === "Application status saved." ? "applicants-message--success" : "applicants-message--error"}`} role={message === "Application status saved." ? "status" : "alert"}>{message}</p>}
    <form className="applicant-filters" onSubmit={applyFilters}>
      <label><span>Search name or email</span><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Name or email" /></label>
      <label><span>Status</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{STATUSES.map((status) => <option value={status} key={status}>{formatStatus(status)}</option>)}</select></label>
      <label><span>Skill</span><input value={filters.skills} onChange={(event) => setFilters({ ...filters, skills: event.target.value })} placeholder="React, Python..." /></label>
      <div className="applicant-filter-actions"><button type="submit">Apply filters</button><button type="button" onClick={resetFilters}>Reset</button></div>
    </form>
    {applications.length === 0 ? <section className="applicants-empty"><h3>No matching applicants</h3><p>{Object.values(activeFilters).some(Boolean) ? "Try changing or clearing your filters." : "When candidates apply for this role, their profiles will appear here."}</p></section> : <section className="applicant-list">
      {applications.map((application) => { const applicant = application.applicant || {}; return <article className="applicant-card" key={application._id}><div><h3>{applicant.fullName || "Applicant"}</h3><p>{applicant.email}</p><p className="applicant-meta">{applicant.location || "Location not provided"} · Applied {formatDate(application.createdAt)}</p><div className="skill-list">{applicant.skills?.length ? applicant.skills.map((skill) => <span key={skill}>{skill}</span>) : <span>No skills listed</span>}</div></div><div className="applicant-actions"><span className={`applicant-status applicant-status--${application.status}`}>{formatStatus(application.status)}</span><button type="button" onClick={(event) => openDetails(application, event.currentTarget)}>View Details</button></div></article>; })}
    </section>}
    {pagination.totalPages > 1 && <nav className="applicant-pagination" aria-label="Applicant pages"><button type="button" disabled={pagination.page === 1} onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}>Previous</button><span>Page {pagination.page} of {pagination.totalPages}</span><button type="button" disabled={pagination.page === pagination.totalPages} onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}>Next</button></nav>}
    {selected && <div className="details-overlay" onMouseDown={closeDetails}><section className="details-panel" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="applicant-name" aria-describedby="applicant-details-description" onMouseDown={(event) => event.stopPropagation()}><button className="close-details" ref={closeButtonRef} type="button" aria-label="Close applicant details" onClick={closeDetails}>×</button><p className="eyebrow" id="applicant-details-description">Applicant details</p><h2 id="applicant-name">{selected.applicant?.fullName || "Applicant"}</h2><dl><dt>Email</dt><dd>{selected.applicant?.email || "Not provided"}</dd><dt>Phone</dt><dd>{selected.applicant?.phone || "Not provided"}</dd><dt>Location</dt><dd>{selected.applicant?.location || "Not provided"}</dd><dt>Skills</dt><dd>{selected.applicant?.skills?.length ? selected.applicant.skills.join(", ") : "Not provided"}</dd><dt>Bio</dt><dd>{selected.applicant?.bio || "Not provided"}</dd><dt>Resume</dt><dd>{selected.hasResume ? <a className="resume-link" href="#resume" onClick={(event) => { event.preventDefault(); if (!openingResume) openResume(selected._id); }} aria-disabled={openingResume}>{openingResume ? "Opening..." : "Open resume"}</a> : "Resume not available"}</dd><dt>Applied</dt><dd>{formatDate(selected.createdAt)}</dd></dl><label className="status-control">Application status<select value={selected.status} disabled={savingId === selected._id} onChange={(event) => saveStatus(selected._id, event.target.value)}>{STATUSES.map((status) => <option value={status} key={status}>{formatStatus(status)}</option>)}</select>{savingId === selected._id && <small aria-live="polite">Saving status...</small>}</label></section></div>}
  </main>;
}

export default Applicants;
