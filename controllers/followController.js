import Follow from '../models/Follow.js';


export async function followUser(req, res) {
  try {
    const followerAddress = req.headers['x-user-address'];
    const { followingAddress } = req.body;

    if (!followerAddress || !followingAddress) {
      return res.status(400).json({ 
        message: 'Both follower and following addresses are required.' 
      });
    }

    await Follow.followUser(followerAddress, followingAddress);
    
    const counts = await Follow.getCounts(followingAddress);
    
    res.status(201).json({ 
      message: 'Successfully followed user.',
      counts
    });
  } catch (error) {
    console.error('Error following user:', error);
    if (error.message === 'Users cannot follow themselves') {
      return res.status(400).json({ message: error.message });
    }
    if (error.message === 'Already following this user') {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error following user.' });
  }
}


export async function unfollowUser(req, res) {
  try {
    const followerAddress = req.headers['x-user-address'];
    const { followingAddress } = req.body;

    if (!followerAddress || !followingAddress) {
      return res.status(400).json({ 
        message: 'Both follower and following addresses are required.' 
      });
    }

    const result = await Follow.unfollowUser(followerAddress, followingAddress);
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        message: 'Follow relationship not found.' 
      });
    }

    const counts = await Follow.getCounts(followingAddress);

    res.json({ 
      message: 'Successfully unfollowed user.',
      counts
    });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ message: 'Error unfollowing user.' });
  }
}


export async function getFollowers(req, res) {
  try {
    const userAddress = req.params.userAddress;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    if (!userAddress) {
      return res.status(400).json({ 
        message: 'User address is required.' 
      });
    }

    const followersData = await Follow.getFollowers(userAddress, page, limit);

    res.json({
      followers: followersData.followers,
      pagination: {
        currentPage: followersData.page,
        totalPages: followersData.totalPages,
        totalFollowers: followersData.totalFollowers,
        itemsPerPage: followersData.limit,
        hasNextPage: followersData.page < followersData.totalPages,
        hasPrevPage: followersData.page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching followers:', error);
    res.status(500).json({ message: 'Error fetching followers.' });
  }
}


export async function getFollowing(req, res) {
  try {
    const userAddress = req.params.userAddress;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    if (!userAddress) {
      return res.status(400).json({ 
        message: 'User address is required.' 
      });
    }

    const followingData = await Follow.getFollowing(userAddress, page, limit);

    res.json({
      following: followingData.following,
      pagination: {
        currentPage: followingData.page,
        totalPages: followingData.totalPages,
        totalFollowing: followingData.totalFollowing,
        itemsPerPage: followingData.limit,
        hasNextPage: followingData.page < followingData.totalPages,
        hasPrevPage: followingData.page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching following list:', error);
    res.status(500).json({ message: 'Error fetching following list.' });
  }
}


export async function getFollowCounts(req, res) {
  try {
    const userAddress = req.params.userAddress;

    if (!userAddress) {
      return res.status(400).json({ 
        message: 'User address is required.' 
      });
    }

    const counts = await Follow.getCounts(userAddress);
    res.json(counts);
  } catch (error) {
    console.error('Error fetching follow counts:', error);
    res.status(500).json({ message: 'Error fetching follow counts.' });
  }
}


export async function checkFollowStatus(req, res) {
  try {
    const followerAddress = req.headers['x-user-address'];
    const followingAddress = req.params.userAddress;

    if (!followerAddress || !followingAddress) {
      return res.status(400).json({ 
        message: 'Both follower and following addresses are required.' 
      });
    }

    const isFollowing = await Follow.isFollowing(followerAddress, followingAddress);
    res.json({ isFollowing: !!isFollowing });
  } catch (error) {
    console.error('Error checking follow status:', error);
    res.status(500).json({ message: 'Error checking follow status.' });
  }
}


export async function checkMutualFollow(req, res) {
  try {
    const userAddress1 = req.headers['x-user-address'];
    const userAddress2 = req.params.userAddress;

    if (!userAddress1 || !userAddress2) {
      return res.status(400).json({ 
        message: 'Both user addresses are required.' 
      });
    }

    const areMutualFollowers = await Follow.getMutualFollowers(userAddress1, userAddress2);
    res.json({ areMutualFollowers });
  } catch (error) {
    console.error('Error checking mutual follow status:', error);
    res.status(500).json({ message: 'Error checking mutual follow status.' });
  }
}