import fs from 'fs';
import { getAudioDurationInSeconds } from 'get-audio-duration';

export function safeDeleteFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`Deleted file: ${filePath}`);
    } catch (err) {
      console.error(`Error deleting file ${filePath}:`, err);
    }
  }
}

export async function calculateAudioDuration(filePath) {
  try {
    const durationInSeconds = await getAudioDurationInSeconds(filePath);
    return durationInSeconds;
  } catch (error) {
    console.error(`Error calculating audio duration: ${error.message}`);
    return 0;
  }
}

export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}