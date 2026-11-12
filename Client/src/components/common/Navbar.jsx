import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { logout } from "../../redux/authSlice";
import "../../styles/Navbar.css";

const candidateAiTools = [["Resume Analyzer", "/resume-analyzer"], ["Job Match", "/job-match"], ["Recommendations", "/job-recommendations"], ["AI Interview", "/interview"], ["Interview History", "/interview/history"]];
const navigationByRole = {
  public: [["Home", "/"], ["Jobs", "/jobs"]],
  candidate: [["Dashboard", "/dashboard"], ["Jobs", "/jobs"], ["Applications", "/applications"], ["Profile", "/profile"]],
  employer: [["Dashboard", "/dashboard"], ["Company", "/company-profile"], ["Post Job", "/jobs/create"]],
  admin: [["Dashboard", "/admin/dashboard"], ["Users", "/admin/users"], ["Jobs", "/admin/jobs"], ["Applications", "/admin/applications"]],
};

export default function Navbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aiToolsOpen, setAiToolsOpen] = useState(false);
  const navRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);
  const aiToolsButtonRef = useRef(null);
  const role = user?.role && navigationByRole[user.role] ? user.role : "public";
  const navItems = navigationByRole[role];
  const closeMenus = () => { setMobileOpen(false); setAiToolsOpen(false); };

  useEffect(() => {
    const closeOnOutsidePointer = (event) => {
      if (!navRef.current?.contains(event.target)) closeMenus();
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      closeMenus();
      if (aiToolsOpen && event.target.closest(".ai-tools")) aiToolsButtonRef.current?.focus();
      else if (mobileOpen) mobileMenuButtonRef.current?.focus();
    }
  };
  const handleLogout = () => { dispatch(logout()); closeMenus(); navigate("/", { replace: true }); };
  const renderNavItem = ([label, to]) => {
    return <li key={label}><NavLink className="nav-link" to={to} onClick={closeMenus} end={to === "/"}>{label}</NavLink></li>;
  };

  return (
    <nav ref={navRef} className="navbar" aria-label="Main navigation" onKeyDown={handleKeyDown}>
      <Link className="logo" to="/" onClick={closeMenus} aria-label="TalentBridge home"><span className="brand-mark" aria-hidden="true">TB</span><span className="brand-wordmark">Talent<span>Bridge</span></span></Link>
      <button ref={mobileMenuButtonRef} className="mobile-menu-trigger" type="button" aria-expanded={mobileOpen} aria-controls="primary-navigation" aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"} onClick={() => setMobileOpen((open) => !open)}><span /></button>
      <div className={`nav-menu${mobileOpen ? " is-open" : ""}`} id="primary-navigation" aria-label="Primary navigation">
        <ul className="nav-links">
          {navItems.map(renderNavItem)}
          {role === "candidate" && <li className="ai-tools"><button ref={aiToolsButtonRef} className="ai-tools-trigger" type="button" aria-expanded={aiToolsOpen} aria-controls="candidate-ai-tools" aria-haspopup="true" onClick={() => setAiToolsOpen((open) => !open)}>Career Studio <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg></button><ul className="ai-tools-menu" id="candidate-ai-tools" hidden={!aiToolsOpen}>{candidateAiTools.map(([label, to]) => <li key={to}><NavLink to={to} onClick={closeMenus}>{label}</NavLink></li>)}</ul></li>}
        </ul>
        <div className="nav-actions">{user ? <button className="logout-btn" type="button" onClick={handleLogout}>Logout</button> : <><NavLink className="account-link" to="/login" onClick={closeMenus}>Login</NavLink><NavLink className="logout-btn" to="/register" onClick={closeMenus}>Register</NavLink></>}</div>
      </div>
    </nav>
  );
}
