import { Shazam } from "node-shazam";
import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const shazam = new Shazam();

async function convertToValidMp3(inputPath) {
  const tempDir = path.join(process.cwd(), 'temp');
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const outputPath = path.join(tempDir, `${uuidv4()}.mp3`);

  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        return reject(new Error(`FFprobe error: ${err.message}`));
      }

      const command = ffmpeg(inputPath)
        .outputOptions([
          '-c:a libmp3lame',           
          '-q:a 2',                    
          '-ar 44100',                 
          '-ac 2',                     
          '-b:a 192k',                 
          '-map_metadata 0:s:0',       
          '-id3v2_version 3'           
        ])
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('Processing: ' + progress.percent + '% done');
        })
        .on('end', () => {
          console.log('FFmpeg conversion finished');
          resolve(outputPath);
        })
        .on('error', (err, stdout, stderr) => {
          console.error('FFmpeg stderr:', stderr);
          reject(new Error(`FFmpeg conversion error: ${err.message}`));
        });

      if (metadata.streams[0]) {
        const audioStream = metadata.streams[0];
        if (audioStream.codec_name === 'aac') {
          command.inputOptions(['-acodec aac']);
        }
      }

      command.save(outputPath);
    });
  });
}

async function validateAndFixAudio(filePath) {
  try {
    await promisify(fs.access)(filePath, fs.constants.R_OK);
    
    const stats = await promisify(fs.stat)(filePath);
    if (stats.size === 0) {
      throw new Error('File is empty');
    }

    try {
      const convertedPath = await convertToValidMp3(filePath);
      return convertedPath;
    } catch (error) {
      console.error('Standard conversion failed, trying fallback:', error);
      
      return new Promise((resolve, reject) => {
        const tempDir = path.join(process.cwd(), 'temp');
        const fallbackPath = path.join(tempDir, `${uuidv4()}_fallback.mp3`);

        ffmpeg(filePath)
          .outputOptions([
            '-c:a libmp3lame',
            '-q:a 5',                  
            '-ar 44100',
            '-ac 1',                  
            '-b:a 128k',              
            '-map_metadata 0:s:0'
          ])
          .on('end', () => resolve(fallbackPath))
          .on('error', (err) => reject(err))
          .save(fallbackPath);
      });
    }
  } catch (error) {
    console.error('Audio validation failed:', error);
    throw error;
  }
}

async function cleanupTempFiles(files) {
  for (const file of files) {
    try {
      if (file && fs.existsSync(file)) {
        await promisify(fs.unlink)(file);
      }
    } catch (error) {
      console.error(`Error cleaning up file ${file}:`, error);
    }
  }
}

export async function recognizeSong(filePath) {
  let convertedPath = null;
  let fallbackPath = null;

  try {
    convertedPath = await validateAndFixAudio(filePath);
    
    try {
      const recognition = await shazam.recognise(convertedPath, "en-US");
      return recognition;
    } catch (error) {
      console.error('First recognition attempt failed:', error);
      
      if (fallbackPath = await convertToValidMp3(filePath)) {
        const recognition = await shazam.recognise(fallbackPath, "en-US");
        return recognition;
      }
      throw error;
    }
  } catch (error) {
    console.error("Shazam recognition error:", error);
    throw new Error(`Failed to process audio: ${error.message}`);
  } finally {
    await cleanupTempFiles([convertedPath, fallbackPath].filter(Boolean));
  }
}

export function checkSongExistence(recognition) {
  return !!(recognition && recognition.track);
}

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  const tempDir = path.join(process.cwd(), 'temp');
  if (fs.existsSync(tempDir)) {
    fs.readdir(tempDir, (err, files) => {
      if (err) return;
      for (const file of files) {
        fs.unlink(path.join(tempDir, file), () => {});
      }
    });
  }
});
