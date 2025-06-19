import express from "express";
import cookieParser from "cookie-parser";

import authRouter from "./routes/auth.routes.js";
import { PORT } from "./config/env.js";
import connectToDatabase from "./database/mongodb.js";
import headmasterRouter from "./routes/headmaster.routes.js";
import studentsRouter from "./routes/students.routes.js";
import teachersRouter from "./routes/teachers.routes.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import pedagogyRouter from "./routes/pedagogy.routes.js";
import helpRouter from "./routes/help.routes.js";
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use("/api/v1/auth", authRouter);
app.use("/api/head/", headmasterRouter);
app.use("/api/teacher/", teachersRouter);
app.use("/api/staff/pedagogy", pedagogyRouter);
app.use("/api/help", helpRouter);
app.use(errorMiddleware);
app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.listen(PORT, async () => {
  console.log(`Server is running on port: ${PORT}`);
  await connectToDatabase();
});

export default app;
