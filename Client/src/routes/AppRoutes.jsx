import { Routes, Route } from "react-router-dom";

// Layout
import MainLayout from "../layouts/MainLayout.jsx";

// Home
import Home from "../pages/candidate/Home.jsx";

// Authentication
import Login from "../pages/auth/Login.jsx";
import Register from "../pages/auth/Register.jsx";

// Candidate
import Profile from "../pages/candidate/Profile.jsx";
import Applications from "../pages/candidate/Applications.jsx";
import ResumeAnalyzer from "../pages/candidate/ResumeAnalyzer.jsx";
import JobMatch from "../pages/candidate/JobMatch.jsx";
import JobMatchResults from "../pages/candidate/JobMatchResults.jsx";
import AIInterview from "../pages/candidate/AIInterview.jsx";
import InterviewSession from "../pages/candidate/InterviewSession.jsx";
import InterviewHistory from "../pages/candidate/InterviewHistory.jsx";
import InterviewReview from "../pages/candidate/InterviewReview.jsx";
import JobRecommendations from "../pages/candidate/JobRecommendations.jsx";

// Employer
import Dashboard from "../pages/employer/Dashboard.jsx";
import ProtectedRoute from "./ProtectedRoutes.jsx";
import Jobs from "../pages/jobs/Jobs.jsx";
import JobDetails from "../pages/jobs/JobDetails.jsx";
import PostJob from "../pages/employer/PostJob.jsx";
import EditJob from "../pages/employer/EditJob.jsx";
import Applicants from "../pages/employer/Applicants.jsx";
import CompanyProfile from "../pages/employer/CompanyProfile.jsx";
import AdminDashboard from "../pages/admin/AdminDashboard.jsx";
import AdminUsers from "../pages/admin/AdminUsers.jsx";
import AdminJobs from "../pages/admin/AdminJobs.jsx";
import AdminApplications from "../pages/admin/AdminApplications.jsx";
import NotFound from "../pages/NotFound.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Main Website Layout */}
      <Route path="/" element={<MainLayout />}>
        {/* Home */}
        <Route index element={<Home />} />

        {/* Authentication */}
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />

        {/* Public job discovery */}
        <Route path="jobs" element={<Jobs />} />
        <Route path="jobs/:id" element={<JobDetails />} />

        <Route element={<ProtectedRoute />}>
          {/* Candidate */}
          <Route element={<ProtectedRoute allowedRoles={["candidate"]} />}>
            <Route path="profile" element={<Profile />} />
            <Route path="applications" element={<Applications />} />
            <Route path="resume-analyzer" element={<ResumeAnalyzer />} />
            <Route path="job-match" element={<JobMatch />} />
            <Route path="job-match/results" element={<JobMatchResults />} />
            <Route path="job-recommendations" element={<JobRecommendations />} />
            <Route path="interview" element={<AIInterview />} />
            <Route path="interview/history" element={<InterviewHistory />} />
            <Route path="interview/:id/review" element={<InterviewReview />} />
            <Route path="interview/:id" element={<InterviewSession />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["candidate", "employer"]} />}>
            <Route path="dashboard" element={<Dashboard />} />
          </Route>

          {/* Employer */}
          <Route element={<ProtectedRoute allowedRoles={["employer"]} />}>
            <Route path="jobs/create" element={<PostJob />} />
            <Route path="jobs/:jobId/edit" element={<EditJob />} />
            <Route path="jobs/:jobId/applicants" element={<Applicants />} />
            <Route path="company-profile" element={<CompanyProfile />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="admin/dashboard" element={<AdminDashboard />} />
            <Route path="admin/users" element={<AdminUsers />} />
            <Route path="admin/jobs" element={<AdminJobs />} />
            <Route path="admin/applications" element={<AdminApplications />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
