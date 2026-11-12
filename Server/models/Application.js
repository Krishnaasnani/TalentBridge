import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },

    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },

    statusHistory: [{
      status: {
        type: String,
        enum: ["pending", "accepted", "rejected"],
        required: true,
      },
      timestamp: {
        type: Date,
        required: true,
      },
      actor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    }],
  },
  {
    timestamps: true,
  },
);

applicationSchema.index({ applicant: 1, job: 1 }, { unique: true });

const Application = mongoose.model("Application", applicationSchema);

export default Application;
