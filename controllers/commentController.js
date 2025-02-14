import Comment from "../models/Comment.js";
import Song from "../models/Song.js";

export async function createComment(req, res) {
  try {
    const userAddress = req.headers["x-user-address"];
    const { dsrcId, content } = req.body;

    if (!userAddress || !dsrcId || !content) {
      return res.status(400).json({
        message: "User address, DSRC ID, and comment content are required.",
      });
    }

    const song = await Song.findOne({ dsrcId });
    if (!song) {
      return res.status(404).json({ message: "DSRC not found." });
    }

    const newComment = await Comment.createComment(
      userAddress,
      dsrcId,
      song.uploadHash,
      content
    );

    const counts = await Comment.getDSRCCommentCount(dsrcId);

    res.status(201).json({
      message: "Comment created successfully.",
      comment: {
        userAddress: newComment.userAddress,
        content: newComment.content,
        createdAt: newComment.createdAt,
      },
      counts,
    });
  } catch (error) {
    console.error("Error creating comment:", error);
    if (error.message.includes("maximum length")) {
      return res.status(400).json({ message: error.message });
    }
    return res
      .status(500)
      .json({ message: "Error creating comment. Please try again." });
  }
}

export async function getDSRCComments(req, res) {
  try {
    const { dsrcId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    if (!dsrcId) {
      return res.status(400).json({
        message: "DSRC ID is required.",
      });
    }

    const songExists = await Song.exists({ dsrcId });
    if (!songExists) {
      return res.status(404).json({ message: "DSRC not found." });
    }

    const commentsData = await Comment.getDSRCComments(dsrcId, page, limit);

    res.json({
      comments: commentsData.comments,
      pagination: {
        currentPage: commentsData.page,
        totalPages: commentsData.totalPages,
        totalComments: commentsData.totalComments,
        itemsPerPage: commentsData.limit,
        hasNextPage: commentsData.page < commentsData.totalPages,
        hasPrevPage: commentsData.page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching DSRC comments:", error);
    res.status(500).json({ message: "Error fetching DSRC comments." });
  }
}

export async function getUserComments(req, res) {
  try {
    const userAddress = req.params.userAddress;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    if (!userAddress) {
      return res.status(400).json({
        message: "User address is required.",
      });
    }

    const commentsData = await Comment.getUserComments(
      userAddress,
      page,
      limit
    );

    const enrichedComments = await Promise.all(
      commentsData.comments.map(async (comment) => {
        const song = await Song.findOne({ dsrcId: comment.dsrcId })
          .select("title description metadata walletAddress supportedChains")
          .lean();

        if (!song) {
          return null;
        }

        return {
          ...comment,
          songDetails: {
            title: song.title,
            description: song.description,
            metadata: song.metadata,
            creator: song.walletAddress,
            supportedChains: song.supportedChains,
          },
        };
      })
    );

    const validComments = enrichedComments.filter(
      (comment) => comment !== null
    );

    res.json({
      comments: validComments,
      pagination: {
        currentPage: commentsData.page,
        totalPages: commentsData.totalPages,
        totalComments: commentsData.totalComments,
        itemsPerPage: commentsData.limit,
        hasNextPage: commentsData.page < commentsData.totalPages,
        hasPrevPage: commentsData.page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching user comments:", error);
    res.status(500).json({ message: "Error fetching user comments." });
  }
}

export async function getTopCommentedDSRCs(req, res) {
  try {
    const days = parseInt(req.query.days) || 7;
    const limit = parseInt(req.query.limit) || 10;

    const topCommented = await Comment.getTopCommentedDSRCs(days, limit);

    const enrichedResults = await Promise.all(
      topCommented.map(async (item) => {
        const song = await Song.findOne({ dsrcId: item.dsrcId })
          .select(
            "title description metadata walletAddress supportedChains hashTags id"
          )
          .lean();

        if (!song) {
          return null;
        }

        return {
          dsrcId: item.dsrcId,
          uniqueCommenters: item.uniqueCommentersCount,
          totalComments: item.totalComments,
          uploadHash: item.uploadHash,
          songDetails: {
            title: song.title,
            description: song.description,
            metadata: song.metadata,
            creator: song.walletAddress,
            supportedChains: song.supportedChains,
            hashTags: song.hashTags,
            _id: song._id,
          },
        };
      })
    );

    const validResults = enrichedResults.filter((item) => item !== null);

    res.json({
      timeframe: `${days} days`,
      results: validResults,
    });
  } catch (error) {
    console.error("Error fetching top commented DSRCs:", error);
    res.status(500).json({ message: "Error fetching top commented DSRCs." });
  }
}

export async function getDSRCCommentCount(req, res) {
  try {
    const { dsrcId } = req.params;

    if (!dsrcId) {
      return res.status(400).json({
        message: "DSRC ID is required.",
      });
    }

    const songExists = await Song.exists({ dsrcId });
    if (!songExists) {
      return res.status(404).json({ message: "DSRC not found." });
    }

    const counts = await Comment.getDSRCCommentCount(dsrcId);
    res.json(counts);
  } catch (error) {
    console.error("Error fetching DSRC comment count:", error);
    res.status(500).json({ message: "Error fetching DSRC comment count." });
  }
}

export async function getMultipleDSRCCommentCounts(req, res) {
  try {
    const { dsrcIds } = req.body;

    if (!Array.isArray(dsrcIds) || dsrcIds.length === 0) {
      return res.status(400).json({
        message: "Array of DSRC IDs is required.",
      });
    }

    const existingDsrcs = await Song.find({ dsrcId: { $in: dsrcIds } })
      .select("dsrcId")
      .lean();

    const existingDsrcIds = existingDsrcs.map((song) => song.dsrcId);
    const nonExistingDsrcIds = dsrcIds.filter(
      (id) => !existingDsrcIds.includes(id)
    );

    if (nonExistingDsrcIds.length > 0) {
      return res.status(404).json({
        message: "Some DSRCs not found",
        nonExistingDsrcIds,
      });
    }

    const commentCounts = await Comment.getMultipleDSRCCommentCounts(dsrcIds);
    res.json({ commentCounts });
  } catch (error) {
    console.error("Error fetching multiple DSRC comment counts:", error);
    res
      .status(500)
      .json({ message: "Error fetching multiple DSRC comment counts." });
  }
}

export async function deleteComment(req, res) {
  try {
    const userAddress = req.headers["x-user-address"];
    const { commentId } = req.params;

    if (!userAddress || !commentId) {
      return res.status(400).json({
        message: "User address and comment ID are required.",
      });
    }

    const deletedComment = await Comment.deleteComment(commentId, userAddress);

    const counts = await Comment.getDSRCCommentCount(deletedComment.dsrcId);

    res.json({
      message: "Comment deleted successfully.",
      counts,
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    if (error.message === "Comment not found") {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === "Unauthorized to delete this comment") {
      return res.status(403).json({ message: error.message });
    }
    res.status(500).json({ message: "Error deleting comment." });
  }
}

export async function getUserCommentsCount(req, res) {
  try {
    const { userAddress } = req.params;

    if (!userAddress) {
      return res.status(400).json({
        message: "User address is required.",
      });
    }

    const totalComments = await Comment.countDocuments({ userAddress });

    res.json({ totalComments });
  } catch (error) {
    console.error("Error fetching user comments count:", error);
    res.status(500).json({ message: "Error fetching user comments count." });
  }
}
