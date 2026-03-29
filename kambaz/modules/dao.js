import { v4 as uuidv4 } from "uuid";

export default function ModulesDao(db) {
  function findModulesForCourse(courseId) {
    const { modules } = db;
    return modules.filter((module) => module.course === courseId);
  }

  function createModule(module) {
    const newModule = { ...module, _id: uuidv4() };
    db.modules = [...db.modules, newModule];
    return newModule;
  }

  function deleteModule(moduleId) {
    const { modules } = db;
    db.modules = modules.filter((module) => module._id !== moduleId);
  }

  return {
    findModulesForCourse,
    createModule,
    deleteModule,
  };
}
