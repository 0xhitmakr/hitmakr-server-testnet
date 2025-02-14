import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers['authorization'];
  const nonceToken = req.headers['x-nonce-token'];
  const address = req.headers['x-user-address'];
  const chainId = req.headers['x-chain-id'];

  // Check if all required headers are present
  if (!authHeader || !nonceToken || !address || !chainId) {
    return res.status(401).json({ 
      message: 'Missing required headers',
      details: {
        hasAuth: !!authHeader,
        hasNonce: !!nonceToken,
        hasAddress: !!address,
        hasChainId: !!chainId
      }
    });
  }

  // Extract the Bearer token
  const authToken = authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : authHeader;

  if (!authToken) {
    return res.status(401).json({ message: 'Invalid Authorization header format' });
  }

  try {
    // Decode both tokens
    const decodedAuth = jwt.decode(authToken);
    const decodedNonce = jwt.decode(nonceToken);
    
    if (!decodedAuth || !decodedNonce) {
      return res.status(403).json({ message: 'Invalid token format' });
    }

    // 1. Verify tokens haven't expired
    const now = Math.floor(Date.now() / 1000);
    if (decodedAuth.exp <= now) {
      return res.status(403).json({ message: 'Token expired' });
    }

    // 2. Verify issuers
    if (decodedAuth.iss !== 'api.web3modal.org' || decodedNonce.iss !== 'api.web3modal.org') {
      return res.status(403).json({ message: 'Invalid token issuer' });
    }

    // 3. Verify project ID keys match
    if (decodedAuth.projectIdKey !== decodedNonce.projectIdKey) {
      return res.status(403).json({ message: 'Project ID mismatch between tokens' });
    }

    // 4. Verify nonce values match
    if (decodedAuth.nonce !== decodedNonce.nonce) {
      return res.status(403).json({ message: 'Nonce mismatch between tokens' });
    }

    // 6. Verify address matches (case-insensitive)
    if (decodedAuth.address.toLowerCase() !== address.toLowerCase()) {
      return res.status(403).json({ message: 'Address mismatch' });
    }

    // 7. Verify chain ID matches
    if (decodedAuth.chainId.toString() !== chainId.toString()) {
      return res.status(403).json({ message: 'Chain ID mismatch' });
    }

    // Add verified user data to request
    req.user = {
      address: decodedAuth.address,
      chainId: decodedAuth.chainId,
      profileUuid: decodedAuth.profileUuid,
      projectUuid: decodedAuth.projectUuid,
      nonce: decodedAuth.nonce,
      projectIdKey: decodedAuth.projectIdKey
    };

    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// Also export the same function as verifyWeb3ModalTokens for semantic clarity
export const verifyWeb3ModalTokens = verifyToken;