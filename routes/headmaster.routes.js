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
    const { username, password, full_name, phone_number, national_ID, email } =
      req.body;

    const schoolId = req.school.schoolId;

    const fullUsername = `ad${username}@${req.school.derivationKey}`;

    // ✅ Validate required fields
    if (
      !username ||
      !fullUsername ||
      !password ||
      !full_name ||
      !phone_number ||
      !national_ID ||
      !email ||
      !schoolId
    ) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const existing = await Member.findOne({
      $or: [{ email }, { fullUsername }, { phone_number }, { national_ID }],
      schoolId,
    });
    if (existing) {
      return res.status(409).json({
        error:
          "A member with this username, email, phone number, or national ID already exists.",
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
      role: "STAFF", // force role to STAFF
      schoolId,
    });

    await newMember.save();

    res.status(201).json({
      message: "STAFF member created successfully",
      member: newMember,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create staff member" });
  }
});

headmasterRouter.get("/members", authenticateHeadMaster, async (req, res) => {
  try {
    const schoolId = req.school.schoolId;

    const members = await Member.find({ schoolId });

    const sanitizedMembers = members.map((member) => {
      const { password, __v, updatedAt, fullUsername, ...rest } = member._doc;
      return rest;
    });

    res.json(sanitizedMembers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get members" });
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

headmasterRouter.post(
  "/school/tabspwds",
  authenticateHeadMaster,
  async (req, res) => {
    try {
      const { pedagogy, finance, attendance, assets } = req.body;

      const schoolId = req.school.schoolId;

      const school = await School.findById(schoolId);

      if (!school) {
        return res.status(404).json({ error: "School not found" });
      }

      if (pedagogy) {
        const hashed = await bcrypt.hash(pedagogy, 10);
        school.information.tabspwds.pedagogy = hashed;
      }
      if (finance) {
        const hashed = await bcrypt.hash(finance, 10);
        school.information.tabspwds.finance = hashed;
      }
      if (attendance) {
        const hashed = await bcrypt.hash(attendance, 10);
        school.information.tabspwds.attendance = hashed;
      }
      if (assets) {
        const hashed = await bcrypt.hash(assets, 10);
        school.information.tabspwds.assets = hashed;
      }

      await school.save();

      res.json({
        message: "Tab passwords updated successfully",
        updated: {
          pedagogy: !!pedagogy,
          finance: !!finance,
          attendance: !!attendance,
          assets: !!assets,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update tab passwords" });
    }
  }
);

export default headmasterRouter;
