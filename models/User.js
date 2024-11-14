import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  walletAddress: { type: String, unique: true, required: true },
  fullName: String,
  bio: String,
  profilePictureUrl: String,
  username: String,
  tokenId: Number, 
  lastUpdated: Date, 
  creativeID: String,
});

const User = mongoose.model('User', userSchema);

export default User;