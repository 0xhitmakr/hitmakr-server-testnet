import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema({
  sha256Hash: String,
  ipfsHash: String,
  url: String,
  timestamp: Date,
});

const Image = mongoose.model('Image', imageSchema);

export default Image;