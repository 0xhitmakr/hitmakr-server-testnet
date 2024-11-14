import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  feedback: { type: String, required: true },
  email: { type: String },
  timestamp: { type: Date, default: Date.now },
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

export default Feedback;