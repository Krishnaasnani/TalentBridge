import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import "../../styles/AISection.css";

const tools = [
  { icon: "⌁", eyebrow: "Resume Intelligence", title: "Make your resume work harder", description: "Review focused feedback, extracted skills, strengths, and practical improvements.", to: "/resume-analyzer", action: "Analyze my resume" },
  { icon: "↗", eyebrow: "Career Match", title: "See where you fit", description: "Compare your resume to a role and understand compatibility before you apply.", to: "/job-match", action: "Match a role" },
  { icon: "◌", eyebrow: "Interview Preparation", title: "Practice with purpose", description: "Prepare for technical, behavioral, and HR conversations, then revisit your history.", to: "/interview", action: "Start interview practice" },
  { icon: "✦", eyebrow: "Career Discovery", title: "Find relevant opportunities", description: "Explore recommendations tailored to the experience and skills in your profile.", to: "/job-recommendations", action: "View recommendations" },
];

export default function AISection() {
  const user = useSelector((state) => state.auth.user);
  const canUseTools = user?.role === "candidate";

  return (
    <section className="ai-tools-panel" aria-labelledby="ai-tools-title">
      <div className="ai-tools-inner">
        <div className="ai-tools-intro">
          <p className="section-eyebrow">TalentBridge career tools</p>
          <h2 id="ai-tools-title">Your Career Growth Studio</h2>
          <p>Everything you need to understand your strengths, prepare for opportunities and move your career forward.</p>
          {canUseTools ? <Link className="ai-tools-profile-link" to="/profile">Keep your profile current <span aria-hidden="true">→</span></Link> : <Link className="ai-tools-profile-link" to="/login">Log in to unlock your studio <span aria-hidden="true">→</span></Link>}
        </div>
        <div className="ai-tool-list">
          {tools.map(({ icon, eyebrow, title, description, to, action }) => (
            <article className="ai-tool-card" key={title}>
              <span className="ai-tool-icon" aria-hidden="true">{icon}</span>
              <div><p className="ai-tool-eyebrow">{eyebrow}</p><h3>{title}</h3><p>{description}</p><Link to={canUseTools ? to : "/login"}>{canUseTools ? action : "Log in to explore"}<span aria-hidden="true"> →</span></Link></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
