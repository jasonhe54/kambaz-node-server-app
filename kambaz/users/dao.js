import { v4 as uuidv4 } from "uuid";

const ALLOWED_ROLES = ["ADMIN", "FACULTY", "TA", "STUDENT"];

// normalize roles to uppercase, trim whitespace - easier to store given no typescript here
const normalizeRole = (role) =>
  typeof role === "string" ? role.trim().toUpperCase() : "";

const roleValidationError = () => ({
  error: `Invalid user role. Allowed roles: ${ALLOWED_ROLES.join(", ")}`,
});

export default function UsersDao(db) {
  const createUser = (user = {}) => {
    const role = normalizeRole(user.role);
    if (!ALLOWED_ROLES.includes(role)) {
      return roleValidationError();
    }
    const newUser = { ...user, role, _id: uuidv4() };
    db.users = [...db.users, newUser];
    return newUser;
  };

  const findAllUsers = () => db.users;

  const findUserById = (userId) => db.users.find((user) => user._id === userId);

  const findUserByUsername = (username) =>
    db.users.find((user) => user.username === username);

  const findUserByCredentials = (username, password) =>
    db.users.find((user) => user.username === username && user.password === password);

  const updateUser = (userId, userUpdates) => {
    const user = findUserById(userId);
    if (!user) {
      return null;
    }

    const existingUser = userUpdates.username
      ? findUserByUsername(userUpdates.username)
      : null;
    if (existingUser && existingUser._id !== userId) {
      return null;
    }

    const updates = { ...userUpdates };
    if (Object.prototype.hasOwnProperty.call(updates, "role")) {
      const role = normalizeRole(updates.role);
      if (!ALLOWED_ROLES.includes(role)) {
        return roleValidationError();
      }
      updates.role = role;
    }

    Object.assign(user, updates, { _id: userId });
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
    createUser,
    findAllUsers,
    findUserById,
    findUserByUsername,
    findUserByCredentials,
    updateUser,
    deleteUser,
  };
}
