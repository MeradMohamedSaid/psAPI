import { Router } from "express";
import SchoolStructure from "../models/specialities.model.js";
const helpRouter = Router();
import mongoose from "mongoose"; // make sure you have this for ObjectId
helpRouter.get("/", async (req, res) => {
  res.send({
    message: "Help API",
  });
});
// helpRouter.post("/structure", async (req, res) => {
//   try {
//     const schoolData = req.body;
//     const newStructure = new SchoolStructure(schoolData);
//     await newStructure.save();
//     res.status(201).json({
//       message: "School structure created successfully!",
//     });
//   } catch (error) {
//     if (error.name === "ValidationError") {
//       return res
//         .status(400)
//         .json({ message: "Validation Error", errors: error.errors });
//     }

//     // Handle other server errors
//     console.error("Error creating school structure:", error);
//     res.status(500).json({ message: "Server Error" });
//   }
// });

helpRouter.get("/structure/specialities/:type", async (req, res) => {
  const { type } = req.params;
  try {
    const structure = await SchoolStructure.findOne({
      [`${type}`]: { $exists: true },
    });

    if (!structure) {
      return res.status(404).json({ message: "School structure not found" });
    }

    const specialities = structure[type]?.specialities || [];

    const result = specialities.map((speciality) => ({
      _id: speciality._id,
      name: speciality.name,
      levels: (speciality.levels || []).map((level) => level.level),
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching school structure:", error);
    return res.status(500).json({ message: "Server Error" });
  }
});

helpRouter.get("/structure/modules/:type", async (req, res) => {
  const { type } = req.params;

  try {
    const structure = await SchoolStructure.findOne({
      [`${type}`]: { $exists: true },
    });

    if (!structure) {
      return res.status(404).json({ message: "School structure not found" });
    }

    const specialities = structure[type]?.specialities || [];

    const modulesMap = new Map();

    specialities.forEach((speciality) => {
      (speciality.levels || []).forEach((level) => {
        (level.modules || []).forEach((module) => {
          if (!modulesMap.has(module.id)) {
            modulesMap.set(module.id, {
              id: module.id,
              name: module.name,
            });
          }
        });
      });
    });

    const result = Array.from(modulesMap.values());

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching modules:", error);
    return res.status(500).json({ message: "Server Error" });
  }
});

helpRouter.post("/structure/modules/by-ids", async (req, res) => {
  const { type, ids } = req.body;

  if (!type || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      message: "Please provide a valid 'type' and an array of module IDs.",
    });
  }

  try {
    const structure = await SchoolStructure.findOne({
      [`${type}`]: { $exists: true },
    });
    if (!structure) {
      return res.status(404).json({ message: "School structure not found" });
    }
    const specialities = structure[type]?.specialities || [];
    const modulesMap = new Map();
    specialities.forEach((speciality) => {
      (speciality.levels || []).forEach((level) => {
        (level.modules || []).forEach((module) => {
          if (ids.includes(module.id) && !modulesMap.has(module.id)) {
            modulesMap.set(module.id, {
              id: module.id,
              name: module.name,
            });
          }
        });
      });
    });
    const result = Array.from(modulesMap.values());
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching modules by IDs:", error);
    return res.status(500).json({ message: "Server Error" });
  }
});

helpRouter.get("/structure/specialities/:type/:level", async (req, res) => {
  const { type, level } = req.params;

  try {
    const structure = await SchoolStructure.findOne({
      [`${type}`]: { $exists: true },
    });

    if (!structure) {
      return res.status(404).json({ message: "School structure not found" });
    }

    const specialities = structure[type]?.specialities || [];

    const result = specialities
      .filter((speciality) =>
        (speciality.levels || []).some((l) => l.level === parseInt(level))
      )
      .map((speciality) => ({
        _id: speciality._id,
        name: speciality.name,
      }));

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching specialities by level:", error);
    return res.status(500).json({ message: "Server Error" });
  }
});

helpRouter.get("/structure/speciality/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const structure = await SchoolStructure.findOne({
      $or: [
        { "primaire.specialities._id": id },
        { "cem.specialities._id": id },
        { "lycee.specialities._id": id },
      ],
    });

    if (!structure) {
      return res.status(404).json({ message: "Speciality not found" });
    }

    const schoolTypes = ["primaire", "cem", "lycee"];
    let foundSpeciality = null;

    for (const type of schoolTypes) {
      const specialities = structure[type]?.specialities || [];
      const match = specialities.find((s) => s._id.toString() === id);
      if (match) {
        foundSpeciality = match;
        break;
      }
    }

    if (!foundSpeciality) {
      return res.status(404).json({ message: "Speciality not found" });
    }

    const levels = (foundSpeciality.levels || []).map((level) => level.level);

    res.status(200).json({
      _id: foundSpeciality._id,
      name: foundSpeciality.name,
      levels: levels,
    });
  } catch (error) {
    console.error("Error fetching speciality by ID:", error);
    return res.status(500).json({ message: "Server Error" });
  }
});

helpRouter.get("/structure/speciality/:id/level/:level", async (req, res) => {
  const { id, level } = req.params;

  try {
    const objectId = new mongoose.Types.ObjectId(id);
    const structure = await SchoolStructure.findOne({
      $or: [
        { "primaire.specialities._id": objectId },
        { "cem.specialities._id": objectId },
        { "lycee.specialities._id": objectId },
      ],
    });

    if (!structure) {
      return res.status(404).json({ message: "Speciality not found" });
    }

    const schoolTypes = ["primaire", "cem", "lycee"];
    let foundSpeciality = null;

    for (const type of schoolTypes) {
      const specialities = structure[type]?.specialities || [];
      const match = specialities.find(
        (s) => s._id.toString() === objectId.toString()
      );
      if (match) {
        foundSpeciality = match;
        break;
      }
    }

    if (!foundSpeciality) {
      return res.status(404).json({ message: "Speciality not found" });
    }

    // Find the requested level in this speciality
    const requestedLevel = foundSpeciality.levels.find(
      (l) => l.level === parseInt(level)
    );

    if (!requestedLevel) {
      return res.status(404).json({ message: "Level not found in speciality" });
    }

    res.status(200).json({
      specialityId: foundSpeciality._id,
      specialityName: foundSpeciality.name,
      level: requestedLevel.level,
      modulesCount: requestedLevel.modulesCount,
      optionalModulesCount: requestedLevel.optionalModulesCount,
      totalWeeklyHours: requestedLevel.totalWeeklyHours,
      modules: requestedLevel.modules, // or limit fields if you want
    });
  } catch (error) {
    console.error("Error fetching level info:", error);
    return res.status(500).json({ message: "Server Error" });
  }
});

export default helpRouter;
