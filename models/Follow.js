import mongoose from 'mongoose';

const followSchema = new mongoose.Schema({
  follower: {
    type: String, 
    required: true,
    index: true
  },
  following: {
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


followSchema.index({ follower: 1, following: 1 }, { unique: true }); 
followSchema.index({ follower: 1, createdAt: -1 }); 
followSchema.index({ following: 1, createdAt: -1 }); 

followSchema.statics.followUser = async function(followerAddress, followingAddress) {
  if (followerAddress === followingAddress) {
    throw new Error('Users cannot follow themselves');
  }

  try {
    const newFollow = await this.create({
      follower: followerAddress,
      following: followingAddress
    });
    return newFollow;
  } catch (error) {
    if (error.code === 11000) {
      throw new Error('Already following this user');
    }
    throw error;
  }
};

followSchema.statics.unfollowUser = function(followerAddress, followingAddress) {
  return this.deleteOne({
    follower: followerAddress,
    following: followingAddress
  });
};


followSchema.statics.isFollowing = function(followerAddress, followingAddress) {
  return this.exists({
    follower: followerAddress,
    following: followingAddress
  });
};


followSchema.statics.getFollowers = async function(userAddress, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const [followers, totalCount] = await Promise.all([
    this.find({ following: userAddress })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('follower createdAt'),
    
    this.countDocuments({ following: userAddress })
  ]);

  return {
    followers: followers.map(f => f.follower),
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
    totalFollowers: totalCount
  };
};


followSchema.statics.getFollowing = async function(userAddress, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const [following, totalCount] = await Promise.all([
    this.find({ follower: userAddress })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('following createdAt'),
    
    this.countDocuments({ follower: userAddress })
  ]);

  return {
    following: following.map(f => f.following),
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
    totalFollowing: totalCount
  };
};


followSchema.statics.getCounts = async function(userAddress) {
  const [followerCount, followingCount] = await Promise.all([
    this.countDocuments({ following: userAddress }),
    this.countDocuments({ follower: userAddress })
  ]);

  return {
    followers: followerCount,
    following: followingCount
  };
};


followSchema.statics.getMutualFollowers = async function(userAddress1, userAddress2) {
  const mutualFollowers = await this.aggregate([
    {
      $match: {
        $or: [
          { follower: userAddress1, following: userAddress2 },
          { follower: userAddress2, following: userAddress1 }
        ]
      }
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 }
      }
    }
  ]);

  return mutualFollowers.length === 2;
};

const Follow = mongoose.models.Follow || mongoose.model('Follow', followSchema);

export default Follow;