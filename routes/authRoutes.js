const router = require("express").Router();
const userController = require("../controller/userController");
const { authGuard } = require("../middleware/authGurad");

//sending the otp
router.post("/send-otp", userController.sendOTP);

//verifying otp and updating the password

router.post(
  "/verify-otp-and-update-password",
  userController.verifyOTPAndUpdatePassword
);

module.exports = router
