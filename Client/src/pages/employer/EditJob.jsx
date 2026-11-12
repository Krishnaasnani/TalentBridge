import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getJobById, updateJob } from "../../services/authService";
import "../../styles/PostJob.css";

const toForm = (job) => ({
  title: job.title || "",
  location: job.location || "",
  jobType: job.jobType || "Full-time",
  experienceLevel: job.experienceLevel || "",
  description: job.description || "",
  requirements: Array.isArray(job.requirements) ? job.requirements.join(", ") : "",
  salary: job.salary == null ? "" : String(job.salary),
});

function EditJob() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [fieldErrors, setFieldErrors] = useState({});
  const formRef = useRef(null);

  useEffect(() => {
    let active = true;
    const loadJob = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getJobById(jobId);
        if (active) setForm(toForm(data.job));
      } catch (requestError) {
        if (active) setError(requestError.response?.data?.message || "Unable to load this job.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadJob();
    return () => { active = false; };
  }, [jobId, reloadKey]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
    setSuccess("");
    setFieldErrors((current) => ({ ...current, [name]: "" }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const requirements = form.requirements.split(",").map((item) => item.trim()).filter(Boolean);
    const nextFieldErrors = {
      title: form.title.trim() ? "" : "Enter a job title.",
      location: form.location.trim() ? "" : "Enter a location.",
      experienceLevel: form.experienceLevel.trim() ? "" : "Enter an experience level.",
      requirements: requirements.length ? "" : "Add at least one skill.",
      description: form.description.trim() ? "" : "Enter a job description.",
    };
    if (Object.values(nextFieldErrors).some(Boolean)) {
      setFieldErrors(nextFieldErrors);
      setError("Please complete all required fields and add at least one skill.");
      window.requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const data = await updateJob(jobId, { ...form, requirements });
      setForm(toForm(data.job));
      setSuccess("Job updated successfully.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update this job.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main className="post-job-page"><section className="post-job-card" aria-live="polite">Loading job details...</section></main>;
  if (error && !form) return <main className="post-job-page"><section className="post-job-card" role="alert"><p className="post-job-message post-job-message--error">{error}</p><button type="button" onClick={() => setReloadKey((value) => value + 1)}>Try again</button><Link to="/dashboard">Back to dashboard</Link></section></main>;

  return (
    <main className="post-job-page">
      <section className="post-job-container">
        <header className="post-job-header"><p className="eyebrow">Employer dashboard</p><h1>Edit job</h1><p>Update the details candidates see for this opportunity.</p></header>
        <form className="post-job-card" ref={formRef} onSubmit={handleSubmit} noValidate>
          {error && <p className="post-job-message post-job-message--error" role="alert">{error}</p>}
          {success && <p className="post-job-message post-job-message--success" role="status">{success}</p>}
          <div className="post-job-grid">
            <label>Job title<input name="title" value={form.title} onChange={handleChange} required disabled={saving} aria-invalid={Boolean(fieldErrors.title)} aria-describedby={fieldErrors.title ? "edit-job-title-error" : undefined} />{fieldErrors.title && <span className="post-job-field-error" id="edit-job-title-error">{fieldErrors.title}</span>}</label>
            <label>Location<input name="location" value={form.location} onChange={handleChange} required disabled={saving} aria-invalid={Boolean(fieldErrors.location)} aria-describedby={fieldErrors.location ? "edit-job-location-error" : undefined} />{fieldErrors.location && <span className="post-job-field-error" id="edit-job-location-error">{fieldErrors.location}</span>}</label>
            <label>Job type<select name="jobType" value={form.jobType} onChange={handleChange} disabled={saving}><option>Full-time</option><option>Part-time</option><option>Internship</option><option>Remote</option></select></label>
            <label>Experience<input name="experienceLevel" value={form.experienceLevel} onChange={handleChange} placeholder="Fresher, 1-3 years" required disabled={saving} aria-invalid={Boolean(fieldErrors.experienceLevel)} aria-describedby={fieldErrors.experienceLevel ? "edit-experience-level-error" : undefined} />{fieldErrors.experienceLevel && <span className="post-job-field-error" id="edit-experience-level-error">{fieldErrors.experienceLevel}</span>}</label>
            <label>Salary <span>(optional)</span><input type="text" name="salary" value={form.salary} onChange={handleChange} placeholder="₹167,000 - ₹500,000" disabled={saving} /></label>
            <label className="post-job-full">Requirements / skills<input name="requirements" value={form.requirements} onChange={handleChange} placeholder="React, Node.js, communication" required disabled={saving} aria-invalid={Boolean(fieldErrors.requirements)} aria-describedby="edit-requirements-help edit-requirements-error" /><span id="edit-requirements-help">Separate skills with commas.</span>{fieldErrors.requirements && <span className="post-job-field-error" id="edit-requirements-error">{fieldErrors.requirements}</span>}</label>
            <label className="post-job-full">Description<textarea name="description" rows="7" value={form.description} onChange={handleChange} required disabled={saving} aria-invalid={Boolean(fieldErrors.description)} aria-describedby="edit-description-help edit-description-error" /><span id="edit-description-help">Describe responsibilities, qualifications, and what candidates can expect.</span>{fieldErrors.description && <span className="post-job-field-error" id="edit-description-error">{fieldErrors.description}</span>}</label>
          </div>
          <div className="post-job-actions"><button type="button" onClick={() => navigate("/dashboard")} disabled={saving}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button></div>
        </form>
      </section>
    </main>
  );
}

export default EditJob;
