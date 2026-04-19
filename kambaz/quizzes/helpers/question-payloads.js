import { v4 as uuidv4 } from "uuid";

// question payload sanitization/normalization.
// all create/update validation for question bodies lives here.
const QUIZ_QUESTION_TYPES = ["MULTIPLE_CHOICE", "TRUE_FALSE", "FILL_IN_THE_BLANK"];

export const sanitizeStringField = (value, fallback = "") => {
  if (value === undefined || value === null) return fallback;
  return `${value}`;
};

export const sanitizeQuestionType = (type) => {
  if (!type) return "MULTIPLE_CHOICE";
  if (!QUIZ_QUESTION_TYPES.includes(type)) return null;
  return type;
};

export const sanitizeQuestionPoints = (points, fallback = 0) => {
  if (points === undefined || points === null || points === "") return fallback;
  const parsed = Number(points);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, parsed);
};

export const sanitizeChoices = (choices) => {
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

export const sanitizeBlankAnswers = (answers) => {
  if (!Array.isArray(answers)) return [];
  return answers
    .map((answer) => sanitizeStringField(answer, "").trim())
    .filter(Boolean);
};

export const buildQuestionCreatePayload = (body) => {
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
    payload.trueFalseAnswer =
      body?.trueFalseAnswer === undefined ? true : Boolean(body.trueFalseAnswer);
  } else {
    payload.blankAnswers = sanitizeBlankAnswers(body?.blankAnswers);
  }

  return payload;
};

export const buildQuestionUpdatePayload = (currentQuestion, body) => {
  const requestedType = body?.type !== undefined ? sanitizeQuestionType(body.type) : undefined;
  if (body?.type !== undefined && !requestedType) return null;

  const nextType = requestedType || currentQuestion.type;

  const updates = {};

  if (body?.type !== undefined) updates.type = requestedType;
  if (body?.title !== undefined) {
    updates.title = sanitizeStringField(body.title, currentQuestion.title);
  }
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
      if (
        choices.length &&
        !choices.some((choice) => choice._id === currentQuestion.correctChoiceId)
      ) {
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
