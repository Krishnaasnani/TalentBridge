const normalizeSkill = (value) => String(value || "")
  .trim()
  .replace(/\s+/g, " ")
  .toLowerCase();

const uniqueSkills = (skills = []) => [...new Set(
  (Array.isArray(skills) ? skills : [])
    .map(normalizeSkill)
    .filter((skill) => skill.length > 1),
)];

const skillOccursIn = (skill, text) => {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Non-alphanumeric boundaries prevent a skill such as "java" matching "javascript".
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(text);
};

export const scoreJobForSkills = (skills, job) => {
  const candidateSkills = uniqueSkills(skills);
  if (!candidateSkills.length) return { score: 0, matchedSkills: [], reasons: [] };

  const title = String(job.title || "");
  const requirements = (Array.isArray(job.requirements) ? job.requirements : []).join(" ");
  const description = String(job.description || "");
  const jobText = `${title} ${requirements} ${description}`.replace(/\s+/g, " ");
  const matchedSkills = candidateSkills.filter((skill) => skillOccursIn(skill, jobText));
  const score = Math.round((matchedSkills.length / candidateSkills.length) * 100);
  const reasons = matchedSkills.slice(0, 3).map((skill) => {
    const source = skillOccursIn(skill, title) ? "job title" : skillOccursIn(skill, requirements) ? "requirements" : "description";
    return `${skill} appears in the job ${source}`;
  });

  return { score, matchedSkills, reasons };
};

export { normalizeSkill, uniqueSkills };
