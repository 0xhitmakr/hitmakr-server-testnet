import { spawn } from 'child_process';
import Codegen from '@qgustavor/stream-audio-fingerprint';
import Fingerprint from '../models/Fingerprints.js';

export async function generateFingerprint(filePath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", filePath,
      "-acodec", "pcm_s16le",
      "-ar", "22050",
      "-ac", "1",
      "-f", "s16le",
      "-v", "fatal",
      "pipe:1",
    ]);

    const fingerprinter = new Codegen();
    const fingerprints = [];

    ffmpeg.stdout.on("data", (audioData) => {
      const data = fingerprinter.process(audioData);
      for (let i = 0; i < data.tcodes.length; i++) {
        fingerprints.push(`${data.tcodes[i]}:${data.hcodes[i]}`);
      }
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) resolve(fingerprints);
      else reject(new Error(`FFmpeg error: ${code}`));
    });
  });
}

export async function processAndStoreFingerprint(songData) {
  try {
    const fingerprints = await generateFingerprint(songData.filePath);
    const fingerprint = new Fingerprint({
      songId: songData.songId,
      walletAddress: songData.walletAddress,
      fingerprints: fingerprints,
    });
    await fingerprint.save();
    console.log('Fingerprints stored successfully for songId:', songData.songId);
    return { success: true, message: 'Fingerprints stored successfully.' };
  } catch (error) {
    console.error('Error processing and storing fingerprint:', error);
    return { success: false, message: 'Error storing fingerprint.' };
  }
}

export async function checkForSimilarSong(fingerprints, threshold = 5) {
  try {
    const fingerprintSet = new Set(fingerprints);
    const matchResults = await Fingerprint.aggregate([
      {
        $project: {
          _id: 1,
          matchCount: {
            $size: {
              $setIntersection: ['$fingerprints', Array.from(fingerprintSet)],
            },
          },
        },
      },
      { $match: { matchCount: { $gte: threshold } } },
      { $sort: { matchCount: -1 } },
      { $limit: 1 },
    ]);
    if (matchResults.length > 0) {
      const bestMatch = matchResults[0];
      const matchPercentage = (bestMatch.matchCount / fingerprints.length) * 100;
      return { matchingSongId: bestMatch._id, matchPercentage };
    }
    return { matchingSongId: null, matchPercentage: 0 };
  } catch (error) {
    console.error('Error finding matching song:', error);
    throw error;
  }
}