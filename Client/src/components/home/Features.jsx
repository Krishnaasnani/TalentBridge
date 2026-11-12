import { Link } from "react-router-dom";
import "../../styles/Features.css";

const capabilities = [
  {
    icon: "↗",
    title: "Explore relevant roles",
    description: "Browse open roles and search by job title, skill, or company.",
    to: "/jobs",
    action: "Browse jobs",
  },
  {
    icon: "▤",
    title: "Review your resume",
    description: "Get ATS-focused feedback on your saved resume, including strengths and suggested improvements.",
    to: "/resume-analyzer",
    action: "Analyze resume",
  },
  {
    icon: "◎",
    title: "Compare a target role",
    description: "Match your resume to a job description and review matched skills and gaps.",
    to: "/job-match",
    action: "Try Job Match",
  },
  {
    icon: "◌",
    title: "Practice interviews",
    description: "Set up a role-based or job-specific AI interview and receive a performance report.",
    to: "/interview",
    action: "Start practicing",
  },
];

export default function Features() {
  return (
    <section className="home-section capabilities" id="about" aria-labelledby="capabilities-title">
      <div className="section-intro">
        <p className="section-eyebrow">One connected career ecosystem</p>
        <h2 id="capabilities-title">Everything to build your next chapter</h2>
        <p>TalentBridge brings opportunities, practical career development, and intelligent guidance together around your professional momentum.</p>
      </div>

      <div className="capability-grid">
        {capabilities.map(({ icon, title, description, to, action }) => (
          <article className="capability-card" key={title}>
            <span className="capability-icon" aria-hidden="true">{icon}</span>
            <h3>{title}</h3>
            <p>{description}</p>
            <Link to={to} className="text-link">{action}<span aria-hidden="true"> →</span></Link>
          </article>
        ))}
      </div>

      <section className="candidate-workflow" aria-labelledby="workflow-title">
        <div className="workflow-heading">
          <p className="section-eyebrow">A simple starting point</p>
          <h2 id="workflow-title">Move from profile to preparation in three steps</h2>
        </div>
        <ol className="workflow-list">
          <li><span>01</span><div><h3>Build your profile</h3><p>Add your skills and save your resume so candidate tools have the information they need.</p></div></li>
          <li><span>02</span><div><h3>Focus on a role</h3><p>Explore jobs or compare your resume with a job description you are considering.</p></div></li>
          <li><span>03</span><div><h3>Prepare with feedback</h3><p>Review resume feedback and practice interview questions for your selected context.</p></div></li>
        </ol>
      </section>
    </section>
  );
}
