import { Uploader } from '@irys/upload';
import { BaseEth } from '@irys/upload-ethereum';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import dotenv from 'dotenv';
import { uploadFile } from './filebaseService.js';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';

dotenv.config();

const CHUNK_SIZE = 90 * 1024;

const getIrysUploader = async () => {
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY environment variable is not set');
  }
  return await Uploader(BaseEth).withWallet(process.env.PRIVATE_KEY);
};

function getContentType(fileExtension) {
  switch (fileExtension.toLowerCase()) {
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.ogg':
      return 'audio/ogg';
    default:
      return 'application/octet-stream';
  }
}

async function validateAndFixAudio(inputPath) {
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
        .on('end', () => resolve(outputPath))
        .on('error', (err, stdout, stderr) => reject(new Error(`FFmpeg conversion error: ${err.message}`)));

      if (metadata.streams[0] && metadata.streams[0].codec_name === 'aac') {
        command.inputOptions(['-acodec aac']);
      }

      command.save(outputPath);
    });
  });
}

async function uploadChunk(chunk, index, contentType, totalChunks, fileName, retries = 3) {
  const irys = await getIrysUploader();
  const tags = [
    { name: 'Content-Type', value: contentType },
    { name: 'Chunk-Index', value: index.toString() },
    { name: 'Total-Chunks', value: totalChunks.toString() },
    { name: 'File-Name', value: fileName },
    { name: 'Accept-Ranges', value: 'bytes' },
  ];

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await irys.upload(chunk, { tags });
      return { id: response.id, index: index };
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }
  throw lastError;
}

export async function uploadMusic(filePath) {
  try {
    const validatedFilePath = await validateAndFixAudio(filePath);
    const fileName = path.basename(validatedFilePath);
    const fileExtension = path.extname(validatedFilePath);
    const fileSize = fs.statSync(validatedFilePath).size;
    const fileStream = fs.createReadStream(validatedFilePath);
    const contentType = getContentType(fileExtension);
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
    const uploadPromises = [];
    let chunkIndex = 0;
    let buffer = Buffer.alloc(0);

    const processChunk = () => {
      return new Promise((resolve, reject) => {
        fileStream.on('data', (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);
          while (buffer.length >= CHUNK_SIZE) {
            const chunkToUpload = buffer.slice(0, CHUNK_SIZE);
            buffer = buffer.slice(CHUNK_SIZE);
            const chunkStream = Readable.from(chunkToUpload);
            uploadPromises.push(uploadChunk(chunkStream, chunkIndex, contentType, totalChunks, fileName));
            chunkIndex++;
          }
        });

        fileStream.on('end', () => {
          if (buffer.length > 0) {
            const chunkStream = Readable.from(buffer);
            uploadPromises.push(uploadChunk(chunkStream, chunkIndex, contentType, totalChunks, fileName));
          }
          resolve();
        });

        fileStream.on('error', reject);
      });
    };

    await processChunk();
    const chunkResults = await Promise.all(uploadPromises);
    await promisify(fs.unlink)(validatedFilePath).catch(console.error);
    return chunkResults.sort((a, b) => a.index - b.index).map(result => result.id);
  } catch (error) {
    throw error;
  }
}

export async function uploadCoverImage(fileObject) {
  try {
    const irys = await getIrysUploader();
    const tags = [
      { name: 'Content-Type', value: fileObject.mimetype },
      { name: 'File-Name', value: fileObject.originalname },
    ];

    const fileStream = Readable.from(fileObject.buffer);
    const response = await irys.upload(fileStream, { tags });
    return `https://gateway.irys.xyz/${response.id}`;
  } catch (error) {
    throw new Error('Failed to upload cover image to Irys');
  }
}

async function uploadLyricsToIrys(lyricsText) {
  try {
    const irys = await getIrysUploader();
    const tags = [
      { name: 'Content-Type', value: 'text/plain' },
      { name: 'File-Name', value: 'lyrics.txt' },
    ];

    const lyricsBase64 = Buffer.from(lyricsText).toString('base64');
    const response = await irys.upload(Buffer.from(lyricsBase64), { tags });
    return `https://gateway.irys.xyz/${response.id}`;
  } catch (error) {
    throw new Error('Failed to upload lyrics file to Irys');
  }
}

export async function uploadMetadata(metadata) {
  try {
    const jsonString = JSON.stringify(metadata);
    const sizeInBytes = Buffer.byteLength(jsonString, 'utf8');
    const SIZE_THRESHOLD = 100 * 1024;
      
    if (sizeInBytes <= SIZE_THRESHOLD) {
      const irys = await getIrysUploader();
      const tags = [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Type', value: 'metadata' }
      ];

      const response = await irys.upload(Buffer.from(jsonString), { tags });
      return `https://gateway.irys.xyz/${response.id}`;
    } else {
      const fileName = `metadata-${Date.now()}.json`;
      const tempFilePath = `/tmp/${fileName}`;
      fs.writeFileSync(tempFilePath, jsonString);
      
      const fileObject = {
        originalname: fileName,
        path: tempFilePath
      };
      
      return await uploadFile(fileObject);
    }
  } catch (error) {
    throw new Error(`Failed to upload metadata: ${error.message}`);
  }
}

export { uploadLyricsToIrys };