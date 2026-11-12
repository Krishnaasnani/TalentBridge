import asyncio
import io
import os
import secrets
import tempfile
import traceback
from pathlib import Path
from typing import Literal

import textract
from docx import Document
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, Header, UploadFile
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from pypdf import PdfReader

load_dotenv()

app = FastAPI(title="TalentBridge AI Career Tools")

MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024
ALLOWED_RESUME_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
}


async def require_service_key(x_ai_service_key: str | None = Header(default=None)) -> None:
    expected_key = os.getenv("AI_SERVICE_API_KEY")
    if not expected_key:
        raise HTTPException(status_code=503, detail="AI service is not configured.")
    if not x_ai_service_key or not secrets.compare_digest(x_ai_service_key, expected_key):
        raise HTTPException(status_code=403, detail="AI service access denied.")


async def read_resume(upload: UploadFile) -> tuple[bytes, str]:
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix not in {".pdf", ".doc", ".docx"} or upload.content_type not in ALLOWED_RESUME_MIME_TYPES:
        raise HTTPException(status_code=415, detail="The uploaded resume format is not supported for analysis.")

    chunks: list[bytes] = []
    total = 0
    while chunk := await upload.read(1024 * 1024):
        total += len(chunk)
        if total > MAX_RESUME_SIZE_BYTES:
            raise HTTPException(status_code=413, detail="Resume must be 10 MB or smaller.")
        chunks.append(chunk)
    return b"".join(chunks), suffix


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


class ResumeAnalysisResponse(BaseModel):
    overallScore: int = Field(ge=0, le=100)
    extractedSkills: list[str]
    strengths: list[str]
    weaknesses: list[str]
    suggestions: list[str]
    atsBreakdown: "AtsBreakdown"
    atsHighlights: list[str]


class AtsBreakdown(BaseModel):
    formatting: int = Field(ge=0, le=100)
    contactInformation: int = Field(ge=0, le=100)
    professionalSummary: int = Field(ge=0, le=100)
    skills: int = Field(ge=0, le=100)
    experience: int = Field(ge=0, le=100)
    projects: int = Field(ge=0, le=100)
    education: int = Field(ge=0, le=100)
    linksAndKeywords: int = Field(ge=0, le=100)


class RequirementMatch(BaseModel):
    requirement: str
    category: str
    importance: str
    status: str
    resumeEvidence: list[str]
    explanation: str


class RequirementSet(BaseModel):
    title: str = ""
    requiredSkills: list[str] = []
    preferredSkills: list[str] = []
    requiredTools: list[str] = []
    preferredTools: list[str] = []
    experience: str | None = None
    education: str | None = None
    responsibilities: list[str] = []
    domainKeywords: list[str] = []
    softSkills: list[str] = []
    certifications: list[str] = []
    otherRequirements: list[str] = []


class ScoreBreakdown(BaseModel):
    requiredSkills: int | None = Field(default=None, ge=0, le=100)
    preferredSkills: int | None = Field(default=None, ge=0, le=100)
    experience: int | None = Field(default=None, ge=0, le=100)
    responsibilities: int | None = Field(default=None, ge=0, le=100)
    education: int | None = Field(default=None, ge=0, le=100)
    tools: int | None = Field(default=None, ge=0, le=100)
    domainKeywords: int | None = Field(default=None, ge=0, le=100)
    roleAlignment: int | None = Field(default=None, ge=0, le=100)
    requirementCoverage: int | None = Field(default=None, ge=0, le=100)


class Improvement(BaseModel):
    priority: str
    requirement: str
    currentEvidence: str
    recommendedAction: str
    reason: str


class ResumeImprovement(BaseModel):
    priority: str
    currentEvidence: str
    recommendedChange: str
    reason: str


class JobMatchResponse(BaseModel):
    overallMatchScore: int = Field(ge=0, le=100)
    scoreBreakdown: ScoreBreakdown
    jobRequirements: RequirementSet
    matchedRequirements: list[RequirementMatch]
    partialMatches: list[RequirementMatch]
    missingRequirements: list[RequirementMatch]
    experienceFit: RequirementMatch | None = None
    educationFit: RequirementMatch | None = None
    responsibilityMatches: list[RequirementMatch]
    resumeStrengths: list[str]
    gaps: list[str]
    improvements: list[Improvement]
    resumeImprovements: list[ResumeImprovement]


class InterviewGenerationRequest(BaseModel):
    contextType: Literal["role", "job_description"]
    role: str = ""
    jobDescription: str = ""
    interviewType: Literal["Technical Interview", "HR Interview", "Behavioral Interview"]
    difficulty: Literal["Beginner", "Intermediate", "Advanced", "Adaptive"]
    questionCount: Literal[5, 10, 15, 20]
    resumeText: str = Field(min_length=1, max_length=100_000)


class InterviewQuestion(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    category: str = Field(min_length=1, max_length=80)
    difficulty: Literal["Easy", "Medium", "Hard"]


class InterviewGenerationResponse(BaseModel):
    questions: list[InterviewQuestion] = Field(min_length=5, max_length=20)


class InterviewAnswerEvaluation(BaseModel):
    score: int = Field(ge=0, le=100)
    rating: Literal["Poor", "Fair", "Good", "Strong", "Excellent"]
    strengths: list[str] = Field(max_length=5)
    weaknesses: list[str] = Field(max_length=5)
    feedback: str = Field(min_length=1, max_length=1_000)
    improvement: str = Field(min_length=1, max_length=1_000)


def match_score(matches: list[RequirementMatch], categories: set[str]) -> int | None:
    aliases = {
        "requiredskills": "requiredskill", "preferredskills": "preferredskill",
        "requiredtools": "requiredtool", "preferredtools": "preferredtool",
        "responsibilities": "responsibility", "domainkeywords": "domainkeyword",
    }
    relevant = [item for item in matches if aliases.get(item.category.lower(), item.category.lower()) in categories]
    if not relevant:
        return None
    values = {"matched": 100, "partial": 50, "missing": 0}
    return round(sum(values.get(item.status, 0) for item in relevant) / len(relevant))


def log_requirement_classification(matches: list[RequirementMatch], label: str, categories: set[str]) -> None:
    aliases = {"requiredskills": "requiredskill", "preferredskills": "preferredskill", "requiredtools": "requiredtool", "preferredtools": "preferredtool", "responsibilities": "responsibility", "domainkeywords": "domainkeyword"}
    relevant = [item for item in matches if aliases.get(item.category.lower(), item.category.lower()) in categories]
    counts = {status: sum(item.status == status for item in relevant) for status in ("matched", "partial", "missing")}
    print(f"[Job Match] {label}: total={len(relevant)}, matched={counts['matched']}, partial={counts['partial']}, missing={counts['missing']}")
    for item in relevant:
        print(f"[Job Match] {label} classification: {item.requirement} -> {item.status}")


def calculate_scores(analysis: JobMatchResponse) -> JobMatchResponse:
    matches = analysis.matchedRequirements + analysis.partialMatches + analysis.missingRequirements
    requirements = analysis.jobRequirements
    experience_matches = matches + ([analysis.experienceFit] if analysis.experienceFit else [])

    def score_if_applicable(categories: set[str], applicable: bool, source: list[RequirementMatch] = matches) -> int | None:
        if not applicable:
            return None
        score = match_score(source, categories)
        return 0 if score is None else score

    applicability = {
        "Required Skills": bool(requirements.requiredSkills or requirements.softSkills),
        "Preferred Skills": bool(requirements.preferredSkills),
        "Experience": bool(requirements.experience),
        "Responsibilities": bool(requirements.responsibilities),
        "Education": bool(requirements.education),
        "Tools": bool(requirements.requiredTools or requirements.preferredTools),
        "Domain Keywords": bool(requirements.domainKeywords),
    }
    for category, applicable in applicability.items():
        print(f"[Job Match] Applicability: {category} -> {'applicable' if applicable else 'not_applicable'}")
    if requirements.experience:
        fit = analysis.experienceFit
        print(f"[Job Match] Experience: requirement={requirements.experience}, status={fit.status if fit else 'missing'}, evidenceCount={len(fit.resumeEvidence) if fit else 0}")
    log_requirement_classification(matches, "Required skills", {"requiredskill", "softskill"})
    log_requirement_classification(matches, "Tools", {"requiredtool", "preferredtool", "tool"})
    log_requirement_classification(matches, "Responsibilities", {"responsibility"})
    breakdown = ScoreBreakdown(
        requiredSkills=score_if_applicable({"requiredskill", "softskill"}, applicability["Required Skills"]),
        preferredSkills=score_if_applicable({"preferredskill"}, applicability["Preferred Skills"]),
        experience=score_if_applicable({"experience"}, applicability["Experience"], experience_matches),
        responsibilities=score_if_applicable({"responsibility"}, applicability["Responsibilities"]),
        education=score_if_applicable({"education"}, applicability["Education"], matches + ([analysis.educationFit] if analysis.educationFit else [])),
        tools=score_if_applicable({"requiredtool", "preferredtool", "tool"}, applicability["Tools"]),
        domainKeywords=score_if_applicable({"domainkeyword"}, applicability["Domain Keywords"]),
        roleAlignment=match_score(matches, {"rolealignment", "other"}),
        requirementCoverage=score_if_applicable({"requiredskill", "requiredtool", "experience", "education", "responsibility", "other"}, any(applicability.values()), experience_matches),
    )
    weights = {"requiredSkills": 25, "preferredSkills": 10, "experience": 15, "responsibilities": 15, "education": 10, "tools": 10, "domainKeywords": 5, "roleAlignment": 5, "requirementCoverage": 5}
    applicable = {key: weight for key, weight in weights.items() if getattr(breakdown, key) is not None}
    total_weight = sum(applicable.values())
    analysis.scoreBreakdown = breakdown
    analysis.overallMatchScore = round(sum(getattr(breakdown, key) * weight for key, weight in applicable.items()) / total_weight) if total_weight else 0
    return analysis


def is_transient_gemini_error(error: Exception) -> bool:
    status_code = getattr(error, "code", None) or getattr(error, "status_code", None)
    if status_code is not None:
        return int(status_code) >= 500
    return "503" in str(error) or "UNAVAILABLE" in str(error)


async def generate_with_retry(client, primary_model: str, contents: str, config, label: str, unavailable_message: str):
    last_error = None
    for attempt, delay in enumerate((2, 5, 10), start=1):
        try:
            print(f"[{label}] Gemini attempt {attempt} using {primary_model}")
            return client.models.generate_content(model=primary_model, contents=contents, config=config)
        except Exception as error:
            if not is_transient_gemini_error(error):
                raise
            last_error = error
            if attempt < 3:
                print(f"[{label}] Gemini 503, retrying...")
                await asyncio.sleep(delay)

    fallback_model = "gemini-3.5-flash"
    if primary_model != fallback_model:
        try:
            print(f"[{label}] Primary model unavailable, trying fallback...")
            print(f"[{label}] Using fallback {fallback_model}")
            return client.models.generate_content(model=fallback_model, contents=contents, config=config)
        except Exception as error:
            if not is_transient_gemini_error(error):
                raise
            last_error = error
    raise HTTPException(status_code=503, detail=unavailable_message) from last_error


def extract_text(content: bytes, suffix: str) -> str:
    if suffix == ".pdf":
        return "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(content)).pages)
    if suffix == ".docx":
        return "\n".join(paragraph.text for paragraph in Document(io.BytesIO(content)).paragraphs)
    if suffix == ".doc":
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name
        try:
            return textract.process(temp_path).decode("utf-8", errors="replace")
        finally:
            os.unlink(temp_path)
    raise ValueError("Unsupported resume format")


@app.post("/analyze-resume", response_model=ResumeAnalysisResponse, dependencies=[Depends(require_service_key)])
async def analyze_resume(resume: UploadFile = File(...)) -> ResumeAnalysisResponse:
    try:
        resume_content, suffix = await read_resume(resume)
        resume_text = extract_text(resume_content, suffix).strip()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Unable to extract text from the uploaded resume.")

    if not resume_text:
        raise HTTPException(status_code=400, detail="No readable text was found in the uploaded resume.")

    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        raise HTTPException(status_code=503, detail="The AI Resume Analyzer is temporarily unavailable. Please try again later.")

    try:
        client = genai.Client(api_key=gemini_api_key)
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"),
            contents=f"Analyze this resume:\n\n{resume_text}",
            config=types.GenerateContentConfig(
                system_instruction=(
                    "Analyze only the supplied resume text. Do not invent experience, education, skills, or achievements. "
                    "Return concise, actionable feedback. Score ATS compatibility only from evidence in the resume; score missing "
                    "sections appropriately. Calculate overallScore using these weights: formatting 15%, contact information 10%, "
                    "professional summary 10%, skills 15%, experience 15%, projects 15%, education 10%, links and keywords 10%."
                ),
                response_mime_type="application/json",
                response_schema=ResumeAnalysisResponse,
            ),
        )
        if not response.text:
            raise ValueError("No structured analysis returned")
        return ResumeAnalysisResponse.model_validate_json(response.text)
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=502, detail="Unable to analyze the resume. Please try again later.")


@app.post("/match-job", response_model=JobMatchResponse, dependencies=[Depends(require_service_key)])
async def match_job(
    resume_file: UploadFile = File(...),
    job_description: str = Form(...),
) -> JobMatchResponse:
    job_description = job_description.strip()
    if not job_description:
        raise HTTPException(status_code=400, detail="Please enter a job description.")
    if len(job_description) > 10_000:
        raise HTTPException(status_code=400, detail="Job description must be 10,000 characters or fewer.")

    try:
        resume_content, suffix = await read_resume(resume_file)
        resume_text = extract_text(resume_content, suffix).strip()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Unable to extract text from the uploaded resume.")
    if not resume_text:
        raise HTTPException(status_code=400, detail="No readable text was found in the uploaded resume.")

    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        raise HTTPException(status_code=503, detail="AI service is temporarily unavailable. Please try again.")

    try:
        client = genai.Client(api_key=gemini_api_key)
        contents = f"RESUME TEXT:\n{resume_text}\n\nJOB DESCRIPTION:\n{job_description}"
        config = types.GenerateContentConfig(
                system_instruction=(
                    "Compare only the supplied resume text and job description. Return JSON only, matching the schema. Extract only actual JD "
                    "requirements into jobRequirements and create a requirement record for every important requirement. Each record must use "
                    "matched, partial, or missing and quote concise evidence actually found in the resume; use 'No explicit evidence found in the "
                    "resume.' when absent. Never invent employment, projects, skills, certifications, degrees, years, achievements, metrics, or "
                    "technologies. Mark a technology matched only when it has explicit resume evidence: related technologies are not equivalents "
                    "(for example Python is not Spark, AWS is not Azure, Kubernetes is not Docker, and Java is not JavaScript). Projects may support "
                    "skills but never professional experience. Use only information extracted from the supplied resume text; never infer or fabricate "
                    "candidate facts. Degrees, coursework, CGPA, skills, and academic/personal projects are not professional experience. An internship "
                    "or employment role is experience only when explicitly identified in the resume. If the JD accepts freshers, entry-level candidates, "
                    "or 0-1 years, create experienceFit with status matched only for entry-level eligibility and explain that no professional experience "
                    "is being claimed. If the JD requires professional years and none are explicit, use missing with no invented evidence. For every JD "
                    "experience, education, and responsibility requirement, return a corresponding fit/classification; do not omit it. Improvements must be tied to a missing or partial "
                    "JD requirement, state current evidence, a truthful recommended action, and why the JD requires it. Use empty arrays/null for "
                    "requirements not mentioned by the JD. Set score fields to 0: scores are recalculated server-side from requirement statuses."
                ),
                response_mime_type="application/json",
                response_schema=JobMatchResponse,
        )
        response = await generate_with_retry(
            client,
            os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"),
            contents,
            config,
            "Job Match",
            "AI analysis is temporarily unavailable. Please try again in a moment.",
        )
        if not response.text:
            raise ValueError("No structured job match returned")
        return calculate_scores(JobMatchResponse.model_validate_json(response.text))
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=502, detail="Unable to analyze the job match. Please try again later.")


@app.post("/generate-interview", response_model=InterviewGenerationResponse, dependencies=[Depends(require_service_key)])
async def generate_interview(
    resume: UploadFile = File(...),
    contextType: str = Form(...),
    role: str = Form(""),
    jobDescription: str = Form(""),
    interviewType: str = Form(...),
    difficulty: str = Form(...),
    questionCount: int = Form(...),
) -> InterviewGenerationResponse:
    try:
        resume_content, suffix = await read_resume(resume)
        resume_text = extract_text(resume_content, suffix).strip()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Unable to extract text from the uploaded resume.")
    if not resume_text:
        raise HTTPException(status_code=400, detail="No readable text was found in the uploaded resume.")

    try:
        request = InterviewGenerationRequest(
            contextType=contextType,
            role=role.strip(),
            jobDescription=jobDescription.strip(),
            interviewType=interviewType,
            difficulty=difficulty,
            questionCount=questionCount,
            resumeText=resume_text,
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid interview setup.")

    if request.contextType == "role" and not 2 <= len(request.role) <= 120:
        raise HTTPException(status_code=400, detail="Role must be between 2 and 120 characters for a role-based interview.")
    if request.contextType == "job_description" and not 1 <= len(request.jobDescription) <= 10_000:
        raise HTTPException(status_code=400, detail="Job description must be between 1 and 10,000 characters for a job-specific interview.")

    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        raise HTTPException(status_code=503, detail="AI Interview is temporarily unavailable. Please try again later.")

    try:
        client = genai.Client(api_key=gemini_api_key)
        if request.contextType == "job_description":
            contents = (
                f"INTERVIEW MODE: JOB-SPECIFIC\n"
                f"INTERVIEW TYPE: {request.interviewType}\n"
                f"INTERVIEW DIFFICULTY: {request.difficulty}\n"
                f"REQUESTED QUESTION COUNT: {request.questionCount}\n\n"
                f"PRIMARY INTERVIEW SOURCE — JOB DESCRIPTION:\n{request.jobDescription}\n\n"
                f"CANDIDATE RESUME — use only to personalize questions and verify claimed experience:\n{request.resumeText}\n\n"
                f"OPTIONAL ROLE TITLE: {request.role or 'Not supplied; derive context only from the job description.'}"
            )
            interview_focus = (
                "This is a Job-Specific interview. Treat the job description as the primary and controlling interview source. "
                "Build the questions from its explicit responsibilities, required and preferred skills, tools, technologies, experience or seniority, "
                "domain, soft skills, and other requirements, in that order. Use the resume only to personalize wording and to determine what the candidate "
                "explicitly claims; never let common resume technologies displace JD requirements. Do not ask about a technology merely because it appears on "
                "the resume when it is unrelated to the JD. If a JD requirement is absent from the resume, ask about exposure, approach, or learning rather "
                "than asserting that the candidate has done it. For Technical Interview, focus on the JD's technical responsibilities, systems, tools, and "
                "processes. For HR Interview, ask behavioral and motivation questions tied to the JD's workplace responsibilities without becoming technical. "
                "For Behavioral Interview, create situational questions grounded in the JD's responsibilities and expectations."
            )
        else:
            contents = (
                f"INTERVIEW MODE: ROLE-BASED\n"
                f"INTERVIEW TYPE: {request.interviewType}\n"
                f"INTERVIEW DIFFICULTY: {request.difficulty}\n"
                f"REQUESTED QUESTION COUNT: {request.questionCount}\n\n"
                f"TARGET ROLE:\n{request.role}\n\n"
                f"CANDIDATE RESUME:\n{request.resumeText}"
            )
            interview_focus = "This is a Role-Based interview. Use the target role as the primary source and the resume to personalize questions."
        config = types.GenerateContentConfig(
            system_instruction=(
                f"Generate exactly {request.questionCount} concise, realistic interview questions. Never generate more or fewer. "
                f"{interview_focus} Never claim the candidate has experience, projects, skills, or technologies that are not explicitly present in the resume. "
                "Do not repeat questions, invent unrelated technologies, "
                "include answers, or include explanations. Return only the requested structured data. Questions must test "
                "understanding rather than trivia and be useful for placement preparation. Use only Easy, Medium, or Hard for "
                "difficulty and provide a clear, meaningful category for every question. For Technical Interview, make questions "
                "role-specific and mix fundamentals, practical concepts, and scenario/debugging questions. For HR Interview, focus "
                "on introduction, motivation, strengths, teamwork, adaptability, and career goals; do not ask technical questions. "
                "For Behavioral Interview, ask about real workplace situations such as teamwork, leadership, conflict, deadlines, "
                "failure, learning, communication, adaptability, and decision making; do not turn it into a technical quiz. "
                "Apply the requested interview-level difficulty to every interview type: Beginner uses accessible fundamentals, straightforward practical understanding, "
                "and simple scenarios; Intermediate uses practical implementation or workplace questions with moderate reasoning; Advanced uses deeper, complex scenarios, "
                "trade-offs, debugging, problem-solving, or senior-level depth where appropriate; Adaptive creates a balanced progression with easier early questions, "
                "intermediate middle questions, and harder later questions. Adaptive is a generation progression only; do not claim it adapts to candidate answers."
            ),
            response_mime_type="application/json",
            response_schema=InterviewGenerationResponse,
        )
        response = await generate_with_retry(
            client,
            os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"),
            contents,
            config,
            "AI Interview",
            "AI Interview is temporarily unavailable. Please try again in a moment.",
        )
        if not response.text:
            raise ValueError("No structured interview questions returned")
        result = InterviewGenerationResponse.model_validate_json(response.text)
        if len(result.questions) != request.questionCount:
            raise ValueError("Generated question count did not match the request")
        return result
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=502, detail="Unable to generate interview questions. Please try again later.")


@app.post("/evaluate-interview-answer", response_model=InterviewAnswerEvaluation, dependencies=[Depends(require_service_key)])
async def evaluate_interview_answer(
    resume: UploadFile = File(...),
    question: str = Form(...),
    answer: str = Form(...),
    contextType: str = Form(...),
    role: str = Form(""),
    jobDescription: str = Form(""),
    interviewType: str = Form(...),
    difficulty: str = Form(...),
) -> InterviewAnswerEvaluation:
    answer = answer.strip()
    question = question.strip()
    if not question or not answer:
        raise HTTPException(status_code=400, detail="Question and answer are required.")
    if len(answer) > 10_000:
        raise HTTPException(status_code=400, detail="Answer must be 10,000 characters or fewer.")
    try:
        resume_content, suffix = await read_resume(resume)
        resume_text = extract_text(resume_content, suffix).strip()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Unable to extract text from the uploaded resume.")
    if not resume_text:
        raise HTTPException(status_code=400, detail="No readable text was found in the uploaded resume.")
    try:
        request = InterviewGenerationRequest(
            contextType=contextType, role=role.strip(), jobDescription=jobDescription.strip(),
            interviewType=interviewType, difficulty=difficulty, questionCount=5, resumeText=resume_text,
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid interview evaluation setup.")
    if request.contextType == "role" and not 2 <= len(request.role) <= 120:
        raise HTTPException(status_code=400, detail="Role must be between 2 and 120 characters for a role-based interview.")
    if request.contextType == "job_description" and not 1 <= len(request.jobDescription) <= 10_000:
        raise HTTPException(status_code=400, detail="Job description must be between 1 and 10,000 characters for a job-specific interview.")
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        raise HTTPException(status_code=503, detail="Answer evaluation is temporarily unavailable. Please try again later.")
    context = f"ROLE: {request.role}" if request.contextType == "role" else f"PRIMARY JOB DESCRIPTION:\n{request.jobDescription}\nOPTIONAL ROLE: {request.role or 'Not supplied'}"
    contents = (
        f"INTERVIEW TYPE: {request.interviewType}\nINTERVIEW DIFFICULTY: {request.difficulty}\n"
        f"{context}\n\nQUESTION:\n{question}\n\nCANDIDATE ANSWER:\n{answer}\n\n"
        f"RESUME TEXT (only for truthful context; never invent experience):\n{request.resumeText}"
    )
    try:
        client = genai.Client(api_key=gemini_api_key)
        config = types.GenerateContentConfig(
            system_instruction=(
                "Evaluate only the supplied answer to the supplied interview question. Return structured feedback without claiming the candidate has "
                "experience not explicitly stated in the answer or resume. Score technical answers for correctness, depth, reasoning, and practical approach; "
                "behavioral answers for relevance, structure, ownership, examples, and communication; HR answers for relevance, communication, professionalism, "
                "self-awareness, and role alignment. Calibrate depth to the requested difficulty. For Job-Specific context, evaluate against the JD requirements. "
                "Use concise, constructive feedback. Return only the requested JSON data and no chain-of-thought or answer key."
            ),
            response_mime_type="application/json",
            response_schema=InterviewAnswerEvaluation,
        )
        response = await generate_with_retry(
            client, os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"), contents, config,
            "AI Interview Evaluation", "Answer evaluation is temporarily unavailable. Please try again in a moment.",
        )
        if not response.text:
            raise ValueError("No structured answer evaluation returned")
        return InterviewAnswerEvaluation.model_validate_json(response.text)
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=502, detail="Unable to evaluate this answer. Please try again later.")
