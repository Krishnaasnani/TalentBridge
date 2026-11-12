import { Link } from "react-router-dom";
import "../styles/NotFound.css";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <section className="not-found-card" aria-labelledby="not-found-title">
        <p className="not-found-code">404</p>
        <h1 id="not-found-title">That page could not be found</h1>
        <p>The link may be outdated, or the page may have moved.</p>
        <div className="not-found-actions">
          <Link to="/">Back to Home</Link>
          <Link to="/jobs" className="not-found-secondary">Browse Jobs</Link>
        </div>
      </section>
    </main>
  );
}
