import express from 'express';
import multer from 'multer';
import { verifyToken } from '../middleware/authMiddleware.js';
import { checkCopyright } from '../controllers/copyrightController.js';

const router = express.Router();
const upload = multer({ 
    dest: 'uploads/',
    limits: {
      fileSize: 100 * 1024 * 1024
    }
}); 

router.post('/copyright-check', verifyToken, upload.single('song'), checkCopyright); 

export default router;