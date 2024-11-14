import mongoose from 'mongoose';

const dsrcCopyrightSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  dsrcId: { type: String, required: true },
  description: { type: String, required: true }, 
  email: { type: String },
  referenceLink: { type: String }, 
  timestamp: { type: Date, default: Date.now }, 
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
});

dsrcCopyrightSchema.index({ walletAddress: 1, dsrcId: 1 });

const DSRCCopyright = mongoose.model('DSRCCopyright', dsrcCopyrightSchema);

export default DSRCCopyright;