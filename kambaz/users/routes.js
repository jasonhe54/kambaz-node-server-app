import UsersDao from "./dao.js";
export default function UserRoutes(app, db) {
  const dao = UsersDao(db);
  const createUser = (req, res) => {
    const newUser = dao.createUser(req.body);
    res.json(newUser);
  };
  const deleteUser = (req, res) => {
    const { userId } = req.params;
    const deletedUser = dao.deleteUser(userId);
    if (!deletedUser) {
      res.status(404).json({ message: `Unable to delete user with ID ${userId}` });
      return;
    }
    if (req.session["currentUser"]?._id === userId) {
      req.session.destroy(() => {});
    }
    res.json(deletedUser);
  };
  const findAllUsers = (req, res) => {
    const { username, password } = req.query;
    if (username && password) {
      const user = dao.findUserByCredentials(username, password);
      res.json(user || null);
      return;
    }
    if (username) {
      const user = dao.findUserByUsername(username);
      res.json(user || null);
      return;
    }
    res.json(dao.findAllUsers());
  };
  const findUserById = (req, res) => {
    const { userId } = req.params;
    const user = dao.findUserById(userId);
    if (!user) {
      res.status(404).json({ message: `Unable to find user with ID ${userId}` });
      return;
    }
    res.json(user);
  };
  const updateUser = (req, res) => {
    const userId = req.params.userId;
    const userUpdates = req.body;
    const currentUser = dao.updateUser(userId, userUpdates);
    if (!currentUser) {
      res.status(404).json({ message: `Unable to update user with ID ${userId}` });
      return;
    }
    req.session["currentUser"] = currentUser;
    res.json(currentUser);
  };
  const signup = (req, res) => {
    const user = dao.findUserByUsername(req.body.username);
    if (user) {
      res.status(400).json({ message: "Username already taken" });
      return;
    }
    const currentUser = dao.createUser(req.body);
    req.session["currentUser"] = currentUser;
    res.json(currentUser);
  };
  const signin = (req, res) => {
    const { username, password } = req.body;
    const currentUser = dao.findUserByCredentials(username, password);
    if (currentUser) {
      req.session["currentUser"] = currentUser;
      res.json(currentUser);
    } else {
      res.status(401).json({ message: "Unable to login. Try again later." });
    }
  };
  const signout = (req, res) => {
    req.session.destroy(() => {
      res.sendStatus(200);
    });
  };
  const profile = (req, res) => {
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
