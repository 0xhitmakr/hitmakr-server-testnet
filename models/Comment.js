import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
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
  content: {
    type: String, 
    required: true,
    maxLength: 500 
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

commentSchema.index({ dsrcId: 1, createdAt: -1 }); 
commentSchema.index({ userAddress: 1, createdAt: -1 }); 

commentSchema.statics.createComment = async function(userAddress, dsrcId, uploadHash, content) {
  if (!content || content.trim().length === 0) {
    throw new Error('Comment content cannot be empty');
  }
  
  if (content.length > 500) {
    throw new Error('Comment content exceeds maximum length of 500 characters');
  }

  const newComment = await this.create({
    userAddress,
    dsrcId,
    uploadHash,
    content: content.trim()
  });

  return newComment;
};


commentSchema.statics.getDSRCComments = async function(dsrcId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const [comments, totalCount] = await Promise.all([
    this.find({ dsrcId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('userAddress content createdAt')
      .lean(),
    
    this.countDocuments({ dsrcId })
  ]);

  return {
    comments: comments.map(comment => ({
      userAddress: comment.userAddress,
      content: comment.content,
      createdAt: comment.createdAt
    })),
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
    totalComments: totalCount
  };
};


commentSchema.statics.getUserComments = async function(userAddress, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const [comments, totalCount] = await Promise.all([
    this.find({ userAddress })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('dsrcId uploadHash content createdAt')
      .lean(),
    
    this.countDocuments({ userAddress })
  ]);

  return {
    comments: comments.map(comment => ({
      dsrcId: comment.dsrcId,
      uploadHash: comment.uploadHash,
      content: comment.content,
      createdAt: comment.createdAt
    })),
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
    totalComments: totalCount
  };
};


commentSchema.statics.getDSRCCommentCount = async function(dsrcId) {
  const count = await this.countDocuments({ dsrcId });
  return { totalComments: count };
};


commentSchema.statics.getMultipleDSRCCommentCounts = async function(dsrcIds) {
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

  const commentCounts = {};
  counts.forEach(item => {
    commentCounts[item._id] = item.count;
  });

  return commentCounts;
};

commentSchema.statics.getTopCommentedDSRCs = async function(days = 7, limit = 10) {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);

  const topCommented = await this.aggregate([
      {
          $match: {
              createdAt: { $gte: dateThreshold }
          }
      },
      {
          $group: {
              _id: '$dsrcId',
              uniqueCommenters: { $addToSet: '$userAddress' },
              uploadHash: { $first: '$uploadHash' },
              commentCount: { $sum: 1 }
          }
      },
      {
          $addFields: {
              uniqueCommentersCount: { $size: '$uniqueCommenters' }
          }
      },
      {
          $sort: {
              uniqueCommentersCount: -1,
              commentCount: -1
          }
      },
      {
          $limit: limit
      },
      {
          $project: {
              dsrcId: '$_id',
              uploadHash: 1,
              uniqueCommentersCount: 1,
              totalComments: '$commentCount',
              _id: 0
          }
      }
  ]);

  return topCommented;
};


commentSchema.statics.deleteComment = async function(commentId, userAddress) {
  const comment = await this.findById(commentId);
  
  if (!comment) {
    throw new Error('Comment not found');
  }
  
  if (comment.userAddress !== userAddress) {
    throw new Error('Unauthorized to delete this comment');
  }
  
  await comment.deleteOne();
  return comment;
};

const Comment = mongoose.models.Comment || mongoose.model('Comment', commentSchema);

export default Comment;