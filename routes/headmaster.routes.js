import { Router } from "express";
import authenticateHeadMaster from "../middlewares/authMaster.middleware.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Member from "../models/member.model.js";
import School from "../models/school.model.js";

import { JWT_SECRET, JWT_REFRESH_SECRET } from "../config/env.js";
const headmasterRouter = Router();

headmasterRouter.get("/", authenticateHeadMaster, async (req, res) => {
  res.send({
    message: "HeadMaster API",
    token: JWT_SECRET,
    refreshSecret: JWT_REFRESH_SECRET,
  });
});

headmasterRouter.post("/member", authenticateHeadMaster, async (req, res) => {
  try {
    const {
      username,
      password,
      role,
      full_name,
      phone_number,
      national_ID,
      email,
    } = req.body;
    const schoolId = req.school.schoolId;
    const fullUsername = `${
      role === "TEACHER"
        ? "tr"
        : role === "STAFF"
        ? "ad"
        : role === "STUDENT"
        ? "st"
        : "par"
    }${username}@${req.school.derivationKey}`;
    if (
      !username ||
      !fullUsername ||
      !password ||
      !role ||
      !full_name ||
      !phone_number ||
      !national_ID ||
      !email ||
      !schoolId
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existing = await Member.findOne({
      $or: [{ email }, { fullUsername }, { phone_number }, { national_ID }],
      schoolId,
    });
    if (existing) {
      return res.status(409).json({
        error:
          "User with this (fullUsername or email or phone_number or national_ID) already exists",
        username: fullUsername,
        phone_number,
        email,
        national_ID,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newMember = new Member({
      username,
      full_name,
      phone_number,
      national_ID,
      email,
      fullUsername,
      password: hashedPassword,
      role,
      schoolId,
    });

    await newMember.save();

    res
      .status(201)
      .json({ message: "Member created successfully", member: newMember });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to create member" });
  }
});

headmasterRouter.get(
  "/member/:username",
  authenticateHeadMaster,
  async (req, res) => {
    try {
      const usernameParam = req.params.username;
      const member = await Member.findOne({ fullUsername: usernameParam });

      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }

      res.json({
        ...member._doc,
        password: undefined,
        __v: undefined,
        updatedAt: undefined,
        fullUsername: undefined,
        username: undefined,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to get member info" });
    }
  }
);

export default headmasterRouter;
