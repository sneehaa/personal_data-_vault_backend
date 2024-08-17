const mongoose = require("mongoose");

const dataSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  fullNameIv: { type: String, required: true }, // Added field for IV
  dateOfBirth: { type: Date, required: true },
  address: { type: String, required: true },
  addressIv: { type: String, required: true }, // Added field for IV
  phoneNumber: { type: String, required: true },
  phoneNumberIv: { type: String, required: true }, // Added field for IV
  email: { type: String, required: true },
  emailIv: { type: String, required: true }, // Added field for IV
  dataImageUrl: { type: String, required: true },
  dataImageEncrypted: { type: String, required: true },
  dataImageIv: { type: String, required: true }, // Added field for IV
});

module.exports = mongoose.model("Data", dataSchema);
