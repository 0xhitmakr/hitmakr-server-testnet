import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import * as commentController from '../controllers/commentController.js';

const router = express.Router();

router.post('/create', verifyToken, commentController.createComment);
router.get('/dsrc/:dsrcId/comments', commentController.getDSRCComments);
router.get('/dsrc/:dsrcId/count', commentController.getDSRCCommentCount);
router.get('/user-comments-count/:userAddress', commentController.getUserCommentsCount);
router.get('/user/:userAddress/comments', verifyToken, commentController.getUserComments);
router.post('/multiple-counts', commentController.getMultipleDSRCCommentCounts);
router.delete('/:commentId', verifyToken, commentController.deleteComment);
router.get('/top-commented', commentController.getTopCommentedDSRCs);

export default router;