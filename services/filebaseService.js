import { ObjectManager } from '@filebase/sdk';
import * as dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';
import Image from '../models/Image.js';

dotenv.config();

const FILEBASE_KEY = process.env.FILEBASE_KEY;
const FILEBASE_SECRET = process.env.FILEBASE_SECRET;
const FILEBASE_BUCKET = process.env.FILEBASE_BUCKET;

if (!FILEBASE_KEY || !FILEBASE_SECRET || !FILEBASE_BUCKET) {
  console.error('Filebase credentials are not set in the environment variables.');
  process.exit(1);
}

const filebase = new ObjectManager(FILEBASE_KEY, FILEBASE_SECRET, {
  bucket: FILEBASE_BUCKET,
});

export async function uploadFile(fileObject) {
  if (!fileObject || !fileObject.originalname || !fileObject.path) {
    throw new Error('Invalid file object provided');
  }

  let filePath = fileObject.path;
  try {
    const fileName = fileObject.originalname;
    console.log(`Attempting to upload file: ${fileName}`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at path: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath);
    if (!fileContent || fileContent.length === 0) {
      throw new Error('File content is empty');
    }

    const hash = crypto.createHash('sha256');
    hash.update(fileContent);
    const sha256Hash = hash.digest('hex');

    const existingImage = await Image.findOne({ sha256Hash });
    if (existingImage) {
      console.log(`Found matching image in database: ${existingImage.url}`);
      return existingImage.url;
    }

    const uploadResponse = await filebase.upload(fileName, fileContent);
    console.log('Filebase upload response:', uploadResponse);

    if (!uploadResponse) {
      throw new Error('No response received from Filebase');
    }
    if (!uploadResponse.cid) {
      throw new Error('Upload successful but no CID returned from Filebase');
    }

    const cid = uploadResponse.cid;
    console.log('Uploaded file CID:', cid);

    const ipfsUrl = `https://ipfs.filebase.io/ipfs/${cid}`;

    const newImage = await Image.create({
      sha256Hash,
      ipfsHash: cid,
      url: ipfsUrl,
      timestamp: new Date()
    });

    if (!newImage) {
      throw new Error('Failed to create database entry');
    }

    console.log(`File uploaded successfully. IPFS URL: ${ipfsUrl}`);
    return ipfsUrl;

  } catch (error) {
    console.error('Detailed error in uploadFile:', error);
    throw new Error(`Failed to upload file to Filebase: ${error.message}`);
  } finally {
    // Clean up temporary file
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Temporary file cleaned up: ${filePath}`);
      } catch (unlinkError) {
        console.error(`Failed to clean up temporary file: ${unlinkError.message}`);
      }
    }
  }
}

try {
  await filebase.list();
  console.log('Successfully connected to Filebase');
} catch (err) {
  console.error('Failed to connect to Filebase:', err);
}