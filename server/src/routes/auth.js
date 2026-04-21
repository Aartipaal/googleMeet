const express = require('express');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');

const router = express.Router();

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already exists' });
    const user = await User.create({ name, email, password, isVerified: true });
    res.json({ token: signToken(user._id), user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !await user.comparePassword(password))
      return res.status(400).json({ message: 'Invalid credentials' });
    res.json({ token: signToken(user._id), user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Send OTP
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    let user = await User.findOne({ email });
    if (!user) user = await User.create({ name: email.split('@')[0], email, otp, otpExpiry });
    else { user.otp = otp; user.otpExpiry = otpExpiry; await user.save(); }
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP - SmartMeet',
      html: `<h2>Your OTP is: <strong>${otp}</strong></h2><p>Valid for 10 minutes.</p>`,
    });
    res.json({ message: 'OTP sent' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.otp !== otp || user.otpExpiry < new Date())
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    user.isVerified = true; user.otp = undefined; user.otpExpiry = undefined;
    await user.save();
    res.json({ token: signToken(user._id), user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Google Auth
router.post('/google', async (req, res) => {
  try {
    const { googleId, email, name, avatar } = req.body;
    let user = await User.findOne({ email });
    if (!user) user = await User.create({ googleId, email, name, avatar, isVerified: true });
    else if (!user.googleId) { user.googleId = googleId; await user.save(); }
    res.json({ token: signToken(user._id), user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
