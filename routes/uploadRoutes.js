import express from 'express';
const router = express.Router(); 
import multer from 'multer';
import { verifyToken } from '../middleware/authMiddleware.js';
import { newUpload } from '../controllers/uploadController.js';


const upload = multer({ dest: 'uploads/' });

router.post('/new-upload', verifyToken, upload.fields([
  { name: 'song', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 },
]), newUpload);


export default router;