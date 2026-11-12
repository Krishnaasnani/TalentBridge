import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/Hero.css";

export default function Hero() {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const handleSearch = (event) => {
    event.preventDefault();
    const term = search.trim();

    navigate(term ? `/jobs?search=${encodeURIComponent(term)}` : "/jobs");
  };

  return (
    <section className="hero" aria-labelledby="home-hero-title">
      <div className="hero-left">
        <p className="hero-eyebrow">TalentBridge · Professional ecosystem</p>
        <h1 id="home-hero-title">
          Connect your potential
          <br />
          to what’s <span>next.</span>
        </h1>

        <p>
          Connect with opportunities, build in-demand skills, and move forward with AI-guided career tools designed around your goals.
        </p>

        <form className="search-box" onSubmit={handleSearch}>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search roles, skills, or companies"
          />

          <button type="submit">Explore jobs</button>
        </form>
      </div>

      <div className="hero-right" aria-label="TalentBridge workspace preview">
        <div className="hero-preview">
          <div className="preview-topbar"><span className="preview-mark">TB</span><span>TalentBridge</span><i /></div>
          <div className="preview-body">
            <aside><span className="preview-active">Overview</span><span>My profile</span><span>AI tools</span><span>Applications</span></aside>
            <section>
              <p>Welcome back</p><h2>Your professional bridge, built around you.</h2>
              <div className="preview-metrics"><div><span>Profile</span><strong>Growing</strong></div><div><span>Career tools</span><strong>Ready</strong></div></div>
              <div className="preview-panel"><span>Career momentum</span><strong>Connect your strengths to the opportunities ahead.</strong><div><i /><i /><i /></div></div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
