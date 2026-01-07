import mongoose from 'mongoose';

const promotionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Promotion title is required'],
    trim: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  image: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['SLOTS', 'CASINO', 'SPORT', 'VIP', 'UNLIMITED'],
    required: true
  },
  bonusAmount: {
    type: String,
    required: true
  },
  maxBonus: {
    type: Number,
    default: null
  },
  minDeposit: {
    type: Number,
    default: 0
  },
  wageringRequirement: {
    type: Number,
    default: 1
  },
  validFrom: {
    type: Date,
    required: true
  },
  validUntil: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  terms: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for filtering
promotionSchema.index({ category: 1, isActive: 1 });
promotionSchema.index({ validFrom: 1, validUntil: 1 });

const Promotion = mongoose.model('Promotion', promotionSchema);

export default Promotion;
