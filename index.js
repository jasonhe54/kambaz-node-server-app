import express from 'express'
import hello from "./hello.js"
import lab5 from "./lab5/index.js";
import cors from "cors";

const app = express()
app.use(cors());
lab5(app)
hello(app)
app.listen(process.env.PORT || 4000)
