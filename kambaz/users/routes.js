import UsersDao from "./dao.js";

export default function UserRoutes(app) {
  const dao = UsersDao();

  const createUser = async (req, res) => {
    const newUser = await dao.createUser(req.body);
    // if error present, return 400 with that error message
    if (newUser?.error) {
      res.status(400).json({ message: newUser.error });
      return;
    }
    res.json(newUser);
  };

  const deleteUser = async (req, res) => {
    const { userId } = req.params;
    const deletedUser = await dao.deleteUser(userId);
    if (!deletedUser || deletedUser.deletedCount === 0) {
      res.status(404).json({ message: `Unable to delete user with ID ${userId}` });
      return;
    }
    if (req.session["currentUser"]?._id === userId) {
      req.session.destroy(() => {});
    }
    res.json(deletedUser);
  };

  const findAllUsers = async (req, res) => {
    const { role, name } = req.query;
    if (role && name) {
      const users = await dao.findUsersByRoleAndPartialName(role, name);
      res.json(users);
      return;
    }
    if (role) {
      const users = await dao.findUsersByRole(role);
      res.json(users);
      return;
    }
    if (name) {
      const users = await dao.findUsersByPartialName(name);
      res.json(users);
      return;
    }
    const users = await dao.findAllUsers();
    res.json(users);
  };

  const findUserById = async (req, res) => {
    const { userId } = req.params;
    const user = await dao.findUserById(userId);
    if (!user) {
      res.status(404).json({ message: `Unable to find user with ID ${userId}` });
      return;
    }
    res.json(user);
  };

  const updateUser = async (req, res) => {
    const { userId } = req.params;
    const userUpdates = req.body;
    const currentUser = req.session["currentUser"];

    if (!currentUser) {
      res.status(401).json({ message: "You must be signed in to update a user." });
      return;
    }

    const isSelf = currentUser._id === userId;
    const isAdmin = currentUser.role === "ADMIN";
    if (!isSelf && !isAdmin) {
      res.status(403).json({ message: "You can only update your own profile unless you are an admin." });
      return;
    }

    if (!userUpdates || Object.keys(userUpdates).length === 0) {
      res.status(400).json({ message: "No user updates were provided." });
      return;
    }

    const existingUser = userUpdates.username
      ? await dao.findUserByUsername(userUpdates.username)
      : null;
    if (existingUser && existingUser._id !== userId) {
      res.status(400).json({ message: "Username already taken" });
      return;
    }

    const status = await dao.updateUser(userId, userUpdates);
    if (!status || status.matchedCount === 0) {
      res.status(404).json({ message: `Unable to update user with ID ${userId}` });
      return;
    }

    if (isSelf) {
      req.session["currentUser"] = { ...currentUser, ...userUpdates };
      res.json(req.session["currentUser"]);
      return;
    }

    const updatedUser = await dao.findUserById(userId);
    res.json(updatedUser);
  };

  const signup = async (req, res) => {
    const user = await dao.findUserByUsername(req.body.username);
    if (user) {
      res.status(400).json({ message: "Username already taken" });
      return;
    }

    const currentUser = await dao.createUser(req.body);
    if (currentUser?.error) {
      res.status(400).json({ message: currentUser.error });
      return;
    }

    req.session["currentUser"] = currentUser;
    res.json(currentUser);
  };

  const signin = async (req, res) => {
    const { username, password } = req.body;
    const currentUser = await dao.findUserByCredentials(username, password);
    if (currentUser) {
      req.session["currentUser"] = currentUser;
      res.json(currentUser);
    } else {
      res.status(401).json({ message: "Unable to login. Double check your username and password." });
    }
  };

  const signout = async (req, res) => {
    req.session.destroy(() => {
      res.sendStatus(200);
    });
  };

  const profile = async (req, res) => {
    const currentUser = req.session["currentUser"];
    if (!currentUser) {
      res.sendStatus(401);
      return;
    }
    res.json(currentUser);
  };

  app.post("/api/users", createUser);
  app.get("/api/users", findAllUsers);
  app.get("/api/users/:userId", findUserById);
  app.put("/api/users/:userId", updateUser);
  app.delete("/api/users/:userId", deleteUser);
  app.post("/api/users/signup", signup);
  app.post("/api/users/signin", signin);
  app.post("/api/users/signout", signout);
  app.post("/api/users/profile", profile);
}
