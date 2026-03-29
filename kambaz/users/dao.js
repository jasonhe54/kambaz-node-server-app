import { v4 as uuidv4 } from "uuid";
export default function UsersDao(db) {
  const createUser = (user) => {
    const newUser = { ...user, _id: uuidv4() };
    db.users = [...db.users, newUser];
    return newUser;
  };
  const findAllUsers = () => db.users;
  const findUserById = (userId) => db.users.find((user) => user._id === userId);
  const findUserByUsername = (username) => db.users.find((user) => user.username === username);
  const findUserByCredentials = (username, password) =>
    db.users.find((user) => user.username === username && user.password === password);
  const updateUser = (userId, userUpdates) => {
    const user = findUserById(userId);
    if (!user) {
      return null;
    }
    // verify that the updated username is not already taken
    if (findUserByUsername(userUpdates.username)) {
      return null;
    }
    Object.assign(user, userUpdates, { _id: userId });
    return user;
  };
  const deleteUser = (userId) => {
    const user = findUserById(userId);
    if (!user) {
      return null;
    }
    db.users = db.users.filter((u) => u._id !== userId);
    return user;
  };
  return {
    createUser, findAllUsers, findUserById, findUserByUsername, findUserByCredentials, updateUser, deleteUser
  };
}
