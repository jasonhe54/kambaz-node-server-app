import { v4 as uuidv4 } from "uuid";
import model from "./model.js";

export default function CoursesDao(db) {
  function findAllCourses() {
    return model.find();
  }

  function findCourseById(courseId) {
    return db.courses.find((course) => course._id === courseId);
  }

  async function findCoursesForEnrolledUser(userId) {
    const { enrollments } = db;
    const courses = await model.find();
    const enrolledCourses = courses.filter((course) =>
      enrollments.some(
        (enrollment) => enrollment.user === userId && enrollment.course === course._id
      )
    );
    return enrolledCourses;
  }

  function createCourse(course) {
    return model.create({ ...course, _id: uuidv4() });
  }

  function deleteCourse(courseId) {
    const { enrollments } = db;
    db.enrollments = enrollments.filter((enrollment) => enrollment.course !== courseId);
    return model.deleteOne({ _id: courseId });
  }

  function updateCourse(courseId, courseUpdates) {
    const { courses } = db;
    const course = courses.find((course) => course._id === courseId);
    Object.assign(course, courseUpdates);
    return course;
  }

  return {
    findAllCourses,
    findCourseById,
    findCoursesForEnrolledUser,
    createCourse,
    deleteCourse,
    updateCourse,
  };
}
