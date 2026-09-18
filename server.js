require('dotenv').config();

const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const os = require('os');

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/findit';

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  gender: { type: String, enum: ['male', 'female', 'others'], default: 'others' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  passwordHash: { type: String, required: true },
  avatar: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

const reportFields = {
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  itemName: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  dateTime: { type: String, required: true, trim: true },
  contactMethod: { type: String, required: true, trim: true },
  photos: { type: [String], default: [] },
  status: { type: String, enum: ['active', 'resolved'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
};

const lostReportSchema = new mongoose.Schema({
  ...reportFields,
  reward: { type: String, trim: true, default: '' }
}, { collection: 'lost_reports' });

const verificationQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true },
  options: { type: [String], required: true },
  correctAnswer: { type: Number, required: true }
}, { _id: false });

const foundReportSchema = new mongoose.Schema({
  ...reportFields,
  pickupTime: { type: String, required: true, trim: true },
  privatePhoto: { type: String, default: null },
  verificationQuestions: { type: [verificationQuestionSchema], default: [] }
}, { collection: 'found_reports' });

const LostReport = mongoose.model('LostReport', lostReportSchema);
const FoundReport = mongoose.model('FoundReport', foundReportSchema);

const claimSchema = new mongoose.Schema({
  reportId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  claimantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  message: { type: String, trim: true, default: 'Claimed this item.' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  passedVerification: { type: Boolean, default: true },
  answersSubmitted: { type: [Number], default: [] },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'claims' });

const messageSchema = new mongoose.Schema({
  reportId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'messages' });

const Claim = mongoose.model('Claim', claimSchema);
const Message = mongoose.model('Message', messageSchema);

const notificationSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reportId: { type: mongoose.Schema.Types.ObjectId, default: null },
  type: { type: String, enum: ['report', 'claim', 'message', 'system'], default: 'system' },
  title: { type: String, required: true, trim: true },
  body: { type: String, required: true, trim: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'notifications' });

const Notification = mongoose.model('Notification', notificationSchema);

async function addNotification({ recipientId, actorId = null, reportId = null, type, title, body }) {
  if (!recipientId) return;
  return Notification.create({ recipientId, actorId, reportId, type, title, body });
}

function publicUser(user) {
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    gender: user.gender || 'others',
    role: user.role || 'user',
    avatar: user.avatar,
    createdAt: user.createdAt
  };
}

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return 'localhost';
}

// Enable CORS for mobile browsers and other devices on local network
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname));

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { fullName, email, phone, password, gender, avatar } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!fullName || !normalizedEmail || !phone || !password || !['male', 'female', 'others'].includes(gender)) {
      return res.status(400).json({ message: 'Please complete all required fields.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const user = await User.create({
      fullName,
      email: normalizedEmail,
      phone,
      gender,
      passwordHash: await bcrypt.hash(password, 12),
      avatar: avatar || null
    });

    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Unable to create account right now.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const normalizedEmail = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email/password.' });
    }

    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Unable to log in right now.' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ user: publicUser(user) });
  } catch (error) {
    res.status(400).json({ message: 'Invalid user id.' });
  }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body.fullName === 'string' && req.body.fullName.trim()) {
      updates.fullName = req.body.fullName.trim();
    }
    if (typeof req.body.phone === 'string' && req.body.phone.trim()) {
      updates.phone = req.body.phone.trim();
    }
    if (typeof req.body.avatar === 'string' || req.body.avatar === null) {
      updates.avatar = req.body.avatar;
    }
    if (req.body.password) {
      const pw = String(req.body.password).trim();
      if (pw.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters.' });
      }
      updates.passwordHash = await bcrypt.hash(pw, 12);
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select('-passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'That email is already in use.' });
    res.status(400).json({ message: 'Unable to update profile.' });
  }
});

function reportPayload(body, userId) {
  return {
    userId,
    itemName: String(body.itemName || '').trim(),
    category: String(body.category || '').trim(),
    description: String(body.description || '').trim(),
    location: String(body.location || '').trim(),
    dateTime: String(body.dateTime || '').trim(),
    contactMethod: String(body.contactMethod || '').trim(),
    photos: Array.isArray(body.photos) ? body.photos.filter(photo => typeof photo === 'string' && photo.trim().length > 0) : []
  };
}

function validateReportPayload(payload) {
  return Boolean(
    payload.itemName &&
    payload.category &&
    payload.description &&
    payload.location &&
    payload.dateTime &&
    payload.contactMethod &&
    Array.isArray(payload.photos) &&
    payload.photos.length > 0 &&
    (!('pickupTime' in payload) || payload.pickupTime)
  );
}

async function createReport(Report, req, res, extraFields = {}) {
  try {
    const { userId } = req.body;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: 'Please log in before submitting a report.' });
    }
    if (!(await User.exists({ _id: userId }))) {
      return res.status(401).json({ message: 'User account was not found.' });
    }

    const payload = { ...reportPayload(req.body, userId), ...extraFields };
    if (!payload.photos || payload.photos.length === 0) {
      return res.status(400).json({ message: 'Please upload at least one photo of the item.' });
    }
    if (!validateReportPayload(payload)) {
      return res.status(400).json({ message: 'Please complete all required report fields.' });
    }
    const report = await Report.create(payload);
    const user = await User.findById(userId).select('fullName');
    await addNotification({
      recipientId: userId,
      actorId: userId,
      reportId: report._id,
      type: 'report',
      title: 'Report submitted successfully',
      body: `${user.fullName} posted ${report.itemName}`
    });
    res.status(201).json({ report });
  } catch (error) {
    console.error('Report creation error:', error);
    res.status(500).json({ message: 'Unable to save the report right now.' });
  }
}

app.post('/api/reports/lost', (req, res) => createReport(LostReport, req, res, {
  reward: String(req.body.reward || '').trim()
}));

app.post('/api/reports/found', (req, res) => {
  let verificationQuestions = [];
  if (Array.isArray(req.body.verificationQuestions)) {
    verificationQuestions = req.body.verificationQuestions
      .slice(0, 5)
      .filter(q => q && typeof q.question === 'string' && q.question.trim().length > 0 && Array.isArray(q.options) && q.options.length >= 2)
      .map(q => ({
        question: String(q.question).trim(),
        options: q.options.map(opt => String(opt).trim()).filter(Boolean),
        correctAnswer: Math.max(0, Math.min(q.options.length - 1, Number(q.correctAnswer) || 0))
      }));
  }

  return createReport(FoundReport, req, res, {
    pickupTime: String(req.body.pickupTime || '').trim(),
    privatePhoto: typeof req.body.privatePhoto === 'string' && req.body.privatePhoto.trim() ? req.body.privatePhoto.trim() : null,
    verificationQuestions
  });
});

app.get('/api/reports', async (req, res) => {
  try {
    const [lostReports, foundReports] = await Promise.all([
      LostReport.find().sort({ createdAt: -1 }).lean(),
      FoundReport.find().sort({ createdAt: -1 }).lean()
    ]);
    const sanitizedFound = foundReports.map(doc => {
      const clone = { ...doc };
      delete clone.privatePhoto;
      if (Array.isArray(clone.verificationQuestions)) {
        clone.verificationQuestions = clone.verificationQuestions.map(q => ({
          question: q.question,
          options: q.options
        }));
      }
      return clone;
    });
    res.json({ lostReports, foundReports: sanitizedFound });
  } catch (error) {
    console.error('Public report fetch error:', error);
    res.status(500).json({ message: 'Unable to load reports right now.' });
  }
});

app.get('/api/reports/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid report id.' });
    }

    const [lostReport, foundReport] = await Promise.all([
      LostReport.findById(req.params.id).lean(),
      FoundReport.findById(req.params.id).lean()
    ]);
    const report = lostReport || foundReport;

    if (!report) return res.status(404).json({ message: 'Report not found.' });

    const viewerId = req.query.userId;
    let isOwnerOrAdmin = false;
    let userClaim = null;

    if (viewerId && mongoose.isValidObjectId(viewerId)) {
      const viewer = await User.findById(viewerId).lean();
      if (viewer) {
        if (String(report.userId) === String(viewerId) || viewer.role === 'admin') {
          isOwnerOrAdmin = true;
        }
        userClaim = await Claim.findOne({ reportId: report._id, claimantId: viewerId }).lean();
      }
    }

    if (foundReport) {
      if (!isOwnerOrAdmin) {
        delete report.privatePhoto;
        if (Array.isArray(report.verificationQuestions)) {
          report.verificationQuestions = report.verificationQuestions.map(q => ({
            question: q.question,
            options: q.options
          }));
        }
      }
    }

    res.json({
      report,
      type: lostReport ? 'lost' : 'found',
      isOwnerOrAdmin,
      userClaim: userClaim ? {
        status: userClaim.status,
        passedVerification: userClaim.passedVerification,
        createdAt: userClaim.createdAt
      } : null
    });
  } catch (error) {
    console.error('Report details fetch error:', error);
    res.status(500).json({ message: 'Unable to load report details right now.' });
  }
});

app.get('/api/users/:id/reports', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user id.' });
    }
    const [lostReports, foundReports] = await Promise.all([
      LostReport.find({ userId: req.params.id }).sort({ createdAt: -1 }),
      FoundReport.find({ userId: req.params.id }).sort({ createdAt: -1 })
    ]);
    res.json({ lostReports, foundReports });
  } catch (error) {
    console.error('Report fetch error:', error);
    res.status(500).json({ message: 'Unable to load reports right now.' });
  }
});

async function getReportById(id) {
  const [lostReport, foundReport] = await Promise.all([
    LostReport.findById(id),
    FoundReport.findById(id)
  ]);
  return { report: lostReport || foundReport, type: lostReport ? 'lost' : 'found' };
}

function validateUserId(userId) {
  return mongoose.isValidObjectId(userId);
}

app.post('/api/reports/:id/claims', async (req, res) => {
  try {
    const { userId, message, answers } = req.body;
    if (!validateUserId(req.params.id) || !validateUserId(userId)) {
      return res.status(400).json({ message: 'Invalid report or user.' });
    }
    const { report, type } = await getReportById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found.' });
    if (type !== 'found') return res.status(400).json({ message: 'Only found items can be claimed.' });
    const claimant = await User.findById(userId);
    if (!claimant) return res.status(401).json({ message: 'User account was not found.' });

    if (String(report.userId) === String(userId)) {
      return res.status(400).json({ message: 'You cannot claim your own found report.' });
    }

    // A user can only submit a claim attempt ONCE
    const existingClaim = await Claim.findOne({ reportId: report._id, claimantId: userId });
    if (existingClaim) {
      return res.status(400).json({
        message: 'You have already submitted a claim attempt for this item. Multiple attempts are not allowed.'
      });
    }

    // MCQ verification
    const questions = report.verificationQuestions || [];
    if (questions.length > 0) {
      const submittedAnswers = Array.isArray(answers) ? answers.map(Number) : [];
      let isCorrect = true;
      if (submittedAnswers.length !== questions.length) {
        isCorrect = false;
      } else {
        for (let i = 0; i < questions.length; i++) {
          if (submittedAnswers[i] !== questions[i].correctAnswer) {
            isCorrect = false;
            break;
          }
        }
      }

      if (!isCorrect) {
        // Record failed attempt so user cannot retry
        await Claim.create({
          reportId: report._id,
          claimantId: userId,
          message: 'Failed verification quiz',
          status: 'rejected',
          passedVerification: false,
          answersSubmitted: submittedAnswers
        });
        return res.status(400).json({
          success: false,
          correct: false,
          message: 'your answers are wrong the item or product is not yours'
        });
      }
    }

    const claimMessage = String(message || '').trim() || `${claimant.fullName} claimed this item/product`;
    const claim = await Claim.create({
      reportId: report._id,
      claimantId: userId,
      message: claimMessage,
      status: 'pending',
      passedVerification: true,
      answersSubmitted: Array.isArray(answers) ? answers.map(Number) : []
    });

    const populated = await Claim.findById(claim._id).populate('claimantId', 'fullName email phone');
    if (String(report.userId) !== String(userId)) {
      await addNotification({
        recipientId: report.userId,
        actorId: userId,
        reportId: report._id,
        type: 'claim',
        title: 'New claim request',
        body: `${claimant.fullName} claimed this item/product`
      });
    }
    res.status(201).json({
      claim: populated,
      success: true,
      message: 'Claim submitted successfully!'
    });
  } catch (error) {
    console.error('Claim creation error:', error);
    res.status(500).json({ message: 'Unable to save the claim right now.' });
  }
});

app.post('/api/reports/:id/messages', async (req, res) => {
  try {
    const { userId, body } = req.body;
    if (!validateUserId(req.params.id) || !validateUserId(userId)) {
      return res.status(400).json({ message: 'Invalid report or user.' });
    }
    const { report, type } = await getReportById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found.' });
    if (!(await User.exists({ _id: userId }))) return res.status(401).json({ message: 'User account was not found.' });
    const text = String(body || '').trim();
    if (!text) return res.status(400).json({ message: 'Please write a message.' });

    // For found reports: claimant can only message AFTER successful claim
    if (type === 'found' && String(report.userId) !== String(userId)) {
      const validClaim = await Claim.findOne({
        reportId: report._id,
        claimantId: userId,
        passedVerification: true,
        status: { $ne: 'rejected' }
      });
      if (!validClaim) {
        return res.status(403).json({
          message: 'You can only send messages after successfully claiming this item.'
        });
      }
    }

    const message = await Message.create({ reportId: report._id, senderId: userId, recipientId: report.userId, body: text });
    const populated = await Message.findById(message._id)
      .populate('senderId', 'fullName email phone')
      .populate('recipientId', 'fullName email phone');
    if (String(report.userId) !== String(userId)) {
      await addNotification({
        recipientId: report.userId,
        actorId: userId,
        reportId: report._id,
        type: 'message',
        title: 'New message about your item',
        body: `${populated.senderId.fullName} sent a message about ${report.itemName}`
      });
    }
    res.status(201).json({ message: populated });
  } catch (error) {
    console.error('Message creation error:', error);
    res.status(500).json({ message: 'Unable to save the message right now.' });
  }
});

function calculateSmartMatch(lost, found) {
  const lostName = (lost.itemName || '').toLowerCase();
  const foundName = (found.itemName || '').toLowerCase();
  const lostDesc = (lost.description || '').toLowerCase();
  const foundDesc = (found.description || '').toLowerCase();
  const lostLoc = (lost.location || '').toLowerCase();
  const foundLoc = (found.location || '').toLowerCase();
  const lostCat = (lost.category || '').toLowerCase();
  const foundCat = (found.category || '').toLowerCase();

  const lostFull = `${lostName} ${lostDesc}`;
  const foundFull = `${foundName} ${foundDesc}`;

  const brands = [
    'pixel', 'iphone', 'samsung', 'galaxy', 'macbook', 'ipad', 'airpods',
    'dell', 'hp', 'lenovo', 'asus', 'acer', 'oneplus', 'xiaomi', 'redmi',
    'realme', 'oppo', 'vivo', 'motorola', 'nokia', 'sony', 'huawei',
    'apple watch', 'calculator', 'casio', 'umbrella', 'bag', 'backpack', 'wallet',
    'keys', 'keychain', 'id card', 'bottle', 'charger', 'glasses', 'watch'
  ];

  const colors = [
    'black', 'white', 'silver', 'grey', 'gray', 'space gray', 'space grey',
    'blue', 'navy', 'red', 'gold', 'rose gold', 'green', 'yellow', 'purple',
    'pink', 'orange', 'brown'
  ];

  let score = 0;
  const reasons = [];

  // 1. Category comparison
  const catMatches = (lostCat === foundCat) || 
    (lostCat === 'phone' && foundCat === 'electronics') ||
    (lostCat === 'electronics' && foundCat === 'phone');
  
  if (lostCat === foundCat) {
    score += 15;
  } else if (catMatches) {
    score += 10;
  }

  // 2. Brand & Model detection
  let detectedLostBrand = null;
  let detectedFoundBrand = null;
  for (const b of brands) {
    if (!detectedLostBrand && (lostName.includes(b) || lostDesc.includes(b))) detectedLostBrand = b;
    if (!detectedFoundBrand && (foundName.includes(b) || foundDesc.includes(b))) detectedFoundBrand = b;
  }

  const cleanTokens = str => str.replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
  const lostTokens = cleanTokens(lostFull);
  const foundTokens = cleanTokens(foundFull);

  const normLostName = lostName.replace(/[\s-_]+/g, '');
  const normFoundName = foundName.replace(/[\s-_]+/g, '');

  let brandMatches = false;
  if (detectedLostBrand && detectedFoundBrand && detectedLostBrand === detectedFoundBrand) {
    brandMatches = true;
    score += 25;
  }

  let modelMatches = false;
  if (normLostName.length > 2 && normFoundName.length > 2) {
    if (normLostName === normFoundName || normFoundName.includes(normLostName) || normLostName.includes(normFoundName)) {
      modelMatches = true;
      score += 35;
      reasons.push(`Exact model match (${found.itemName})`);
    }
  }

  if (!modelMatches) {
    let commonTokens = 0;
    const meaningfulLostTokens = lostTokens.filter(t => t.length > 2 && !colors.includes(t) && t !== 'the' && t !== 'and' && t !== 'with' && t !== 'for');
    meaningfulLostTokens.forEach(t => {
      if (foundTokens.includes(t) || foundFull.includes(t)) commonTokens++;
    });
    if (meaningfulLostTokens.length > 0) {
      const tokenRatio = commonTokens / meaningfulLostTokens.length;
      score += Math.round(tokenRatio * 25);
      if (tokenRatio > 0.4) reasons.push('High keyword similarity in name & description');
    }
  }

  // 3. Color matching
  const lostColorsFound = colors.filter(c => lostFull.includes(c));
  const foundColorsFound = colors.filter(c => foundFull.includes(c));
  let colorMatch = false;
  if (lostColorsFound.length > 0 && foundColorsFound.length > 0) {
    const commonColors = lostColorsFound.filter(c => foundColorsFound.includes(c));
    if (commonColors.length > 0) {
      colorMatch = true;
      score += 20;
      reasons.push(`Matching color (${commonColors.join(', ')})`);
    } else {
      score = Math.max(10, score - 15);
    }
  } else if (lostColorsFound.length === 0 && foundColorsFound.length === 0) {
    score += 5;
  }

  // 4. Campus location proximity
  if (lostLoc && foundLoc) {
    const lostLocTokens = cleanTokens(lostLoc).filter(t => t.length > 3);
    const foundLocTokens = cleanTokens(foundLoc).filter(t => t.length > 3);
    const locOverlap = lostLocTokens.filter(t => foundLocTokens.includes(t) || foundLoc.includes(t));
    if (locOverlap.length > 0) {
      score += 10;
      reasons.push('Found in same campus area');
    }
  }

  // 5. Calibration for 100% and partial matches
  if ((brandMatches || normLostName.length > 3) && modelMatches && colorMatch) {
    score = 100;
  } else if (modelMatches && colorMatch) {
    score = Math.max(90, Math.min(100, score));
  } else if ((brandMatches || normLostName.length > 3) && modelMatches) {
    score = Math.max(75, Math.min(85, score));
    if (!reasons.some(r => r.includes('model'))) reasons.unshift(`Same model (${found.itemName})`);
  } else if (brandMatches) {
    score = Math.max(50, Math.min(65, score));
    reasons.unshift(`Same brand (${detectedFoundBrand})`);
  }

  score = Math.min(100, Math.max(0, score));

  let finalReason = reasons.length > 0 ? reasons.join(' • ') : 'Category and attribute similarity';
  if (score === 100) {
    finalReason = `100% Match: Exact model & color match detected on campus`;
  }

  return { score, reason: finalReason };
}

app.get('/api/smart-match', async (req, res) => {
  try {
    const { userId, lostReportId } = req.query;
    if (!validateUserId(userId)) {
      return res.status(400).json({ message: 'Invalid or missing user id.' });
    }

    // Fetch user's active lost reports
    const userLostReports = await LostReport.find({ userId, status: 'active' }).sort({ createdAt: -1 }).lean();
    if (!userLostReports.length) {
      return res.json({
        lostReports: [],
        selectedLostReport: null,
        matches: [],
        totalMatches: 0
      });
    }

    // Selected lost report (either requested or most recent)
    let selectedLost = userLostReports[0];
    if (lostReportId && mongoose.isValidObjectId(lostReportId)) {
      const foundTarget = userLostReports.find(r => String(r._id) === String(lostReportId));
      if (foundTarget) selectedLost = foundTarget;
    }

    // Fetch all active found reports
    const activeFoundReports = await FoundReport.find({ status: 'active' }).sort({ createdAt: -1 }).lean();

    // Match against each found report
    const matches = [];
    for (const found of activeFoundReports) {
      // Don't match user's own found report with their lost report
      if (String(found.userId) === String(userId)) continue;

      const { score, reason } = calculateSmartMatch(selectedLost, found);
      if (score >= 40) {
        matches.push({
          id: `match-${found._id}`,
          foundReportId: found._id,
          title: found.itemName,
          category: found.category,
          location: found.location,
          dateTime: found.dateTime,
          pickupTime: found.pickupTime,
          image: (found.photos && found.photos[0]) || '',
          score,
          reason,
          createdAt: found.createdAt
        });
      }
    }

    // Sort matches by highest score first
    matches.sort((a, b) => b.score - a.score);

    res.json({
      lostReports: userLostReports.map(r => ({ _id: r._id, itemName: r.itemName, category: r.category })),
      selectedLostReport: {
        _id: selectedLost._id,
        itemName: selectedLost.itemName,
        category: selectedLost.category,
        description: selectedLost.description,
        location: selectedLost.location
      },
      matches,
      totalMatches: matches.length
    });
  } catch (error) {
    console.error('Smart match error:', error);
    res.status(500).json({ message: 'Unable to calculate smart matches right now.' });
  }
});

app.get('/api/users/:id/activity', async (req, res) => {
  try {
    if (!validateUserId(req.params.id)) return res.status(400).json({ message: 'Invalid user id.' });
    const reports = await Promise.all([
      LostReport.find({ userId: req.params.id }).select('_id itemName'),
      FoundReport.find({ userId: req.params.id }).select('_id itemName')
    ]);
    const reportIds = reports.flat().map(report => report._id);
    const [claims, messages] = await Promise.all([
      Claim.find({ reportId: { $in: reportIds } }).sort({ createdAt: -1 }).populate('claimantId', 'fullName email phone'),
      Message.find({ recipientId: req.params.id }).sort({ createdAt: -1 }).populate('senderId', 'fullName email phone')
    ]);
    const reportNames = new Map(reports.flat().map(report => [String(report._id), report.itemName]));
    res.json({
      claims: claims.map(claim => ({ ...claim.toObject(), itemName: reportNames.get(String(claim.reportId)) || 'Unknown item' })),
      messages: messages.map(message => ({ ...message.toObject(), itemName: reportNames.get(String(message.reportId)) || 'Unknown item' }))
    });
  } catch (error) {
    console.error('Activity fetch error:', error);
    res.status(500).json({ message: 'Unable to load activity right now.' });
  }
});

app.get('/api/users/:id/notifications', async (req, res) => {
  try {
    if (!validateUserId(req.params.id)) return res.status(400).json({ message: 'Invalid user id.' });
    const notifications = await Notification.find({ recipientId: req.params.id })
      .sort({ createdAt: -1 })
      .populate('actorId', 'fullName')
      .lean();
    res.json({ notifications });
  } catch (error) {
    console.error('Notification fetch error:', error);
    res.status(500).json({ message: 'Unable to load notifications right now.' });
  }
});

app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    if (!validateUserId(req.body.userId) || !mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid notification or user.' });
    }
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.body.userId },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });
    res.json({ notification });
  } catch (error) {
    res.status(500).json({ message: 'Unable to update notification.' });
  }
});

app.patch('/api/users/:id/notifications/read-all', async (req, res) => {
  try {
    if (!validateUserId(req.params.id)) return res.status(400).json({ message: 'Invalid user id.' });
    await Notification.updateMany({ recipientId: req.params.id, read: false }, { read: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Unable to mark notifications as read.' });
  }
});

async function start() {
  await mongoose.connect(mongoUri);
  console.log(`MongoDB connected: ${mongoUri}`);
  const localIp = getLocalIpAddress();
  app.listen(port, '0.0.0.0', () => {
    console.log(`\n==================================================`);
    console.log(`🚀 FindIt Server running and open to local Wi-Fi!`);
    console.log(`   - On PC:     http://localhost:${port}`);
    console.log(`   - On Mobile:  http://${localIp}:${port}`);
    console.log(`==================================================\n`);
  });
}

start().catch(error => {
  console.error('Could not connect to MongoDB:', error.message);
  process.exit(1);
});
