import { v4 as uuidv4 } from "uuid";
import model from "./model.js";

export default function UsersDao() {
  const createUser = (user) => model.create({ ...user, _id: uuidv4() });
  const findAllUsers = () => model.find();
  const findUsersByRole = (role) => model.find({ role: role });
  const findUsersByPartialName = (partialName) => {
    const regex = new RegExp(partialName, "i");
    return model.find({
      $or: [{ firstName: { $regex: regex } }, { lastName: { $regex: regex } }],
    });
  };
  const findUsersByRoleAndPartialName = (role, partialName) => {
    const regex = new RegExp(partialName, "i");
    return model.find({
      role,
      $or: [{ firstName: { $regex: regex } }, { lastName: { $regex: regex } }],
    });
  };

  const findUserById = (userId) => model.findById(userId);

  const findUserByUsername = (username) =>
    model.findOne({ username: username });

  const findUserByCredentials = (username, password) =>
    model.findOne({ username, password });

  const updateUser = (userId, userUpdates) => model.updateOne({ _id: userId }, { $set: userUpdates });

  const deleteUser = (userId) => model.findByIdAndDelete(userId);

  return {
    createUser,
    findAllUsers,
    findUsersByRole,
    findUsersByPartialName,
    findUsersByRoleAndPartialName,
    findUserById,
    findUserByUsername,
    findUserByCredentials,
    updateUser,
    deleteUser,
  };
}
