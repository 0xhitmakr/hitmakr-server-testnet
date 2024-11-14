import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { 
  submitDSRCCopyrightClaim,
} from '../controllers/dsrcCopyrightController.js';

const router = express.Router();

router.post('/claim', verifyToken, submitDSRCCopyrightClaim);

export default router;