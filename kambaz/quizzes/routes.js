// quizzes route wiring only.
// this file should stay small and predictable:
// 1) build DAOs/helpers/handlers
// 2) register express routes
// if behavior changes for a specific endpoint, edit the handler module instead.
import QuizzesDao from "./dao.js";
import EnrollmentsDao from "../enrollments/dao.js";
import QuizAttemptsDao from "../quizAttempts/dao.js";
import QuizQuestionsDao from "../quizQuestions/dao.js";
import { createEnsureCourseAccess, isPrivilegedUser } from "./helpers/access.js";
import {
  createAttachCurrentUserAttemptScores,
  createGetOrderedQuestionsForQuiz,
  createSyncQuizDerivedFields,
  normalizeQuestionIds,
  toPlainQuiz,
} from "./helpers/quiz-derived-sync.js";
import {
  buildQuestionCreatePayload,
  buildQuestionUpdatePayload,
  sanitizeStringField,
} from "./helpers/question-payloads.js";
import { createGradingHelpers } from "./helpers/grading.js";
import { createQuizHandlers } from "./handlers/quiz-handlers.js";
import { createQuestionHandlers } from "./handlers/question-handlers.js";
import { createAttemptHandlers } from "./handlers/attempt-handlers.js";
import { seedVisualizationAttempts, visualizationSeed } from "./seed.js";

export default function QuizzesRoutes(app) {
  const dao = QuizzesDao();
  const enrollmentsDao = EnrollmentsDao();
  const attemptsDao = QuizAttemptsDao();
  const questionsDao = QuizQuestionsDao();

  const ensureCourseAccess = createEnsureCourseAccess(enrollmentsDao);
  const getOrderedQuestionsForQuiz = createGetOrderedQuestionsForQuiz(questionsDao);
  const syncQuizDerivedFields = createSyncQuizDerivedFields({
    dao,
    questionsDao,
    getOrderedQuestionsForQuiz,
  });
  const attachCurrentUserAttemptScores =
    createAttachCurrentUserAttemptScores(attemptsDao);

  const { toAnswerEntries, evaluateQuestionAnswer } = createGradingHelpers({
    sanitizeStringField,
  });

  const {
    findQuizById,
    findQuizzesForCourse,
    createQuizForCourse,
    updateQuiz,
    setQuizPublished,
    deleteQuiz,
  } = createQuizHandlers({
    dao,
    attemptsDao,
    questionsDao,
    isPrivilegedUser,
    ensureCourseAccess,
    syncQuizDerivedFields,
    attachCurrentUserAttemptScores,
    toPlainQuiz,
  });

  const {
    findQuestionsForQuiz,
    createQuestionForQuiz,
    updateQuestionForQuiz,
    deleteQuestionFromQuiz,
  } = createQuestionHandlers({
    dao,
    questionsDao,
    isPrivilegedUser,
    ensureCourseAccess,
    syncQuizDerivedFields,
    getOrderedQuestionsForQuiz,
    buildQuestionCreatePayload,
    buildQuestionUpdatePayload,
    normalizeQuestionIds,
  });

  const { createAttemptForQuiz, findCurrentUsersAttemptsForQuiz } =
    createAttemptHandlers({
      dao,
      attemptsDao,
      isPrivilegedUser,
      ensureCourseAccess,
      syncQuizDerivedFields,
      getOrderedQuestionsForQuiz,
      toAnswerEntries,
      evaluateQuestionAnswer,
    });

  dao.seedQuizzes(visualizationSeed).catch((error) => {
    console.error("Unable to seed visualization quizzes", error);
  });

  seedVisualizationAttempts({ enrollmentsDao, attemptsDao }).catch((error) => {
    console.error("Unable to seed visualization quiz attempts", error);
  });

  app.post("/api/courses/:courseId/quizzes", createQuizForCourse);
  app.get("/api/courses/:courseId/quizzes", findQuizzesForCourse);
  app.get("/api/quizzes/:quizId", findQuizById);
  app.put("/api/quizzes/:quizId", updateQuiz);
  app.patch("/api/quizzes/:quizId/published", setQuizPublished);
  app.delete("/api/quizzes/:quizId", deleteQuiz);

  app.get("/api/quizzes/:quizId/questions", findQuestionsForQuiz);
  app.post("/api/quizzes/:quizId/questions", createQuestionForQuiz);
  app.put("/api/quizzes/:quizId/questions/:questionId", updateQuestionForQuiz);
  app.delete("/api/quizzes/:quizId/questions/:questionId", deleteQuestionFromQuiz);

  app.post("/api/quizzes/:quizId/attempts", createAttemptForQuiz);
  app.get("/api/quizzes/:quizId/attempts/me", findCurrentUsersAttemptsForQuiz);
}
