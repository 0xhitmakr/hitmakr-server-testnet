import Feedback from '../models/Feedback.js';

export async function submitFeedback(req, res) {
  try {
    const walletAddress = req.headers['x-user-address'];
    const { feedback, email } = req.body;

    const lastFeedback = await Feedback.findOne({ walletAddress }).sort({ timestamp: -1 });

    if (lastFeedback && (Date.now() - lastFeedback.timestamp) < 60 * 60 * 1000) {
      return res.status(429).json({ message: 'You can submit feedback again after 1 hour.' });
    }

    const newFeedback = new Feedback({
      walletAddress,
      feedback,
      email,
    });

    await newFeedback.save();

    res.json({ message: 'Feedback submitted successfully.' });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ message: 'Error submitting feedback.' });
  }
}