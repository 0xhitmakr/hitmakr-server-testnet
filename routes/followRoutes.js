import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import * as followController from '../controllers/followController.js';

const router = express.Router();

router.post('/follow', verifyToken, followController.followUser);
router.post('/unfollow', verifyToken, followController.unfollowUser);

router.get('/followers/:userAddress', followController.getFollowers);
router.get('/following/:userAddress', verifyToken, followController.getFollowing);

router.get('/follow-counts/:userAddress', followController.getFollowCounts);

router.get('/follow-status/:userAddress', verifyToken, followController.checkFollowStatus);

router.get('/mutual-follow/:userAddress', verifyToken, followController.checkMutualFollow);

export default router;