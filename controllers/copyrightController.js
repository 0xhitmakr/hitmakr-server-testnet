import { recognizeSong, checkSongExistence } from '../services/shazamService.js';
import { generateFingerprint, checkForSimilarSong } from '../services/fingerprintService.js';
import { safeDeleteFile, calculateAudioDuration } from '../utils/fileUtils.js';

export async function checkCopyright(req, res) {
  let filePath;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No song file uploaded.' });
    }

    filePath = req.file.path;

    const duration = await calculateAudioDuration(filePath);
    if (duration === 0) {
      safeDeleteFile(filePath);
      return res.status(400).json({ message: 'Invalid audio file or duration could not be determined.' });
    }

    const recognition = await recognizeSong(filePath);
    const isShazamRecognized = checkSongExistence(recognition);

    if (isShazamRecognized) {
      safeDeleteFile(filePath);
      return res.status(200).json({
        message: 'Copyright violation detected.',
        song: {
          title: recognition.track.title,
          artist: recognition.track.subtitle,
        },
      });
    }

    const fingerprints = await generateFingerprint(filePath);
    const { matchingSongId, matchPercentage } = await checkForSimilarSong(fingerprints);

    safeDeleteFile(filePath);

    if (matchingSongId) {
      return res.status(200).json({
        message: 'Potential copyright issue: Fingerprint match found.',
        matchPercentage: matchPercentage.toFixed(2),
      });
    }

    res.status(200).json({ message: 'No copyright violation detected.' });

  } catch (error) {
    console.error('Error processing copyright check:', error);
    if (filePath) {
      safeDeleteFile(filePath);
    }
    res.status(500).json({ 
      message: 'Error processing copyright check.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}