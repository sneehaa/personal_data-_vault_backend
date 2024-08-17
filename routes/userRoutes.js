const express = require("express");
const router = express.Router();
const userController = require("../controller/userController");
const { body } = require("express-validator");
const { authGuard, authGuardAdmin } = require('../middleware/authGurad');

router.post(
  "/register",
  [
    body("firstName").notEmpty().withMessage("First name is required"),
    body("lastName").notEmpty().withMessage("Last name is required"),
    body("email").isEmail().withMessage("Invalid email address"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters long"),
  ],
  userController.register
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Invalid email address"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters long"),
  ],
  userController.loginUser
);


router.get("/profile/:userId", userController.getUserProfile);

router.get('/getAll', authGuard, authGuardAdmin, userController.getAllUsers);

router.delete('/delete/:id', authGuard, authGuardAdmin, userController.deleteUser);

router.get('/:id/verify/:token', userController.verifyEmail);


router.put("/edit/:userId",authGuard, userController.editUserProfile);



router.post('/logout', (req, res) => {
  req.session.destroy(err => {
      if (err) {
          return res.status(500).json({ success: false, message: "Logout failed." });
      }
      res.json({ success: true, message: "Logged out successfully." });
  });
});

module.exports = router;
