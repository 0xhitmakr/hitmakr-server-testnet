import mongoose from 'mongoose';

const fingerprintSchema = new mongoose.Schema({
  songId: { type: String, required: true },
  walletAddress: { type: String, required: true }, 
  fingerprints: { type: [String], required: true }
}, {
  timestamps: true
});

const Fingerprint = mongoose.model('Fingerprint', fingerprintSchema);

export default Fingerprint;