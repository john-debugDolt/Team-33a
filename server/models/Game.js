import mongoose from 'mongoose';

const gameSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Game name is required'],
    trim: true
  },
  provider: {
    type: String,
    required: [true, 'Provider is required'],
    trim: true
  },
  gameType: {
    type: String,
    enum: ['slot', 'live-casino', 'sports', 'fishing', 'card-game'],
    default: 'slot'
  },
  image: {
    type: String,
    default: ''
  },
  rtp: {
    type: Number,
    min: 0,
    max: 100,
    default: 96
  },
  minBet: {
    type: Number,
    min: 0,
    default: 0.10
  },
  maxBet: {
    type: Number,
    min: 0,
    default: 1000
  },
  volatility: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Very High'],
    default: 'Medium'
  },
  description: {
    type: String,
    default: ''
  },
  features: [{
    type: String
  }],
  isHot: {
    type: Boolean,
    default: false
  },
  isNew: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 4.5
  },
  playCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for search and filtering
gameSchema.index({ name: 'text', provider: 'text' });
gameSchema.index({ provider: 1, gameType: 1 });
gameSchema.index({ isHot: 1, isNew: 1, isFeatured: 1 });

const Game = mongoose.model('Game', gameSchema);

export default Game;
