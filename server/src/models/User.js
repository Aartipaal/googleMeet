const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String },
  avatar: { type: String, default: '' },
  googleId: { type: String },
  otp: { type: String },
  otpExpiry: { type: Date },
  isVerified: { type: Boolean, default: false },
}, { timestamps: true });

userSchema.pre('save', function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const self = this;
  bcrypt.genSalt(10, function (err, salt) {
    if (err) return next(err);
    bcrypt.hash(self.password, salt, function (err, hash) {
      if (err) return next(err);
      self.password = hash;
      next();
    });
  });
});

userSchema.methods.comparePassword = function (plain) {
  return new Promise((resolve, reject) => {
    bcrypt.compare(plain, this.password || '', (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

module.exports = mongoose.model('User', userSchema);
