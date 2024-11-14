import Playlist from '../models/Playlist.js';


export async function createPlaylist(req, res) {
    try {
      const creator = req.headers['x-user-address'];
      const { name, description, imageUrl, isPublic = true } = req.body;
  
      if (!creator) {
        return res.status(400).json({ message: 'Creator address is required.' });
      }
  
      if (!name || !imageUrl) {
        return res.status(400).json({ message: 'Name and image URL are required.' });
      }
  
      const playlist = new Playlist({
        creator,
        name,
        description,
        imageUrl,
        isPublic,
        createdAt: new Date(),
        updatedAt: new Date()
      });
  
      await playlist.save();
  
      res.status(201).json({ 
        message: 'Playlist created successfully.',
        playlist: {
          _id: playlist._id,
          playlistId: playlist.playlistId,
          name: playlist.name,
          description: playlist.description,
          imageUrl: playlist.imageUrl,
          isPublic: playlist.isPublic,
          creator: playlist.creator,
          totalTracks: playlist.totalTracks,
          createdAt: playlist.createdAt,
          updatedAt: playlist.updatedAt
        }
      });
    } catch (error) {
      console.error('Error creating playlist:', error);
      if (error.code === 11000) {
        return res.status(400).json({ 
          message: 'A playlist with this ID already exists. Please try again.' 
        });
      }
      res.status(500).json({ message: 'Error creating playlist.' });
    }
  }


export async function getUserPlaylists(req, res) {
  try {
    const creator = req.headers['x-user-address'];
    const playlists = await Playlist.findUserPlaylists(creator);
    res.json({ playlists });
  } catch (error) {
    console.error('Error fetching playlists:', error);
    res.status(500).json({ message: 'Error fetching playlists.' });
  }
}


export async function getPlaylist(req, res) {
    try {
      const { playlistId } = req.params;
      const userAddress = req.headers['x-user-address'];
  
      const playlist = await Playlist.findOne({ playlistId }); 
      
      if (!playlist) {
        return res.status(404).json({ message: 'Playlist not found.' });
      }
  
      if (!playlist.isPublic && playlist.creator !== userAddress) {
        return res.status(403).json({ message: 'Access denied.' });
      }
  
      res.json({ playlist });
    } catch (error) {
      console.error('Error fetching playlist:', error);
      res.status(500).json({ message: 'Error fetching playlist.' });
    }
  }
  

  export async function updatePlaylist(req, res) {
    try {
      const { playlistId } = req.params;
      const creator = req.headers['x-user-address'];
      const { name, description, imageUrl, isPublic } = req.body;
  
      const playlist = await Playlist.findOne({ playlistId, creator }); // Changed query to use playlistId
  
      if (!playlist) {
        return res.status(404).json({ message: 'Playlist not found.' });
      }
  

      if (name) playlist.name = name;
      if (description !== undefined) playlist.description = description;
      if (imageUrl) playlist.imageUrl = imageUrl;
      if (isPublic !== undefined) playlist.isPublic = isPublic;
  
      await playlist.save();
      res.json({ message: 'Playlist updated successfully.', playlist });
    } catch (error) {
      console.error('Error updating playlist:', error);
      res.status(500).json({ message: 'Error updating playlist.' });
    }
  }
  

  export async function deletePlaylist(req, res) {
    try {
      const { playlistId } = req.params;
      const creator = req.headers['x-user-address'];
  
      const result = await Playlist.deleteOne({ playlistId, creator });
  
      if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Playlist not found.' });
      }
  
      res.json({ message: 'Playlist deleted successfully.' });
    } catch (error) {
      console.error('Error deleting playlist:', error);
      res.status(500).json({ message: 'Error deleting playlist.' });
    }
  }
  

  export async function addTracks(req, res) {
    try {
      const { playlistId } = req.params;
      const creator = req.headers['x-user-address'];
      const { dsrcIds } = req.body;
  
      if (!Array.isArray(dsrcIds) || dsrcIds.length === 0) {
        return res.status(400).json({ message: 'Please provide an array of DSRCids.' });
      }
  
      const playlist = await Playlist.findOne({ playlistId, creator });
  
      if (!playlist) {
        return res.status(404).json({ message: 'Playlist not found.' });
      }
  
      dsrcIds.forEach(dsrcId => {
        playlist.addTrack(dsrcId);
      });
  
      await playlist.save();
      res.json({ message: 'Tracks added successfully.', playlist });
    } catch (error) {
      console.error('Error adding tracks:', error);
      res.status(500).json({ message: 'Error adding tracks.' });
    }
  }

  export async function removeTracks(req, res) {
    try {
      const { playlistId } = req.params;
      const creator = req.headers['x-user-address'];
      const { dsrcIds } = req.body;
  
      if (!Array.isArray(dsrcIds) || dsrcIds.length === 0) {
        return res.status(400).json({ message: 'Please provide an array of DSRCids.' });
      }
  
      const playlist = await Playlist.findOne({ playlistId, creator });
  
      if (!playlist) {
        return res.status(404).json({ message: 'Playlist not found.' });
      }
  
      dsrcIds.forEach(dsrcId => {
        playlist.removeTrack(dsrcId);
      });
  
      await playlist.save();
      res.json({ message: 'Tracks removed successfully.', playlist });
    } catch (error) {
      console.error('Error removing tracks:', error);
      res.status(500).json({ message: 'Error removing tracks.' });
    }
  }

  export async function reorderTracks(req, res) {
    try {
      const { playlistId } = req.params;
      const creator = req.headers['x-user-address'];
      const { dsrcIds } = req.body;
  
      if (!Array.isArray(dsrcIds)) {
        return res.status(400).json({ message: 'Please provide the new track order.' });
      }
  
      const playlist = await Playlist.findOne({ playlistId, creator });
  
      if (!playlist) {
        return res.status(404).json({ message: 'Playlist not found.' });
      }
  
      const currentTracks = new Set(playlist.tracks.map(track => track.dsrcId));
      const validReorder = dsrcIds.every(id => currentTracks.has(id)) && 
                          dsrcIds.length === playlist.tracks.length;
  
      if (!validReorder) {
        return res.status(400).json({ message: 'Invalid track order provided.' });
      }
  
      playlist.tracks = dsrcIds.map(dsrcId => ({
        dsrcId,
        addedAt: playlist.tracks.find(t => t.dsrcId === dsrcId).addedAt
      }));
  
      await playlist.save();
      res.json({ message: 'Tracks reordered successfully.', playlist });
    } catch (error) {
      console.error('Error reordering tracks:', error);
      res.status(500).json({ message: 'Error reordering tracks.' });
    }
  }

export async function getPublicPlaylists(req, res) {
  try {
    const { limit = 20, offset = 0 } = req.query;
    
    const playlists = await Playlist
      .find({ isPublic: true })
      .select('-tracks')
      .sort('-createdAt')
      .skip(Number(offset))
      .limit(Number(limit));

    const total = await Playlist.countDocuments({ isPublic: true });

    res.json({ 
      playlists,
      pagination: {
        total,
        offset: Number(offset),
        limit: Number(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching public playlists:', error);
    res.status(500).json({ message: 'Error fetching public playlists.' });
  }
}


export async function searchPlaylists(req, res) {
  try {
    const { query, limit = 20, offset = 0 } = req.query;
    const userAddress = req.headers['x-user-address'];

    if (!query) {
      return res.status(400).json({ message: 'Search query is required.' });
    }

    const searchRegex = new RegExp(query, 'i');

    const playlists = await Playlist
      .find({
        $or: [
          { creator: userAddress },
          { isPublic: true }
        ],
        $or: [
          { name: searchRegex },
          { description: searchRegex }
        ]
      })
      .select('-tracks')
      .sort('-createdAt')
      .skip(Number(offset))
      .limit(Number(limit));

    res.json({ playlists });
  } catch (error) {
    console.error('Error searching playlists:', error);
    res.status(500).json({ message: 'Error searching playlists.' });
  }
}

export async function clonePlaylist(req, res) {
  try {
    const { playlistId } = req.params;
    const creator = req.headers['x-user-address'];

    const sourcePlaylist = await Playlist.findOne({ playlistId, isPublic: true });

    if (!sourcePlaylist) {
      return res.status(404).json({ message: 'Playlist not found or not public.' });
    }

    // Create new playlist with copied data
    const newPlaylist = new Playlist({
      creator,
      name: `${sourcePlaylist.name} (Copy)`,
      description: sourcePlaylist.description,
      imageUrl: sourcePlaylist.imageUrl,
      isPublic: true,
      tracks: sourcePlaylist.tracks
    });

    await newPlaylist.save();
    res.status(201).json({ message: 'Playlist cloned successfully.', playlist: newPlaylist });
  } catch (error) {
    console.error('Error cloning playlist:', error);
    res.status(500).json({ message: 'Error cloning playlist.' });
  }
}


export async function getPaginatedPlaylists(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const creator = req.headers['x-user-address'];

    const [playlists, total] = await Promise.all([
      Playlist.find({ creator })
        .select('-tracks')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .lean(),
      Playlist.countDocuments({ creator })
    ]);

    res.json({
      playlists,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching playlists:', error);
    res.status(500).json({ message: 'Error fetching playlists.' });
  }
}

export async function getPaginatedTracks(req, res) {
  try {
    const { playlistId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const creator = req.headers['x-user-address'];

    const playlist = await Playlist.findOne({ playlistId });
    
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found.' });
    }

    if (!playlist.isPublic && playlist.creator !== creator) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const total = playlist.tracks.length;
    const paginatedTracks = playlist.tracks.slice(skip, skip + limit);

    res.json({
      playlistId,
      tracks: paginatedTracks,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching tracks:', error);
    res.status(500).json({ message: 'Error fetching tracks.' });
  }
}


export async function getPaginatedPublicPlaylists(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const [playlists, total] = await Promise.all([
      Playlist.find({ isPublic: true })
        .select('-tracks')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .lean(),
      Playlist.countDocuments({ isPublic: true })
    ]);

    res.json({
      playlists,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching public playlists:', error);
    res.status(500).json({ message: 'Error fetching public playlists.' });
  }
}


export async function searchPaginatedPlaylists(req, res) {
  try {
    const { query } = req.query;
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const userAddress = req.headers['x-user-address'];

    if (!query) {
      return res.status(400).json({ message: 'Search query is required.' });
    }

    const searchRegex = new RegExp(query, 'i');
    const searchQuery = {
      $or: [
        { creator: userAddress },
        { isPublic: true }
      ],
      $and: [
        {
          $or: [
            { name: searchRegex },
            { description: searchRegex }
          ]
        }
      ]
    };

    const [playlists, total] = await Promise.all([
      Playlist.find(searchQuery)
        .select('-tracks')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .lean(),
      Playlist.countDocuments(searchQuery)
    ]);

    res.json({
      playlists,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error searching playlists:', error);
    res.status(500).json({ message: 'Error searching playlists.' });
  }
}