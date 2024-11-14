
import { uploadFile } from '../services/filebaseService.js';
import { safeDeleteFile } from '../utils/fileUtils.js';

const MAX_FILE_SIZE = 1 * 1024 * 1024;


export async function uploadProfilePicture(req, res) {
    try {
        if (req.file && req.file.size > MAX_FILE_SIZE) {
            safeDeleteFile(req.file.path);
            return res.status(413).json({ message: 'File size exceeds the limit of 1MB.' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No profile picture uploaded.' });
        }

        const profilePictureUrl = await uploadFile(req.file);
        safeDeleteFile(req.file.path);

        res.json({ 
            message: 'Profile picture uploaded successfully.', 
            profilePictureUrl 
        });
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        res.status(500).json({ message: 'Error uploading profile picture.' });
    }
}

