import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createJob } from "../../services/authService";
import "../../styles/PostJob.css";

const initialForm = {
  title: "",
  companyName: "",
  location: "",
  jobType: "Full-time",
  experienceLevel: "Fresher",
  description: "",
  requirements: "",
  salary: "",
};

function PostJob() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [posting, setPosting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const formRef = useRef(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
    setError("");
    setFieldErrors((current) => ({ ...current, [name]: "" }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const requirements = form.requirements.split(",").map((item) => item.trim()).filter(Boolean);

    const nextFieldErrors = {
      title: form.title.trim() ? "" : "Enter a job title.",
      companyName: form.companyName.trim() ? "" : "Enter a company name.",
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

    setPosting(true);
    setError("");
    try {
      await createJob({ ...form, requirements });
      navigate("/dashboard");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to post your job.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <main className="post-job-page">
      <section className="post-job-container">
        <header className="post-job-header"><p className="eyebrow">Employer dashboard</p><h1>Post a job</h1><p>Share your opportunity with the TalentBridge community.</p></header>
        <form className="post-job-card" ref={formRef} onSubmit={handleSubmit} noValidate>
          {error && <p className="post-job-message post-job-message--error" role="alert">{error}</p>}
          <div className="post-job-grid">
            <label>Job title<input name="title" value={form.title} onChange={handleChange} required aria-invalid={Boolean(fieldErrors.title)} aria-describedby={fieldErrors.title ? "job-title-error" : undefined} />{fieldErrors.title && <span className="post-job-field-error" id="job-title-error">{fieldErrors.title}</span>}</label>
            <label>Company<input name="companyName" value={form.companyName} onChange={handleChange} required aria-invalid={Boolean(fieldErrors.companyName)} aria-describedby={fieldErrors.companyName ? "company-name-error" : undefined} />{fieldErrors.companyName && <span className="post-job-field-error" id="company-name-error">{fieldErrors.companyName}</span>}</label>
            <label>Location<input name="location" value={form.location} onChange={handleChange} required aria-invalid={Boolean(fieldErrors.location)} aria-describedby={fieldErrors.location ? "job-location-error" : undefined} />{fieldErrors.location && <span className="post-job-field-error" id="job-location-error">{fieldErrors.location}</span>}</label>
            <label>Job type<select name="jobType" value={form.jobType} onChange={handleChange}><option>Full-time</option><option>Part-time</option><option>Internship</option><option>Remote</option></select></label>
            <label>Experience<input name="experienceLevel" value={form.experienceLevel} onChange={handleChange} placeholder="Fresher, 1-3 years" required aria-invalid={Boolean(fieldErrors.experienceLevel)} aria-describedby={fieldErrors.experienceLevel ? "experience-level-error" : undefined} />{fieldErrors.experienceLevel && <span className="post-job-field-error" id="experience-level-error">{fieldErrors.experienceLevel}</span>}</label>
            <label>Salary <span>(optional)</span><input type="text" name="salary" value={form.salary} onChange={handleChange} placeholder="₹167,000 - ₹500,000" /></label>
            <label className="post-job-full">Requirements / skills<input name="requirements" value={form.requirements} onChange={handleChange} placeholder="React, Node.js, communication" required aria-invalid={Boolean(fieldErrors.requirements)} aria-describedby="requirements-help requirements-error" /><span id="requirements-help">Separate skills with commas.</span>{fieldErrors.requirements && <span className="post-job-field-error" id="requirements-error">{fieldErrors.requirements}</span>}</label>
            <label className="post-job-full">Description<textarea name="description" rows="7" value={form.description} onChange={handleChange} required aria-invalid={Boolean(fieldErrors.description)} aria-describedby="description-help description-error" /><span id="description-help">Describe responsibilities, qualifications, and what candidates can expect.</span>{fieldErrors.description && <span className="post-job-field-error" id="description-error">{fieldErrors.description}</span>}</label>
          </div>
          <div className="post-job-actions"><button type="button" onClick={() => navigate("/dashboard")} disabled={posting}>Cancel</button><button type="submit" disabled={posting}>{posting ? "Posting..." : "Post a Job"}</button></div>
        </form>
      </section>
    </main>
  );
}

export default PostJob;
