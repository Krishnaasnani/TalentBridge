import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate, useParams } from "react-router-dom";
import { applyToJob, getJobById, getMyApplications } from "../../services/authService";
import "../../styles/Jobs.css";

const formatDate = (date) => new Date(date).toLocaleDateString(undefined, {
  day: "numeric", month: "long", year: "numeric",
});

const formatSalary = (salary) => {
  if (typeof salary === "number" && Number.isFinite(salary)) {
    return `₹${salary.toLocaleString()}`;
  }

  return typeof salary === "string" && salary.trim() ? salary : "Salary not listed";
};

function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applicationMessage, setApplicationMessage] = useState("");

  useEffect(() => {
    const loadJob = async () => {
      try {
        const data = await getJobById(id);
        setJob(data.job);
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to load this job.");
      } finally {
        setLoading(false);
      }
    };
    loadJob();
  }, [id]);

  useEffect(() => {
    const loadApplicationState = async () => {
      if (user?.role !== "candidate") {
        setApplied(false);
        return;
      }

      try {
        const data = await getMyApplications();
        setApplied((data.applications || []).some((application) => application.job?._id === id));
      } catch {
        // The application action still surfaces any relevant backend error.
      }
    };

    loadApplicationState();
  }, [id, user?.role]);

  const handleApply = async () => {
    if (applying || applied) return;
    setApplying(true);
    setApplicationMessage("");

    try {
      await applyToJob(id);
      setApplied(true);
      setApplicationMessage("Application submitted successfully. Opening your applications...");
      // A completed submission should not be restored as an active form by Back.
      navigate("/applications", { replace: true, state: { message: "Application submitted successfully." } });
    } catch (requestError) {
      const message = requestError.response?.data?.message || "Unable to submit your application.";
      if (requestError.response?.status === 409) {
        setApplied(true);
      }
      setApplicationMessage(message);
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <main className="jobs-page"><p className="jobs-message">Loading job details...</p></main>;
  if (error) return <main className="jobs-page"><p className="jobs-message error-message" role="alert">{error}</p><Link to="/jobs">Back to jobs</Link></main>;

  return (
    <main className="jobs-page">
      <Link className="back-link" to="/jobs">← Back to jobs</Link>
      <section className="job-detail-card">
        <div className="job-detail-heading"><div><p className="company-name">{job.company?.name || "Company"}</p><h1>{job.title}</h1><p className="posted-date">Posted {formatDate(job.createdAt)}</p></div>{job.company?.logo && <img src={job.company.logo} alt={`${job.company.name} logo`} />}</div>
        <div className="job-detail-meta"><span>{job.location}</span><span>{job.jobType}</span><span>{job.experienceLevel}</span><span>{formatSalary(job.salary)}</span></div>
        <div className="job-detail-content"><section><h2>About this role</h2><p>{job.description}</p></section>{job.requirements?.length > 0 && <section><h2>Required skills</h2><div className="job-skills">{job.requirements.map((skill) => <span key={skill}>{skill}</span>)}</div></section>}{job.company?.description && <section><h2>About {job.company.name}</h2><p>{job.company.description}</p></section>}</div>
        <div className="apply-placeholder">
          <div>
            <h2>Interested in this role?</h2>
            <p>{!user ? "Sign in to submit your application." : user.role === "employer" ? "Employer accounts cannot apply to jobs." : applied ? "You have already applied for this role." : "Submit your application with your candidate profile."}</p>
            {applicationMessage && <p className={applied ? "application-success" : "application-error"} role={applied ? "status" : "alert"}>{applicationMessage}</p>}
          </div>
          {!user && <Link className="apply-login-link" to="/login">Login to apply</Link>}
          {user?.role === "candidate" && <button type="button" onClick={handleApply} disabled={applying || applied}>{applying ? "Applying..." : applied ? "Already Applied" : "Apply Now"}</button>}
          {user?.role === "employer" && <button type="button" disabled>Candidate only</button>}
        </div>
      </section>
    </main>
  );
}

export default JobDetails;
