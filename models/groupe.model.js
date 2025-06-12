import mongoose from "mongoose";

const { Schema, model } = mongoose;

const groupSchema = new Schema(
  {
    _id: {
      type: String,
    },
    level: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    speciality: {
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
    modules: [
      {
        type: String,
        required: true,
        trim: true,
      },
    ],
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
  },
  { timestamps: true }
);

function generateAbbreviation(name) {
  return name
    .split(/\s+/)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function getCurrentSeason() {
  const today = new Date();
  let startYear = today.getFullYear();
  const month = today.getMonth() + 1; // 1-12
  if (month >= 7) {
    startYear += 1;
  }
  const prevYearShort = String(startYear - 1).slice(-2);
  const thisYearShort = String(startYear).slice(-2);
  return `${prevYearShort}${thisYearShort}`;
}

// Utility to get next group letter based on count
function getNextGroupLetter(count) {
  // count starts from 0
  return String.fromCharCode(65 + count); // 0 => 'A', 1 => 'B', ...
}

groupSchema.pre("validate", async function (next) {
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
    schoolId: this.schoolId, // <-- add schoolId here
  });

  const nextLetter = getNextGroupLetter(count);

  // Generate groupName if missing
  if (!this.groupName) {
    this.groupName = `${this.level}-${this.speciality.abbreviation}-${nextLetter}`;
  }

  // Generate _id if missing
  if (!this._id) {
    this._id = `grp${this.season}-${this.groupName}`;
  }

  next();
});

const Group = model("Group", groupSchema);

export default Group;
