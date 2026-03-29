import "dotenv/config";
import express from 'express'
import session from "express-session";
import hello from "./hello.js"
import lab5 from "./lab5/index.js";
import cors from "cors";
import db from "./kambaz/database/index.js";
import UserRoutes from "./kambaz/users/routes.js";
import CourseRoutes from "./kambaz/courses/routes.js";
import ModulesRoutes from "./kambaz/modules/routes.js";

const app = express()
app.use(cors({
  credentials: true,
  origin: process.env.CLIENT_URL || "http://localhost:3000",
}));
const sessionOptions = {
  secret: process.env.SESSION_SECRET || "kambaz",
  resave: false,
  saveUninitialized: false,
};
if (process.env.SERVER_ENV !== "development") {
  sessionOptions.proxy = true;
  sessionOptions.cookie = {
    sameSite: "none",
    secure: true,
    domain: process.env.SERVER_URL,
  };
}
app.use(session(sessionOptions));
app.use(express.json());
UserRoutes(app, db);
CourseRoutes(app, db);
ModulesRoutes(app, db);
lab5(app)
hello(app)
const port = process.env.PORT || 4000
app.listen(port)
