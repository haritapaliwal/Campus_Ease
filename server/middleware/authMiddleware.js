import jwt from "jsonwebtoken";

const authMiddleware = (req, res, next) => {
  // Try to get token from cookies first (new way), or Auth header (backward compatibility)
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
  
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.id;
    req.userRole = decoded.role; // Extract role for RBAC
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid Token" });
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ message: `Role ${req.userRole} is not authorized to access this route.` });
    }
    next();
  };
};

export default authMiddleware;
