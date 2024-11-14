import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const address = req.headers['x-user-address'];
  const chainId = req.headers['x-chain-id'];

  if (!authHeader || !address || !chainId) {
    return res.status(401).json({ message: 'Missing required headers' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Invalid Authorization header' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.address || !decoded.chainId) {
      return res.status(403).json({ message: 'Invalid JWT token' });
    }

    if (
      decoded.address.toLowerCase() !== address.toLowerCase()
    ) {
      return res.status(403).json({ message: 'Address or chainId mismatch' });
    }

    req.user = decoded; 
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ message: 'Invalid token' });
  }
};