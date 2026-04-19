// quiz aggregate/projection helpers.
// file contains methods for points/questionCount/order logic changes.
// also used for attaching per-user score fields to response payloads (createAttachCurrentUserAttemptScores)

// Normalize quizzes for API responses:
// - convert Mongoose documents into plain objects when needed
// - remove user-derived fields (lastAttemptScore) from the base quiz shape
//     so route handlers can explicitly attach current-user scores without stale/duplicate data.
export const toPlainQuiz = (quiz) => {
  const plain = typeof quiz?.toObject === "function" ? quiz.toObject() : quiz; // mongoose document to plain object conversion
  if (!plain) return plain;
  const { lastAttemptScore, ...quizWithoutUserScore } = plain;
  return quizWithoutUserScore;
};

export const normalizeQuestionIds = (questionIds) =>
  Array.isArray(questionIds)
    ? questionIds
        .map((questionId) => `${questionId}`.trim())
        .filter((questionId) => questionId.length > 0)
    : [];

export const calculateTotalPoints = (questions) =>
  questions.reduce((total, question) => {
    const points = Number(question?.points ?? 0);
    return total + (Number.isFinite(points) ? points : 0);
  }, 0);

export const createGetOrderedQuestionsForQuiz = (questionsDao) =>
  async function getOrderedQuestionsForQuiz(quiz) {
    const questionIds = normalizeQuestionIds(quiz?.questionIds);
    if (questionIds.length) {
      const questions = await questionsDao.findQuestionsByIds(questionIds);
      const byId = new Map(questions.map((question) => [`${question._id}`, question]));
      return questionIds.map((questionId) => byId.get(questionId)).filter(Boolean);
    }

    return questionsDao.findQuestionsForQuiz(`${quiz._id}`);
  };

export const createSyncQuizDerivedFields = ({
  dao,
  questionsDao,
  getOrderedQuestionsForQuiz,
}) =>
  async function syncQuizDerivedFields(quiz) {
    if (!quiz) return null;

    const currentPoints = Number(quiz.points ?? 0);
    const currentQuestionCount = Number(quiz.questionCount ?? 0);
    const questionIds = normalizeQuestionIds(quiz.questionIds);

    if (!questionIds.length) {
      const fallbackQuestions = await questionsDao.findQuestionsForQuiz(`${quiz._id}`);
      if (!fallbackQuestions.length) {
        return quiz;
      }

      const nextQuestionIds = fallbackQuestions.map((question) => `${question._id}`);
      const nextPoints = calculateTotalPoints(fallbackQuestions);
      const nextQuestionCount = fallbackQuestions.length;

      const needsUpdate =
        nextQuestionCount !== currentQuestionCount || nextPoints !== currentPoints;

      if (!needsUpdate) {
        return quiz;
      }

      return dao.updateQuiz(`${quiz._id}`, {
        questionIds: nextQuestionIds,
        questionCount: nextQuestionCount,
        points: nextPoints,
      });
    }

    const orderedQuestions = await getOrderedQuestionsForQuiz(quiz);
    const nextQuestionIds = orderedQuestions.map((question) => `${question._id}`);
    const nextPoints = calculateTotalPoints(orderedQuestions);
    const nextQuestionCount = orderedQuestions.length;

    const idsChanged = nextQuestionIds.length !== questionIds.length;
    const totalsChanged =
      nextQuestionCount !== currentQuestionCount || nextPoints !== currentPoints;

    if (!idsChanged && !totalsChanged) {
      return quiz;
    }

    return dao.updateQuiz(`${quiz._id}`, {
      questionIds: nextQuestionIds,
      questionCount: nextQuestionCount,
      points: nextPoints,
    });
  };

export const createAttachCurrentUserAttemptScores = (attemptsDao) =>
  async function attachCurrentUserAttemptScores(quizzes, currentUserId) {
    const plainQuizzes = quizzes.map(toPlainQuiz);
    if (!plainQuizzes.length) return plainQuizzes;

    const quizIds = plainQuizzes.map((quiz) => quiz._id);
    const latestAttempts = await attemptsDao.findLatestAttemptsForUserByQuizIds(
      currentUserId,
      quizIds
    );

    const scoreByQuizId = new Map(
      latestAttempts.map((attempt) => [`${attempt.quiz}`, attempt.score])
    );

    return plainQuizzes.map((quiz) => ({
      ...quiz,
      lastAttemptScore: scoreByQuizId.has(`${quiz._id}`)
        ? scoreByQuizId.get(`${quiz._id}`)
        : null,
    }));
  };
