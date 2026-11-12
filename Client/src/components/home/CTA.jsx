import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import "../../styles/CTA.css";

export default function CTA() {
  const user = useSelector((state) => state.auth.user);
  const isCandidate = user?.role === "candidate";
  const isSignedIn = Boolean(user);

  return (
    <section className="home-cta" aria-labelledby="home-cta-title">
      <div>
        <p className="section-eyebrow">Start where you are</p>
        <h2 id="home-cta-title">{isCandidate ? "Keep your job search moving." : "Build a more prepared job search."}</h2>
        <p>{isCandidate ? "Return to your dashboard to manage your profile, applications, and career tools." : isSignedIn ? "Return to your dashboard to manage your hiring activity, or explore current roles." : "Create a candidate account to save your profile and use the candidate tools, or start by exploring current roles."}</p>
      </div>
      <div className="cta-actions">
        <Link className="cta-primary" to={isSignedIn ? "/dashboard" : "/register"}>{isSignedIn ? "Go to dashboard" : "Create an account"}</Link>
        <Link className="cta-secondary" to="/jobs">Explore jobs</Link>
      </div>
    </section>
  );
}
