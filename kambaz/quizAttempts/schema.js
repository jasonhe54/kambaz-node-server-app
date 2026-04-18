import mongoose from "mongoose";

const quizAttemptSchema = new mongoose.Schema(
  {
    _id: String,
    quiz: { type: String, ref: "QuizModel", required: true, index: true },
    course: { type: String, ref: "CourseModel", required: true, index: true },
    user: { type: String, ref: "UserModel", required: true, index: true },
    score: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: Date.now, index: true },
  },
  { collection: "quizAttempts" }
);

export default quizAttemptSchema;
