import QuizzesDao from "./dao.js";
import EnrollmentsDao from "../enrollments/dao.js";
import QuizAttemptsDao from "../quizAttempts/dao.js";

export default function QuizzesRoutes(app) {
  const dao = QuizzesDao();
  const enrollmentsDao = EnrollmentsDao();
  const attemptsDao = QuizAttemptsDao();

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
        score: 18 + (index % 6),
        startedAt: new Date("2026-03-24T17:00:00.000Z"),
        submittedAt: new Date("2026-03-24T17:20:00.000Z"),
      },
      {
        _id: `ATT-${user._id}-QCS9012-2`,
        quiz: "QCS9012-2",
        course: "CS9012",
        user: user._id,
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

    res.json({
      ...toPlainQuiz(quiz),
      lastAttemptScore: latestAttempt ? latestAttempt.score : null,
    });
  };

  const findQuizzesForCourse = async (req, res) => {
    const { courseId } = req.params;
    const currentUser = await ensureCourseAccess(req, res, courseId);
    if (!currentUser) return;

    let quizzes = await dao.findQuizzesForCourse(courseId);
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
    const { lastAttemptScore, ...quizBody } = req.body || {};
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

    const { lastAttemptScore, ...quizUpdates } = req.body || {};
    const updatedQuiz = await dao.updateQuiz(quizId, quizUpdates);
    res.send(updatedQuiz);
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

    const status = await dao.deleteQuiz(quizId);
    res.send(status);
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

    const score = Number(req.body?.score ?? 0);
    if (Number.isNaN(score)) {
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

    const attempt = await attemptsDao.createAttempt({
      quiz: quizId,
      course: quiz.course,
      user: currentUser._id,
      score,
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

  app.post("/api/quizzes/:quizId/attempts", createAttemptForQuiz);
  app.get("/api/quizzes/:quizId/attempts/me", findCurrentUsersAttemptsForQuiz);
}
