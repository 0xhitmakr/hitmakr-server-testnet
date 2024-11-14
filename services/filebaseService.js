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
  try {
    const fileName = fileObject.originalname;
    const filePath = fileObject.path;

    console.log(`Attempting to upload file: ${fileName}`);

    const fileContent = fs.readFileSync(filePath);

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

    const cid = uploadResponse.cid;
    console.log('Uploaded file CID:', cid);

    const ipfsUrl = `https://ipfs.filebase.io/ipfs/${cid}`;

    await Image.create({
      sha256Hash,
      ipfsHash: cid,
      url: ipfsUrl,
      timestamp: new Date(),
    });

    console.log(`File uploaded successfully. IPFS URL: ${ipfsUrl}`);
    return ipfsUrl;
  } catch (error) {
    console.error('Detailed error in uploadFile:', error);
    throw new Error(`Failed to upload file to Filebase: ${error.message}`);
  }finally{
    fs.unlinkSync(fileObject.path);
  }
}

try {
  await filebase.list();
  console.log('Successfully connected to Filebase');
} catch (err) {
  console.error('Failed to connect to Filebase:', err);
}