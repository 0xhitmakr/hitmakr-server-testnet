import DSRCCopyright from '../models/DSRCCopyright.js';


const ONE_HOUR = 60 * 60 * 1000;

export async function submitDSRCCopyrightClaim(req, res) {
  try {
    const walletAddress = req.headers['x-user-address'];
    const { dsrcId, claimDescription, email, referenceLink } = req.body;

    const lastClaim = await DSRCCopyright.findOne({ walletAddress })
      .sort({ timestamp: -1 });

    if (lastClaim) {
      const timeSinceLastClaim = Date.now() - lastClaim.timestamp;
      const timeRemaining = ONE_HOUR - timeSinceLastClaim;

      if (timeRemaining > 0) {
        const minutesRemaining = Math.ceil(timeRemaining / (60 * 1000));
        return res.status(429).json({
          message: `Please wait ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''} before submitting another claim.`,
          timeRemaining: timeRemaining,
          nextAvailableSubmission: new Date(lastClaim.timestamp.getTime() + ONE_HOUR)
        });
      }
    }

    const existingClaim = await DSRCCopyright.findOne({
      walletAddress,
      dsrcId
    });

    if (existingClaim) {
      return res.status(409).json({
        message: 'A DSRC copyright claim for this content already exists from your wallet address.',
        existingClaim: {
          dsrcId: existingClaim.dsrcId,
          submittedAt: existingClaim.timestamp
        }
      });
    }

    // Create new copyright claim
    const newDSRCCopyrightClaim = new DSRCCopyright({
      walletAddress,
      dsrcId,
      description: claimDescription,
      email,
      referenceLink
    });

    await newDSRCCopyrightClaim.save();

    res.json({
      message: 'DSRC copyright claim submitted successfully.',
      claim: newDSRCCopyrightClaim,
      nextAvailableSubmission: new Date(Date.now() + ONE_HOUR)
    });

  } catch (error) {
    console.error('Error submitting DSRC copyright claim:', error);
    res.status(500).json({
      message: 'Error submitting DSRC copyright claim.',
      error: error.message
    });
  }
}

export async function getDSRCCopyrightClaims(req, res) {
  try {
    const walletAddress = req.headers['x-user-address'];
    
    const claims = await DSRCCopyright.find({ walletAddress })
      .sort({ timestamp: -1 });
    
    let nextAvailableSubmission = null;
    if (claims.length > 0) {
      const lastClaimTime = claims[0].timestamp.getTime();
      const currentTime = Date.now();
      const timePassedSinceLastClaim = currentTime - lastClaimTime;
      
      if (timePassedSinceLastClaim < ONE_HOUR) {
        nextAvailableSubmission = new Date(lastClaimTime + ONE_HOUR);
      }
    }
    
    res.json({
      claims,
      nextAvailableSubmission
    });

  } catch (error) {
    console.error('Error fetching DSRC copyright claims:', error);
    res.status(500).json({ message: 'Error fetching DSRC copyright claims.' });
  }
}

export async function getDSRCCopyrightClaimByDsrc(req, res) {
  try {
    const { dsrcId } = req.params;
    
    const claim = await DSRCCopyright.findOne({ dsrcId });
    
    if (!claim) {
      return res.status(404).json({ 
        message: 'No DSRC copyright claim found for this DSRC ID.' 
      });
    }
    
    res.json({ claim });

  } catch (error) {
    console.error('Error fetching DSRC copyright claim:', error);
    res.status(500).json({ message: 'Error fetching DSRC copyright claim.' });
  }
}