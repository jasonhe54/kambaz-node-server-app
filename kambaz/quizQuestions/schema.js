import mongoose from "mongoose";

const choiceSchema = new mongoose.Schema(
  {
    _id: String,
    text: { type: String, default: "" },
  },
  { _id: false }
);

const quizQuestionSchema = new mongoose.Schema(
  {
    _id: String,
    quiz: { type: String, ref: "QuizModel", required: true, index: true },
    course: { type: String, ref: "CourseModel", required: true, index: true },
    type: {
      type: String,
      enum: ["MULTIPLE_CHOICE", "TRUE_FALSE", "FILL_IN_THE_BLANK"],
      default: "MULTIPLE_CHOICE",
    },
    title: { type: String, default: "Untitled Question" },
    points: { type: Number, default: 0 },
    questionText: { type: String, default: "" },
    choices: { type: [choiceSchema], default: [] },
    correctChoiceId: { type: String, default: "" },
    trueFalseAnswer: { type: Boolean, default: true },
    blankAnswers: { type: [String], default: [] },
  },
  { collection: "quizQuestions", timestamps: true }
);

export default quizQuestionSchema;
