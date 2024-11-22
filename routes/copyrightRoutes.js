import express from 'express';
const router = express.Router();
import multer from 'multer';
import { verifyToken } from '../middleware/authMiddleware.js';
import { checkCopyright } from '../controllers/copyrightController.js';

const upload = multer({ dest: 'uploads/' });

router.post('/copyright-check', verifyToken, upload.single('song'), checkCopyright);

export default router;