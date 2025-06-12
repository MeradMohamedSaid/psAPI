// middleware/authenticateHeadMaster.js
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";

const authenticateHeadMaster = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const error = new Error("Authorization header missing or malformed");
    error.statusCode = 401;
    return next(error);
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "HEADMASTER") {
      const error = new Error("Unauthorized access");
      error.statusCode = 403;
      return next(error);
    }

    req.school = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      err.message = "Access token expired";
      err.statusCode = 401;
    } else if (err.name === "JsonWebTokenError") {
      err.message = "Invalid access token";
      err.statusCode = 401;
    } else {
      err.message = "Failed to authenticate token";
      err.statusCode = 500;
    }

    next(err);
  }
};

export default authenticateHeadMaster;
