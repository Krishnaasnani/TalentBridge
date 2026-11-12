import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      trim: true,
      required: true,
    },
    category: {
      type: String,
      trim: true,
      required: true,
    },
    difficulty: {
      type: String,
      required: true,
      enum: ["Easy", "Medium", "Hard"],
    },
    answer: {
      type: String,
      trim: true,
      default: "",
      maxlength: 10_000,
    },
    evaluation: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { _id: false },
);

const interviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    contextType: {
      type: String,
      enum: ["role", "job_description"],
      required: true,
      default: "role",
    },
    role: {
      type: String,
      required() {
        return this.contextType === "role";
      },
      trim: true,
      default: "",
      maxlength: 120,
    },
    jobDescription: {
      type: String,
      trim: true,
      default: "",
      maxlength: 10_000,
    },
    interviewType: {
      type: String,
      required: true,
      enum: ["Technical Interview", "HR Interview", "Behavioral Interview"],
    },
    difficulty: {
      type: String,
      required: true,
      enum: ["Beginner", "Intermediate", "Advanced", "Adaptive"],
      default: "Intermediate",
    },
    questionCount: {
      type: Number,
      required: true,
      enum: [5, 10, 15, 20],
      default: 10,
    },
    questions: {
      type: [questionSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    feedback: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true },
);

const Interview = mongoose.model("Interview", interviewSchema);

export default Interview;
