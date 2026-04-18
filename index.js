import "dotenv/config";
import express from 'express'
import session from "express-session";
import hello from "./hello.js"
import lab5 from "./lab5/index.js";
import cors from "cors";
import UserRoutes from "./kambaz/users/routes.js";
import CourseRoutes from "./kambaz/courses/routes.js";
import ModulesRoutes from "./kambaz/modules/routes.js";
import AssignmentRoutes from "./kambaz/assignments/routes.js";
import QuizzesRoutes from "./kambaz/quizzes/routes.js";
import mongoose from "mongoose";


const CONNECTION_STRING = process.env.DATABASE_CONNECTION_STRING || "mongodb://127.0.0.1:27017/kambaz"
mongoose.connect(CONNECTION_STRING)

const app = express()

// writing custom logic for handling an regex of vercel project subdomains since the lecture
// instructions would break my assignment deployment pipeline with vercel preview builds since
// every assignment requires a preview build (since each assignment is on its own branch).
// in theory, the assignment instructions would work for this assignment, but it'll automatically break
// CORS for every assignment after (unless I manually fix it, but then it breaks for this assignment)
function handleVercelSubdomains(origin, callback) {
  if (!origin) return callback(null, true);
  const clientUrlRegex = process.env.CLIENT_URL_REGEX
    ? new RegExp(process.env.CLIENT_URL_REGEX)
    : null;
  const allowed =
    origin === "http://localhost:3000" ||
    origin === process.env.CLIENT_URL ||
    clientUrlRegex?.test(origin);
  if (allowed) return callback(null, true);
  return callback(new Error("Not allowed by CORS"));
}

app.use(cors({
  credentials: true,
  origin: handleVercelSubdomains,
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
UserRoutes(app);
CourseRoutes(app);
ModulesRoutes(app);
AssignmentRoutes(app);
QuizzesRoutes(app);
lab5(app)
hello(app)
const port = process.env.PORT || 4000
app.listen(port)
