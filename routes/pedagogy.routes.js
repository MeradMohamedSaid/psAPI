import { Router } from "express";
import authStaff from "../middlewares/authStaff.middleware.js";
import { authTabAccess } from "../middlewares/authTabAcees.middleware.js";
import { JWT_SECRET, JWT_REFRESH_SECRET, TAB_SECRET } from "../config/env.js";
import Member from "../models/member.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Group from "../models/groupe.model.js"; // import your Group model
import School from "../models/school.model.js"; // import your School model
import SchoolStructure from "../models/specialities.model.js";

import { Student } from "../models/student.model.js"; // make sure you import Student
import { Teacher } from "../models/teacher.model.js";
import { Types } from "mongoose";

const pedagogyRouter = Router();

pedagogyRouter.post("/verify-password", authStaff, async (req, res) => {
  try {
    const { password } = req.body;
    const schoolId = req.school.schoolId;

    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({ error: "School not found" });
    }

    const hashedPassword = school.information.tabspwds.pedagogy;

    const isMatch = await bcrypt.compare(password, hashedPassword);
    if (!isMatch) {
      return res.status(401).json({ valid: false, error: "Invalid password" });
    }

    const tabToken = jwt.sign({ tab: "pedagogy", schoolId }, TAB_SECRET, {
      expiresIn: "1h",
    });

    res.cookie("tab_access_token", tabToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 60 * 60 * 1000,
    });

    res
      .status(200)
      .json({ valid: true, message: "Password correct, access granted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ valid: false, error: "Failed to verify password" });
  }
});

pedagogyRouter.get(
  "/",
  authStaff,
  authTabAccess("pedagogy"),
  async (req, res) => {
    res.send({
      message: "Staff API",
      token: JWT_SECRET,
      refreshSecret: JWT_REFRESH_SECRET,
    });
  }
);

pedagogyRouter.get(
  "/members",
  authStaff,
  authTabAccess("pedagogy"),
  async (req, res) => {
    try {
      const schoolId = req.school.schoolId;
      const members = await Member.find({ schoolId })
        .select("-password -__v -updatedAt -fullUsername -username -schoolId")
        .sort({ createdAt: -1 });
      res.json(members);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch members" });
    }
  }
);

pedagogyRouter.get(
  "/member/:username",
  authStaff,
  authTabAccess("pedagogy"),
  async (req, res) => {
    try {
      const usernameParam = req.params.username;
      const schoolId = req.school.schoolId.toString();
      const member = await Member.findOne({
        $or: [
          { username: usernameParam },
          { fullUsername: usernameParam },
          { email: usernameParam },
        ],
        schoolId,
      });

      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }

      if (member.schoolId.toString() !== req.school.schoolId.toString()) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (
        member.role !== "TEACHER" &&
        member.role !== "STUDENT" &&
        member.role !== "PARENT"
      ) {
        return res.status(403).json({ error: "Access denied" });
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

function getCurrentSchoolSeason() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0 = Jan, 5 = June

  if (month >= 5) {
    // After May → new season
    return `${(year % 100).toString().padStart(2, "0")}${((year + 1) % 100)
      .toString()
      .padStart(2, "0")}`;
  } else {
    // Before June → same academic year
    return `${((year - 1) % 100).toString().padStart(2, "0")}${(year % 100)
      .toString()
      .padStart(2, "0")}`;
  }
}

pedagogyRouter.post(
  "/student",
  authStaff,
  authTabAccess("pedagogy"),
  async (req, res) => {
    try {
      const {
        username,
        password,
        full_name,
        phone_number,
        national_ID,
        email,
        parent_national_IDs,
        parent_phone_numbers,
        nationality,
        birthDate,
        birthCity,
        sex,
        registeredGroupId,
      } = req.body;

      const role = "STUDENT";
      const schoolId = req.school.schoolId;
      const school = await School.findById(schoolId);
      if (!school) {
        return res.status(404).json({ error: "School not found" });
      }

      const fullUsername = `st${username}@${school.derivationKey}`;

      if (
        !username ||
        !password ||
        !full_name ||
        !phone_number ||
        !national_ID ||
        !email ||
        !nationality ||
        !birthDate ||
        !birthCity ||
        !sex
      ) {
        return res
          .status(400)
          .json({ error: "All required fields must be filled" });
      }

      const existing = await Member.findOne({
        $or: [{ email }, { fullUsername }, { phone_number }, { national_ID }],
        schoolId,
      });

      if (existing) {
        return res.status(409).json({
          error: "User already exists with this email, phone, or national ID",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const groupHistory = [];
      let registered = false;

      if (registeredGroupId) {
        registered = true;
        const season = getCurrentSchoolSeason();
        groupHistory.push({
          groupId: registeredGroupId,
          season,
        });
      }

      const student = new Student({
        username,
        password: hashedPassword,
        full_name,
        phone_number,
        national_ID,
        email,
        fullUsername,
        role,
        schoolId,
        parent_national_IDs,
        parent_phone_numbers,
        nationality,
        birthDate,
        birthCity,
        sex,
        registeredGroupId: registered ? registeredGroupId : null,
        registered,
        groupHistory,
      });

      await student.save();

      res.status(201).json({
        message: "Student created successfully",
        student: {
          ...student._doc,
          password: undefined,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create student" });
    }
  }
);

pedagogyRouter.get(
  "/students",
  authStaff,
  authTabAccess("pedagogy"),
  async (req, res) => {
    try {
      const schoolId = req.school.schoolId;
      const students = await Student.find({ schoolId }).select(
        "-password -__v -updatedAt"
      );
      res.status(200).json({ count: students.length, students });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch students" });
    }
  }
);

pedagogyRouter.post(
  "/groupe",
  authStaff,
  authTabAccess("pedagogy"),
  async (req, res) => {
    try {
      const { level, speciality, classNumber, season } = req.body;
      const schoolId = req.school.schoolId;

      if (
        !level ||
        !speciality ||
        !speciality.id ||
        !season ||
        !classNumber ||
        !schoolId
      ) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const newGroup = new Group({
        level,
        speciality,
        classNumber,
        schoolId,
        season,
      });
      await newGroup.save();

      res
        .status(201)
        .json({ message: "Group created successfully", group: newGroup });
    } catch (err) {
      console.error(err);

      // ✅ Handle duplicate key error
      if (err.code === 11000) {
        return res.status(409).json({
          error: "Group with this name already exists",
        });
      }

      // ✅ Handle Mongoose validation errors (e.g. getNextGroupLetter throws)
      if (err.name === "ValidationError") {
        return res.status(400).json({
          error: err.message,
        });
      }

      // ✅ Fallback: server error
      res.status(500).json({
        error: "Failed to create group",
      });
    }
  }
);

pedagogyRouter.get(
  "/groupes",
  authStaff,
  authTabAccess("pedagogy"),
  async (req, res) => {
    try {
      const schoolId = req.school.schoolId;
      const groupes = await Group.find({ schoolId }).sort({ createdAt: -1 });
      res.status(200).json({ count: groupes.length, groupes });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch groupes" });
    }
  }
);

pedagogyRouter.get(
  "/groupes/current",
  authStaff,
  authTabAccess("pedagogy"),
  async (req, res) => {
    try {
      const schoolId = req.school.schoolId;

      const getCurrentSeason = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();

        if (month >= 8) {
          return `${(year % 100).toString().padStart(2, "0")}${(
            (year + 1) %
            100
          )
            .toString()
            .padStart(2, "0")}`;
        } else {
          return `${((year - 1) % 100).toString().padStart(2, "0")}${(
            year % 100
          )
            .toString()
            .padStart(2, "0")}`;
        }
      };

      const season = getCurrentSeason();

      const groupes = await Group.find({ schoolId, season }).sort({
        createdAt: -1,
      });

      res.status(200).json({ count: groupes.length, groupes });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ error: "Failed to fetch groupes for current season" });
    }
  }
);

pedagogyRouter.get(
  "/student/:identifier",
  authStaff,
  authTabAccess("pedagogy"),
  async (req, res) => {
    try {
      const { identifier } = req.params;
      const schoolId = req.school.schoolId;
      let query = {
        schoolId,
      };
      if (Types.ObjectId.isValid(identifier)) {
        query._id = identifier;
      } else if (identifier.includes("@")) {
        query.fullUsername = identifier;
      } else {
        const school = await School.findById(schoolId);
        if (!school) {
          return res.status(404).json({ error: "School not found" });
        }
        query.fullUsername = `st${identifier}@${school.derivationKey}`;
      }

      const student = await Student.findOne(query).select(
        "-password -__v -updatedAt"
      );

      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      res.status(200).json({ student });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to get student info" });
    }
  }
);

pedagogyRouter.post(
  "/student/group",
  authStaff,
  authTabAccess("pedagogy"),
  async (req, res) => {
    try {
      const { studentId, groupId } = req.body;
      const schoolId = req.school.schoolId;

      if (!studentId || !groupId) {
        return res
          .status(400)
          .json({ error: "studentId and groupId are required" });
      }

      const group = await Group.findOne({ id: groupId, schoolId });
      if (!group) {
        return res
          .status(404)
          .json({ error: "Group not found or does not belong to your school" });
      }

      // Get student and validate ownership
      const student = await Student.findOne({ _id: studentId, schoolId });
      if (!student) {
        return res.status(404).json({
          error: "Student not found or does not belong to your school",
        });
      }

      if (student.registered) {
        return res
          .status(400)
          .json({ error: "Student is already assigned to a group" });
      }

      student.registeredGroupId = groupId;
      student.registered = true;

      const currentSeason = group.season || getCurrentSchoolSeason();

      const alreadyInHistory = student.groupHistory.some(
        (h) => h.groupId === groupId && h.season === currentSeason
      );
      if (!alreadyInHistory) {
        student.groupHistory.push({
          groupId,
          season: currentSeason,
        });
      }

      await student.save();

      res.status(200).json({
        message: "Student assigned to group successfully",
        student: {
          studentID: student._id,
          full_name: student.full_name,
          registeredGroupId: student.registeredGroupId,
          registered: student.registered,
          groupHistory: student.groupHistory,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to assign student to group" });
    }
  }
);

pedagogyRouter.post(
  "/student/group/bulk",
  authStaff,
  authTabAccess("pedagogy"),
  async (req, res) => {
    try {
      const { groupId, students } = req.body;
      const schoolId = req.school.schoolId;

      if (!groupId || !Array.isArray(students) || students.length === 0) {
        return res
          .status(400)
          .json({ error: "groupId and students[] are required" });
      }

      const group = await Group.findOne({ id: groupId, schoolId });
      if (!group) {
        return res
          .status(404)
          .json({ error: "Group not found or not part of your school" });
      }

      const currentSeason = group.season || getCurrentSchoolSeason();
      const success = [];
      const failed = [];

      for (const studentId of students) {
        try {
          const student = await Student.findOne({ _id: studentId, schoolId });

          if (!student) {
            failed.push({
              studentId,
              reason: "Student not found or not in your school",
            });
            continue;
          }

          if (student.registered) {
            failed.push({
              studentId,
              full_name: student.full_name,
              reason: "Already registered to a group",
            });
            continue;
          }

          const alreadyInHistory = student.groupHistory.some(
            (entry) =>
              entry.groupId === groupId && entry.season === currentSeason
          );

          if (!alreadyInHistory) {
            student.groupHistory.push({ groupId, season: currentSeason });
          }

          student.registeredGroupId = groupId;
          student.registered = true;

          await student.save();

          success.push({
            studentID: student._id,
            full_name: student.full_name,
            registeredGroupId: student.registeredGroupId,
            registered: student.registered,
            groupHistory: student.groupHistory,
          });
        } catch (err) {
          failed.push({
            studentId,
            reason: "Unexpected error",
            details: err.message,
          });
        }
      }

      return res.status(200).json({
        message: "Bulk group assignment completed",
        successCount: success.length,
        failureCount: failed.length,
        success,
        failed,
      });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ error: "Server error during bulk group assignment" });
    }
  }
);

pedagogyRouter.put(
  "/student/group/change",
  authStaff,
  authTabAccess("pedagogy"),
  async (req, res) => {
    try {
      const { studentId, newGroupId } = req.body;
      const schoolId = req.school.schoolId;

      if (!studentId || !newGroupId) {
        return res
          .status(400)
          .json({ error: "studentId and newGroupId are required" });
      }

      const student = await Student.findOne({ _id: studentId, schoolId });
      if (!student) {
        return res
          .status(404)
          .json({ error: "Student not found or not part of your school" });
      }

      const group = await Group.findOne({ id: newGroupId, schoolId });
      if (!group) {
        return res
          .status(404)
          .json({ error: "Group not found or not part of your school" });
      }

      const currentSeason = group.season || getCurrentSchoolSeason();

      if (!student.registered) {
        return res
          .status(400)
          .json({ error: "Student is not registred to any group yet" });
      }

      if (student.registeredGroupId === newGroupId) {
        return res.status(200).json({
          message: "Student already registered to this group",
          student: {
            studentID: student._id,
            full_name: student.full_name,
            registeredGroupId: student.registeredGroupId,
            groupHistory: student.groupHistory,
          },
        });
      }

      student.groupHistory.push({
        groupId: newGroupId,
        season: currentSeason,
        reason: "TRANSFERED",
      });

      student.registeredGroupId = newGroupId;
      student.registered = true;

      await student.save();

      return res.status(200).json({
        message: "Group changed successfully",
        student: {
          studentID: student._id,
          full_name: student.full_name,
          registeredGroupId: student.registeredGroupId,
          groupHistory: student.groupHistory,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to change group for student" });
    }
  }
);

pedagogyRouter.get(
  "/group/:groupId/students",
  authStaff,
  authTabAccess("pedagogy"),
  async (req, res) => {
    try {
      const { groupId } = req.params;
      const schoolId = req.school.schoolId;

      if (!groupId) {
        return res.status(400).json({ error: "Group ID is required" });
      }

      const students = await Student.find({
        schoolId,
        registeredGroupId: groupId,
      }).select("full_name phone_number parent_phone_numbers birthDate sex");

      res.status(200).json({
        groupId,
        count: students.length,
        students,
      });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ error: "Failed to fetch students for this group" });
    }
  }
);

pedagogyRouter.get(
  "/students/nogroup",
  authStaff,
  authTabAccess("pedagogy"),
  async (req, res) => {
    try {
      const schoolId = req.school.schoolId;

      const studentsWithoutGroup = await Student.find({
        schoolId,
        $or: [
          { registeredGroupId: null },
          { registeredGroupId: { $exists: false } },
        ],
      }).select("full_name email phone_number national_ID birthDate sex");

      res.status(200).json({
        count: studentsWithoutGroup.length,
        students: studentsWithoutGroup,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch students without group" });
    }
  }
);

pedagogyRouter.post(
  "/teacher",
  authStaff,
  authTabAccess("pedagogy"),
  async (req, res) => {
    try {
      const {
        username,
        password,
        full_name,
        phone_number,
        national_ID,
        email,
        modules,
        currentGroups,
      } = req.body;

      const role = "TEACHER";
      const schoolId = req.school.schoolId;

      const school = await School.findById(schoolId);
      if (!school) {
        return res.status(404).json({ error: "School not found" });
      }

      const fullUsername = `tr${username}@${school.derivationKey}`;

      if (
        !username ||
        !password ||
        !full_name ||
        !phone_number ||
        !national_ID ||
        !email ||
        !modules ||
        modules.length === 0
      ) {
        return res
          .status(400)
          .json({ error: "All required fields must be filled" });
      }

      const existing = await Member.findOne({
        $or: [{ email }, { fullUsername }, { phone_number }, { national_ID }],
        schoolId,
      });

      if (existing) {
        return res.status(409).json({
          error: "User already exists with this email, phone, or national ID",
        });
      }

      // ✅ Validate currentGroups: must be array of { groupId, moduleId }
      let validCurrentGroups = [];
      if (Array.isArray(currentGroups)) {
        validCurrentGroups = currentGroups.filter(
          (cg) => cg.groupId && cg.moduleId
        );
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const teacher = new Teacher({
        username,
        password: hashedPassword,
        full_name,
        phone_number,
        national_ID,
        email,
        fullUsername,
        role,
        schoolId,
        modules,
        currentGroups: validCurrentGroups,
      });

      await teacher.save();

      res.status(201).json({
        message: "Teacher created successfully",
        teacher: {
          ...teacher._doc,
          password: undefined,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create teacher" });
    }
  }
);

pedagogyRouter.post(
  "/teachers/assign",
  authStaff,
  authTabAccess("pedagogy"),
  async (req, res) => {
    try {
      const { groupId, assignments } = req.body;

      if (!groupId || !Array.isArray(assignments) || assignments.length === 0) {
        return res.status(400).json({
          error: "groupId and a non-empty assignments array are required",
        });
      }

      // ✅ Load group
      const group = await Group.findOne({ id: groupId });
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      // ✅ Load the structure to verify allowed modules
      const structure = await SchoolStructure.findOne({
        $or: [
          { "primaire.specialities._id": group.speciality.id },
          { "cem.specialities._id": group.speciality.id },
          { "lycee.specialities._id": group.speciality.id },
        ],
      });
      if (!structure) {
        return res
          .status(404)
          .json({ error: "Speciality structure not found" });
      }

      // ✅ Extract correct school type
      const schoolTypes = ["primaire", "cem", "lycee"];
      let speciality = null;
      for (const type of schoolTypes) {
        const specialities = structure[type]?.specialities || [];
        const match = specialities.find(
          (s) => s._id.toString() === group.speciality.id.toString()
        );
        if (match) {
          speciality = match;
          break;
        }
      }
      if (!speciality) {
        return res
          .status(404)
          .json({ error: "Speciality not found in structure" });
      }

      // ✅ Find level data for this group’s level
      const levelData = speciality.levels.find(
        (lvl) => lvl.level === group.level
      );
      if (!levelData) {
        return res.status(404).json({ error: "Level not found in speciality" });
      }

      // ✅ Collect allowed module IDs for this level
      const allowedModuleIds = new Set(levelData.modules.map((m) => m.id));

      // ✅ Track modules already used in the group
      const existingModules = new Set(group.teachers.map((t) => t.moduleId));

      // ✅ Cache fetched teachers
      const teachersToUpdate = {};

      for (const { teacherId, moduleId } of assignments) {
        if (!teacherId || !moduleId) {
          return res.status(400).json({
            error: "Each assignment must include teacherId and moduleId",
          });
        }

        // ✅ Module must be allowed for this speciality & level
        if (!allowedModuleIds.has(moduleId)) {
          return res.status(400).json({
            error: `Module ${moduleId} is not valid for this group’s speciality and level`,
          });
        }

        // ✅ Module must not already be assigned in this group
        if (existingModules.has(moduleId)) {
          return res.status(409).json({
            error: `Module ${moduleId} already assigned in this group`,
          });
        }

        // ✅ Load teacher (or reuse)
        let teacher = teachersToUpdate[teacherId];
        if (!teacher) {
          teacher = await Teacher.findById(teacherId);
          if (!teacher) {
            return res
              .status(404)
              .json({ error: `Teacher ${teacherId} not found` });
          }
          teachersToUpdate[teacherId] = teacher;
        }

        // ✅ Teacher must have this module
        const hasModule = teacher.modules.some((m) => m.id === moduleId);
        if (!hasModule) {
          return res.status(400).json({
            error: `Teacher ${teacherId} does not have module ${moduleId}`,
          });
        }

        // ✅ Teacher must not already teach this module in this group
        const alreadyTeaching = group.teachers.some(
          (t) => t.teacherId.toString() === teacherId && t.moduleId === moduleId
        );
        if (alreadyTeaching) {
          return res.status(409).json({
            error: `Teacher ${teacherId} already teaches module ${moduleId} in this group`,
          });
        }

        // ✅ Assign teacher to group
        group.teachers.push({ teacherId, moduleId });

        // ✅ Add to teacher’s currentGroups
        teacher.currentGroups.push({ groupId, moduleId });

        // ✅ Log in teachingHistory
        teacher.teachingHistory.push({
          groupId,
          moduleId,
          reason: "assigned",
          timestamp: new Date(),
        });

        // ✅ Mark module as now assigned in this group
        existingModules.add(moduleId);
      }

      // ✅ Save everything
      await group.save();
      await Promise.all(Object.values(teachersToUpdate).map((t) => t.save()));

      res.json({
        message: "Teachers assigned successfully",
        group,
        teachers: Object.values(teachersToUpdate).map((teacher) => ({
          _id: teacher._id,
          full_name: teacher.full_name,
          currentGroups: teacher.currentGroups,
          teachingHistory: teacher.teachingHistory,
        })),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to assign teachers" });
    }
  }
);

export default pedagogyRouter;
