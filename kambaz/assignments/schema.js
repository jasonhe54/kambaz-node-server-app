import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    _id: String,
    title: String,
    course: { type: String, ref: "CourseModel" },
    description: String,
    points: Number,
    availableFrom: String,
    dueDate: String,
    availableUntil: String,
  },
  { collection: "assignments" }
);

export default assignmentSchema;
