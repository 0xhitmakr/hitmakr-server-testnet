import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { 
    createDSRC,
} from '../controllers/dsrcController.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const createDSRCLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, 
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { 
        success: false, 
        message: 'Too many DSRC creation attempts. Please try again later.'
    }
});



router.post(
    '/create',
    [
        verifyToken,        
        createDSRCLimiter     
    ],
    createDSRC
);




export default router;