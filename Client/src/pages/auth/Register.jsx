import { useState } from "react";
import { Link } from "react-router-dom";
import { registerUser } from "../../services/authService";
import "../../styles/Register.css";

export default function Register() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "candidate",
  });

  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setIsSuccess(false);
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await registerUser({
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });

      setIsSuccess(true);
      setMessage(response.message || "Registration successful!");

      setFormData({
        fullName: "",
        email: "",
        password: "",
        confirmPassword: "",
        role: "candidate",
      });
    } catch (error) {
      setIsSuccess(false);
      setMessage(error.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="register-page">
      <section className="register-container" aria-labelledby="register-title">
        <Link className="register-brand" to="/">TalentBridge</Link>
        <div className="register-card">
          <header className="register-header">
            <h1 id="register-title">Create your account</h1>
            <p>Find opportunities and grow your career.</p>
          </header>

          <form className="register-form" onSubmit={handleSubmit}>
            {message && (
              <p className={`register-message ${isSuccess ? "register-success" : "register-error"}`} role={isSuccess ? "status" : "alert"}>
                {message}
              </p>
            )}

            <label className="register-field">
              <span>Full name</span>
              <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} autoComplete="name" required />
            </label>

            <label className="register-field">
              <span>Email</span>
              <input type="email" name="email" value={formData.email} onChange={handleChange} autoComplete="email" required />
            </label>

            <label className="register-field">
              <span>Password</span>
              <input type="password" name="password" value={formData.password} onChange={handleChange} autoComplete="new-password" required />
            </label>

            <label className="register-field">
              <span>Confirm password</span>
              <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} autoComplete="new-password" required />
            </label>

            <label className="register-field">
              <span>Role</span>
              <select name="role" value={formData.role} onChange={handleChange}>
                <option value="candidate">Candidate</option>
                <option value="employer">Employer</option>
              </select>
            </label>

            <button className="register-submit" type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="register-login-prompt">Already have an account? <Link to="/login">Login</Link></p>
        </div>
      </section>
    </main>
  );
}
