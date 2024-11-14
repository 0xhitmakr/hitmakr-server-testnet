import { Uploader } from '@irys/upload';
import { BaseEth } from '@irys/upload-ethereum';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import dotenv from 'dotenv';
import { uploadFile } from './filebaseService.js';

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

async function uploadChunk(chunk, index, contentType, totalChunks, fileName) {
  const irys = await getIrysUploader();
  const tags = [
    { name: 'Content-Type', value: contentType },
    { name: 'Chunk-Index', value: index.toString() },
    { name: 'Total-Chunks', value: totalChunks.toString() },
    { name: 'File-Name', value: fileName },
    { name: 'Accept-Ranges', value: 'bytes' },
  ];

  try {
    const response = await irys.upload(chunk, { tags });
    console.log(`Chunk ${index + 1}/${totalChunks} uploaded ==> https://gateway.irys.xyz/${response.id}`);
    return { id: response.id, index: index };
  } catch (e) {
    console.error(`Error uploading chunk ${index + 1}/${totalChunks}:`, e);
    throw e;
  }
}

export async function uploadMusic(filePath) {
  const fileName = path.basename(filePath);
  const fileExtension = path.extname(filePath);
  const fileSize = fs.statSync(filePath).size;
  const fileStream = fs.createReadStream(filePath);
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

      fileStream.on('error', (error) => {
        reject(error);
      });
    });
  };

  try {
    await processChunk();
    const chunkResults = await Promise.all(uploadPromises);
    return chunkResults.sort((a, b) => a.index - b.index).map((result) => result.id);
  } catch (error) {
    console.error('Error during file upload:', error);
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
    console.error('Error uploading cover image to Irys:', error);
    throw new Error('Failed to upload cover image to Irys');
  }
}

async function uploadLyricsToIrys(lyricsText) {
  console.log('Uploading lyrics to Irys...');
  try {
    const irys = await getIrysUploader();
    const tags = [
      { name: 'Content-Type', value: 'text/plain' },
      { name: 'File-Name', value: 'lyrics.txt' },
    ];

    const lyricsBase64 = Buffer.from(lyricsText).toString('base64');

    const response = await irys.upload(Buffer.from(lyricsBase64), { tags });
    return `https://gateway.irys.xyz/${response.id}`;
  } catch (uploadError) {
    console.error('Error uploading lyrics to Irys:', uploadError);
    throw new Error('Failed to upload lyrics file to Irys');
  }
}

export async function uploadMetadata(metadata) {
  try {
      const jsonString = JSON.stringify(metadata);
      const sizeInBytes = Buffer.byteLength(jsonString, 'utf8');
      const SIZE_THRESHOLD = 100 * 1024; // 100KB in bytes
      
      if (sizeInBytes <= SIZE_THRESHOLD) {
          // Use Irys for smaller files
          console.log('Using Irys for metadata upload (size <= 100KB)');
          const irys = await getIrysUploader();
          const tags = [
              { name: 'Content-Type', value: 'application/json' },
              { name: 'Type', value: 'metadata' }
          ];

          const response = await irys.upload(Buffer.from(jsonString), { tags });
          return `https://gateway.irys.xyz/${response.id}`;
      } else {
          // Use Filebase for larger files
          console.log('Using Filebase for metadata upload (size > 100KB)');
          const fileName = `metadata-${Date.now()}.json`;
          const tempFilePath = `/tmp/${fileName}`;
          
          // Write metadata to temporary file
          fs.writeFileSync(tempFilePath, jsonString);
          
          const fileObject = {
              originalname: fileName,
              path: tempFilePath
          };
          
          return await uploadFile(fileObject);
      }
  } catch (error) {
      console.error('Error uploading metadata:', error);
      throw new Error(`Failed to upload metadata: ${error.message}`);
  }
}

export { uploadLyricsToIrys };