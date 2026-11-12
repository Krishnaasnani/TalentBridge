import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import "../../styles/Footer.css";

export default function Footer() {
  const user = useSelector((state) => state.auth.user);
  const dashboardPath = user?.role === "admin" ? "/admin/dashboard" : "/dashboard";

  return (
    <footer className="site-footer" id="contact">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">Talent<span>Bridge</span></Link>
          <p>Connect, learn, grow, and succeed with opportunities and career intelligence in one place.</p>
        </div>
        <nav aria-label="Explore TalentBridge">
          <h2>Explore</h2>
          <Link to="/jobs">Browse jobs</Link>
          <Link to="/resume-analyzer">Resume Analyzer</Link>
          <Link to="/job-match">Job Match</Link>
        </nav>
        <nav aria-label="Account links">
          <h2>Account</h2>
          {user ? <Link to={dashboardPath}>Dashboard</Link> : <Link to="/login">Log in</Link>}
          {user?.role === "candidate" ? <Link to="/profile">Your profile</Link> : !user && <Link to="/register">Create an account</Link>}
          <Link to="/#about">How it works</Link>
        </nav>
        <div className="footer-contact">
          <h2>Contact</h2>
          <p>Questions about getting started?</p>
          <a href="mailto:support@talentbridge.ai">Email support</a>
        </div>
      </div>
      <div className="footer-bottom"><p>© {new Date().getFullYear()} TalentBridge</p><a href="#about">About TalentBridge</a></div>
    </footer>
  );
}
