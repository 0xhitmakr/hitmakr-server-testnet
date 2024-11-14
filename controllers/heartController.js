import Heart from '../models/Heart.js';
import Song from '../models/Song.js';


export async function toggleHeart(req, res) {
  try {
    const userAddress = req.headers['x-user-address'];
    const { dsrcId } = req.body;

    if (!userAddress || !dsrcId) {
      return res.status(400).json({ 
        message: 'Both user address and DSRC ID are required.' 
      });
    }

    const song = await Song.findOne({ dsrcId });
    if (!song) {
      return res.status(404).json({ message: 'DSRC not found.' });
    }

    const result = await Heart.toggleHeart(userAddress, dsrcId, song.uploadHash);
    
    const counts = await Heart.getDSRCLikeCount(dsrcId);

    const message = result.action === 'liked' 
      ? 'Successfully liked DSRC.' 
      : 'Successfully unliked DSRC.';
    
    res.json({  
      message,
      action: result.action,
      counts,
      heart: result.heart
    });
  } catch (error) {
    console.error('Error toggling heart:', error);

    switch (error.code) {
      case 11000:
        return res.status(409).json({ 
          message: 'Concurrent heart action detected. Please try again.' 
        });
      default:
        return res.status(500).json({ 
          message: 'Error processing heart action. Please try again.' 
        });
    }
  }
}

export async function getTopLikedDSRCs(req, res) {
  try {
    const days = parseInt(req.query.days) || 7;
    const limit = parseInt(req.query.limit) || 10;

    const topLiked = await Heart.getTopLikedDSRCs(days, limit);

    const enrichedResults = await Promise.all(
      topLiked.map(async (item) => {
        const song = await Song.findOne({ dsrcId: item._id })
          .select('title description metadata walletAddress supportedChains')
          .lean();

        if (!song) {
          return null;
        }

        return {
          dsrcId: item._id,
          likes: item.count,
          uploadHash: item.uploadHash,
          songDetails: {
            title: song.title,
            description: song.description,
            metadata: song.metadata,
            creator: song.walletAddress,
            supportedChains: song.supportedChains
          }
        };
      })
    );

    const validResults = enrichedResults.filter(item => item !== null);

    res.json({
      timeframe: `${days} days`,
      results: validResults
    });
  } catch (error) {
    console.error('Error fetching top liked DSRCs:', error);
    res.status(500).json({ message: 'Error fetching top liked DSRCs.' });
  }
}

export async function getDSRCLikes(req, res) {
  try {
    const { dsrcId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    if (!dsrcId) {
      return res.status(400).json({ 
        message: 'DSRC ID is required.' 
      });
    }

    const songExists = await Song.exists({ dsrcId });
    if (!songExists) {
      return res.status(404).json({ message: 'DSRC not found.' });
    }

    const likesData = await Heart.getDSRCLikes(dsrcId, page, limit);

    res.json({
      likes: likesData.likes,
      pagination: {
        currentPage: likesData.page,
        totalPages: likesData.totalPages,
        totalLikes: likesData.totalLikes,
        itemsPerPage: likesData.limit,
        hasNextPage: likesData.page < likesData.totalPages,
        hasPrevPage: likesData.page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching DSRC likes:', error);
    res.status(500).json({ message: 'Error fetching DSRC likes.' });
  }
}


export async function getUserLikes(req, res) {
    try {
      const userAddress = req.params.userAddress;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
  
      if (!userAddress) {
        return res.status(400).json({ 
          message: 'User address is required.' 
        });
      }
  
      const likesData = await Heart.getUserLikes(userAddress, page, limit);

      const enrichedLikes = await Promise.all(
        likesData.likes.map(async (like) => {
          const song = await Song.findOne({ dsrcId: like.dsrcId })
            .select('title description metadata walletAddress supportedChains')
            .lean();
  
          if (!song) {
            return null;
          }
  
          return {
            ...like,
            songDetails: {
              title: song.title,
              description: song.description,
              metadata: song.metadata,
              creator: song.walletAddress,
              supportedChains: song.supportedChains
            }
          };
        })
      );
  
      const validLikes = enrichedLikes.filter(like => like !== null);
  
      res.json({
        likes: validLikes,
        pagination: {
          currentPage: likesData.page,
          totalPages: likesData.totalPages,
          totalLikes: likesData.totalLikes,
          itemsPerPage: likesData.limit,
          hasNextPage: likesData.page < likesData.totalPages,
          hasPrevPage: likesData.page > 1
        }
      });
    } catch (error) {
      console.error('Error fetching user likes:', error);
      res.status(500).json({ message: 'Error fetching user likes.' });
    }
  }


export async function getDSRCLikeCount(req, res) {
  try {
    const { dsrcId } = req.params;

    if (!dsrcId) {
      return res.status(400).json({ 
        message: 'DSRC ID is required.' 
      });
    }

    const songExists = await Song.exists({ dsrcId });
    if (!songExists) {
      return res.status(404).json({ message: 'DSRC not found.' });
    }

    const counts = await Heart.getDSRCLikeCount(dsrcId);
    res.json(counts);
  } catch (error) {
    console.error('Error fetching DSRC like count:', error);
    res.status(500).json({ message: 'Error fetching DSRC like count.' });
  }
}


export async function checkHeartStatus(req, res) {
  try {
    const userAddress = req.headers['x-user-address'];
    const { dsrcId } = req.params;

    if (!userAddress || !dsrcId) {
      return res.status(400).json({ 
        message: 'Both user address and DSRC ID are required.' 
      });
    }

    const songExists = await Song.exists({ dsrcId });
    if (!songExists) {
      return res.status(404).json({ message: 'DSRC not found.' });
    }

    const hasLiked = await Heart.hasLiked(userAddress, dsrcId);
    res.json({ hasLiked: !!hasLiked });
  } catch (error) {
    console.error('Error checking heart status:', error);
    res.status(500).json({ message: 'Error checking heart status.' });
  }
}


export async function getMultipleDSRCLikeCounts(req, res) {
  try {
    const { dsrcIds } = req.body;

    if (!Array.isArray(dsrcIds) || dsrcIds.length === 0) {
      return res.status(400).json({ 
        message: 'Array of DSRC IDs is required.' 
      });
    }

    const existingDsrcs = await Song.find({ dsrcId: { $in: dsrcIds } })
      .select('dsrcId')
      .lean();

    const existingDsrcIds = existingDsrcs.map(song => song.dsrcId);
    const nonExistingDsrcIds = dsrcIds.filter(id => !existingDsrcIds.includes(id));

    if (nonExistingDsrcIds.length > 0) {
      return res.status(404).json({ 
        message: 'Some DSRCs not found',
        nonExistingDsrcIds 
      });
    }

    const likeCounts = await Heart.getMultipleDSRCLikeCounts(dsrcIds);
    res.json({ likeCounts });
  } catch (error) {
    console.error('Error fetching multiple DSRC like counts:', error);
    res.status(500).json({ message: 'Error fetching multiple DSRC like counts.' });
  }
}


export async function getUserLikeStatuses(req, res) {
  try {
    const userAddress = req.headers['x-user-address'];
    const { dsrcIds } = req.body;

    if (!userAddress || !Array.isArray(dsrcIds) || dsrcIds.length === 0) {
      return res.status(400).json({ 
        message: 'User address and array of DSRC IDs are required.' 
      });
    }

    const existingDsrcs = await Song.find({ dsrcId: { $in: dsrcIds } })
      .select('dsrcId')
      .lean();

    const existingDsrcIds = existingDsrcs.map(song => song.dsrcId);
    const nonExistingDsrcIds = dsrcIds.filter(id => !existingDsrcIds.includes(id));

    if (nonExistingDsrcIds.length > 0) {
      return res.status(404).json({ 
        message: 'Some DSRCs not found',
        nonExistingDsrcIds 
      });
    }

    const likeStatuses = await Heart.getUserLikeStatuses(userAddress, dsrcIds);
    res.json({ likeStatuses });
  } catch (error) {
    console.error('Error fetching user like statuses:', error);
    res.status(500).json({ message: 'Error fetching user like statuses.' });
  }
}


export async function getUserLikesCount(req, res) {
    try {
      const { userAddress } = req.params;
  
      if (!userAddress) {
        return res.status(400).json({ 
          message: 'User address is required.' 
        });
      }
  
      const totalLikes = await Heart.countDocuments({ userAddress });
  
      res.json({ totalLikes });
    } catch (error) {
      console.error('Error fetching user likes count:', error);
      res.status(500).json({ message: 'Error fetching user likes count.' });
    }
  }