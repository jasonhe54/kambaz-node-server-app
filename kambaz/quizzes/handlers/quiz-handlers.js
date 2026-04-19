export const createQuizHandlers = ({
  dao,
  attemptsDao,
  questionsDao,
  isPrivilegedUser,
  ensureCourseAccess,
  syncQuizDerivedFields,
  attachCurrentUserAttemptScores,
  toPlainQuiz,
}) => {
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

    const syncedQuiz = await syncQuizDerivedFields(quiz);

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
      quizzes.map(async (quiz) => (await syncQuizDerivedFields(quiz)) || quiz)
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
    const syncedQuiz = await syncQuizDerivedFields(updatedQuiz || quiz);
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

  return {
    findQuizById,
    findQuizzesForCourse,
    createQuizForCourse,
    updateQuiz,
    setQuizPublished,
    deleteQuiz,
  };
};
