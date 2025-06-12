import { Router } from "express";
import authenticateTeacher from "../middlewares/authTeacher.middleware.js";
import { JWT_SECRET, JWT_REFRESH_SECRET } from "../config/env.js";

const teachersRouter = Router();

teachersRouter.get("/", authenticateTeacher, async (req, res) => {
  res.send({
    message: "Teacher API",
    token: JWT_SECRET,
    refreshSecret: JWT_REFRESH_SECRET,
  });
});

export default teachersRouter;
