import Song from "../models/Song.js";

export async function searchSongs(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const { title, type } = req.query;

    const query = {
      dsrcId: { $exists: true, $ne: null },
    };

    if (title && type === "title") {
      query.$or = [
        { title: new RegExp(title, "i") },
        { description: new RegExp(title, "i") },
        { dsrc: new RegExp(title, "i") },
      ];
    }

    if (title && type === "dsrcid") {
      query.$or = [{ dsrcId: new RegExp(title, "i") }];
    }

    if (title && type === "hashtags") {
      query.hashTags = { $regex: title, $options: "i" };
    }

    const songs = await Song.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("dsrcId _id  id metadata.image metadata.name description");

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
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error searching songs:", error);
    res.status(500).json({
      message: "Error searching songs.",
      error: error.message,
    });
  }
}

export async function getSongById(req, res) {
  try {
    const { songId } = req.params;

    const song = await Song.findOne({
      songId,
      dsrcId: { $exists: true, $ne: null },
    }).select("-plays -impressions -uploadHash");

    if (!song) {
      return res.status(404).json({
        message: "Song not found or does not have a dsrcId.",
      });
    }

    res.json(song);
  } catch (error) {
    console.error("Error fetching song:", error);
    res.status(500).json({
      message: "Error fetching song details.",
      error: error.message,
    });
  }
}

export async function getSongByDSRC(req, res) {
  try {
    const { dsrcId } = req.params;

    const song = await Song.findOne({
      dsrcId,
    });

    if (!song) {
      return res.json({});
    }
    res.json(song);
  } catch (error) {
    return res.json({});
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
      dsrcId: { $exists: true, $ne: null },
    };

    const songs = await Song.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-plays -impressions -uploadHash");

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
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching wallet songs:", error);
    res.status(500).json({
      message: "Error fetching songs for wallet.",
      error: error.message,
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
      dsrcId: { $exists: true, $ne: null }, // Only return songs with dsrcId
    };

    const songs = await Song.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-plays -impressions -uploadHash");

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
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching chain songs:", error);
    res.status(500).json({
      message: "Error fetching songs for chain.",
      error: error.message,
    });
  }
}

export async function getRecentSongs(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {
      dsrcId: { $exists: true, $ne: null },
    };

    const songs = await Song.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-plays -impressions -uploadHash");

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
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching recent songs:", error);
    res.status(500).json({
      message: "Error fetching recent songs.",
      error: error.message,
    });
  }
}

export async function addHashtags(req, res) {
  try {
    const { songId, walletAddress, hashtag } = req.body;
    if (!songId || !walletAddress || !hashtag)
      throw new Error("Missing required fields");

    const song = await Song.findOne({ _id: songId });
    if (!song) throw new Error("Song not found");

    if (song.walletAddress.toLowerCase() !== walletAddress.toLowerCase())
      throw new Error("Unauthorized. Wallet address does not match.");

    if (song.hashTags.includes(hashtag.toLowerCase()))
      throw new Error("Hashtag already exists");

    song.hashTags.push(hashtag.toLowerCase());
    await song.save();

    return res.status(200).json({ message: "Hashtag added successfully" });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Error adding song hashtags.",
      error: error.message,
    });
  }
}

export async function deleteHashtag(req, res) {
  try {
    const { id } = req.query;
    const { hashtag } = req.body;

    if (!id || !hashtag) throw new Error("Missing required fields");

    const song = await Song.findById(id);
    if (!song) throw new Error("Song not found");

    const hashtagIndex = song.hashTags.indexOf(hashtag);
    if (hashtagIndex === -1) throw new Error("Hashtag not found");

    song.hashTags.splice(hashtagIndex, 1);
    await song.save();

    return res
      .status(200)
      .json({ message: "Hashtag deleted successfully", status: true });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Error deleting hashtag.",
      error: error.message,
      status: false,
    });
  }
}

export async function getSongByGenre(req, res) {
  try {
    const { genre } = req.params;
    const query = req.query;
    if (!genre) throw new Error("Genre is required");

    const buildAggregation = () => {
      const matchStage = {
        dsrcId: { $exists: true, $ne: null },
        "metadata.attributes": {
          $elemMatch: {
            trait_type: "Genre",
            value: { $regex: `^${genre}$`, $options: "i" },
          },
        },
      };

      if (query.country) {
        matchStage["metadata.attributes"] = {
          $all: [
            {
              $elemMatch: {
                trait_type: "Genre",
                value: { $regex: `^${genre}$`, $options: "i" },
              },
            },
            {
              $elemMatch: {
                trait_type: "Country",
                value: { $regex: `^${query.country}$`, $options: "i" },
              },
            },
          ],
        };
      }

      const pipeline = [
        { $match: matchStage },
        // REMOVE THESE TWO STAGES: Price filtering is removed
        // { $unwind: "$metadata.attributes" },
        // {
        //   $match: {
        //     "metadata.attributes.trait_type": "Price",
        //   },
        // },
        {
          $lookup: {
            from: "hearts",
            localField: "dsrcId",
            foreignField: "dsrcId",
            as: "likes",
          },
        },
        {
          $addFields: {
            likesCount: { $size: "$likes" },
          },
        },
        ...(query.price || query.date || query.likes
          ? [
              {
                $sort: {
                  // Price sorting will not work as expected now as we removed price filtering
                  ...(query.price && {
                    "metadata.attributes.value": query.price === "asc" ? 1 : -1,
                  }),
                  ...(query.date && {
                    createdAt: query.date === "asc" ? 1 : -1,
                  }),
                  ...(query.likes && {
                    likesCount: query.likes === "asc" ? 1 : -1,
                  }),
                },
              },
            ]
          : []),
        {
          $project: {
            _id: 1,
            dsrcId: 1,
            metadata: 1,
            createdAt: 1,
            likesCount: 1,
            hashTags: 1,
          },
        },
      ];

      return pipeline;
    };

    const songs = await Song.aggregate(buildAggregation());
    console.log(songs); // Keep console log for debugging
    return res.status(200).json({ songs });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Error fetching song details.",
      error: error.message,
    });
  }
}

export async function getSongByCategory(req, res) {
  try {
    const { category } = req.params;
    const query = req.query;
    if (!category) throw new Error("Category is required");

    const buildAggregation = () => {
      const matchStage = {
        dsrcId: { $exists: true, $ne: null },
        "metadata.attributes": {
          $elemMatch: {
            trait_type: "Category",
            value: { $regex: `^${category}$`, $options: "i" },
          },
        },
      };

      if (query.country) {
        matchStage["metadata.attributes"] = {
          $all: [
            {
              $elemMatch: {
                trait_type: "Category",
                value: { $regex: `^${category}$`, $options: "i" },
              },
            },
            {
              $elemMatch: {
                trait_type: "Country",
                value: { $regex: `^${query.country}$`, $options: "i" },
              },
            },
          ],
        };
      }

      if (query.genre) {
        matchStage["metadata.attributes"] = {
          $all: [
            {
              $elemMatch: {
                trait_type: "Category",
                value: { $regex: `^${category}$`, $options: "i" },
              },
            },
            {
              $elemMatch: {
                trait_type: "Genre",
                value: { $regex: `^${query.genre}$`, $options: "i" },
              },
            },
          ],
        };
      }

      if (query.country && query.genre) {
        matchStage["metadata.attributes"] = {
          $all: [
            {
              $elemMatch: {
                trait_type: "Category",
                value: { $regex: `^${category}$`, $options: "i" },
              },
            },
            {
              $elemMatch: {
                trait_type: "Country",
                value: { $regex: `^${query.country}$`, $options: "i" },
              },
            },
            {
              $elemMatch: {
                trait_type: "Genre",
                value: { $regex: `^${query.genre}$`, $options: "i" },
              },
            },
          ],
        };
      }

      const pipeline = [
        { $match: matchStage },
        // REMOVE THESE TWO STAGES: Price filtering is removed
        // { $unwind: "$metadata.attributes" },
        // {
        //   $match: {
        //     "metadata.attributes.trait_type": "Price",
        //   },
        // },
        {
          $lookup: {
            from: "hearts",
            localField: "dsrcId",
            foreignField: "dsrcId",
            as: "likes",
          },
        },
        {
          $addFields: {
            likesCount: { $size: "$likes" },
          },
        },
        ...(query.price || query.date || query.likes
          ? [
              {
                $sort: {
                  // Price sorting will not work as expected now as we removed price filtering
                  ...(query.price && {
                    "metadata.attributes.value": query.price === "asc" ? 1 : -1,
                  }),
                  ...(query.date && {
                    createdAt: query.date === "asc" ? 1 : -1,
                  }),
                  ...(query.likes && {
                    likesCount: query.likes === "asc" ? 1 : -1,
                  }),
                },
              },
            ]
          : []),
        {
          $project: {
            _id: 1,
            dsrcId: 1,
            metadata: 1,
            createdAt: 1,
            likesCount: 1,
            hashTags: 1,
          },
        },
      ];

      return pipeline;
    };

    const songs = await Song.aggregate(buildAggregation());
    console.log(songs); // Keep console log for debugging
    return res.status(200).json({ songs });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Error fetching song details.",
      error: error.message,
    });
  }
}