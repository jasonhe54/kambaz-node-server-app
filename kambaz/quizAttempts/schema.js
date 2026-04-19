import mongoose from "mongoose";

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const resultSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
    pointsEarned: { type: Number, default: 0 },
  },
  { _id: false }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    _id: String,
    quiz: { type: String, ref: "QuizModel", required: true, index: true },
    course: { type: String, ref: "CourseModel", required: true, index: true },
    user: { type: String, ref: "UserModel", required: true, index: true },
    attemptNumber: { type: Number, default: 1 },
    answers: { type: [answerSchema], default: [] },
    results: { type: [resultSchema], default: [] },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: Date.now, index: true },
  },
  { collection: "quizAttempts" }
);

export default quizAttemptSchema;
