import express from 'express';
const router = express.Router();
import multer from 'multer';
import { verifyToken } from '../middleware/authMiddleware.js';
import { uploadProfilePicture } from '../controllers/userController.js';

const upload = multer({ dest: 'uploads/' });

router.post('/profile-dp-url-generator', verifyToken, upload.single('profilePicture'), uploadProfilePicture);

export default router;