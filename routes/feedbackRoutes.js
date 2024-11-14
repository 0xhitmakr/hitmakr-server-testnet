import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { submitFeedback } from '../controllers/feedbackController.js';

const router = express.Router(); 

router.post('/feedback', verifyToken, submitFeedback); 

export default router;