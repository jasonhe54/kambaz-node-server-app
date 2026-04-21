export const createAttemptHandlers = ({
  dao,
  attemptsDao,
  isPrivilegedUser,
  ensureCourseAccess,
  syncQuizDerivedFields,
  getOrderedQuestionsForQuiz,
  toAnswerEntries,
  evaluateQuestionAnswer,
}) => {
  const gradeQuizSubmission = async (quiz, submissionBody = {}) => {
    const submittedAnswers = toAnswerEntries(submissionBody.answers);
    const answerByQuestionId = new Map(
      submittedAnswers.map((entry) => [entry.questionId, entry.value])
    );

    const quizForScoring = (await syncQuizDerivedFields(quiz)) || quiz;
    const orderedQuestions = await getOrderedQuestionsForQuiz(quizForScoring);

    const answers = orderedQuestions.map((question) => ({
      questionId: `${question._id}`,
      value: answerByQuestionId.has(`${question._id}`)
        ? answerByQuestionId.get(`${question._id}`)
        : null,
    }));

    const results = orderedQuestions.map((question) => {
      const answerValue = answerByQuestionId.has(`${question._id}`)
        ? answerByQuestionId.get(`${question._id}`)
        : null;
      const evaluated = evaluateQuestionAnswer(question, answerValue);
      return {
        questionId: `${question._id}`,
        isCorrect: evaluated.isCorrect,
        pointsEarned: evaluated.pointsEarned,
      };
    });

    const score = results.reduce((total, result) => total + result.pointsEarned, 0);
    const maxScore = orderedQuestions.reduce((total, question) => {
      const pointsValue = Number(question?.points ?? 0);
      return total + (Number.isFinite(pointsValue) ? Math.max(0, pointsValue) : 0);
    }, 0);

    return {
      answers,
      results,
      score: Math.max(0, score),
      maxScore,
    };
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

    const gradedAttempt = await gradeQuizSubmission(quiz, req.body || {});

    const attempt = await attemptsDao.createAttempt({
      quiz: quizId,
      course: quiz.course,
      user: currentUser._id,
      attemptNumber: previousAttemptCount + 1,
      answers: gradedAttempt.answers,
      results: gradedAttempt.results,
      score: gradedAttempt.score,
      maxScore: gradedAttempt.maxScore,
      startedAt,
      submittedAt,
    });

    res.status(201).json(attempt);
  };

  const previewGradeForQuiz = async (req, res) => {
    const { quizId } = req.params;
    const quiz = await dao.findQuizById(quizId);
    if (!quiz) {
      res.status(404).json({ message: `Unable to find quiz with ID ${quizId}` });
      return;
    }

    const currentUser = await ensureCourseAccess(req, res, quiz.course);
    if (!currentUser) return;

    if (!isPrivilegedUser(currentUser)) {
      res.status(403).json({ message: "Only faculty users can preview quizzes." });
      return;
    }

    const gradedPreview = await gradeQuizSubmission(quiz, req.body || {});
    res.json(gradedPreview);
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

  return {
    createAttemptForQuiz,
    previewGradeForQuiz,
    findCurrentUsersAttemptsForQuiz,
  };
};
