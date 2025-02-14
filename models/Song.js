import mongoose from "mongoose";

const songSchema = new mongoose.Schema(
  {
    songId: { type: String, required: true },
    dsrc: { type: String },
    hashTags: { type: [String] },
    dsrcId: { type: String },
    dsrcAddress: { type: String },
    uploadHash: { type: String, required: true },
    supportedChains: [String],
    chainDsrcs: {
      type: Map,
      of: {
        dsrcId: String,
        dsrcAddress: String,
        transactionHash: String,
      },
    },
    walletAddress: { type: String, required: true },
    title: { type: String, required: true },
    description: String,
    impressions: { type: Number, default: 0 },
    plays: { type: Number, default: 0 },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {
        attributes: [],
        dsrcDetails: null,
      },
    },
  },
  { timestamps: true }
);

songSchema.index({ title: "text", description: "text" });
songSchema.index({ dsrcId: 1 });
songSchema.index({ createdAt: -1 });

const Song = mongoose.model("Song", songSchema);
export default Song;
