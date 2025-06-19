import mongoose from "mongoose";
import Member from "./member.model.js";

const { Schema } = mongoose;

const module = new Schema(
  {
    id: { type: String, required: true },
    hoursPerWeek: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);
const teacherSchema = new Schema(
  {
    modules: {
      type: [module],
      required: true,
      default: [],
    },
    currentGroups: {
      type: [
        {
          groupId: { type: String, required: true },
          moduleId: { type: String, required: true },
        },
      ],
      default: [],
    },
    teachingHistory: {
      type: [
        {
          groupId: { type: String, required: true },
          moduleId: { type: String, required: true },
          reason: {
            type: String,
            enum: ["assigned", "removed"],
            required: true,
          },
          timestamp: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
    },
  },
  { timestamps: true, discriminatorKey: "memberType" }
);
teacherSchema.pre("validate", function (next) {
  if (!this.currentGroups || !Array.isArray(this.currentGroups)) {
    this.currentGroups = [];
  }

  if (!this.teachingHistory || !Array.isArray(this.teachingHistory)) {
    this.teachingHistory = [];
  }

  this.role = "TEACHER";
  next();
});

const Teacher = Member.discriminator("Teacher", teacherSchema);

export { Member, Teacher };
