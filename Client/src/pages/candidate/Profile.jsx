import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import { updateUser } from "../../redux/authSlice";
import { getMyResume, getProfile, updateProfile } from "../../services/authService";
import "../../styles/Profile.css";

const emptyProfile = {
  fullName: "",
  email: "",
  phone: "",
  location: "",
  skills: "",
  bio: "",
  profileImage: "",
  resume: "",
};

const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024;
const allowedResumeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const allowedResumeExtensions = /\.(pdf|doc|docx)$/i;

const hydrateProfile = (user, currentProfile = emptyProfile) => ({
  ...currentProfile,
  fullName: user.fullName || "",
  email: user.email || "",
  phone: user.phone || "",
  location: user.location || "",
  skills: (user.skills || []).join(", "),
  bio: user.bio || "",
  profileImage: user.profileImage || "",
  resume: user.resume || "",
});

function Profile() {
  const dispatch = useDispatch();
  const [profile, setProfile] = useState(emptyProfile);
  const [resumeFile, setResumeFile] = useState(null);
  const [selectedResumePreviewUrl, setSelectedResumePreviewUrl] = useState("");
  const [openingSavedResume, setOpeningSavedResume] = useState(false);
  const resumeInputRef = useRef(null);
  const selectedResumePreviewUrlRef = useRef("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await getProfile();
        if (!data.user) {
          throw new Error("The server did not return a profile.");
        }
        setProfile((currentProfile) => hydrateProfile(data.user, currentProfile));
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to load your profile.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => () => {
    if (selectedResumePreviewUrlRef.current) {
      URL.revokeObjectURL(selectedResumePreviewUrlRef.current);
    }
  }, []);

  const clearSelectedResumePreview = () => {
    if (selectedResumePreviewUrlRef.current) {
      URL.revokeObjectURL(selectedResumePreviewUrlRef.current);
      selectedResumePreviewUrlRef.current = "";
    }
    setSelectedResumePreviewUrl("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setProfile((currentProfile) => ({ ...currentProfile, [name]: value }));
    setError("");
    setSuccess("");
  };

  const handleResumeChange = (event) => {
    const file = event.target.files?.[0] || null;
    setError("");
    setSuccess("");
    clearSelectedResumePreview();

    if (!file) {
      setResumeFile(null);
      return;
    }

    if (!allowedResumeExtensions.test(file.name) || !allowedResumeTypes.has(file.type)) {
      setResumeFile(null);
      event.target.value = "";
      setError("Only PDF, DOC, and DOCX resume files are allowed.");
      return;
    }

    if (file.size > MAX_RESUME_SIZE_BYTES) {
      setResumeFile(null);
      event.target.value = "";
      setError("Resume must be 10 MB or smaller.");
      return;
    }

    setResumeFile(file);
    if (file.type === "application/pdf") {
      const objectUrl = URL.createObjectURL(file);
      selectedResumePreviewUrlRef.current = objectUrl;
      setSelectedResumePreviewUrl(objectUrl);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const skills = profile.skills
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean);

    try {
      let data;
      if (resumeFile) {
        const formData = new FormData();
        formData.append("fullName", profile.fullName);
        formData.append("phone", profile.phone);
        formData.append("location", profile.location);
        formData.append("bio", profile.bio);
        formData.append("profileImage", profile.profileImage);
        formData.append("skills", JSON.stringify(skills));
        formData.append("resume", resumeFile);
        data = await updateProfile(formData);
      } else {
        data = await updateProfile({
          fullName: profile.fullName,
          phone: profile.phone,
          location: profile.location,
          bio: profile.bio,
          profileImage: profile.profileImage,
          skills,
        });
      }

      if (!data.user) {
        throw new Error("The server did not return the updated profile.");
      }

      dispatch(updateUser(data.user));
      setProfile((currentProfile) => hydrateProfile(data.user, currentProfile));
      const resumeWasUploaded = Boolean(resumeFile);
      setResumeFile(null);
      clearSelectedResumePreview();
      if (resumeInputRef.current) resumeInputRef.current.value = "";
      setSuccess(
        resumeWasUploaded
          ? "Form submitted successfully. Resume uploaded successfully."
          : "Form submitted successfully",
      );
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const openSavedResume = async (event) => {
    event.preventDefault();
    if (openingSavedResume) return;

    const resumeWindow = window.open("", "_blank");
    if (!resumeWindow) {
      setError("Allow pop-ups to open your resume.");
      return;
    }
    resumeWindow.opener = null;

    setOpeningSavedResume(true);
    setError("");
    try {
      const resume = await getMyResume();
      const resumeUrl = URL.createObjectURL(resume);
      resumeWindow.location.href = resumeUrl;
      window.setTimeout(() => URL.revokeObjectURL(resumeUrl), 60_000);
    } catch {
      resumeWindow.close();
      setError("Unable to open your resume.");
    } finally {
      setOpeningSavedResume(false);
    }
  };

  if (loading) {
    return <main className="profile-page"><p>Loading your profile...</p></main>;
  }

  return (
    <main className="profile-page">
      <div className="profile-heading">
        <div>
          <p className="eyebrow">Candidate profile</p>
          <h1>Build a profile that stands out.</h1>
          <p>Keep your contact details, skills, and career story up to date.</p>
        </div>
        <Link className="profile-dashboard-link" to="/dashboard">View dashboard</Link>
      </div>

      <form className="profile-card" onSubmit={handleSubmit}>
        {error && <p className="profile-form-message profile-form-message--error" role="alert">{error}</p>}
        {success && <p className="profile-form-message profile-form-message--success" role="status">{success}</p>}

        <div className="profile-avatar-row">
          {profile.profileImage ? (
            <img src={profile.profileImage} alt="Profile" className="profile-avatar" />
          ) : (
            <div className="profile-avatar placeholder-avatar" aria-hidden="true">
              {profile.fullName.charAt(0).toUpperCase() || "U"}
            </div>
          )}
          <div>
            <h2>Personal details</h2>
            <p>Your email and account role are managed securely and cannot be edited here.</p>
          </div>
        </div>

        <div className="profile-form-grid">
          <label>
            Full name
            <input name="fullName" value={profile.fullName} onChange={handleChange} required />
          </label>
          <label>
            Email
            <input value={profile.email} readOnly aria-readonly="true" />
          </label>
          <label>
            Phone
            <input name="phone" value={profile.phone} onChange={handleChange} placeholder="Your phone number" />
          </label>
          <label>
            Location
            <input name="location" value={profile.location} onChange={handleChange} placeholder="City, country" />
          </label>
          <label className="full-width">
            Profile image URL
            <input name="profileImage" type="url" value={profile.profileImage} onChange={handleChange} placeholder="https://..." />
          </label>
          <label className="full-width">
            Skills
            <input name="skills" value={profile.skills} onChange={handleChange} placeholder="React, Node.js, MongoDB" />
            <span>Separate skills with commas.</span>
          </label>
          <label className="full-width">
            Bio
            <textarea name="bio" value={profile.bio} onChange={handleChange} rows="5" placeholder="Tell employers about your experience and goals." />
          </label>
          <label className="full-width">
            Resume
            <input ref={resumeInputRef} type="file" accept=".pdf,.doc,.docx" onChange={handleResumeChange} />
            <span>{resumeFile ? `Selected: ${resumeFile.name}` : "PDF, DOC, or DOCX. Maximum size: 10 MB."}</span>
            {selectedResumePreviewUrl && <a className="profile-resume-link" href={selectedResumePreviewUrl} target="_blank" rel="noreferrer">Preview Selected Resume</a>}
            {profile.resume && <a className="profile-resume-link" href="#saved-resume" onClick={openSavedResume} aria-disabled={openingSavedResume}>{openingSavedResume ? "Opening Resume..." : "View Resume"}</a>}
          </label>
        </div>

        <button className="profile-save-button" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save profile"}
        </button>
      </form>
    </main>
  );
}

export default Profile;
