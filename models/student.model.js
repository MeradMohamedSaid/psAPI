import mongoose from "mongoose";
import Member from "./member.model.js";

const { Schema } = mongoose;

const studentSchema = new Schema(
  {
    parent_national_IDs: {
      mother: {
        type: String,
        required: false,
        trim: true,
        match: /^[A-Z0-9]{6,20}$/i,
      },
      father: {
        type: String,
        required: false,
        trim: true,
        match: /^[A-Z0-9]{6,20}$/i,
      },
    },
    parent_phone_numbers: {
      mother: {
        type: String,
        required: false,
        trim: true,
        match: /^\+?\d{7,15}$/,
      },
      father: {
        type: String,
        required: false,
        trim: true,
        match: /^\+?\d{7,15}$/,
      },
    },
    nationality: {
      type: String,
      required: true,
      trim: true,
    },
    birthDate: {
      type: Date,
      required: true,
    },
    birthCity: {
      type: String,
      required: true,
      trim: true,
    },
    sex: {
      type: String,
      required: true,
      enum: ["MALE", "FEMALE"],
    },
    registeredGroupId: {
      type: String,
      ref: "Group",
      default: null,
    },
    registered: {
      type: Boolean,
      default: false,
    },
    groupHistory: [
      {
        groupId: { type: String, ref: "Group" },
        season: { type: String },
        reason: { type: String, default: "REGISTRED" },
        date: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true, discriminatorKey: "memberType" }
);

// Ensure at least one parent phone number is provided
studentSchema.pre("validate", function (next) {
  const { mother, father } = this.parent_phone_numbers || {};
  if (!mother && !father) {
    this.invalidate(
      "parent_phone_numbers",
      "At least one parent phone number is required"
    );
  }

  // Enforce consistency between registeredGroupId and registered
  if (!this.registeredGroupId) {
    this.registered = false;
    this.registeredGroupId = null;
  } else {
    this.registered = true;
  }
  this.role = "STUDENT"; // Ensure role is set to STUDENT
  next();
});

const Student = Member.discriminator("Student", studentSchema);

export { Member, Student };
