import { v4 as uuidv4 } from "uuid";
import QuizzesDao from "./dao.js";
import EnrollmentsDao from "../enrollments/dao.js";
import QuizAttemptsDao from "../quizAttempts/dao.js";
import QuizQuestionsDao from "../quizQuestions/dao.js";

const QUIZ_QUESTION_TYPES = ["MULTIPLE_CHOICE", "TRUE_FALSE", "FILL_IN_THE_BLANK"];

export default function QuizzesRoutes(app) {
  const dao = QuizzesDao();
  const enrollmentsDao = EnrollmentsDao();
  const attemptsDao = QuizAttemptsDao();
  const questionsDao = QuizQuestionsDao();

  const isPrivilegedUser = (user) => Boolean(user && user.role !== "STUDENT");

  const visualizationSeed = [
    {
      _id: "QCS9012-1",
      course: "CS9012",
      title: "Published - Closed",
      published: true,
      availableDate: "2026-03-01T08:00:00.000Z",
      dueDate: "2026-03-25T18:00:00.000Z",
      untilDate: "2026-03-28T23:59:00.000Z",
      points: 25,
      questionCount: 10,
    },
    {
      _id: "QCS9012-2",
      course: "CS9012",
      title: "Published - Available",
      published: true,
      availableDate: "2026-04-10T08:00:00.000Z",
      dueDate: "2026-04-22T18:00:00.000Z",
      untilDate: "2026-04-25T23:59:00.000Z",
      points: 30,
      questionCount: 12,
    },
    {
      _id: "QCS9012-3",
      course: "CS9012",
      title: "Published - Not Yet Available",
      published: true,
      availableDate: "2026-04-25T08:00:00.000Z",
      dueDate: "2026-05-02T18:00:00.000Z",
      untilDate: "2026-05-04T23:59:00.000Z",
      points: 20,
      questionCount: 8,
    },
    {
      _id: "QCS9012-4",
      course: "CS9012",
      title: "Unpublished - Closed",
      published: false,
      availableDate: "2026-03-03T08:00:00.000Z",
      dueDate: "2026-03-21T18:00:00.000Z",
      untilDate: "2026-03-24T23:59:00.000Z",
      points: 15,
      questionCount: 6,
    },
    {
      _id: "QCS9012-5",
      course: "CS9012",
      title: "Unpublished - Available",
      published: false,
      availableDate: "2026-04-11T08:00:00.000Z",
      dueDate: "2026-04-24T18:00:00.000Z",
      untilDate: "2026-04-26T23:59:00.000Z",
      points: 40,
      questionCount: 16,
    },
    {
      _id: "QCS9012-6",
      course: "CS9012",
      title: "Unpublished - Not Yet Available",
      published: false,
      availableDate: "2026-05-01T08:00:00.000Z",
      dueDate: "2026-05-06T18:00:00.000Z",
      untilDate: "2026-05-08T23:59:00.000Z",
      points: 50,
      questionCount: 20,
    },
  ];

  dao.seedQuizzes(visualizationSeed).catch((error) => {
    console.error("Unable to seed visualization quizzes", error);
  });

  const seedVisualizationAttempts = async () => {
    const usersInVisualizationCourse = await enrollmentsDao.findUsersForCourse("CS9012");
    const studentUsers = usersInVisualizationCourse.filter(
      (user) => user && user.role === "STUDENT"
    );

    const visualizationAttempts = studentUsers.flatMap((user, index) => [
      {
        _id: `ATT-${user._id}-QCS9012-1`,
        quiz: "QCS9012-1",
        course: "CS9012",
        user: user._id,
        attemptNumber: 1,
        score: 18 + (index % 6),
        startedAt: new Date("2026-03-24T17:00:00.000Z"),
        submittedAt: new Date("2026-03-24T17:20:00.000Z"),
      },
      {
        _id: `ATT-${user._id}-QCS9012-2`,
        quiz: "QCS9012-2",
        course: "CS9012",
        user: user._id,
        attemptNumber: 1,
        score: 22 + (index % 8),
        startedAt: new Date("2026-04-20T16:45:00.000Z"),
        submittedAt: new Date("2026-04-20T17:05:00.000Z"),
      },
    ]);

    await attemptsDao.seedAttempts(visualizationAttempts);
  };

  seedVisualizationAttempts().catch((error) => {
    console.error("Unable to seed visualization quiz attempts", error);
  });

  const ensureCourseAccess = async (req, res, courseId) => {
    const currentUser = req.session["currentUser"];
    if (!currentUser) {
      res.sendStatus(401);
      return null;
    }

    const courses = await enrollmentsDao.findCoursesForUser(currentUser._id);
    const isEnrolledInCourse = courses.some(
      (course) => course && `${course._id}` === `${courseId}`
    );

    if (!isEnrolledInCourse) {
      res.status(403).json({ message: "You do not have access to this course." });
      return null;
    }

    return currentUser;
  };

  const toPlainQuiz = (quiz) => {
    const plain = typeof quiz?.toObject === "function" ? quiz.toObject() : quiz;
    if (!plain) return plain;
    const { lastAttemptScore, ...quizWithoutUserScore } = plain;
    return quizWithoutUserScore;
  };

  const normalizeQuestionIds = (questionIds) =>
    Array.isArray(questionIds)
      ? questionIds
          .map((questionId) => `${questionId}`.trim())
          .filter((questionId) => questionId.length > 0)
      : [];

  const calculateTotalPoints = (questions) =>
    questions.reduce((total, question) => {
      const points = Number(question?.points ?? 0);
      return total + (Number.isFinite(points) ? points : 0);
    }, 0);

  const getOrderedQuestionsForQuiz = async (quiz) => {
    const questionIds = normalizeQuestionIds(quiz?.questionIds);
    if (questionIds.length) {
      const questions = await questionsDao.findQuestionsByIds(questionIds);
      const byId = new Map(questions.map((question) => [`${question._id}`, question]));
      return questionIds.map((questionId) => byId.get(questionId)).filter(Boolean);
    }

    return questionsDao.findQuestionsForQuiz(`${quiz._id}`);
  };

  const syncQuizQuestionAggregates = async (quiz) => {
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

  const attachCurrentUserAttemptScores = async (quizzes, currentUserId) => {
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

  const sanitizeStringField = (value, fallback = "") => {
    if (value === undefined || value === null) return fallback;
    return `${value}`;
  };

  const sanitizeQuestionType = (type) => {
    if (!type) return "MULTIPLE_CHOICE";
    if (!QUIZ_QUESTION_TYPES.includes(type)) return null;
    return type;
  };

  const sanitizeQuestionPoints = (points, fallback = 0) => {
    if (points === undefined || points === null || points === "") return fallback;
    const parsed = Number(points);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, parsed);
  };

  const sanitizeChoices = (choices) => {
    if (!Array.isArray(choices)) return [];
    return choices
      .map((choice) => {
        const text = sanitizeStringField(choice?.text, "").trim();
        if (!text) return null;
        return {
          _id: sanitizeStringField(choice?._id, uuidv4()),
          text,
        };
      })
      .filter(Boolean);
  };

  const sanitizeBlankAnswers = (answers) => {
    if (!Array.isArray(answers)) return [];
    return answers
      .map((answer) => sanitizeStringField(answer, "").trim())
      .filter(Boolean);
  };

  const buildQuestionCreatePayload = (body) => {
    const type = sanitizeQuestionType(body?.type);
    if (!type) return null;

    const points = sanitizeQuestionPoints(body?.points, 0);
    if (points === null) return null;

    const payload = {
      type,
      title: sanitizeStringField(body?.title, "Untitled Question").trim() || "Untitled Question",
      points,
      questionText: sanitizeStringField(body?.questionText, ""),
    };

    if (type === "MULTIPLE_CHOICE") {
      const choices = sanitizeChoices(body?.choices);
      payload.choices = choices;
      payload.correctChoiceId = sanitizeStringField(body?.correctChoiceId, choices[0]?._id || "");
    } else if (type === "TRUE_FALSE") {
      payload.trueFalseAnswer = body?.trueFalseAnswer === undefined ? true : Boolean(body.trueFalseAnswer);
    } else {
      payload.blankAnswers = sanitizeBlankAnswers(body?.blankAnswers);
    }

    return payload;
  };

  const buildQuestionUpdatePayload = (currentQuestion, body) => {
    const requestedType = body?.type !== undefined ? sanitizeQuestionType(body.type) : undefined;
    if (body?.type !== undefined && !requestedType) return null;

    const nextType = requestedType || currentQuestion.type;

    const updates = {};

    if (body?.type !== undefined) updates.type = requestedType;
    if (body?.title !== undefined) updates.title = sanitizeStringField(body.title, currentQuestion.title);
    if (body?.questionText !== undefined) {
      updates.questionText = sanitizeStringField(body.questionText, currentQuestion.questionText);
    }
    if (body?.points !== undefined) {
      const points = sanitizeQuestionPoints(body.points, currentQuestion.points);
      if (points === null) return null;
      updates.points = points;
    }

    if (nextType === "MULTIPLE_CHOICE") {
      if (body?.choices !== undefined) {
        const choices = sanitizeChoices(body.choices);
        updates.choices = choices;
        if (choices.length && !choices.some((choice) => choice._id === currentQuestion.correctChoiceId)) {
          updates.correctChoiceId = choices[0]._id;
        }
      }
      if (body?.correctChoiceId !== undefined) {
        updates.correctChoiceId = sanitizeStringField(body.correctChoiceId, "");
      }
    }

    if (nextType === "TRUE_FALSE" && body?.trueFalseAnswer !== undefined) {
      updates.trueFalseAnswer = Boolean(body.trueFalseAnswer);
    }

    if (nextType === "FILL_IN_THE_BLANK" && body?.blankAnswers !== undefined) {
      updates.blankAnswers = sanitizeBlankAnswers(body.blankAnswers);
    }

    return updates;
  };

  const findQuizById = async (req, res) => {
    const { quizId } = req.params;
    const quiz = await dao.findQuizById(quizId);
    if (!quiz) {
      res.status(404).json({ message: `Unable to find quiz with ID ${quizId}` });
      return;
    }

    const currentUser = await ensureCourseAccess(req, res, quiz.course);
    if (!currentUser) return;

    if (!isPrivilegedUser(currentUser) && !quiz.published) {
      res.status(403).json({ message: "You do not have access to this quiz." });
      return;
    }

    const latestAttempt = await attemptsDao.findLatestAttemptForUserAndQuiz(
      currentUser._id,
      quizId
    );

    const syncedQuiz = await syncQuizQuestionAggregates(quiz);

    res.json({
      ...toPlainQuiz(syncedQuiz || quiz),
      lastAttemptScore: latestAttempt ? latestAttempt.score : null,
    });
  };

  const findQuizzesForCourse = async (req, res) => {
    const { courseId } = req.params;
    const currentUser = await ensureCourseAccess(req, res, courseId);
    if (!currentUser) return;

    let quizzes = await dao.findQuizzesForCourse(courseId);

    quizzes = await Promise.all(
      quizzes.map(async (quiz) => (await syncQuizQuestionAggregates(quiz)) || quiz)
    );

    if (!isPrivilegedUser(currentUser)) {
      quizzes = quizzes.filter((quiz) => quiz.published);
    }

    const quizzesWithUserScores = await attachCurrentUserAttemptScores(
      quizzes,
      currentUser._id
    );

    res.json(quizzesWithUserScores);
  };

  const createQuizForCourse = async (req, res) => {
    const { courseId } = req.params;
    const currentUser = await ensureCourseAccess(req, res, courseId);
    if (!currentUser) return;

    if (!isPrivilegedUser(currentUser)) {
      res.status(403).json({ message: "Only faculty users can create quizzes." });
      return;
    }

    const now = Date.now();
    const { lastAttemptScore, questionIds, ...quizBody } = req.body || {};
    const quiz = {
      title: "Untitled Quiz",
      description: "",
      published: false,
      quizType: "Graded Quiz",
      assignmentGroup: "Quizzes",
      shuffleAnswers: true,
      timeLimit: 20,
      multipleAttempts: false,
      howManyAttempts: 1,
      showCorrectAnswers: false,
      accessCode: "",
      oneQuestionAtATime: true,
      webcamRequired: false,
      lockQuestionsAfterAnswering: false,
      points: 0,
      questionCount: 0,
      questionIds: [],
      availableDate: new Date(now).toISOString(),
      dueDate: new Date(now + 1000 * 60 * 60 * 24 * 7).toISOString(),
      untilDate: new Date(now + 1000 * 60 * 60 * 24 * 8).toISOString(),
      ...quizBody,
      course: courseId,
      isDraft: true,
    };

    const newQuiz = await dao.createQuiz(quiz);
    res.send(newQuiz);
  };

  const updateQuiz = async (req, res) => {
    const { quizId } = req.params;
    const quiz = await dao.findQuizById(quizId);
    if (!quiz) {
      res.status(404).json({ message: `Unable to find quiz with ID ${quizId}` });
      return;
    }

    const currentUser = await ensureCourseAccess(req, res, quiz.course);
    if (!currentUser) return;

    if (!isPrivilegedUser(currentUser)) {
      res.status(403).json({ message: "Only faculty users can update quizzes." });
      return;
    }

    const { lastAttemptScore, questionIds, ...quizUpdates } = req.body || {};
    const updatedQuiz = await dao.updateQuiz(quizId, quizUpdates);
    const syncedQuiz = await syncQuizQuestionAggregates(updatedQuiz || quiz);
    res.send(syncedQuiz || updatedQuiz);
  };

  const setQuizPublished = async (req, res) => {
    const { quizId } = req.params;
    const quiz = await dao.findQuizById(quizId);
    if (!quiz) {
      res.status(404).json({ message: `Unable to find quiz with ID ${quizId}` });
      return;
    }

    const currentUser = await ensureCourseAccess(req, res, quiz.course);
    if (!currentUser) return;

    if (!isPrivilegedUser(currentUser)) {
      res.status(403).json({ message: "Only faculty users can publish quizzes." });
      return;
    }

    const updatedQuiz = await dao.updateQuiz(quizId, {
      published: Boolean(req.body?.published),
    });
    res.send(updatedQuiz);
  };

  const deleteQuiz = async (req, res) => {
    const { quizId } = req.params;
    const quiz = await dao.findQuizById(quizId);
    if (!quiz) {
      res.status(404).json({ message: `Unable to find quiz with ID ${quizId}` });
      return;
    }

    const currentUser = await ensureCourseAccess(req, res, quiz.course);
    if (!currentUser) return;

    if (!isPrivilegedUser(currentUser)) {
      res.status(403).json({ message: "Only faculty users can delete quizzes." });
      return;
    }

    await Promise.all([
      attemptsDao.deleteAttemptsForQuiz(quizId),
      questionsDao.deleteQuestionsForQuiz(quizId),
    ]);
    const status = await dao.deleteQuiz(quizId);
    res.send(status);
  };

  const findQuestionsForQuiz = async (req, res) => {
    const { quizId } = req.params;
    const quiz = await dao.findQuizById(quizId);
    if (!quiz) {
      res.status(404).json({ message: `Unable to find quiz with ID ${quizId}` });
      return;
    }

    const currentUser = await ensureCourseAccess(req, res, quiz.course);
    if (!currentUser) return;

    if (!isPrivilegedUser(currentUser) && !quiz.published) {
      res.status(403).json({ message: "You do not have access to this quiz." });
      return;
    }

    const syncedQuiz = await syncQuizQuestionAggregates(quiz);
    const questions = await getOrderedQuestionsForQuiz(syncedQuiz || quiz);

    const requestedIndex = req.query?.index;
    if (requestedIndex === undefined) {
      res.json(questions);
      return;
    }

    const parsedIndex = Number(requestedIndex);
    if (!Number.isInteger(parsedIndex) || parsedIndex < 0) {
      res.status(400).json({ message: "index must be a non-negative integer." });
      return;
    }

    if (parsedIndex >= questions.length) {
      res.status(404).json({ message: "Question index out of range." });
      return;
    }

    res.json({
      index: parsedIndex,
      total: questions.length,
      question: questions[parsedIndex],
    });
  };

  const createQuestionForQuiz = async (req, res) => {
    const { quizId } = req.params;
    const quiz = await dao.findQuizById(quizId);
    if (!quiz) {
      res.status(404).json({ message: `Unable to find quiz with ID ${quizId}` });
      return;
    }

    const currentUser = await ensureCourseAccess(req, res, quiz.course);
    if (!currentUser) return;

    if (!isPrivilegedUser(currentUser)) {
      res.status(403).json({ message: "Only faculty users can create questions." });
      return;
    }

    const questionPayload = buildQuestionCreatePayload(req.body || {});
    if (!questionPayload) {
      res.status(400).json({ message: "Invalid question payload." });
      return;
    }

    const question = await questionsDao.createQuestion({
      ...questionPayload,
      quiz: quizId,
      course: quiz.course,
    });

    const existingQuestionIds = normalizeQuestionIds(quiz.questionIds);
    const quizWithQuestion = await dao.updateQuiz(quizId, {
      questionIds: [...existingQuestionIds, `${question._id}`],
    });

    await syncQuizQuestionAggregates(quizWithQuestion || quiz);

    res.status(201).json(question);
  };

  const updateQuestionForQuiz = async (req, res) => {
    const { quizId, questionId } = req.params;
    const quiz = await dao.findQuizById(quizId);
    if (!quiz) {
      res.status(404).json({ message: `Unable to find quiz with ID ${quizId}` });
      return;
    }

    const currentUser = await ensureCourseAccess(req, res, quiz.course);
    if (!currentUser) return;

    if (!isPrivilegedUser(currentUser)) {
      res.status(403).json({ message: "Only faculty users can update questions." });
      return;
    }

    const question = await questionsDao.findQuestionById(questionId);
    if (!question || `${question.quiz}` !== `${quizId}`) {
      res.status(404).json({ message: `Unable to find question with ID ${questionId}` });
      return;
    }

    const questionUpdates = buildQuestionUpdatePayload(question, req.body || {});
    if (questionUpdates === null) {
      res.status(400).json({ message: "Invalid question payload." });
      return;
    }

    const updatedQuestion = await questionsDao.updateQuestion(questionId, questionUpdates);
    await syncQuizQuestionAggregates(quiz);

    res.json(updatedQuestion);
  };

  const deleteQuestionFromQuiz = async (req, res) => {
    const { quizId, questionId } = req.params;
    const quiz = await dao.findQuizById(quizId);
    if (!quiz) {
      res.status(404).json({ message: `Unable to find quiz with ID ${quizId}` });
      return;
    }

    const currentUser = await ensureCourseAccess(req, res, quiz.course);
    if (!currentUser) return;

    if (!isPrivilegedUser(currentUser)) {
      res.status(403).json({ message: "Only faculty users can delete questions." });
      return;
    }

    const question = await questionsDao.findQuestionById(questionId);
    if (!question || `${question.quiz}` !== `${quizId}`) {
      res.status(404).json({ message: `Unable to find question with ID ${questionId}` });
      return;
    }

    await questionsDao.deleteQuestion(questionId);

    const nextQuestionIds = normalizeQuestionIds(quiz.questionIds).filter(
      (id) => id !== `${questionId}`
    );
    const updatedQuiz = await dao.updateQuiz(quizId, { questionIds: nextQuestionIds });

    await syncQuizQuestionAggregates(updatedQuiz || quiz);

    res.sendStatus(204);
  };

  const toAnswerEntries = (answers) => {
    if (!Array.isArray(answers)) return [];
    return answers
      .map((answer) => {
        const questionId = sanitizeStringField(answer?.questionId, "").trim();
        if (!questionId) return null;
        return {
          questionId,
          value: answer?.value ?? null,
        };
      })
      .filter(Boolean);
  };

  const toResultEntries = (results) => {
    if (!Array.isArray(results)) return [];
    return results
      .map((result) => {
        const questionId = sanitizeStringField(result?.questionId, "").trim();
        if (!questionId) return null;
        const pointsEarned = Number(result?.pointsEarned ?? 0);
        if (!Number.isFinite(pointsEarned)) return null;
        return {
          questionId,
          isCorrect: Boolean(result?.isCorrect),
          pointsEarned: Math.max(0, pointsEarned),
        };
      })
      .filter(Boolean);
  };

  const createAttemptForQuiz = async (req, res) => {
    const { quizId } = req.params;
    const quiz = await dao.findQuizById(quizId);
    if (!quiz) {
      res.status(404).json({ message: `Unable to find quiz with ID ${quizId}` });
      return;
    }

    const currentUser = await ensureCourseAccess(req, res, quiz.course);
    if (!currentUser) return;

    if (!isPrivilegedUser(currentUser) && !quiz.published) {
      res.status(403).json({ message: "You cannot submit attempts for this quiz." });
      return;
    }

    const previousAttemptCount = await attemptsDao.countAttemptsForUserAndQuiz(
      currentUser._id,
      quizId
    );

    if (!isPrivilegedUser(currentUser)) {
      const maxAttempts = quiz.multipleAttempts
        ? Math.max(1, Number(quiz.howManyAttempts || 1))
        : 1;
      if (previousAttemptCount >= maxAttempts) {
        res.status(403).json({ message: "No attempts remaining for this quiz." });
        return;
      }
    }

    const answers = toAnswerEntries(req.body?.answers);
    const results = toResultEntries(req.body?.results);

    const scoreFromBody = req.body?.score;
    const derivedScore = results.reduce((total, result) => total + result.pointsEarned, 0);

    const resolvedScore =
      scoreFromBody === undefined || scoreFromBody === null || scoreFromBody === ""
        ? derivedScore
        : Number(scoreFromBody);

    if (!Number.isFinite(resolvedScore)) {
      res.status(400).json({ message: "score must be numeric." });
      return;
    }

    const submittedAt = req.body?.submittedAt
      ? new Date(req.body.submittedAt)
      : new Date();
    const startedAt = req.body?.startedAt
      ? new Date(req.body.startedAt)
      : submittedAt;

    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(submittedAt.getTime())) {
      res.status(400).json({ message: "Invalid startedAt/submittedAt date." });
      return;
    }

    const quizForScoring = (await syncQuizQuestionAggregates(quiz)) || quiz;

    const attempt = await attemptsDao.createAttempt({
      quiz: quizId,
      course: quiz.course,
      user: currentUser._id,
      attemptNumber: previousAttemptCount + 1,
      answers,
      results,
      score: Math.max(0, resolvedScore),
      maxScore: calculateTotalPoints(await getOrderedQuestionsForQuiz(quizForScoring)),
      startedAt,
      submittedAt,
    });

    res.status(201).json(attempt);
  };

  const findCurrentUsersAttemptsForQuiz = async (req, res) => {
    const { quizId } = req.params;
    const quiz = await dao.findQuizById(quizId);
    if (!quiz) {
      res.status(404).json({ message: `Unable to find quiz with ID ${quizId}` });
      return;
    }

    const currentUser = await ensureCourseAccess(req, res, quiz.course);
    if (!currentUser) return;

    if (!isPrivilegedUser(currentUser) && !quiz.published) {
      res.status(403).json({ message: "You do not have access to this quiz." });
      return;
    }

    const attempts = await attemptsDao.findAttemptsForUserAndQuiz(
      currentUser._id,
      quizId
    );

    res.json(attempts);
  };

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
