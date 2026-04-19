export const createGradingHelpers = ({ sanitizeStringField }) => {
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

  const normalizeCompareText = (value) =>
    sanitizeStringField(value, "").trim().toLowerCase();

  const parseBooleanAnswer = (value) => {
    if (typeof value === "boolean") return value;
    const normalized = normalizeCompareText(value);
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
    return null;
  };

  const evaluateQuestionAnswer = (question, answerValue) => {
    const pointsValue = Number(question?.points ?? 0);
    const maxPoints = Number.isFinite(pointsValue) ? Math.max(0, pointsValue) : 0;

    if (question?.type === "MULTIPLE_CHOICE") {
      const submittedChoiceId = sanitizeStringField(answerValue, "").trim();
      const correctChoiceId = sanitizeStringField(question.correctChoiceId, "").trim();
      const isCorrect =
        submittedChoiceId.length > 0 &&
        correctChoiceId.length > 0 &&
        submittedChoiceId === correctChoiceId;
      return { isCorrect, pointsEarned: isCorrect ? maxPoints : 0 };
    }

    if (question?.type === "TRUE_FALSE") {
      const submittedValue = parseBooleanAnswer(answerValue);
      const isCorrect =
        submittedValue !== null &&
        submittedValue === Boolean(question.trueFalseAnswer);
      return { isCorrect, pointsEarned: isCorrect ? maxPoints : 0 };
    }

    if (question?.type === "FILL_IN_THE_BLANK") {
      const acceptedAnswers = Array.isArray(question.blankAnswers)
        ? question.blankAnswers
            .map((answer) => normalizeCompareText(answer))
            .filter(Boolean)
        : [];
      const accepted = new Set(acceptedAnswers);

      const submittedValues = Array.isArray(answerValue)
        ? answerValue.map((value) => normalizeCompareText(value)).filter(Boolean)
        : [normalizeCompareText(answerValue)].filter(Boolean);

      const isCorrect =
        submittedValues.length > 0 &&
        submittedValues.some((value) => accepted.has(value));
      return { isCorrect, pointsEarned: isCorrect ? maxPoints : 0 };
    }

    return { isCorrect: false, pointsEarned: 0 };
  };

  return {
    toAnswerEntries,
    evaluateQuestionAnswer,
  };
};
