import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import errorMiddleware from "./error.middleware.js";

const authenticate = (req, res, errorMiddleware) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const error = new Error("Authorization header missing or malformed");
    error.statusCode = 401;
    return errorMiddleware(error);
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("decoded auth", decoded);
    req.school = decoded;
    req.role = decoded.role;

    if (decoded.role !== "HEADMASTER") {
      req.full_name = decoded.full_name;
      req.phone_number = decoded.phone_number;
      req.national_ID = decoded.national_ID;
    }
    errorMiddleware();
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

    errorMiddleware(err);
  }
};

export default authenticate;
