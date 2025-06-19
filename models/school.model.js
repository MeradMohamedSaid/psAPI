import mongoose from "mongoose";
const { Schema, model } = mongoose;

const locationSchema = new Schema(
  {
    x: { type: Number, required: [true, "X coord is required"] },
    y: { type: Number, required: [true, "Y coord is required"] },
  },
  { _id: false }
);
const parametersSchema = new Schema(
  {
    specilaities: {
      type: [String],
      default: [],
    },
    amazigh: { type: Boolean, default: false },
  },
  { _id: false }
);
const tabspwdsSchema = new Schema(
  {
    pedagogy: {
      type: String,
      default: "",
    },
    finance: {
      type: String,
      default: "",
    },
    attendance: {
      type: String,
      default: "",
    },
    assets: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

tabspwdsSchema.pre("save", function (next) {
  if (!this.pedagogy) this.pedagogy = "";
  if (!this.finance) this.finance = "";
  if (!this.attendance) this.attendance = "";
  if (!this.assets) this.assets = "";
  next();
});

const informationSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "School Name is required"],
      minLength: 3,
      maxLength: 50,
    },
    location: {
      type: locationSchema,
      required: [true, "Location is required"],
    },
    type: {
      type: String,
      enum: ["primaire", "cem", "lycee"],
      required: [true, "School Type is required"],
    },
    tabspwds: {
      type: tabspwdsSchema,
    },
  },
  { _id: false }
);

const planSchema = new Schema({
  name: {
    type: String,
    required: [true, "Plan Name is required"],
  },
  price: {
    type: Number,
    required: [true, "Plan Price is required"],
  },
  duration: {
    type: String,
    enum: ["Monthly", "Yearly"],
    required: [true, "Plan Duration is required"],
  },
  startingDate: {
    type: Date,
    required: [true, "Starting date is required"],
    validate: {
      validator: function (value) {
        return value <= new Date();
      },
      message: "Starting Date must be in the past",
    },
  },
  endingDate: {
    type: Date,
    required: [true, "Ending date is required"],
    default: function () {
      const durationDays = { Monthly: 30, Yearly: 365 }[this.duration] || 30;
      const date = new Date(this.startingDate);
      date.setDate(date.getDate() + durationDays);
      return date;
    },
    validate: {
      validator: function (value) {
        return value > this.startingDate;
      },
      message: "Ending Date must be after the starting date",
    },
  },
});

// planSchema.pre("save", function (next) {
//   if (!this.endingDate) {
//     const endDate = { Monthly: 30, Yearly: 365 }[this.duration];
//     this.endingDate = new Date(this.startingDate);
//     this.endingDate.setDate(this.endingDate.getDate() + endDate);
//   }
//   next();
// });

const subscriptionSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      required: true,
      default: "INACTIVE",
    },
    plan: {
      type: planSchema,
      required: false,
    },
    history: [
      {
        type: planSchema,
        required: false,
      },
    ],
  },
  { _id: false }
);

const authSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
        "Please fill a valid email address",
      ],
    },
    password: { type: String, required: true, minLength: 8 },
  },
  { _id: false }
);

// authSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) return next();
//   this.password = await bcrypt.hash(this.password, 10);
//   next();
// });

const schoolSchema = new Schema(
  {
    information: {
      type: informationSchema,
      required: [true, "Info Schema is required"],
    },
    derivationKey: {
      type: String,
      required: [true, "Derivation Key is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-z0-9]+$/,
        "Derivation Key must contain only lowercase letters and numbers (no spaces or symbols)",
      ],
    },
    subscriptions: {
      type: subscriptionSchema,
      required: false, // ⬅️ make it optional
      default: {
        status: "INACTIVE", // ⬅️ default status
        plan: null,
        history: [],
      },
    },
    parameters: {
      type: parametersSchema,
    },

    auth: { type: authSchema, required: [true, "Auth Schema is required"] },
  },
  {
    timestamps: true,
  }
);

const School = model("School", schoolSchema);

export default School;
