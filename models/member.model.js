import mongoose from "mongoose";
const { Schema, model } = mongoose;

const phoneRegex = /^\+?\d{7,15}$/; // Example: supports optional + and 7-15 digits
const nationalIdRegex = /^[A-Z0-9]{6,20}$/i; // Example: alphanumeric, 6-20 chars

const memberSchema = new Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
    },
    full_name: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    phone_number: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      validate: {
        validator: function (v) {
          return phoneRegex.test(v);
        },
        message: (props) => `${props.value} is not a valid phone number!`,
      },
    },
    national_ID: {
      type: String,
      required: [true, "National ID is required"],
      trim: true,
      validate: {
        validator: function (v) {
          return nationalIdRegex.test(v);
        },
        message: (props) => `${props.value} is not a valid national ID!`,
      },
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      unique: true,
      lowercase: true,
      match: [
        /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
        "Please fill a valid email address",
      ],
    },
    fullUsername: {
      type: String,
      required: [true, "Full username is required"],
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
    },
    role: {
      type: String,
      enum: {
        values: ["TEACHER", "STUDENT", "STAFF"],
        message: "Role must be TEACHER, STUDENT, or STAFF",
      },
      required: [true, "Role is required"],
    },
    schoolId: {
      type: String,
      ref: "School",
      required: [true, "School ID is required"],
    },
  },
  {
    timestamps: true,
    discriminatorKey: "memberType", // <- REQUIRED to support inheritance
  }
);

export default model("Member", memberSchema);
