export const openJobFromListing = (navigate, jobId, flush = (callback) => callback()) => {
  flush(() => navigate("/jobs", { replace: true }));
  navigate(`/jobs/${jobId}`);
};
