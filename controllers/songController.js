import Song from '../models/Song.js';


export async function searchSongs(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const { title } = req.query;

        const query = {
            dsrcId: { $exists: true, $ne: null }
        };

        if (title) {
            query.$or = [
                { title: new RegExp(title, 'i') },
                { description: new RegExp(title, 'i') }
            ];
        }

        const songs = await Song.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('songId dsrcId title description');

        const total = await Song.countDocuments(query);
        const totalPages = Math.ceil(total / limit);

        res.json({
            songs,
            pagination: {
                currentPage: page,
                totalPages,
                totalSongs: total,
                itemsPerPage: limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });

    } catch (error) {
        console.error('Error searching songs:', error);
        res.status(500).json({
            message: 'Error searching songs.',
            error: error.message
        });
    }
}


export async function getSongById(req, res) {
  try {
    const { songId } = req.params;

    const song = await Song.findOne({ 
      songId,
      dsrcId: { $exists: true, $ne: null } 
    }).select('-plays -impressions -uploadHash');

    if (!song) {
      return res.status(404).json({
        message: 'Song not found or does not have a dsrcId.'
      });
    }

    res.json(song);
  } catch (error) {
    console.error('Error fetching song:', error);
    res.status(500).json({
      message: 'Error fetching song details.',
      error: error.message
    });
  }
}


export async function getSongsByWallet(req, res) {
  try {
    const { walletAddress } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {
      walletAddress,
      dsrcId: { $exists: true, $ne: null }  
    };

    const songs = await Song.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-plays -impressions -uploadHash');

    const total = await Song.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      songs,
      pagination: {
        currentPage: page,
        totalPages,
        totalSongs: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching wallet songs:', error);
    res.status(500).json({
      message: 'Error fetching songs for wallet.',
      error: error.message
    });
  }
}


export async function getSongsByChain(req, res) {
  try {
    const { chainId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {
      supportedChains: chainId,
      dsrcId: { $exists: true, $ne: null }  // Only return songs with dsrcId
    };

    const songs = await Song.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-plays -impressions -uploadHash');

    const total = await Song.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      songs,
      pagination: {
        currentPage: page,
        totalPages,
        totalSongs: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching chain songs:', error);
    res.status(500).json({
      message: 'Error fetching songs for chain.',
      error: error.message
    });
  }
}


export async function getRecentSongs(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {
      dsrcId: { $exists: true, $ne: null } 
    };

    const songs = await Song.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-plays -impressions -uploadHash');

    const total = await Song.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      songs,
      pagination: {
        currentPage: page,
        totalPages,
        totalSongs: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching recent songs:', error);
    res.status(500).json({
      message: 'Error fetching recent songs.',
      error: error.message
    });
  }
}