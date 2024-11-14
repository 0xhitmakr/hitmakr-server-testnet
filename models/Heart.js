import mongoose from 'mongoose';

const heartSchema = new mongoose.Schema({
  userAddress: {
    type: String,
    required: true,
    index: true
  },
  dsrcId: {
    type: String,
    required: true,
    index: true
  },
  uploadHash: {
    type: String, 
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

heartSchema.index({ userAddress: 1, dsrcId: 1 }, { unique: true }); 
heartSchema.index({ dsrcId: 1, createdAt: -1 }); 
heartSchema.index({ userAddress: 1, createdAt: -1 });


heartSchema.statics.toggleHeart = async function(userAddress, dsrcId, uploadHash) {
  try {
    const existingHeart = await this.findOne({
      userAddress: userAddress,
      dsrcId: dsrcId
    });

    if (existingHeart) {
      await existingHeart.deleteOne();
      return {
        action: 'unliked',
        heart: existingHeart
      };
    } else {
      const newHeart = await this.create({
        userAddress,
        dsrcId,
        uploadHash
      });

      return {
        action: 'liked',
        heart: newHeart
      };
    }
  } catch (error) {
    if (error.code === 11000) {
      const existing = await this.findOne({
        userAddress: userAddress,
        dsrcId: dsrcId
      });
      
      if (existing) {
        await existing.deleteOne();
        return {
          action: 'unliked',
          heart: existing
        };
      }
    }
    throw error;
  }
};

heartSchema.statics.hasLiked = function(userAddress, dsrcId) {
  return this.exists({
    userAddress,
    dsrcId
  });
};

heartSchema.statics.getDSRCLikes = async function(dsrcId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const [likes, totalCount] = await Promise.all([
    this.find({ dsrcId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('userAddress createdAt'),
    
    this.countDocuments({ dsrcId })
  ]);

  return {
    likes: likes.map(like => ({
      userAddress: like.userAddress,
      createdAt: like.createdAt
    })),
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
    totalLikes: totalCount
  };
};

heartSchema.statics.getUserLikes = async function(userAddress, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    const [likes, totalCount] = await Promise.all([
      this.find({ 
        userAddress,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('dsrcId uploadHash createdAt')
        .lean(),
      
      this.countDocuments({ 
        userAddress,
      })
    ]);
  
    const likedDSRCs = likes.map(like => ({
      dsrcId: like.dsrcId,
      uploadHash: like.uploadHash,
      createdAt: like.createdAt
    }));
  
    return {
      likes: likedDSRCs,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalLikes: totalCount
    };
  };

heartSchema.statics.getDSRCLikeCount = async function(dsrcId) {
  const count = await this.countDocuments({ dsrcId });
  return { totalLikes: count };
};

heartSchema.statics.getMultipleDSRCLikeCounts = async function(dsrcIds) {
  const counts = await this.aggregate([
    {
      $match: {
        dsrcId: { $in: dsrcIds }
      }
    },
    {
      $group: {
        _id: '$dsrcId',
        count: { $sum: 1 }
      }
    }
  ]);

  const likeCounts = {};
  counts.forEach(item => {
    likeCounts[item._id] = item.count;
  });

  return likeCounts;
};

heartSchema.statics.getTopLikedDSRCs = async function(days = 7, limit = 10) {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);

  const topLiked = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: dateThreshold }
      }
    },
    {
      $group: {
        _id: '$dsrcId',
        count: { $sum: 1 },
        uploadHash: { $first: '$uploadHash' }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: limit
    }
  ]);

  return topLiked;
};

heartSchema.statics.getUserLikeStatuses = async function(userAddress, dsrcIds) {
  const likes = await this.find({
    userAddress,
    dsrcId: { $in: dsrcIds }
  }).select('dsrcId');

  const likeStatuses = {};
  dsrcIds.forEach(dsrcId => {
    likeStatuses[dsrcId] = likes.some(like => like.dsrcId === dsrcId);
  });

  return likeStatuses;
};

const Heart = mongoose.models.Heart || mongoose.model('Heart', heartSchema);

export default Heart;