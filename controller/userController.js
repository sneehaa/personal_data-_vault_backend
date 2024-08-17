// controllers/userController.js
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../model/userModel").User;
const OTP = require("../model/otpModel");
const Token = require("../model/tokenModel");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const { validationResult } = require("express-validator");
const { logActivity } = require("../auditLogger");
const nodemailer = require("nodemailer");

//function for generating the otp
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

//configuring nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    // Generate OTP
    const otp = generateOTP();

    // Save OTP to database
    try {
      await OTP.create({ userId: user.id, otp, isUsed: false });
    } catch (error) {
      console.error("Error saving OTP to database:", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to save OTP." });
    }

    // Send OTP to user's email
    await transporter.sendMail({
      from: '"Personal Data Vault" <adhikarisneha0001@gmail.com>',
      to: email,
      subject: "OTP Verification",
      text: `Your OTP for password reset is: ${otp}`,
    });

    // Update user's OTP in the database
    user.otp = otp;
    await user.save();

    console.log("OTP sent to user:", otp);

    res.status(200).json({
      success: true,
      message: "OTP sent to your email.",
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ success: false, message: "Failed to send OTP." });
  }
};

// Controller function to verify OTP and update password
const verifyOTPAndUpdatePassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Finding the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    // Checking if the user's password has already been updated with the OTP
    if (user.passwordUpdatedWithOTP) {
      return res
        .status(400)
        .json({ success: false, message: "OTP already used." });
    }

    // Finding the OTP record for the user
    const otpRecord = await OTP.findOne({
      userId: user.id,
      otp,
      isUsed: false,
    });

    if (!otpRecord || otpRecord.isUsed) {
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    // Validate the new password based on security criteria
    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be 8-12 characters long, include at least one uppercase letter, one lowercase letter, one number, and one special character.",
      });
    }

    // Encrypt the new password
    const randomSalt = await bcrypt.genSalt(10);
    const encryptedPassword = await bcrypt.hash(newPassword, randomSalt);

    // Updating the user's password with the encrypted password
    user.password = encryptedPassword;

    // Mark the OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    // Setting the flag to indicate that the OTP has been used to update the password
    user.passwordUpdatedWithOTP = true;
    await user.save();

    await logActivity(
      user._id,
      "Password Update",
      "Password updated successfully"
    );

    res
      .status(200)
      .json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    console.error("Error verifying OTP and updating password:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update password." });
  }
};

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 12;
const ACCOUNT_LOCKOUT_THRESHOLD = 5;

const validatePassword = (password) => {
  const upperCase = /[A-Z]/.test(password);
  const lowerCase = /[a-z]/.test(password);
  const number = /\d/.test(password);
  const specialChar = /[!@#$%^&*]/.test(password);
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    upperCase &&
    lowerCase &&
    number &&
    specialChar
  );
};

const generateVerificationToken = () => {
  return crypto.randomBytes(20).toString("hex");
};

const sendVerificationEmail = async (user) => {
  const token = generateVerificationToken();
  user.emailVerificationToken = token;
  user.emailVerificationExpires = Date.now() + 3600000; // 1 hour
  await user.save();

  const verificationUrl = `${process.env.BASE_URL}/user/${user._id}/verify/${token}`;
  console.log("Verification URL:", verificationUrl);

  await sendEmail(
    user.email,
    "Verify Email",
    `
    <p>Hi ${user.firstName},</p>
    <p>Thank you for registering. Please verify your email by clicking the button below:</p>
    <a href="${verificationUrl}" style="padding: 10px 20px; background-color: #ff6f6f; color: #fff; text-decoration: none; border-radius: 5px;">Verify Email</a>
  `
  );
};

const register = async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  if (!validatePassword(password)) {
    return res.status(400).json({
      success: false,
      message:
        "Password must be 8-12 characters long, include at least one uppercase letter, one lowercase letter, one number, and one special character.",
    });
  }

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });

    await newUser.save();
    await sendVerificationEmail(newUser);

    await logActivity(
      newUser._id,
      "User Registration",
      "User registered successfully"
    );
    res.status(201).json({
      success: true,
      message:
        "User registered successfully. Please check your email for verification.",
    });
  } catch (error) {
    console.error("Error during registration:", error); // Log the error for debugging
    res.status(500).json({ success: false, message: "Server error." });
  }
};

const verifyEmail = async (req, res) => {
  const { id, token } = req.params;

  console.log(
    `Received email verification request with user ID: ${id} and token: ${token}`
  );

  try {
    // Attempt to find the user with the provided ID and token
    const user = await User.findOne({
      _id: id,
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      // User not found or token is invalid/expired
      console.log(
        `User not found or token expired. User ID: ${id}, Token: ${token}`
      );
      return res.status(400).json({
        success: false,
        message: "Email verification token is invalid or has expired.",
      });
    }

    // Log user details before updating
    console.log(
      `User found for verification. User ID: ${user._id}, Email: ${user.email}`
    );

    console.log("User before saving:", user);
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    console.log("User after saving:", user);
    
    // Log successful email verification
    console.log(`Email verified successfully for User ID: ${user._id}.`);

    // Redirect to login page
    console.log("Redirecting to /login");
    res.redirect("/login");
  } catch (error) {
    // Log the error details
    console.error("Error during email verification:", error.message);
    console.error("Stack trace:", error.stack);

    // Return server error response
    res.status(500).json({ success: false, message: "Server error." });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      await logActivity(
        null,
        "Failed Login Attempt",
        `Attempted login with email: ${email}`
      );
      return res
        .status(400)
        .json({ success: false, message: "Invalid credentials." });
    }

    if (!user.emailVerified) {
      return res
        .status(400)
        .json({ success: false, message: "Please verify your email address." });
    }

    if (user.accountLockedUntil && new Date() < user.accountLockedUntil) {
      return res
        .status(403)
        .json({ success: false, message: "Account is locked." });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      user.failedLoginAttempts += 1;
      console.log(`Failed login attempts for ${email}: ${user.failedLoginAttempts}`);
      if (user.failedLoginAttempts >= ACCOUNT_LOCKOUT_THRESHOLD) {
        user.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await user.save(); // Save user with updated failedLoginAttempts
      await logActivity(user._id, "Failed Login Attempt", "Invalid password");
      return res
        .status(400)
        .json({ success: false, message: "Invalid credentials." });
    }
    
    user.failedLoginAttempts = 0;
    user.accountLockedUntil = null;
    await user.save();

    const token = user.generateAuthToken();
    await logActivity(
      user._id,
      "Successful Login",
      "User logged in successfully"
    );
    res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      userData: user,
    });
  } catch (error) {
    console.error("Error during login:", error); // Log the error for debugging
    res.status(500).json({ success: false, message: "Server error." });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId); // Ensure the model name is correct

    if (!user) {
      await logActivity(null, "User Profile Access", "User not found");
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userProfile = { ...user.toObject() };
    delete userProfile.password;

    await logActivity(
      user._id,
      "User Profile Access",
      "User profile fetched successfully"
    );
    res.status(200).json({
      success: true,
      message: "User profile fetched successfully.",
      userProfile,
    });
  } catch (error) {
    console.error("Error during fetching user profile:", error); // Log the error for debugging
    await logActivity(
      null,
      "User Profile Access",
      "Error fetching user profile"
    );
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, "-password"); // Exclude password for security
    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

const deleteUser = async (req, res) => {
  const userId = req.params.id;

  try {
    // Find and delete the user by ID
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      // If user is not found, log the attempt and return a 404 status
      await logActivity(null, "Delete User", "User not found");
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Log the successful deletion
    await logActivity(user._id, "Delete User", "User deleted successfully");

    // Return a success response
    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error during user deletion:", error); // Log the error for debugging
    await logActivity(null, "Delete User", "Error deleting user");
    res.status(500).json({
      success: false,
      message: "Server error.",
      error: error.message,
    });
  }
};

//edit user profile
const editUserProfile = async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await Users.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updatedUserProfile = await Users.findByIdAndUpdate(userId, req.body, {
      new: true,
      runValidators: true,
    });
    res.status(200).json({
      success: true,
      message: "User profile updated successfully.",
      updatedUserProfile,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

//User Profile Function
const userProfile = async (req, res, next) => {
  const user = await Users.findOne(req.user.id).select("-password");
  console.log(user, "User");
  res.status(200).json({
    success: true,
    user,
  });
};

module.exports = {
  sendOTP,
  verifyOTPAndUpdatePassword,
  register,
  loginUser,
  verifyEmail,
  getUserProfile,
  getAllUsers,
  deleteUser,
  editUserProfile,
  userProfile,
};
