import mongoose from 'mongoose';

const trackSchema = new mongoose.Schema({
  dsrcId: { 
    type: String, 
    required: true 
  },
  addedAt: { 
    type: Date, 
    default: Date.now 
  }
});

const playlistSchema = new mongoose.Schema({
  playlistId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: function() {
      return `pl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  },
  creator: { 
    type: String, 
    required: true,
    index: true 
  },
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxLength: 50
  },
  description: { 
    type: String, 
    trim: true,
    maxLength: 350,
    default: ''
  },
  imageUrl: { 
    type: String,
    required: true 
  },
  tracks: [trackSchema],
  isPublic: { 
    type: Boolean, 
    default: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  totalTracks: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

playlistSchema.index({ creator: 1, createdAt: -1 });
playlistSchema.index({ playlistId: 1, creator: 1 });

playlistSchema.pre('save', function(next) {
  if (this.isNew && !this.playlistId) {
    this.playlistId = `pl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  if (this.tracks) {
    this.totalTracks = this.tracks.length;
  }
  
  next();
});


playlistSchema.methods.addTrack = function(dsrcId) {
  if (!this.tracks.some(track => track.dsrcId === dsrcId)) {
    this.tracks.push({ dsrcId });
    this.totalTracks = this.tracks.length;
  }
};

playlistSchema.methods.removeTrack = function(dsrcId) {
  this.tracks = this.tracks.filter(track => track.dsrcId !== dsrcId);
  this.totalTracks = this.tracks.length;
};


playlistSchema.statics.findUserPlaylists = function(creator) {
  return this.find({ creator })
    .select('-tracks')
    .sort('-createdAt');
};

playlistSchema.statics.findByPlaylistId = function(playlistId) {
  return this.findOne({ playlistId });
};

const Playlist = mongoose.models.Playlist || mongoose.model('Playlist', playlistSchema);

export default Playlist;