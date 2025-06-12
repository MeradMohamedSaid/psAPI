import { Router } from "express";
import authStaff from "../middlewares/authStaff.middleware.js";
import { JWT_SECRET, JWT_REFRESH_SECRET } from "../config/env.js";
import Member from "../models/member.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Group from "../models/groupe.model.js"; // import your Group model
import School from "../models/school.model.js"; // import your School model
import { Student } from "../models/student.model.js"; // make sure you import Student
import { Teacher } from "../models/teacher.model.js";
import { Types } from "mongoose";

const pedagogyRouter = Router();

pedagogyRouter.get("/", authStaff, async (req, res) => {
  res.send({
    message: "Staff API",
    token: JWT_SECRET,
    refreshSecret: JWT_REFRESH_SECRET,
  });
});
pedagogyRouter.get("/members", authStaff, async (req, res) => {
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
});

pedagogyRouter.get("/member/:username", authStaff, async (req, res) => {
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
});

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

pedagogyRouter.post("/student", authStaff, async (req, res) => {
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
});

pedagogyRouter.get("/students", authStaff, async (req, res) => {
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
});

pedagogyRouter.post("/groupe", authStaff, async (req, res) => {
  try {
    const { level, speciality, modules, classNumber, season } = req.body;
    const schoolId = req.school.schoolId;

    if (
      !level ||
      !speciality ||
      !speciality.name ||
      !modules ||
      !Array.isArray(modules) ||
      modules.length === 0 ||
      !classNumber ||
      !schoolId
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newGroup = new Group({
      level,
      speciality,
      modules,
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
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ error: "Group with this name already exists" });
    }
    res.status(500).json({ error: "Failed to create group" });
  }
});

pedagogyRouter.get("/groupes", authStaff, async (req, res) => {
  try {
    const schoolId = req.school.schoolId;
    const groupes = await Group.find({ schoolId }).sort({ createdAt: -1 });
    res.status(200).json({ count: groupes.length, groupes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch groupes" });
  }
});

pedagogyRouter.get("/groupes/current", authStaff, async (req, res) => {
  try {
    const schoolId = req.school.schoolId;

    const getCurrentSeason = () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();

      if (month >= 8) {
        return `${(year % 100).toString().padStart(2, "0")}${((year + 1) % 100)
          .toString()
          .padStart(2, "0")}`;
      } else {
        return `${((year - 1) % 100).toString().padStart(2, "0")}${(year % 100)
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
});

pedagogyRouter.get("/student/:identifier", authStaff, async (req, res) => {
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
});

pedagogyRouter.post("/student/group", authStaff, async (req, res) => {
  try {
    const { studentId, groupId } = req.body;
    const schoolId = req.school.schoolId;

    if (!studentId || !groupId) {
      return res
        .status(400)
        .json({ error: "studentId and groupId are required" });
    }

    // Verify group exists and belongs to the same school
    const group = await Group.findOne({ _id: groupId, schoolId });
    if (!group) {
      return res
        .status(404)
        .json({ error: "Group not found or does not belong to your school" });
    }

    // Get student and validate ownership
    const student = await Student.findOne({ _id: studentId, schoolId });
    if (!student) {
      return res
        .status(404)
        .json({ error: "Student not found or does not belong to your school" });
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
});

pedagogyRouter.post("/student/group/bulk", authStaff, async (req, res) => {
  try {
    const { groupId, students } = req.body;
    const schoolId = req.school.schoolId;

    if (!groupId || !Array.isArray(students) || students.length === 0) {
      return res
        .status(400)
        .json({ error: "groupId and students[] are required" });
    }

    const group = await Group.findOne({ _id: groupId, schoolId });
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
          (entry) => entry.groupId === groupId && entry.season === currentSeason
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
});

pedagogyRouter.put("/student/group/change", authStaff, async (req, res) => {
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

    const group = await Group.findOne({ _id: newGroupId, schoolId });
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
});

pedagogyRouter.get("/group/:groupId/students", authStaff, async (req, res) => {
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
    res.status(500).json({ error: "Failed to fetch students for this group" });
  }
});

pedagogyRouter.get("/students/nogroup", authStaff, async (req, res) => {
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
});

pedagogyRouter.post("/teacher", authStaff, async (req, res) => {
  try {
    const {
      username,
      password,
      full_name,
      phone_number,
      national_ID,
      email,
      modules,
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
});

export default pedagogyRouter;
