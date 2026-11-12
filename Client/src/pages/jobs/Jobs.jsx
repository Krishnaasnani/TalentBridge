import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getJobs } from "../../services/authService";
import { openJobFromListing } from "./jobListingNavigation";
import "../../styles/Jobs.css";

const initialFilters = { search: "", location: "", jobType: "", experience: "" };

const formatDate = (date) => new Date(date).toLocaleDateString(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const formatSalary = (salary) => {
  if (typeof salary === "number" && Number.isFinite(salary)) {
    return `₹${salary.toLocaleString()}`;
  }

  return typeof salary === "string" && salary.trim() ? salary : "Salary not listed";
};

function JobsContent({ initialJobFilters, navigate, setSearchParams }) {
  const [filters, setFilters] = useState(initialJobFilters);
  const [activeFilters, setActiveFilters] = useState(initialJobFilters);
  const [jobs, setJobs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadJobs = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getJobs({ ...activeFilters, page: pagination.page, limit: 10 });
        if (active) {
          setJobs(data.jobs || []);
          setPagination((currentPagination) => ({ ...currentPagination, ...data.pagination }));
        }
      } catch (requestError) {
        if (active) setError(requestError.response?.data?.message || "Unable to load jobs right now.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadJobs();
    return () => { active = false; };
  }, [activeFilters, pagination.page]);

  const handleSubmit = (event) => {
    event.preventDefault();
    setPagination((currentPagination) => ({ ...currentPagination, page: 1 }));
    setActiveFilters(filters);
    setSearchParams(Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value.trim()),
    ));
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setActiveFilters(initialFilters);
    setPagination((currentPagination) => ({ ...currentPagination, page: 1 }));
    setSearchParams({});
  };

  return (
    <main className="jobs-page">
      <section className="jobs-hero">
        <p className="eyebrow">Find your next opportunity</p>
        <h1>Explore jobs built for your next move.</h1>
        <p>Search roles by title, company, skills, or location.</p>
      </section>

      <form className="job-filters" onSubmit={handleSubmit}>
        <label className="search-field">
          <span>Search jobs</span>
          <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="React, product designer, company..." />
        </label>
        <label><span>Location</span><input value={filters.location} onChange={(event) => setFilters({ ...filters, location: event.target.value })} placeholder="Pune, Remote..." /></label>
        <label><span>Job type</span><select value={filters.jobType} onChange={(event) => setFilters({ ...filters, jobType: event.target.value })}><option value="">All types</option><option value="Full-time">Full-time</option><option value="Part-time">Part-time</option><option value="Internship">Internship</option><option value="Remote">Remote</option></select></label>
        <label><span>Experience</span><input value={filters.experience} onChange={(event) => setFilters({ ...filters, experience: event.target.value })} placeholder="Fresher" /></label>
        <div className="filter-actions"><button type="submit">Search</button><button type="button" onClick={clearFilters}>Clear</button></div>
      </form>

      <section className="jobs-results" aria-live="polite">
        <div className="jobs-result-header"><h2>{loading ? "Searching jobs..." : `${pagination.total} jobs found`}</h2></div>
        {error && <p className="jobs-message error-message" role="alert">{error}</p>}
        {!loading && !error && jobs.length === 0 && <div className="jobs-empty"><h3>{Object.values(activeFilters).some(Boolean) ? "No matching jobs found" : "No jobs available yet"}</h3><p>Try changing your search or filters. New opportunities will appear here as they are posted.</p></div>}
        {loading && <p className="jobs-message">Loading available opportunities...</p>}
        {!loading && jobs.length > 0 && <div className="job-card-grid">{jobs.map((job) => (
          <Link className="job-card" to={`/jobs/${job._id}`} onClick={(event) => { event.preventDefault(); openJobFromListing(navigate, job._id, flushSync); }} key={job._id}>
            <div className="job-card-top"><div><p className="company-name">{job.company?.name || "Company"}</p><h3>{job.title}</h3></div>{job.company?.logo && <img src={job.company.logo} alt="" />}</div>
            <div className="job-meta"><span>{job.location}</span><span>{job.jobType}</span><span>{job.experienceLevel}</span></div>
            <p className="job-salary">{formatSalary(job.salary)}</p>
            {job.requirements?.length > 0 && <div className="job-skills">{job.requirements.slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}</div>}
            <p className="posted-date">Posted {formatDate(job.createdAt)}</p>
          </Link>
        ))}</div>}
      </section>

      {!loading && !error && pagination.totalPages > 1 && <nav className="job-pagination" aria-label="Job pages"><button disabled={pagination.page === 1} onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}>Previous</button><span>Page {pagination.page} of {pagination.totalPages}</span><button disabled={pagination.page === pagination.totalPages} onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}>Next</button></nav>}
    </main>
  );
}

function Jobs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialJobFilters = {
    search: searchParams.get("search") || "",
    location: searchParams.get("location") || "",
    jobType: searchParams.get("jobType") || "",
    experience: searchParams.get("experience") || "",
  };

  return (
    <JobsContent
      key={searchParams.toString()}
      initialJobFilters={initialJobFilters}
      navigate={navigate}
      setSearchParams={setSearchParams}
    />
  );
}

export default Jobs;
