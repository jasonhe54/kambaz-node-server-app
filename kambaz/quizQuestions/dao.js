import { v4 as uuidv4 } from "uuid";
import model from "./model.js";

export default function QuizQuestionsDao() {
  const findQuestionById = (questionId) => model.findById(questionId);

  const findQuestionsForQuiz = (quizId) => model.find({ quiz: quizId }).sort({ createdAt: 1 });

  const findQuestionsByIds = async (questionIds) => {
    if (!questionIds.length) return [];
    return model.find({ _id: { $in: questionIds } });
  };

  const createQuestion = (question) =>
    model.create({
      ...question,
      _id: question._id || uuidv4(),
    });

  const updateQuestion = (questionId, questionUpdates) =>
    model.findByIdAndUpdate(questionId, { $set: questionUpdates }, { new: true });

  const deleteQuestion = (questionId) => model.deleteOne({ _id: questionId });

  const deleteQuestionsForQuiz = (quizId) => model.deleteMany({ quiz: quizId });

  return {
    findQuestionById,
    findQuestionsForQuiz,
    findQuestionsByIds,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    deleteQuestionsForQuiz,
  };
}
