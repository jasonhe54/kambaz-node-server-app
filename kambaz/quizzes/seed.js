export const visualizationSeed = [
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

export const seedVisualizationAttempts = async ({
  enrollmentsDao,
  attemptsDao,
}) => {
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
