import { v4 as uuidv4 } from "uuid";
import model from "./model.js";

export default function QuizzesDao() {
  function findQuizById(quizId) {
    return model.findById(quizId);
  }

  function findQuizzesForCourse(courseId) {
    return model.find({ course: courseId });
  }

  function createQuiz(quiz) {
    return model.create({ ...quiz, _id: uuidv4() });
  }

  function updateQuiz(quizId, quizUpdates) {
    return model.findByIdAndUpdate(quizId, { $set: quizUpdates }, { new: true });
  }

  function deleteQuiz(quizId) {
    return model.deleteOne({ _id: quizId });
  }

  async function seedQuizzes(initialQuizzes) {
    if (!initialQuizzes.length) return;

    await model.bulkWrite(
      initialQuizzes.map((quiz) => ({
        updateOne: {
          filter: { _id: quiz._id },
          update: { $setOnInsert: quiz },
          upsert: true,
        },
      }))
    );
  }

  return {
    findQuizById,
    findQuizzesForCourse,
    createQuiz,
    updateQuiz,
    deleteQuiz,
    seedQuizzes,
  };
}
