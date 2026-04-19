export const createQuestionHandlers = ({
  dao,
  questionsDao,
  isPrivilegedUser,
  ensureCourseAccess,
  syncQuizDerivedFields,
  getOrderedQuestionsForQuiz,
  buildQuestionCreatePayload,
  buildQuestionUpdatePayload,
  normalizeQuestionIds,
}) => {
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

    const syncedQuiz = await syncQuizDerivedFields(quiz);
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

    await syncQuizDerivedFields(quizWithQuestion || quiz);

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
    await syncQuizDerivedFields(quiz);

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

    await syncQuizDerivedFields(updatedQuiz || quiz);

    res.sendStatus(204);
  };

  return {
    findQuestionsForQuiz,
    createQuestionForQuiz,
    updateQuestionForQuiz,
    deleteQuestionFromQuiz,
  };
};
