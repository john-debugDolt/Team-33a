import mongoose from 'mongoose';

const checkInSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  checkedDays: [{
    type: Number,
    min: 1,
    max: 7
  }],
  lastCheckIn: {
    type: Date
  },
  currentStreak: {
    type: Number,
    default: 0,
    min: 0,
    max: 7
  }
}, {
  timestamps: true
});

// Check if user can check in today
checkInSchema.methods.canCheckIn = function() {
  if (!this.lastCheckIn) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastCheckInDate = new Date(this.lastCheckIn);
  lastCheckInDate.setHours(0, 0, 0, 0);

  return today > lastCheckInDate;
};

// Check if streak should be reset
checkInSchema.methods.shouldResetStreak = function() {
  if (!this.lastCheckIn) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastCheckInDate = new Date(this.lastCheckIn);
  lastCheckInDate.setHours(0, 0, 0, 0);

  const diffTime = today - lastCheckInDate;
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  // If more than 1 day has passed, reset streak
  return diffDays > 1;
};

// Get current day reward
checkInSchema.methods.getCurrentReward = function() {
  const rewards = [10, 20, 30, 50, 75, 100, 200];
  const day = this.currentStreak;
  return rewards[day] || rewards[0];
};

const CheckIn = mongoose.model('CheckIn', checkInSchema);

export default CheckIn;
