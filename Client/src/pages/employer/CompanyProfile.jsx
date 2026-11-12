import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createCompany, getMyCompany, updateCompany } from "../../services/authService.js";
import "../../styles/CompanyProfile.css";

const emptyCompany = { name: "", description: "", website: "", location: "", logo: "" };

const toForm = (company) => ({
  name: company?.name || "",
  description: company?.description || "",
  website: company?.website || "",
  location: company?.location || "",
  logo: company?.logo || "",
});

function CompanyProfile() {
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState(emptyCompany);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldError, setFieldError] = useState("");
  const nameRef = useRef(null);

  useEffect(() => {
    let active = true;

    const loadCompany = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getMyCompany();
        if (!active) return;
        setCompany(data.company);
        setForm(toForm(data.company));
      } catch (requestError) {
        if (!active) return;
        if (requestError.response?.status === 404) {
          setCompany(null);
          setForm(emptyCompany);
        } else {
          setError(requestError.response?.data?.message || "Unable to load your company profile.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadCompany();
    return () => { active = false; };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldError("");
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const companyName = form.name.trim();
    if (!companyName) {
      setFieldError("Enter your company name.");
      nameRef.current?.focus();
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const companyData = {
        name: companyName,
        description: form.description.trim(),
        website: form.website.trim(),
        location: form.location.trim(),
        logo: form.logo.trim(),
      };
      const data = company
        ? await updateCompany(company._id, companyData)
        : await createCompany(companyData);
      setCompany(data.company);
      setForm(toForm(data.company));
      setSuccess(data.message || (company ? "Company profile updated." : "Company profile created."));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to save your company profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main className="company-profile-page"><section className="company-profile-state" aria-live="polite">Loading company profile...</section></main>;
  if (error && !company) return <main className="company-profile-page"><section className="company-profile-state company-profile-error" role="alert"><p>{error}</p><Link to="/dashboard">Back to dashboard</Link></section></main>;

  return (
    <main className="company-profile-page">
      <header className="company-profile-header">
        <div><p className="eyebrow">Employer workspace</p><h1>{company ? "Company profile" : "Create your company profile"}</h1><p>{company ? "Keep the company details shown with your job listings accurate." : "Add the company details that candidates will see with your job listings."}</p></div>
        <Link className="company-profile-dashboard-link" to="/dashboard">Back to dashboard</Link>
      </header>

      <form className="company-profile-card" onSubmit={handleSubmit}>
        {error && <p className="company-profile-message company-profile-message--error" role="alert">{error}</p>}
        {success && <p className="company-profile-message company-profile-message--success" role="status">{success}</p>}
        <div className="company-profile-grid">
          <label>Company name<input ref={nameRef} name="name" value={form.name} onChange={handleChange} required aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? "company-name-error" : undefined} />{fieldError && <span id="company-name-error">{fieldError}</span>}</label>
          <label>Location <span>(optional)</span><input name="location" value={form.location} onChange={handleChange} placeholder="City, country" /></label>
          <label className="company-profile-full">Company website <span>(optional)</span><input name="website" type="url" value={form.website} onChange={handleChange} placeholder="https://example.com" /></label>
          <label className="company-profile-full">Logo image URL <span>(optional)</span><input name="logo" type="url" value={form.logo} onChange={handleChange} placeholder="https://example.com/logo.png" /></label>
          <label className="company-profile-full">About your company <span>(optional)</span><textarea name="description" value={form.description} onChange={handleChange} rows="7" placeholder="Describe your company, mission, and work environment." /></label>
        </div>
        <div className="company-profile-actions"><Link to="/dashboard">Cancel</Link><button type="submit" disabled={saving}>{saving ? "Saving..." : company ? "Save changes" : "Create company profile"}</button></div>
      </form>
    </main>
  );
}

export default CompanyProfile;
