import mongoose from "mongoose";
const { Schema, model } = mongoose;

const nameSchema = new Schema(
  {
    name_fr: { type: String, required: true },
    name_en: { type: String, required: true },
    name_ar: { type: String, required: true },
  },
  { _id: false }
);

const moduleSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: nameSchema, required: true },
    weeklyHours: { type: Number, required: true },
    obligatory: { type: Boolean, required: true, default: true },
    coeficient: { type: Number, required: true, default: 1 },
  },
  { _id: false }
);

const levelSchema = new Schema(
  {
    level: { type: Number, required: true },
    modulesCount: { type: Number, required: true },
    optionalModulesCount: { type: Number, required: true },
    totalWeeklyHours: { type: Number, required: true },
    modules: [moduleSchema],
  },
  { _id: false }
);

const specialitySchema = new Schema({
  name: { type: nameSchema, required: true },
  levelsCount: { type: Number, required: true },
  levels: [levelSchema],
});

const schoolTypeSchema = new Schema(
  {
    specialities: [specialitySchema],
  },
  { _id: false }
);

const schoolStructureSchema = new Schema({
  primaire: { type: schoolTypeSchema, required: true },
  cem: { type: schoolTypeSchema, required: true },
  lycee: { type: schoolTypeSchema, required: true },
});

schoolStructureSchema.pre("save", function (next) {
  const schoolTypes = ["primaire", "cem", "lycee"];

  schoolTypes.forEach((type) => {
    const schoolType = this[type];
    if (!schoolType) return;

    const specialities = schoolType.specialities || [];

    specialities.forEach((speciality) => {
      speciality.levels.forEach((level) => {
        const modules = level.modules || [];

        level.modulesCount = modules.length;

        level.optionalModulesCount = modules.filter(
          (mod) => mod.obligatory === false
        ).length;

        level.totalWeeklyHours = modules.reduce(
          (sum, mod) => sum + (mod.obligatory ? mod.weeklyHours : 0 || 0),
          0
        );
      });
    });
  });

  next();
});

const SchoolStructure = model("SchoolStructure", schoolStructureSchema);

export default SchoolStructure;
