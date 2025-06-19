import jwt from "jsonwebtoken";
import { TAB_SECRET } from "../config/env.js";
/**
 * Middleware to authenticate access to specific tabs based on JWT token.
 * @param {string} requiredTab - The tab that the user must have access to.
 * @returns {function} Middleware function to check tab access.
 */

export const authTabAccess = (expectedTab) => {
  return (req, res, next) => {
    console.log("authTabAccess middleware called by :", req.school.role);
    if (req.school.role === "HEADMASTER") {
      next();
      return;
    }
    const token = req.cookies.tab_access_token;

    if (!token) {
      return res.status(403).json({ error: "Tab access token missing" });
    }

    try {
      const decoded = jwt.verify(token, TAB_SECRET);

      if (decoded.tab !== expectedTab) {
        return res.status(403).json({ error: "No access to this tab" });
      }

      if (req.school && decoded.schoolId !== req.school.schoolId) {
        return res.status(403).json({ error: "Token school mismatch" });
      }

      const refreshedToken = jwt.sign(
        {
          tab: decoded.tab,
          schoolId: decoded.schoolId,
        },
        TAB_SECRET,
        { expiresIn: "1h" }
      );

      res.cookie("tab_access_token", refreshedToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 60 * 60 * 1000,
      });

      req.tabAccess = decoded;
      console.log("authTab:", decoded);
      next();
    } catch (err) {
      console.error(err);

      res.clearCookie("tab_access_token", {
        httpOnly: true,
        sameSite: "Strict",
        secure: process.env.NODE_ENV === "production",
      });

      return res
        .status(403)
        .json({ error: "Invalid or expired tab access token" });
    }
  };
};
