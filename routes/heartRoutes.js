import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import * as heartController from '../controllers/heartController.js';

const router = express.Router();


router.post('/toggle', verifyToken, heartController.toggleHeart);


router.get('/dsrc/:dsrcId/likes', heartController.getDSRCLikes);


router.get('/user-likes-count/:userAddress', heartController.getUserLikesCount);
router.get('/user/:userAddress/likes', verifyToken, heartController.getUserLikes);


router.get('/dsrc/:dsrcId/count', heartController.getDSRCLikeCount);

router.get('/status/:dsrcId', verifyToken, heartController.checkHeartStatus);

router.post('/multiple-counts', heartController.getMultipleDSRCLikeCounts);
router.post('/user-statuses', verifyToken, heartController.getUserLikeStatuses);
router.get('/top-liked', heartController.getTopLikedDSRCs);

export default router;