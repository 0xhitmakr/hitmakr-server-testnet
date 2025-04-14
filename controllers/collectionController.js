import Collection from "../models/Collection.js";

export async function createCollection(req, res) {
  try {
    const creator = req.headers["x-user-address"];
    const { name, description, imageUrl, isPublic = true, type } = req.body;

    if (!creator) {
      return res.status(400).json({ message: "Creator address is required." });
    }

    if (!name || !imageUrl) {
      return res
        .status(400)
        .json({ message: "Name and image URL are required." });
    }

    const collection = new Collection({
      creator,
      name,
      description,
      imageUrl,
      isPublic,
      type,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await collection.save();

    res.status(201).json({
      message: "Collection created successfully.",
      collection: {
        _id: collection._id,
        collectionId: collection.collectionId,
        name: collection.name,
        description: collection.description,
        imageUrl: collection.imageUrl,
        isPublic: collection.isPublic,
        creator: collection.creator,
        type: collection.type,
        totalTracks: collection.totalTracks,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error creating collection:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        message: "A collection with this ID already exists. Please try again.",
      });
    }
    res.status(500).json({ message: "Error creating collection." });
  }
}

export async function getUserCollections(req, res) {
  try {
    const creator = req.headers["x-user-address"];
    const collections = await Collection.findUserCollections(creator);
    res.json({ collections });
  } catch (error) {
    console.error("Error fetching collections:", error);
    res.status(500).json({ message: "Error fetching collections." });
  }
}

export async function getCollection(req, res) {
  try {
    const { collectionId } = req.params;
    const userAddress = req.headers["x-user-address"];

    const collection = await Collection.findOne({ collectionId });

    if (!collection) {
      return res.status(404).json({ message: "Collection not found." });
    }

    if (!collection.isPublic && collection.creator !== userAddress) {
      return res.status(403).json({ message: "Access denied." });
    }

    res.json({ collection });
  } catch (error) {
    console.error("Error fetching collection:", error);
    res.status(500).json({ message: "Error fetching collection." });
  }
}

export async function updateCollection(req, res) {
  try {
    const { collectionId } = req.params;
    const creator = req.headers["x-user-address"];
    const { name, description, imageUrl, isPublic, type } = req.body;

    const collection = await Collection.findOne({ collectionId, creator });

    if (!collection) {
      return res.status(404).json({ message: "Collection not found." });
    }

    if (name) collection.name = name;
    if (description !== undefined) collection.description = description;
    if (imageUrl) collection.imageUrl = imageUrl;
    if (isPublic !== undefined) collection.isPublic = isPublic;
    if (type) collection.type = type;

    await collection.save();
    res.json({ message: "Collection updated successfully.", collection });
  } catch (error) {
    console.error("Error updating collection:", error);
    res.status(500).json({ message: "Error updating collection." });
  }
}

export async function addTracks(req, res) {
  try {
    const { collectionId } = req.params;
    const creator = req.headers["x-user-address"];
    const { dsrcIds } = req.body;

    if (!Array.isArray(dsrcIds) || dsrcIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Please provide an array of DSRCids." });
    }

    const collection = await Collection.findOne({ collectionId, creator });

    if (!collection) {
      return res.status(404).json({ message: "Collection not found." });
    }

    dsrcIds.forEach((dsrcId) => {
      collection.addTrack(dsrcId);
    });

    await collection.save();
    res.json({ message: "Tracks added successfully.", collection });
  } catch (error) {
    console.error("Error adding tracks:", error);
    res.status(500).json({ message: "Error adding tracks." });
  }
}

export async function getPublicCollections(req, res) {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const collections = await Collection.find({ isPublic: true })
      .select("-tracks")
      .sort("-createdAt")
      .skip(Number(offset))
      .limit(Number(limit));

    const total = await Collection.countDocuments({ isPublic: true });

    res.json({
      collections,
      pagination: {
        total,
        offset: Number(offset),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching public collections:", error);
    res.status(500).json({ message: "Error fetching public collections." });
  }
}

export async function searchCollections(req, res) {
  try {
    const { query, limit = 20, offset = 0, type } = req.query;
    const userAddress = req.headers["x-user-address"];

    if (!query) {
      return res.status(400).json({ message: "Search query is required." });
    }

    const searchRegex = new RegExp(query, "i");

    const searchCriteria = {
      $or: [{ creator: userAddress }, { isPublic: true }],
      $or: [{ name: searchRegex }, { description: searchRegex }],
    };

    // Add type filter if provided
    if (type) {
      searchCriteria.type = type;
    }

    const collections = await Collection.find(searchCriteria)
      .select("-tracks")
      .sort("-createdAt")
      .skip(Number(offset))
      .limit(Number(limit));

    res.json({ collections });
  } catch (error) {
    console.error("Error searching collections:", error);
    res.status(500).json({ message: "Error searching collections." });
  }
}

export async function getPaginatedCollections(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const creator = req.headers["x-user-address"];
    const { type } = req.query;

    const query = { creator };

    // Add type filter if provided
    if (type) {
      query.type = type;
    }

    const [collections, total] = await Promise.all([
      Collection.find(query)
        .select("-tracks")
        .sort("-createdAt")
        .skip(skip)
        .limit(limit)
        .lean(),
      Collection.countDocuments(query),
    ]);

    res.json({
      collections,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching collections:", error);
    res.status(500).json({ message: "Error fetching collections." });
  }
}

export async function getPaginatedTracks(req, res) {
  try {
    const { collectionId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const creator = req.headers["x-user-address"];

    const collection = await Collection.findOne({ collectionId });

    if (!collection) {
      return res.status(404).json({ message: "Collection not found." });
    }

    if (!collection.isPublic && collection.creator !== creator) {
      return res.status(403).json({ message: "Access denied." });
    }

    const total = collection.tracks.length;
    const paginatedTracks = collection.tracks.slice(skip, skip + limit);

    res.json({
      collectionId,
      tracks: paginatedTracks,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching tracks:", error);
    res.status(500).json({ message: "Error fetching tracks." });
  }
}



export async function getCollectionsByType(req, res) {
  try {
    const { type } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    if (!type) {
      return res.status(400).json({ message: "Collection type is required." });
    }

    const collections = await Collection.find({ isPublic: true, type })
      .select("-tracks")
      .sort("-createdAt")
      .skip(Number(offset))
      .limit(Number(limit));

    const total = await Collection.countDocuments({ isPublic: true, type });

    res.json({
      collections,
      pagination: {
        total,
        offset: Number(offset),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching collections by type:", error);
    res.status(500).json({ message: "Error fetching collections by type." });
  }
}
