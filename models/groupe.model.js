import mongoose from "mongoose";
import SchoolStructure from "./specialities.model.js";

const { Schema, model } = mongoose;

// ✅ Utility: generate abbreviation
function generateAbbreviation(name) {
  return name
    .split(/\s+/)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function getCurrentSeason() {
  const today = new Date();
  let startYear = today.getFullYear();
  const month = today.getMonth() + 1;

  if (month >= 7) {
    startYear += 1;
  }
  const prevYearShort = String(startYear - 1).slice(-2);
  const thisYearShort = String(startYear).slice(-2);
  return `${prevYearShort}${thisYearShort}`;
}

function getNextGroupLetter(count) {
  const MAX_LETTER_INDEX = 6;
  if (count > MAX_LETTER_INDEX) {
    const err = new Error(
      `Too many groups: maximum is ${MAX_LETTER_INDEX + 1} (A-G)`
    );
    err.name = "ValidationError";
    throw err;
  }
  return String.fromCharCode(65 + count);
}

// ✅ Schema
const groupSchema = new Schema(
  {
    id: { type: String, required: true },
    level: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    speciality: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      name: {
        type: String,
        required: true,
        trim: true,
      },
      abbreviation: {
        type: String,
        trim: true,
      },
    },
    classNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    season: {
      type: String,
    },
    groupName: {
      type: String,
      unique: true,
      trim: true,
    },
    schoolId: {
      type: String,
      required: true,
      ref: "School",
    },
    teachers: {
      type: [
        {
          teacherId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: "Member",
          },
          moduleId: { type: String, required: true },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
  { id: false }
);

// ✅ Pre-validation: auto-fill everything
groupSchema.pre("validate", async function (next) {
  try {
    // 1️⃣ Ensure ObjectId
    if (
      this.speciality?.id &&
      !(this.speciality.id instanceof mongoose.Types.ObjectId)
    ) {
      this.speciality.id = new mongoose.Types.ObjectId(this.speciality.id);
    }

    // 2️⃣ Lookup name if missing
    if (this.speciality?.id && !this.speciality.name) {
      const objectId = this.speciality.id;

      const structure = await SchoolStructure.findOne({
        $or: [
          { "primaire.specialities._id": objectId },
          { "cem.specialities._id": objectId },
          { "lycee.specialities._id": objectId },
        ],
      });

      if (!structure) {
        return next(new Error("Speciality not found"));
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
        return next(new Error("Speciality not found"));
      }

      this.speciality.name = foundSpeciality.name.name_fr;
    }

    if (!this.speciality.abbreviation) {
      this.speciality.abbreviation = generateAbbreviation(this.speciality.name);
    }

    if (!this.season) {
      this.season = getCurrentSeason();
    }

    const Group = this.constructor;
    const count = await Group.countDocuments({
      level: this.level,
      season: this.season,
      "speciality.abbreviation": this.speciality.abbreviation,
      schoolId: this.schoolId,
    });

    const nextLetter = getNextGroupLetter(count);

    if (!this.groupName) {
      this.groupName = `${this.level}-${this.speciality.abbreviation}-${nextLetter}`;
    }

    if (!this.id) {
      this.id = `grp${this.season}-${this.groupName}`;
    }
    next();
  } catch (err) {
    next(err);
  }
});

const Group = model("Group", groupSchema);

export default Group;
