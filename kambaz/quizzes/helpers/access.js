// per previous impl, privileged user is any user with role other than STUDENT
// access/authorization helpers shared by quiz routes.
export const isPrivilegedUser = (user) => Boolean(user && user.role !== "STUDENT");

// ensures user has access to course
export const createEnsureCourseAccess = (enrollmentsDao) =>
  async function ensureCourseAccess(req, res, courseId) {
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
