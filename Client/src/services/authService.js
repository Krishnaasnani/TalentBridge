import api from "./api";

export const registerUser = async (userData) => {
  const response = await api.post("/auth/register", userData);
  return response.data;
};

export const loginUser = async (userData) => {
  const response = await api.post("/auth/login", userData);
  return response.data;
};

export const getProfile = async () => {
  const response = await api.get("/user/profile");
  return response.data;
};

export const updateProfile = async (profileData) => {
  const response = await api.put("/user/profile", profileData);
  return response.data;
};

export const getMyResume = async () => {
  const response = await api.get("/user/resume", { responseType: "blob" });
  return response.data;
};

export const getMyApplications = async () => {
  const response = await api.get("/application/my-applications");
  return response.data;
};

export const getJobs = async (params) => {
  const response = await api.get("/jobs", { params });
  return response.data;
};

export const getJobById = async (jobId) => {
  const response = await api.get(`/jobs/${jobId}`);
  return response.data;
};

export const createJob = async (jobData) => {
  const response = await api.post("/jobs", jobData);
  return response.data;
};

export const updateJob = async (jobId, jobData) => {
  const response = await api.put(`/jobs/${jobId}`, jobData);
  return response.data;
};

export const getMyJobs = async () => {
  const response = await api.get("/jobs/mine");
  return response.data;
};

export const deleteJob = async (jobId) => {
  const response = await api.delete(`/jobs/${jobId}`);
  return response.data;
};

export const getMyCompany = async () => {
  const response = await api.get("/company/my-company");
  return response.data;
};

export const createCompany = async (companyData) => {
  const response = await api.post("/company", companyData);
  return response.data;
};

export const updateCompany = async (companyId, companyData) => {
  const response = await api.put(`/company/update/${companyId}`, companyData);
  return response.data;
};

export const getJobRecommendations = async () => {
  const response = await api.get("/jobs/recommendations");
  return response.data;
};

export const applyToJob = async (jobId) => {
  const response = await api.post(`/application/apply/${jobId}`);
  return response.data;
};

export const getJobApplicants = async (jobId, params) => {
  const response = await api.get(`/application/job/${jobId}`, { params });
  return response.data;
};

export const getApplicantResume = async (applicationId) => {
  const response = await api.get(`/application/${applicationId}/resume`, { responseType: "blob" });
  return response.data;
};

export const updateApplicationStatus = async (applicationId, status) => {
  const response = await api.patch(`/application/${applicationId}/status`, { status });
  return response.data;
};

export const getEmployerApplicationSummary = async () => {
  const response = await api.get("/application/employer-summary");
  return response.data;
};

export const getAdminStats = async () => {
  const response = await api.get("/admin/stats");
  return response.data;
};

export const getAdminUsers = async (params) => {
  const response = await api.get("/admin/users", { params });
  return response.data;
};

export const deleteAdminUser = async (userId) => {
  const response = await api.delete(`/admin/users/${userId}`);
  return response.data;
};

export const getAdminJobs = async (params) => {
  const response = await api.get("/admin/jobs", { params });
  return response.data;
};

export const moderateAdminJob = async (jobId, moderation) => {
  const response = await api.patch(`/admin/jobs/${jobId}/moderation`, moderation);
  return response.data;
};

export const getAdminApplications = async (params) => {
  const response = await api.get("/admin/applications", { params });
  return response.data;
};

export const getAdminApplicationById = async (applicationId) => {
  const response = await api.get(`/admin/applications/${applicationId}`);
  return response.data;
};

export const analyzeResume = async () => {
  const response = await api.post("/resume/analyze");
  return response.data;
};

export const analyzeJobMatch = async (jobDescription) => {
  const response = await api.post("/resume/job-match", { jobDescription });
  return response.data;
};


export const createInterview = async (interviewData) => {
  const response = await api.post("/interview", interviewData);
  return response.data;
};

export const getMyInterviews = async () => {
  const response = await api.get("/interview/my-interviews");
  return response.data;
};

export const getInterviewById = async (interviewId) => {
  const response = await api.get(`/interview/${interviewId}`);
  return response.data;
};

export const submitInterviewAnswer = async (interviewId, questionIndex, answer) => {
  const response = await api.post(`/interview/${interviewId}/questions/${questionIndex}/answer`, { answer });
  return response.data;
};
