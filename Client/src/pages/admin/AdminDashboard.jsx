import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminStats } from "../../services/authService.js";
import "../../styles/AdminDashboard.css";

const statisticCards = [
  ["Total Users", "totalUsers", "/admin/users"],
  ["Candidates", "candidates"],
  ["Employers", "employers"],
  ["Total Jobs", "totalJobs", "/admin/jobs"],
  ["Total Applications", "totalApplications", "/admin/applications"],
  ["Pending Applications", "pendingApplications"],
  ["Accepted Applications", "acceptedApplications"],
  ["Rejected Applications", "rejectedApplications"],
];

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getAdminStats();
      setStats(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load admin dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(loadStats, 0);
    return () => window.clearTimeout(timeout);
  }, [loadStats]);

  return (
    <main className="admin-dashboard-page">
        <header className="admin-dashboard-header">
          <p className="eyebrow">Administration</p>
          <h1>Admin Dashboard</h1>
          <p>Review users, jobs, and application activity across the platform.</p>
        </header>

        {loading && <section className="admin-dashboard-state" aria-live="polite">Loading admin dashboard data...</section>}

        {!loading && error && (
          <section className="admin-dashboard-state admin-dashboard-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={loadStats}>Retry</button>
          </section>
        )}

        {!loading && !error && stats && (
          <section className="admin-statistics" aria-label="Platform statistics">
            {statisticCards.map(([label, key, link]) => (
              <article key={key}>
                <span>{label}</span>
                <strong>{stats[key] ?? 0}</strong>
                {link && <Link to={link}>{key === "totalJobs" ? "View Jobs" : "View Applications"}</Link>}
              </article>
            ))}
          </section>
        )}
    </main>
  );
}

export default AdminDashboard;
