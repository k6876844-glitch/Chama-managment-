const jwt = require('jsonwebtoken');

// Checks the Bearer token and puts { id, role } on req.user.
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Please log in first' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Your session has expired, please log in again' });
  }
}

// Role-based access control: authorize('treasurer') or authorize('chairperson', 'secretary').
function authorize(...roles) {
  return (req, res, next) => {
    if (roles.includes(req.user.role)) return next();
    res.status(403).json({ message: 'You do not have permission to do this' });
  };
}

module.exports = { authenticate, authorize };
