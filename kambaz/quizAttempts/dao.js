import { v4 as uuidv4 } from "uuid";
import model from "./model.js";

export default function QuizAttemptsDao() {
  const createAttempt = (attempt) =>
    model.create({
      ...attempt,
      _id: uuidv4(),
      submittedAt: attempt.submittedAt || new Date(),
      startedAt: attempt.startedAt || new Date(),
    });

  const findAttemptsForUserAndQuiz = (userId, quizId) =>
    model.find({ user: userId, quiz: quizId }).sort({ submittedAt: -1 });

  const findLatestAttemptForUserAndQuiz = (userId, quizId) =>
    model.findOne({ user: userId, quiz: quizId }).sort({ submittedAt: -1 });

  const findLatestAttemptsForUserByQuizIds = (userId, quizIds) => {
    if (!quizIds.length) return Promise.resolve([]);
    return model.aggregate([
      { $match: { user: userId, quiz: { $in: quizIds } } },
      { $sort: { submittedAt: -1 } },
      {
        $group: {
          _id: "$quiz",
          attempt: { $first: "$$ROOT" },
        },
      },
      { $replaceRoot: { newRoot: "$attempt" } },
    ]);
  };

  async function seedAttempts(initialAttempts) {
    if (!initialAttempts.length) return;

    await model.bulkWrite(
      initialAttempts.map((attempt) => ({
        updateOne: {
          filter: { _id: attempt._id },
          update: { $setOnInsert: attempt },
          upsert: true,
        },
      }))
    );
  }

  return {
    createAttempt,
    findAttemptsForUserAndQuiz,
    findLatestAttemptForUserAndQuiz,
    findLatestAttemptsForUserByQuizIds,
    seedAttempts,
  };
}
