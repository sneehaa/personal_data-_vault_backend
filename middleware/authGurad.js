const jwt = require('jsonwebtoken');
const User = require('../model/userModel').User;

const authGuard = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log("Authorization header missing!");
    return res.status(401).json({
      success: false,
      message: "Authorization header missing!"
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    console.log("Token missing!");
    return res.status(401).json({
      success: false,
      message: "Token missing!"
    });
  }

  try {
    const decodedData = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded token data:", decodedData);
    
    const user = await User.findById(decodedData._id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found."
      });
    }

    req.user = {
      id: decodedData._id,
      role: decodedData.role,
      permissions: decodedData.permissions
    };
    next();
  } catch (error) {
    console.error("Invalid token!", error);
    res.status(401).json({
      success: false,
      message: "Invalid token!"
    });
  }
};

const authGuardAdmin = async (req, res, next) => {
  const token = req.headers.authorization && req.headers.authorization.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded token data (Admin):", decoded);
    req.user = decoded;

    const user = await User.findById(decoded._id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    if (!user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    next();
  } catch (error) {
    console.error('Error verifying token (Admin):', error);
    res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

module.exports = {
  authGuard,
  authGuardAdmin
};
