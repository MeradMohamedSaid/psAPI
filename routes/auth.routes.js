import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import School from "../models/school.model.js";
import Member from "../models/member.model.js";
import authenticate from "../middlewares/auth.middleware.js";
import { JWT_SECRET, JWT_REFRESH_SECRET } from "../config/env.js";
const authRouter = Router();

// Default
authRouter.get("/", (req, res) => {
  res.send({
    message: "Private Schools Auth API",
    token: JWT_SECRET,
    refreshSecret: JWT_REFRESH_SECRET,
  });
});

const generateTokens = (payload) => {
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: "3d",
  });

  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
  return { accessToken, refreshToken };
};

authRouter.post("/create", async (req, res) => {
  try {
    const { information, derivationKey, auth } = req.body;

    const existing = await School.findOne({ "auth.email": auth.email });
    if (existing)
      return res.status(409).json({ error: "Email already registered" });

    const hashedPassword = await bcrypt.hash(auth.password, 10);

    const newSchool = await School.create({
      information,
      derivationKey,
      auth: {
        email: auth.email,
        password: hashedPassword,
      },
    });

    res
      .status(201)
      .json({ message: "School account created", schoolId: newSchool._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    let role = "HEADMASTER";
    let school = await School.findOne({ "auth.email": email });

    if (!school) {
      const derivationKey = email.split("@")[1];
      school = await School.findOne({ derivationKey: derivationKey });
      if (!school /*|| school.status !== "ACTIVE"*/)
        return res.status(400).json({ error: "School not found or Inactive" });
      const user = await Member.findOne({
        fullUsername: email,
      });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ error: "Invalid credentials" });
      }
      role = user.role;
      const payload = {
        ...user._doc,
        password: undefined,
      };
      const { accessToken, refreshToken } = generateTokens(payload);

      res.cookie("token", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.json({ accessToken, role });
    }

    const isMatch = await bcrypt.compare(password, school.auth.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const payload = {
      schoolId: school._id,
      role,
      derivationKey: school.derivationKey,
    };
    const { accessToken, refreshToken } = generateTokens(payload);

    res.cookie("token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken, role });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

authRouter.post("/handshake", (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "No refresh token" });

  try {
    const decode = jwt.verify(token, JWT_REFRESH_SECRET);
    const { exp, iat, ...payload } = decode;
    const newAccessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "3d" });

    const newRefreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("token", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
    });
    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ error: "Refresh token expired. Please login again." });
    }
    console.log(err);

    return res.status(403).json({ error: "Invalid refresh token" });
  }
});

authRouter.post("/logout", (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    sameSite: "Strict",
    secure: process.env.NODE_ENV === "production",
  });
  res.json({ message: "Logged out" });
});

// Protected test route
authRouter.get("/me", authenticate, async (req, res) => {
  try {
    var school;
    if (req.role !== "HEADMASTER") {
      school = await School.findById(req.school.schoolId).select(
        "-auth -subscriptions -information.tabspwds"
      );
    } else {
      school = await School.findById(req.school.schoolId).select(
        "-auth.password"
      );
    }

    const token = req.headers.authorization?.split(" ")[1];
    let expiresIn = null;
    if (token) {
      const decoded = jwt.decode(token, { complete: true });
      if (decoded?.payload?.exp) {
        expiresIn = decoded.payload.exp * 1000 - Date.now();
      }
    }

    res.json({
      school,
      accessTokenExpiresIn: expiresIn,
      role: req.role,
      full_name: req.role !== "HEADMASTER" ? req.full_name : undefined,
      phone_number: req.role !== "HEADMASTER" ? req.phone_number : undefined,
      national_ID: req.role !== "HEADMASTER" ? req.national_ID : undefined,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default authRouter;
