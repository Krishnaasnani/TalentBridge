import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { loginSuccess } from "../../redux/authSlice";
import { loginUser } from "../../services/authService";
import "../../styles/Register.css";

export default function Login() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    // Remove error when user starts correcting the form
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const data = await loginUser(formData);

      dispatch(loginSuccess(data));
      // The public homepage adapts its navigation to the authenticated role.
      // Replacing the login entry keeps Back from restoring a completed login form.
      navigate("/", { replace: true });
    } catch (error) {
      setError(error.response?.data?.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="register-page">
      <section className="register-container" aria-labelledby="login-title">
        <Link className="register-brand" to="/">TalentBridge</Link>
        <div className="register-card">
          <header className="register-header">
            <h1 id="login-title">Welcome back</h1>
            <p>Log in to continue your job search.</p>
          </header>
          <form className="register-form" onSubmit={handleSubmit}>
            {error && <p className="register-message register-error" role="alert">{error}</p>}
            <label className="register-field">
              <span>Email</span>
              <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter your email"
            required
              />
            </label>
            <label className="register-field">
              <span>Password</span>
              <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your password"
            required
              />
            </label>
            <button className="register-submit" type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
          <p className="register-login-prompt">New to TalentBridge? <Link to="/register">Create an account</Link></p>
        </div>
      </section>
    </main>
  );
}
