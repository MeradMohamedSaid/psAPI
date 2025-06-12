import mongoose from "mongoose";
import Member from "./member.model.js";

const { Schema } = mongoose;
const teacherSchema = new Schema(
  {
    modules: {
      type: [String],
      required: true,
      default: [],
    },
    currentGroups: {
      type: [String],
      default: [],
    },
    teachingHistory: {
      type: [
        {
          groupId: { type: String, required: true },
          season: { type: String, required: true },
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
