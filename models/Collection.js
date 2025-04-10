import mongoose from "mongoose";

const trackSchema = new mongoose.Schema({
  dsrcId: {
    type: String,
    required: true,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

const collectionSchema = new mongoose.Schema(
  {
    collectionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: function () {
        return `pl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      },
    },
    creator: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxLength: 50,
    },
    description: {
      type: String,
      trim: true,
      maxLength: 350,
      default: "",
    },
    imageUrl: {
      type: String,
      required: true,
    },
    tracks: [trackSchema],
    isPublic: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    totalTracks: {
      type: Number,
      default: 0,
    },
    type: { type: String },
  },
  {
    timestamps: true,
  }
);

collectionSchema.index({ creator: 1, createdAt: -1 });
collectionSchema.index({ collectionId: 1, creator: 1 });

collectionSchema.pre("save", function (next) {
  if (this.isNew && !this.collectionId) {
    this.collectionId = `pl_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  if (this.tracks) {
    this.totalTracks = this.tracks.length;
  }

  next();
});

collectionSchema.methods.addTrack = function (dsrcId) {
  if (!this.tracks.some((track) => track.dsrcId === dsrcId)) {
    this.tracks.push({ dsrcId });
    this.totalTracks = this.tracks.length;
  }
};

collectionSchema.statics.findUserCollections = function (creator) {
  return this.find({ creator }).select("-tracks").sort("-createdAt");
};

collectionSchema.statics.findByCollectionId = function (collectionId) {
  return this.findOne({ collectionId });
};

const Collection =
  mongoose.models.Collection || mongoose.model("Collection", collectionSchema);

export default Collection;
