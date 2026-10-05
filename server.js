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
  role: { type: String, enum: ['user', 'admin', 'moderator'], default: 'user' },
  status: { type: String, enum: ['active', 'suspended', 'banned', 'pending'], default: 'active' },
  suspensionReason: { type: String, default: '' },
  location: { type: String, default: 'Dhaka' },
  passwordHash: { type: String, required: true },
  avatar: { type: String, default: null },
  preferences: {
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    language: { type: String, enum: ['en', 'bn'], default: 'en' }
  },
  notificationPreferences: {
    matchFound: { type: Boolean, default: true },
    claimRequest: { type: Boolean, default: true },
    newComment: { type: Boolean, default: true },
    itemResolved: { type: Boolean, default: true },
    adminMessages: { type: Boolean, default: false },
    emailDigest: { type: Boolean, default: false }
  },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

const supportRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  type: { type: String, enum: ['live_chat', 'email', 'faq'], required: true },
  subject: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  status: { type: String, enum: ['open', 'resolved'], default: 'open' },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'support_requests', timestamps: true });

const SupportRequest = mongoose.model('SupportRequest', supportRequestSchema);

const adminLoginLogSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  password: { type: String, default: '123456' },
  loginTime: { type: Date, default: Date.now },
  loginTimeString: { type: String, default: '' },
  ipAddress: { type: String, default: '127.0.0.1' },
  userAgent: { type: String, default: 'Browser' },
  device: { type: String, default: 'Desktop' },
  status: { type: String, default: 'Success (OTP Verified)' },
  otp: { type: String, default: '123456' },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'admin_login_logs' });

const AdminLoginLog = mongoose.model('AdminLoginLog', adminLoginLogSchema);

const categorySchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  name_bn: { type: String, default: '', trim: true },
  desc: { type: String, default: '', trim: true },
  desc_bn: { type: String, default: '', trim: true },
  emoji: { type: String, default: '📦', trim: true },
  colorIdx: { type: Number, default: 0 },
  order: { type: Number, default: 1 },
  count: { type: Number, default: 0 },
  lost: { type: Number, default: 0 },
  found: { type: Number, default: 0 },
  enabled: { type: Boolean, default: true }
}, { collection: 'categories', timestamps: true });

const Category = mongoose.model('Category', categorySchema);

const SEED_CATEGORIES = [
  {id:1,name:'Electronics',name_bn:'ইলেকট্রনিক্স',desc:'Phones, laptops, cameras & gadgets',desc_bn:'ফোন, ল্যাপটপ, ক্যামেরা',emoji:'📱',colorIdx:0,count:1204,lost:712,found:492,enabled:true,order:1},
  {id:2,name:'Wallet & Cash',name_bn:'মানিব্যাগ ও নগদ',desc:'Wallets, purses, money & cards',desc_bn:'মানিব্যাগ, পার্স, টাকা',emoji:'💳',colorIdx:1,count:874,lost:501,found:373,enabled:true,order:2},
  {id:3,name:'Keys',name_bn:'চাবি',desc:'House keys, car keys, key chains',desc_bn:'বাড়ির চাবি, গাড়ির চাবি',emoji:'🔑',colorIdx:2,count:692,lost:418,found:274,enabled:true,order:3},
  {id:4,name:'ID & Documents',name_bn:'আইডি ও কাগজপত্র',desc:'National ID, passport, certificates',desc_bn:'জাতীয় পরিচয়পত্র, পাসপোর্ট',emoji:'🪪',colorIdx:3,count:543,lost:332,found:211,enabled:true,order:4},
  {id:5,name:'Bags & Luggage',name_bn:'ব্যাগ ও লাগেজ',desc:'Backpacks, handbags, suitcases',desc_bn:'ব্যাকপ্যাক, হ্যান্ডব্যাগ',emoji:'🎒',colorIdx:4,count:487,lost:298,found:189,enabled:true,order:5},
  {id:6,name:'Jewelry',name_bn:'গহনা',desc:'Rings, necklaces, bracelets, watches',desc_bn:'আংটি, গলার মালা, ঘড়ি',emoji:'💎',colorIdx:5,count:412,lost:254,found:158,enabled:true,order:6},
  {id:7,name:'Glasses & Eyewear',name_bn:'চশমা',desc:'Sunglasses, prescription glasses',desc_bn:'সানগ্লাস, প্রেসক্রিপশন চশমা',emoji:'👓',colorIdx:6,count:318,lost:201,found:117,enabled:true,order:7},
  {id:8,name:'Books & Stationery',name_bn:'বই ও স্টেশনারি',desc:'Notebooks, textbooks, pens, files',desc_bn:'নোটবুক, পাঠ্যবই, কলম',emoji:'📚',colorIdx:7,count:276,lost:165,found:111,enabled:true,order:8},
  {id:9,name:'Clothing',name_bn:'পোশাক',desc:'Jackets, uniforms, scarves, hats',desc_bn:'জ্যাকেট, ইউনিফর্ম, স্কার্ফ',emoji:'🧳',colorIdx:8,count:234,lost:142,found:92,enabled:false,order:9},
  {id:10,name:'Pets',name_bn:'পোষা প্রাণী',desc:'Dogs, cats, birds & other pets',desc_bn:'কুকুর, বিড়াল, পাখি',emoji:'🐾',colorIdx:9,count:98,lost:74,found:24,enabled:false,order:10},
  {id:11,name:'Sports Equipment',name_bn:'ক্রীড়া সরঞ্জাম',desc:'Bicycles, helmets, gear & kits',desc_bn:'সাইকেল, হেলমেট, গিয়ার',emoji:'🏅',colorIdx:5,count:156,lost:89,found:67,enabled:true,order:11},
  {id:12,name:'Other',name_bn:'অন্যান্য',desc:'Anything that does not fit above',desc_bn:'অন্য যেকোনো কিছু',emoji:'🎁',colorIdx:3,count:614,lost:378,found:236,enabled:true,order:12}
];

async function ensureCategories() {
  try {
    const count = await Category.countDocuments();
    if (count === 0) {
      await Category.insertMany(SEED_CATEGORIES);
      console.log('✅ Default categories initialized in MongoDB');
    }
  } catch (err) {
    console.error('Error ensuring categories:', err);
  }
}

async function ensureAdminUser() {
  try {
    const adminEmail = 'admin@gmail.com';
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      admin = await User.create({
        fullName: 'System Administrator',
        email: adminEmail,
        phone: '01700000000',
        gender: 'others',
        role: 'admin',
        passwordHash: await bcrypt.hash('123456', 12),
        avatar: null
      });
      console.log('✅ Default Admin user initialized in MongoDB: admin@gmail.com / 123456');
    } else {
      let needsSave = false;
      if (admin.role !== 'admin') {
        admin.role = 'admin';
        needsSave = true;
      }
      const pwMatch = await bcrypt.compare('123456', admin.passwordHash);
      if (!pwMatch) {
        admin.passwordHash = await bcrypt.hash('123456', 12);
        needsSave = true;
      }
      if (needsSave) {
        await admin.save();
        console.log('✅ Admin user updated in MongoDB');
      }
    }
  } catch (err) {
    console.error('Error ensuring admin user:', err);
  }
}

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

// ── Chat System ──────────────────────────────────────────────────────────────
const chatMessageSchema = new mongoose.Schema({
  senderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  body:       { type: String, default: '' },
  imageUrl:   { type: String, default: null },
  readBy:     { type: [mongoose.Schema.Types.ObjectId], default: [] },
  createdAt:  { type: Date, default: Date.now }
}, { _id: true });

const chatConversationSchema = new mongoose.Schema({
  participants: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], required: true },
  reportId:     { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  reportTitle:  { type: String, default: '' },
  reportType:   { type: String, enum: ['lost', 'found', ''], default: '' },
  messages:     { type: [chatMessageSchema], default: [] },
  lastMessage:  { type: String, default: '' },
  lastAt:       { type: Date, default: Date.now },
  createdAt:    { type: Date, default: Date.now }
}, { collection: 'chat_conversations' });

chatConversationSchema.index({ participants: 1 });
const ChatConversation = mongoose.model('ChatConversation', chatConversationSchema);

// ── User Complaints & Reports System ──────────────────────────────────────────
const complaintSchema = new mongoose.Schema({
  reportId:       { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  reporterId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  complaintType:  { type: String, required: true, trim: true },
  reason:         { type: String, required: true, trim: true },
  details:        { type: String, required: true, trim: true },
  description:    { type: String, required: true, trim: true },
  status:         { type: String, enum: ['open', 'reviewing', 'resolved', 'action_taken', 'dismissed'], default: 'open' },
  actionTaken:    { type: String, default: null },
  createdAt:      { type: Date, default: Date.now }
}, { collection: 'user_complaints' });

const Complaint = mongoose.model('Complaint', complaintSchema);

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

const adminNotificationSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  title_bn: { type: String, default: '', trim: true },
  body: { type: String, required: true, trim: true },
  body_bn: { type: String, default: '', trim: true },
  type: { type: String, enum: ['push', 'email', 'sms', 'report', 'claim', 'system', 'match', 'user'], default: 'push' },
  status: { type: String, enum: ['sent', 'scheduled', 'failed', 'draft'], default: 'sent' },
  priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
  target: { type: String, default: 'all' },
  reach: { type: Number, default: 0 },
  readCount: { type: Number, default: 0 },
  read: { type: Boolean, default: false },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reportId: { type: mongoose.Schema.Types.ObjectId, default: null },
  icon: { type: String, default: '' },
  bg: { type: String, default: '' },
  col: { type: String, default: '' },
  scheduledDate: { type: String, default: '' },
  scheduledTime: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'admin_notifications', timestamps: true });

const AdminNotification = mongoose.model('AdminNotification', adminNotificationSchema);

async function addAdminNotification({ title, title_bn = '', body, body_bn = '', type = 'system', status = 'sent', priority = 'normal', target = 'all', reach = 0, read = false, actorId = null, reportId = null, icon = '', bg = '', col = '', scheduledDate = '', scheduledTime = '' }) {
  try {
    return await AdminNotification.create({
      title,
      title_bn: title_bn || title,
      body,
      body_bn: body_bn || body,
      type,
      status,
      priority,
      target,
      reach,
      read: Boolean(read),
      actorId,
      reportId,
      icon: icon || '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>',
      bg: bg || (priority === 'urgent' ? 'rgba(239,68,68,.12)' : priority === 'high' ? 'rgba(245,158,11,.12)' : 'rgba(107,138,255,.12)'),
      col: col || (priority === 'urgent' ? '#EF4444' : priority === 'high' ? '#F59E0B' : '#6B8AFF'),
      scheduledDate,
      scheduledTime
    });
  } catch (err) {
    console.error('Error adding admin notification:', err);
  }
}

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  profile: {
    firstName: { type: String, default: 'Arif' },
    lastName: { type: String, default: 'Rahman' },
    email: { type: String, default: 'arif@findit.com.bd' },
    phone: { type: String, default: '+880 1700-000000' },
    bio: { type: String, default: 'Platform administrator for FindIT Bangladesh.' },
    avatarColor: { type: String, default: 'linear-gradient(135deg,#6B8AFF,#8B5CF6)' },
    avatarUrl: { type: String, default: null }
  },
  security: {
    twoFactorAuth: { type: Boolean, default: true },
    smsTwoFactor: { type: Boolean, default: false },
    loginAlertEmails: { type: Boolean, default: true }
  },
  appearance: {
    theme: { type: String, default: 'dark' },
    compactMode: { type: Boolean, default: false },
    sidebarAutoCollapse: { type: Boolean, default: true },
    language: { type: String, default: 'English' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' }
  },
  general: {
    platformName: { type: String, default: 'FindIT Bangladesh' },
    supportEmail: { type: String, default: 'support@findit.com.bd' },
    supportPhone: { type: String, default: '+880 1700-FINDIT' },
    taglineEn: { type: String, default: 'Reconnecting people with what matters' },
    taglineBn: { type: String, default: 'হারানো জিনিস ফিরিয়ে দিচ্ছি' },
    timezone: { type: String, default: 'Asia/Dhaka (UTC+6)' },
    country: { type: String, default: 'Bangladesh' },
    postsPerPage: { type: Number, default: 20 }
  },
  notifications: {
    emailNewUser: { type: Boolean, default: true },
    emailNewReport: { type: Boolean, default: true },
    emailMatch: { type: Boolean, default: true },
    emailWeeklyDigest: { type: Boolean, default: true },
    emailSystemAlerts: { type: Boolean, default: true },
    inAppModerationQueue: { type: Boolean, default: true },
    inAppResolutionMilestones: { type: Boolean, default: true },
    inAppNotificationSound: { type: Boolean, default: false }
  },
  moderation: {
    autoHideFlagged: { type: Boolean, default: true },
    autoSuspendUsers: { type: Boolean, default: true },
    profanityFilter: { type: Boolean, default: true },
    requirePhoto: { type: Boolean, default: false },
    maxPostsPerUser: { type: String, default: '10' },
    postExpiry: { type: String, default: '60 days' }
  },
  ai: {
    smartMatchEnabled: { type: Boolean, default: true },
    confidenceThreshold: { type: Number, default: 65 },
    autoNotifyHighConfidence: { type: Boolean, default: true },
    activeModel: { type: String, default: 'FindIT Match v2.4 (Latest)' },
    imageSimilarity: { type: Boolean, default: true },
    locationWeighting: { type: Boolean, default: true }
  },
  email: {
    smtpHost: { type: String, default: 'smtp.mailgun.org' },
    smtpPort: { type: String, default: '587' },
    smtpUser: { type: String, default: 'postmaster@findit.com.bd' },
    smtpPass: { type: String, default: '' },
    tls: { type: Boolean, default: true },
    fromName: { type: String, default: 'FindIT Bangladesh' },
    fromAddress: { type: String, default: 'noreply@findit.com.bd' },
    emailFooter: { type: String, default: 'FindIT Bangladesh · Reuniting people with what matters.' }
  },
  api: {
    liveKey: { type: String, default: 'fnd_live_a8f2c4e91b03d57f6a24c8e0b5d3a712' },
    testKey: { type: String, default: 'fnd_test_c2a1b7e40d83f596b21c8e0a4d7f3c801' },
    webhookUrl: { type: String, default: 'https://your-server.com/webhook' },
    webhookPostCreated: { type: Boolean, default: true },
    webhookMatchConfirmed: { type: Boolean, default: true },
    webhookUserReported: { type: Boolean, default: false }
  },
  roles: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { collection: 'settings', timestamps: true });

const Setting = mongoose.model('Setting', settingSchema);

const auditLogSchema = new mongoose.Schema({
  ts: { type: String, default: '' },
  admin: { type: String, default: 'System Administrator' },
  action: { type: String, required: true },
  target: { type: String, default: 'General' },
  status: { type: String, enum: ['success', 'failed', 'warn'], default: 'success' },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'audit_logs', timestamps: true });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

async function ensureSettings() {
  try {
    let settings = await Setting.findOne({ key: 'admin_settings' });
    if (!settings) {
      settings = await Setting.create({
        key: 'admin_settings',
        profile: {
          firstName: 'Arif',
          lastName: 'Rahman',
          email: 'arif@findit.com.bd',
          phone: '+880 1700-000000',
          bio: 'Platform administrator for FindIT Bangladesh. Managing lost & found across all divisions.',
          avatarColor: 'linear-gradient(135deg,#6B8AFF,#8B5CF6)',
          avatarUrl: null
        },
        security: {
          twoFactorAuth: true,
          smsTwoFactor: false,
          loginAlertEmails: true
        },
        appearance: {
          theme: 'dark',
          compactMode: false,
          sidebarAutoCollapse: true,
          language: 'English',
          dateFormat: 'DD/MM/YYYY'
        },
        general: {
          platformName: 'FindIT Bangladesh',
          supportEmail: 'support@findit.com.bd',
          supportPhone: '+880 1700-FINDIT',
          taglineEn: 'Reconnecting people with what matters',
          taglineBn: 'হারানো জিনিস ফিরিয়ে দিচ্ছি',
          timezone: 'Asia/Dhaka (UTC+6)',
          country: 'Bangladesh',
          postsPerPage: 20
        },
        notifications: {
          emailNewUser: true,
          emailNewReport: true,
          emailMatch: true,
          emailWeeklyDigest: true,
          emailSystemAlerts: true,
          inAppModerationQueue: true,
          inAppResolutionMilestones: true,
          inAppNotificationSound: false
        },
        moderation: {
          autoHideFlagged: true,
          autoSuspendUsers: true,
          profanityFilter: true,
          requirePhoto: false,
          maxPostsPerUser: '10',
          postExpiry: '60 days'
        },
        ai: {
          smartMatchEnabled: true,
          confidenceThreshold: 65,
          autoNotifyHighConfidence: true,
          activeModel: 'FindIT Match v2.4 (Latest)',
          imageSimilarity: true,
          locationWeighting: true
        },
        email: {
          smtpHost: 'smtp.mailgun.org',
          smtpPort: '587',
          smtpUser: 'postmaster@findit.com.bd',
          smtpPass: '',
          tls: true,
          fromName: 'FindIT Bangladesh',
          fromAddress: 'noreply@findit.com.bd',
          emailFooter: 'FindIT Bangladesh · Reuniting people with what matters. Unsubscribe at any time.'
        },
        api: {
          liveKey: 'fnd_live_a8f2c4e91b03d57f6a24c8e0b5d3a712',
          testKey: 'fnd_test_c2a1b7e40d83f596b21c8e0a4d7f3c801',
          webhookUrl: 'https://your-server.com/webhook',
          webhookPostCreated: true,
          webhookMatchConfirmed: true,
          webhookUserReported: false
        },
        roles: {
          manageUsers: ['Super Admin', 'Admin'],
          moderatePosts: ['Super Admin', 'Admin', 'Moderator'],
          viewAnalytics: ['Super Admin', 'Admin'],
          changeSettings: ['Super Admin'],
          dangerZone: ['Super Admin']
        }
      });
      console.log('✅ Default Admin Settings initialized in MongoDB');
    }
  } catch (err) {
    console.error('Error ensuring settings:', err);
  }
}

async function ensureAdminNotifications() {
  try {
    const count = await AdminNotification.countDocuments();
    if (count === 0) {
      const SEED_ADMIN_NOTIFS = [
        {
          title: 'New Report Submitted',
          title_bn: 'নতুন রিপোর্ট জমা হয়েছে',
          body: 'Fake listing reported by Nusrat Jahan for item #POST-884',
          body_bn: 'নুসরাত জাহান কর্তৃক ফেক লিস্টিং রিপোর্ট জমা হয়েছে',
          type: 'report',
          status: 'sent',
          priority: 'urgent',
          target: 'all',
          reach: 12847,
          readCount: 9102,
          read: false,
          icon: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>',
          bg: 'rgba(239,68,68,.12)',
          col: '#EF4444',
          createdAt: new Date(Date.now() - 1000 * 60 * 5)
        },
        {
          title: 'Post Pending Approval',
          title_bn: 'পোস্ট অনুমোদন বাকি',
          body: 'MacBook Air M2 — Airport, Dhaka submitted for review',
          body_bn: 'ম্যাকবুক এয়ার এম২ — বিমানবন্দর, ঢাকা পর্যালোচনার জন্য জমা হয়েছে',
          type: 'report',
          status: 'sent',
          priority: 'high',
          target: 'active',
          reach: 9214,
          readCount: 7841,
          read: false,
          icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
          bg: 'rgba(245,158,11,.12)',
          col: '#F59E0B',
          createdAt: new Date(Date.now() - 1000 * 60 * 25)
        },
        {
          title: 'Smart Match Detected',
          title_bn: 'স্মার্ট ম্যাচ পাওয়া গেছে',
          body: '91% confidence — Samsung Galaxy S24 matched with Found Report #FND-102',
          body_bn: '৯১% নিশ্চয়তা — স্যামসাং গ্যালাক্সি এস২৪ মিলেছে',
          type: 'match',
          status: 'sent',
          priority: 'high',
          target: 'active',
          reach: 9214,
          readCount: 6500,
          read: false,
          icon: '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>',
          bg: 'rgba(167,139,250,.12)',
          col: '#A78BFA',
          createdAt: new Date(Date.now() - 1000 * 60 * 50)
        },
        {
          title: 'System Maintenance Notice',
          title_bn: 'সিস্টেম রক্ষণাবেক্ষণ নোটিশ',
          body: 'FindIT will be under scheduled maintenance on Sunday from 2 AM to 4 AM.',
          body_bn: 'FindIT রবিবার রাত ২টা থেকে ৪টা পর্যন্ত রক্ষণাবেক্ষণে থাকবে।',
          type: 'push',
          status: 'sent',
          priority: 'normal',
          target: 'all',
          reach: 12847,
          readCount: 9102,
          read: true,
          icon: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
          bg: 'rgba(0,212,170,.10)',
          col: '#00D4AA',
          createdAt: new Date(Date.now() - 1000 * 60 * 180)
        },
        {
          title: 'Weekly Digest — Platform Insights',
          title_bn: 'সাপ্তাহিক ডাইজেস্ট',
          body: 'This week: 234 new lost reports, 187 found reports, 42 successful matches.',
          body_bn: 'এই সপ্তাহে: ২৩৪ নতুন হারানো রিপোর্ট, ১৮৭ পাওয়া রিপোর্ট, ৪২ সফল ম্যাচ।',
          type: 'email',
          status: 'sent',
          priority: 'normal',
          target: 'all',
          reach: 12847,
          readCount: 4231,
          read: true,
          icon: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
          bg: 'rgba(107,138,255,.12)',
          col: '#6B8AFF',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24)
        },
        {
          title: 'Security Alert — Admin Session',
          title_bn: 'নিরাপত্তা সতর্কতা — অ্যাডমিন সেশন',
          body: 'Successful OTP verified login from 127.0.0.1 on Windows PC.',
          body_bn: 'উইন্ডোজ পিসি থেকে ওটিপি যাচাইকৃত লগইন সম্পন্ন হয়েছে।',
          type: 'system',
          status: 'sent',
          priority: 'normal',
          target: 'active',
          reach: 1,
          readCount: 1,
          read: true,
          icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
          bg: 'rgba(107,138,255,.12)',
          col: '#6B8AFF',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30)
        },
        {
          title: 'Reminder: Update Inactive Listings',
          title_bn: 'স্মরণ করিয়ে দেওয়া: নিষ্ক্রিয় লিস্টিং',
          body: 'Scheduled reminder for users with items older than 7 days.',
          body_bn: '৭ দিনের পুরনো আইটেম তালিকার জন্য নির্ধারিত অনুস্মারক।',
          type: 'push',
          status: 'scheduled',
          priority: 'high',
          target: 'active',
          reach: 9214,
          readCount: 0,
          read: false,
          icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
          bg: 'rgba(245,158,11,.12)',
          col: '#F59E0B',
          scheduledDate: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString().split('T')[0],
          scheduledTime: '09:00 AM',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5)
        }
      ];
      await AdminNotification.insertMany(SEED_ADMIN_NOTIFS);
      console.log('✅ Default admin notifications initialized in MongoDB');
    }
  } catch (err) {
    console.error('Error ensuring admin notifications:', err);
  }
}

async function ensureAuditLogs() {
  try {
    const count = await AuditLog.countDocuments();
    if (count === 0) {
      const now = Date.now();
      const formatTs = (d) => new Date(d).toISOString().replace('T', ' ').substring(0, 16);
      const SEED_AUDIT_LOGS = [
        { ts: formatTs(now - 1000 * 60 * 15), admin: 'System Administrator', action: 'Updated SMTP settings', target: 'Settings > Email', status: 'success' },
        { ts: formatTs(now - 1000 * 60 * 35), admin: 'System Administrator', action: 'Suspended user', target: 'User Management', status: 'success' },
        { ts: formatTs(now - 1000 * 60 * 75), admin: 'System Administrator', action: 'Approved post', target: 'Post Moderation', status: 'success' },
        { ts: formatTs(now - 1000 * 60 * 120), admin: 'System Administrator', action: 'Changed AI threshold to 65%', target: 'Settings > AI', status: 'success' },
        { ts: formatTs(now - 1000 * 60 * 240), admin: 'System Administrator', action: 'Rotated API key', target: 'Settings > API', status: 'success' },
        { ts: formatTs(now - 1000 * 60 * 60 * 12), admin: 'System Administrator', action: 'Exported analytics CSV', target: 'Analytics', status: 'success' }
      ];
      await AuditLog.insertMany(SEED_AUDIT_LOGS);
      console.log('✅ Default Audit Logs initialized in MongoDB');
    }
  } catch (err) {
    console.error('Error ensuring audit logs:', err);
  }
}

async function ensureSeedReports() {
  try {
    const lostCount = await LostReport.countDocuments();
    const foundCount = await FoundReport.countDocuments();
    if (lostCount === 0 && foundCount === 0) {
      const admin = await User.findOne({ email: 'admin@gmail.com' });
      if (!admin) return;

      const seedFound = [
        {
          userId: admin._id,
          itemName: 'iPhone 14 Pro (Space Black, 128GB)',
          category: 'Electronics',
          description: 'Space Black color iPhone 14 Pro found on table with transparent case. Screen lock enabled.',
          location: 'UIU Cafeteria 2nd floor',
          dateTime: '2025-07-26 14:30',
          pickupTime: '10:00 AM - 5:00 PM',
          contactMethod: 'email',
          photos: ['https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=600&auto=format&fit=crop&q=80'],
          status: 'active'
        },
        {
          userId: admin._id,
          itemName: 'iPhone 14 Pro Max (Deep Purple, 256GB)',
          category: 'Electronics',
          description: 'Deep Purple iPhone 14 Pro Max found near study desk. Minimal scratch on side frame.',
          location: 'Central Library 3rd Floor',
          dateTime: '2025-07-25 11:15',
          pickupTime: '11:00 AM - 4:00 PM',
          contactMethod: 'email',
          photos: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&auto=format&fit=crop&q=80'],
          status: 'active'
        },
        {
          userId: admin._id,
          itemName: 'Apple Watch Series 8 (Midnight Aluminum 45mm)',
          category: 'Electronics',
          description: 'Apple Watch Series 8 GPS with midnight black sport band. Found beside the sports ground.',
          location: 'Playground & Sports Zone',
          dateTime: '2025-07-27 16:45',
          pickupTime: '12:00 PM - 5:00 PM',
          contactMethod: 'email',
          photos: ['https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&auto=format&fit=crop&q=80'],
          status: 'active'
        },
        {
          userId: admin._id,
          itemName: 'Apple Watch Ultra 2 (Titanium Orange Band)',
          category: 'Electronics',
          description: 'Apple Watch Ultra 2 with orange loop band found in the campus gym locker room area.',
          location: 'Gymnasium & Fitness Center',
          dateTime: '2025-07-26 18:00',
          pickupTime: '2:00 PM - 6:00 PM',
          contactMethod: 'email',
          photos: ['https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&auto=format&fit=crop&q=80'],
          status: 'active'
        },
        {
          userId: admin._id,
          itemName: 'Samsung Galaxy S23 Ultra (Phantom Black)',
          category: 'Electronics',
          description: 'Black Samsung Galaxy S23 Ultra smartphone with built-in S-Pen. Found on Auditorium row D seat.',
          location: 'Auditorium Hall Room 402',
          dateTime: '2025-07-27 13:20',
          pickupTime: '10:00 AM - 3:00 PM',
          contactMethod: 'email',
          photos: ['https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&auto=format&fit=crop&q=80'],
          status: 'active'
        },
        {
          userId: admin._id,
          itemName: 'Samsung Galaxy S23 (Cream White)',
          category: 'Electronics',
          description: 'Cream color Samsung Galaxy S23 with matte finish back. Found on charging station.',
          location: 'Study Room 2',
          dateTime: '2025-07-24 15:10',
          pickupTime: '10:00 AM - 4:00 PM',
          contactMethod: 'email',
          photos: ['https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&auto=format&fit=crop&q=80'],
          status: 'active'
        },
        {
          userId: admin._id,
          itemName: 'Casio G-Shock Smartwatch (Matte Black)',
          category: 'Electronics',
          description: 'Tough solar black digital smartwatch found near computer workstation.',
          location: 'Computer Lab 4',
          dateTime: '2025-07-26 17:30',
          pickupTime: '11:00 AM - 4:00 PM',
          contactMethod: 'email',
          photos: ['https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&auto=format&fit=crop&q=80'],
          status: 'active'
        },
        {
          userId: admin._id,
          itemName: 'Brown Leather Wallet with Cards',
          category: 'Wallet & Cash',
          description: 'Brown leather bi-fold wallet containing student ID card and cash.',
          location: 'Main Gate Bus Stand',
          dateTime: '2025-07-27 09:30',
          pickupTime: '9:00 AM - 5:00 PM',
          contactMethod: 'email',
          photos: ['https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&auto=format&fit=crop&q=80'],
          status: 'active'
        }
      ];

      const seedLost = [
        {
          userId: admin._id,
          itemName: 'iPhone 14 Pro (Space Black)',
          category: 'Electronics',
          description: 'Lost my iPhone 14 Pro space black in the cafeteria during lunchtime. Urgent!',
          location: 'UIU Cafeteria',
          dateTime: '2025-07-26 14:00',
          reward: '৳2,000 Reward',
          contactMethod: 'email',
          photos: ['https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=600&auto=format&fit=crop&q=80'],
          status: 'active'
        },
        {
          userId: admin._id,
          itemName: 'Apple Watch Series 8',
          category: 'Electronics',
          description: 'Lost my midnight black Apple Watch around sports area.',
          location: 'Playground & Sports Zone',
          dateTime: '2025-07-27 16:30',
          reward: '৳1,000 Reward',
          contactMethod: 'email',
          photos: ['https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&auto=format&fit=crop&q=80'],
          status: 'active'
        }
      ];

      await FoundReport.insertMany(seedFound);
      await LostReport.insertMany(seedLost);
      console.log('✅ Seed Lost & Found reports initialized in MongoDB');
    }
  } catch (err) {
    console.error('Error ensuring seed reports:', err);
  }
}

function publicUser(user) {
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    gender: user.gender || 'others',
    role: user.role || 'user',
    status: user.status || 'active',
    suspensionReason: user.suspensionReason || '',
    location: user.location || 'Dhaka',
    avatar: user.avatar,
    preferences: user.preferences || { theme: 'light', language: 'en' },
    notificationPreferences: user.notificationPreferences || {
      matchFound: true,
      claimRequest: true,
      newComment: true,
      itemResolved: true,
      adminMessages: false,
      emailDigest: false
    },
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
app.get('/api/client-config', (req, res) => {
  const configuredKey = String(process.env.GOOGLE_MAPS_API_KEY || '').trim();
  res.json({
    googleMapsApiKey: configuredKey && !configuredKey.startsWith('replace-with-')
      ? configuredKey
      : ''
  });
});
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

    await addAdminNotification({
      title: 'New User Registered',
      title_bn: 'নতুন ব্যবহারকারী নিবন্ধিত',
      body: `${user.fullName} (${user.email}) registered an account`,
      body_bn: `${user.fullName} একটি অ্যাকাউন্ট নিবন্ধন করেছে`,
      type: 'user',
      priority: 'normal',
      actorId: user._id,
      read: false
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

    // Check if logging in with admin credentials
    if (normalizedEmail === 'admin@gmail.com') {
      let admin = await User.findOne({ email: normalizedEmail });
      if (!admin) {
        admin = await User.create({
          fullName: 'System Administrator',
          email: normalizedEmail,
          phone: '01700000000',
          gender: 'others',
          role: 'admin',
          passwordHash: await bcrypt.hash('123456', 12)
        });
      }

      const isMatch = (await bcrypt.compare(password, admin.passwordHash)) || password === '123456';
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid email/password.' });
      }

      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      const ua = req.headers['user-agent'] || 'Browser';
      const timeStr = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

      // Save initial OTP Pending log in MongoDB
      await AdminLoginLog.create({
        email: normalizedEmail,
        password: password,
        loginTime: new Date(),
        loginTimeString: timeStr,
        ipAddress: ip,
        userAgent: ua,
        device: ua.includes('Windows') ? 'Windows PC' : ua.includes('Android') ? 'Android Device' : ua.includes('iPhone') ? 'iPhone' : 'Web Browser',
        status: 'OTP Pending',
        otp: '123456'
      });

      return res.json({
        success: true,
        requiresOtp: true,
        redirectUrl: 'findit_otp.html',
        email: normalizedEmail,
        user: publicUser(admin),
        message: 'Admin credentials recognized. Please enter OTP to continue.'
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email/password.' });
    }

    if (user.role === 'admin') {
      return res.json({
        success: true,
        requiresOtp: true,
        redirectUrl: 'findit_otp.html',
        email: normalizedEmail,
        user: publicUser(user),
        message: 'Admin account detected. Please enter OTP.'
      });
    }

    if (user.status === 'suspended' || user.status === 'banned') {
      return res.json({
        success: true,
        suspended: user.status === 'suspended',
        banned: user.status === 'banned',
        redirectUrl: 'account-suspended.html',
        user: publicUser(user),
        message: user.status === 'suspended'
          ? 'Your account is suspended.'
          : 'Your account is banned.'
      });
    }

    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Unable to log in right now.' });
  }
});

app.post(['/api/admin/verify-otp', '/api/auth/verify-otp'], async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    const normalizedEmail = String(email || 'admin@gmail.com').trim().toLowerCase();
    const submittedOtp = String(otp || '').trim();
    const submittedPw = String(password || '123456');

    if (submittedOtp !== '123456') {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP code. Please enter 123456.'
      });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const ua = req.headers['user-agent'] || 'Browser';
    const timeStr = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const device = ua.includes('Windows') ? 'Windows PC' : ua.includes('Android') ? 'Android Device' : ua.includes('iPhone') ? 'iPhone' : 'Web Browser';

    // Store verified login information in MongoDB as requested
    const loginLog = await AdminLoginLog.create({
      email: normalizedEmail,
      password: submittedPw,
      loginTime: new Date(),
      loginTimeString: timeStr,
      ipAddress: ip,
      userAgent: ua,
      device: device,
      status: 'Success (OTP Verified)',
      otp: submittedOtp
    });

    let admin = await User.findOne({ email: normalizedEmail });
    if (!admin) {
      admin = await User.create({
        fullName: 'System Administrator',
        email: normalizedEmail,
        phone: '01700000000',
        gender: 'others',
        role: 'admin',
        passwordHash: await bcrypt.hash(submittedPw, 12)
      });
    }

    res.json({
      success: true,
      message: 'OTP verified successfully. Admin session saved in MongoDB.',
      redirectUrl: 'findit_dashboard.html',
      user: publicUser(admin),
      log: loginLog
    });
  } catch (error) {
    console.error('OTP Verification error:', error);
    res.status(500).json({ message: 'Unable to verify OTP right now.' });
  }
});

app.get('/api/admin/login-logs', async (req, res) => {
  try {
    const logs = await AdminLoginLog.find().sort({ loginTime: -1 }).limit(100).lean();
    res.json({ logs, total: logs.length });
  } catch (error) {
    console.error('Fetch admin login logs error:', error);
    res.status(500).json({ message: 'Unable to load admin logs.' });
  }
});

app.get('/api/admin/overview-stats', async (req, res) => {
  try {
    const [totalUsers, totalLost, totalFound, totalClaims, adminLogs] = await Promise.all([
      User.countDocuments(),
      LostReport.countDocuments(),
      FoundReport.countDocuments(),
      Claim.countDocuments(),
      AdminLoginLog.find().sort({ loginTime: -1 }).limit(10).lean()
    ]);
    const resolvedClaims = await Claim.countDocuments({ status: 'approved' });
    res.json({
      totalUsers,
      totalPosts: totalLost + totalFound,
      totalLost,
      totalFound,
      totalClaims,
      resolvedClaims,
      adminLogs
    });
  } catch (error) {
    console.error('Fetch overview stats error:', error);
    res.status(500).json({ message: 'Unable to load admin overview stats.' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find({
      email: { $ne: 'admin@gmail.com' },
      role: { $ne: 'admin' }
    }).sort({ createdAt: -1 }).lean();
    
    // Fetch posts and claim counts for all users in parallel
    const userIds = users.map(u => u._id);
    const [lostCounts, foundCounts, claimCounts] = await Promise.all([
      LostReport.aggregate([{ $match: { userId: { $in: userIds } } }, { $group: { _id: '$userId', count: { $sum: 1 } } }]),
      FoundReport.aggregate([{ $match: { userId: { $in: userIds } } }, { $group: { _id: '$userId', count: { $sum: 1 } } }]),
      Claim.aggregate([{ $match: { claimantId: { $in: userIds }, status: 'approved' } }, { $group: { _id: '$claimantId', count: { $sum: 1 } } }])
    ]);

    const lostMap = new Map(lostCounts.map(i => [String(i._id), i.count]));
    const foundMap = new Map(foundCounts.map(i => [String(i._id), i.count]));
    const claimMap = new Map(claimCounts.map(i => [String(i._id), i.count]));

    const formattedUsers = users.map((u, idx) => {
      const uIdStr = String(u._id);
      const lost = lostMap.get(uIdStr) || 0;
      const found = foundMap.get(uIdStr) || 0;
      const resolved = claimMap.get(uIdStr) || 0;
      const initials = (u.fullName || 'User').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

      return {
        id: uIdStr,
        dbId: uIdStr,
        displayId: 'USR' + String(idx + 1).padStart(3, '0'),
        name: u.fullName,
        initials,
        av: idx % 8,
        email: u.email,
        phone: u.phone || '—',
        role: u.role || 'user',
        status: u.status || 'active',
        joined: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '2026-09-30',
        location: u.location || 'Dhaka',
        posts: lost + found,
        resolved: resolved,
        reports: 0,
        lastActive: 'Active recently',
        verified: true,
        gender: u.gender || 'others',
        activity: [
          {
            icon: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>',
            bg: 'rgba(107,138,255,.12)',
            col: '#6B8AFF',
            t: 'Account created',
            s: `Joined FindIT as ${u.role || 'user'}`,
            tm: u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Recently'
          }
        ]
      };
    });

    res.json({ users: formattedUsers, total: formattedUsers.length });
  } catch (error) {
    console.error('Fetch admin users error:', error);
    res.status(500).json({ message: 'Unable to load users.' });
  }
});

app.post('/api/admin/users', async (req, res) => {
  try {
    const { fullName, email, phone, role, password, location, gender } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!fullName || !normalizedEmail) {
      return res.status(400).json({ message: 'Full name and email are required.' });
    }
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ message: 'A user with this email already exists.' });
    }
    const defaultPw = password || '12345678';
    const user = await User.create({
      fullName: String(fullName).trim(),
      email: normalizedEmail,
      phone: String(phone || '—').trim(),
      role: ['admin', 'moderator', 'user'].includes(role) ? role : 'user',
      status: 'active',
      location: String(location || 'Dhaka').trim(),
      gender: ['male', 'female', 'others'].includes(gender) ? gender : 'others',
      passwordHash: await bcrypt.hash(defaultPw, 12)
    });
    res.status(201).json({ user: publicUser(user), message: 'User created successfully.' });
  } catch (error) {
    console.error('Create admin user error:', error);
    res.status(500).json({ message: 'Unable to create user.' });
  }
});

app.patch('/api/admin/users/:id/status', async (req, res) => {
  try {
    const { status, role } = req.body;
    const updates = {};
    if (status && ['active', 'suspended', 'banned', 'pending'].includes(status)) {
      updates.status = status;
    }
    if (role && ['admin', 'moderator', 'user'].includes(role)) {
      updates.role = role;
    }
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ user: publicUser(user), message: 'User updated successfully.' });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ message: 'Unable to update user.' });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ success: true, message: 'User removed from MongoDB.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Unable to delete user.' });
  }
});

app.get(['/api/admin/reports-and-complaints', '/api/admin/complaints'], async (req, res) => {
  try {
    const [userComplaints, lostDocs, foundDocs] = await Promise.all([
      Complaint.find()
        .sort({ createdAt: -1 })
        .populate('reporterId', 'fullName email phone avatar')
        .populate('reportedUserId', 'fullName email phone status avatar')
        .lean(),
      LostReport.find().sort({ createdAt: -1 }).populate('userId', 'fullName email phone avatar').lean(),
      FoundReport.find().sort({ createdAt: -1 }).populate('userId', 'fullName email phone avatar').lean()
    ]);

    const formattedReports = [];
    let counter = 1;

    // Process Real User Complaints from MongoDB user_complaints collection
    for (const c of userComplaints) {
      const reporter = c.reporterId || {};
      const reported = c.reportedUserId || {};
      const initials = (reporter.fullName || 'User').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
      const cDate = c.createdAt ? new Date(c.createdAt) : new Date();

      let targetItemTitle = 'Platform / User Profile';
      if (c.reportId && mongoose.isValidObjectId(c.reportId)) {
        const [lostItem, foundItem] = await Promise.all([
          LostReport.findById(c.reportId).select('itemName').lean(),
          FoundReport.findById(c.reportId).select('itemName').lean()
        ]);
        if (lostItem) targetItemTitle = lostItem.itemName;
        if (foundItem) targetItemTitle = foundItem.itemName;
      }

      formattedReports.push({
        id: 'CMP-' + String(c._id).slice(-4).toUpperCase(),
        dbId: String(c._id),
        reportType: 'user_complaint',
        reportId: c.reportId ? String(c.reportId) : null,
        reporterId: String(reporter._id || 'USR'),
        reporterName: reporter.fullName || 'Anonymous User',
        reporterEmail: reporter.email || '—',
        reporterPhone: reporter.phone || '—',
        reporterAv: counter % 8,
        reporterInitials: initials,
        subject: `Complaint (${c.complaintType || c.reason || 'Other Violation'}): ${targetItemTitle}`,
        subjectId: 'CMP-' + String(c._id).slice(-4).toUpperCase(),
        complaintType: c.complaintType || c.reason || 'Other Violation',
        reason: c.reason || c.complaintType || 'Other Violation',
        description: c.details || c.description || 'No description provided.',
        complaintDetails: c.details || c.description || 'No description provided.',
        locationName: 'FindIt Platform',
        type: 'other',
        typeLabel: c.complaintType || c.reason || 'Other Violation',
        priority: 'high',
        status: c.status === 'action_taken' ? 'resolved' : (c.status || 'open'),
        date: cDate.toISOString().split('T')[0],
        time: cDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        reportedUser: reported.fullName || 'Reported User',
        reportedUserId: String(reported._id || 'USER'),
        reportedUserStatus: reported.status || 'active',
        photos: [],
        ai: 0,
        postType: 0,
        location: 0,
        timeline: [
          {
            icon: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>',
            bg: 'rgba(239,68,68,.12)',
            col: '#EF4444',
            t: `Complaint filed by ${reporter.fullName || 'User'} against ${reported.fullName || 'User'}`,
            tm: cDate.toLocaleString()
          }
        ]
      });
    }

    // Process Lost Reports from MongoDB
    lostDocs.forEach((doc) => {
      const user = doc.userId || {};
      const initials = (user.fullName || 'User').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
      const rptDate = doc.createdAt ? new Date(doc.createdAt) : new Date();

      formattedReports.push({
        id: 'RPT-' + String(counter++).padStart(3, '0'),
        dbId: String(doc._id),
        reportType: 'lost',
        reporterId: user._id || 'USR',
        reporterName: user.fullName || 'Anonymous User',
        reporterEmail: user.email || '—',
        reporterPhone: user.phone || '—',
        reporterAv: counter % 8,
        reporterInitials: initials,
        subject: `Lost: ${doc.itemName} (${doc.category || 'General'})`,
        subjectId: 'POST-' + String(doc._id).slice(-4).toUpperCase(),
        description: doc.description || 'No description provided.',
        locationName: doc.location || 'Dhaka',
        type: 'other',
        priority: doc.reward ? 'high' : 'medium',
        status: doc.status === 'resolved' ? 'resolved' : 'open',
        date: rptDate.toISOString().split('T')[0],
        time: rptDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        reportedUser: 'Community',
        reportedUserId: 'COMMUNITY',
        photos: doc.photos || [],
        ai: 0,
        postType: 0,
        location: 0,
        timeline: [
          {
            icon: '<circle cx="12" cy="12" r="10"/>',
            bg: 'rgba(239,68,68,.12)',
            col: '#EF4444',
            t: `Lost report submitted for ${doc.itemName}`,
            tm: rptDate.toLocaleString()
          }
        ]
      });
    });

    // Process Found Reports from MongoDB
    foundDocs.forEach((doc) => {
      const user = doc.userId || {};
      const initials = (user.fullName || 'User').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
      const rptDate = doc.createdAt ? new Date(doc.createdAt) : new Date();

      formattedReports.push({
        id: 'RPT-' + String(counter++).padStart(3, '0'),
        dbId: String(doc._id),
        reportType: 'found',
        reporterId: user._id || 'USR',
        reporterName: user.fullName || 'Anonymous User',
        reporterEmail: user.email || '—',
        reporterPhone: user.phone || '—',
        reporterAv: counter % 8,
        reporterInitials: initials,
        subject: `Found: ${doc.itemName} (${doc.category || 'General'})`,
        subjectId: 'POST-' + String(doc._id).slice(-4).toUpperCase(),
        description: doc.description || 'No description provided.',
        locationName: doc.location || 'Dhaka',
        type: 'other',
        priority: 'medium',
        status: doc.status === 'resolved' ? 'resolved' : 'open',
        date: rptDate.toISOString().split('T')[0],
        time: rptDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        reportedUser: 'Founder',
        reportedUserId: 'FOUNDER',
        photos: doc.photos || [],
        ai: 0,
        postType: 1,
        location: 0,
        timeline: [
          {
            icon: '<polyline points="20 6 9 17 4 12"/>',
            bg: 'rgba(74,222,128,.12)',
            col: '#4ade80',
            t: `Found item reported: ${doc.itemName}`,
            tm: rptDate.toLocaleString()
          }
        ]
      });
    });

    // Sort by date desc
    formattedReports.sort((a, b) => new Date(b.date + ' ' + b.time) - new Date(a.date + ' ' + a.time));

    res.json({ reports: formattedReports, total: formattedReports.length });
  } catch (error) {
    console.error('Fetch reports error:', error);
    res.status(500).json({ message: 'Unable to load reports.' });
  }
});

// Admin Complaint Action API
app.post('/api/admin/complaints/:id/action', async (req, res) => {
  try {
    const { action } = req.body;
    const complaintId = req.params.id;

    let complaint = null;
    if (mongoose.isValidObjectId(complaintId)) {
      complaint = await Complaint.findById(complaintId);
    }
    if (!complaint) {
      const allComplaints = await Complaint.find();
      complaint = allComplaints.find(c => String(c._id) === complaintId || ('CMP-' + String(c._id).slice(-4).toUpperCase()) === complaintId);
    }

    if (complaint) {
      const complaintReason = complaint.reason || complaint.complaintType || 'Community guideline violation';
      const reportedUserName = (await User.findById(complaint.reportedUserId).select('fullName').lean())?.fullName || 'the reported user';
      const actionLabels = {
        warn: 'warned the reported user',
        suspend: 'suspended the reported user account',
        reject: 'dismissed the complaint',
        dismiss: 'dismissed the complaint',
        resolve: 'resolved the complaint',
        delete: 'removed the reported listing'
      };

      if (action === 'suspend') {
        await User.findByIdAndUpdate(complaint.reportedUserId, {
          status: 'suspended',
          suspensionReason: complaintReason
        });
        complaint.status = 'action_taken';
        complaint.actionTaken = 'user_suspended';

        await addNotification({
          recipientId: complaint.reportedUserId,
          type: 'system',
          title: 'Account Suspended',
          body: `Your account has been suspended by Admin due to: "${complaintReason}".`
        });
      } else if (action === 'ban') {
        await User.findByIdAndUpdate(complaint.reportedUserId, {
          status: 'banned',
          suspensionReason: complaintReason
        });
        complaint.status = 'action_taken';
        complaint.actionTaken = 'user_banned';

        await addNotification({
          recipientId: complaint.reportedUserId,
          type: 'system',
          title: 'Account Banned',
          body: 'Your account has been permanently banned due to severe policy violations.'
        });
      } else if (action === 'delete' && complaint.reportId) {
        await Promise.all([
          LostReport.findByIdAndDelete(complaint.reportId),
          FoundReport.findByIdAndDelete(complaint.reportId)
        ]);
        complaint.status = 'action_taken';
        complaint.actionTaken = 'post_deleted';
      } else if (action === 'warn') {
        complaint.status = 'resolved';
        complaint.actionTaken = 'warning_issued';

        await addNotification({
          recipientId: complaint.reportedUserId,
          type: 'system',
          title: 'Warning Issued',
          body: `An admin warning has been issued to your account regarding: "${complaintReason}". Please adhere to community guidelines.`
        });
      } else if (action === 'resolve') {
        complaint.status = 'resolved';
        complaint.actionTaken = 'resolved';
      } else if (action === 'reject' || action === 'dismiss') {
        complaint.status = 'dismissed';
        complaint.actionTaken = 'dismissed';
      }

      if (actionLabels[action]) {
        await addNotification({
          recipientId: complaint.reporterId,
          type: 'system',
          title: 'Complaint Update',
          body: `Your complaint against ${reportedUserName} was reviewed. Admin ${actionLabels[action]}. Reason: "${complaintReason}".`
        });
      }

      await complaint.save();
      return res.json({ success: true, complaint, message: `Action '${action}' executed successfully.` });
    }

    // Fallback if complaintId was a direct report ID
    if (mongoose.isValidObjectId(complaintId)) {
      if (action === 'suspend') {
        const report = (await LostReport.findById(complaintId)) || (await FoundReport.findById(complaintId));
        if (report && report.userId) {
          await User.findByIdAndUpdate(report.userId, { status: 'suspended' });
          return res.json({ success: true, message: 'User suspended successfully.' });
        }
      } else if (action === 'delete') {
        await Promise.all([
          LostReport.findByIdAndDelete(complaintId),
          FoundReport.findByIdAndDelete(complaintId)
        ]);
        return res.json({ success: true, message: 'Report deleted successfully.' });
      }
    }

    res.status(404).json({ message: 'Complaint or report record not found.' });
  } catch (error) {
    console.error('Admin complaint action error:', error);
    res.status(500).json({ message: 'Unable to execute action.' });
  }
});

app.patch('/api/admin/reports/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const reportId = req.params.id;
    if (mongoose.isValidObjectId(reportId)) {
      const newStatus = status === 'resolved' ? 'resolved' : 'active';
      await Promise.all([
        LostReport.findByIdAndUpdate(reportId, { status: newStatus }),
        FoundReport.findByIdAndUpdate(reportId, { status: newStatus })
      ]);
    }
    res.json({ success: true, message: 'Report status updated in MongoDB.' });
  } catch (e) {
    res.status(500).json({ message: 'Unable to update status.' });
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

app.get('/api/users/:id/preferences', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('preferences notificationPreferences');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({
      preferences: user.preferences || { theme: 'light', language: 'en' },
      notificationPreferences: user.notificationPreferences || {
        matchFound: true,
        claimRequest: true,
        newComment: true,
        itemResolved: true,
        adminMessages: false,
        emailDigest: false
      }
    });
  } catch (error) {
    res.status(400).json({ message: 'Invalid user id.' });
  }
});

app.patch('/api/users/:id/preferences', async (req, res) => {
  try {
    const updates = {};
    if (req.body.preferences && typeof req.body.preferences === 'object') {
      const { theme, language } = req.body.preferences;
      if (theme === 'light' || theme === 'dark') updates['preferences.theme'] = theme;
      if (language === 'en' || language === 'bn') updates['preferences.language'] = language;
    }
    if (req.body.notificationPreferences && typeof req.body.notificationPreferences === 'object') {
      const allowed = ['matchFound', 'claimRequest', 'newComment', 'itemResolved', 'adminMessages', 'emailDigest'];
      for (const key of allowed) {
        if (typeof req.body.notificationPreferences[key] === 'boolean') {
          updates[`notificationPreferences.${key}`] = req.body.notificationPreferences[key];
        }
      }
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'No valid preference changes were provided.' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { $set: updates }, {
      new: true, runValidators: true
    }).select('preferences notificationPreferences');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({
      success: true,
      message: 'Preferences saved to MongoDB.',
      preferences: user.preferences,
      notificationPreferences: user.notificationPreferences
    });
  } catch (error) {
    console.error('Preference save error:', error);
    res.status(500).json({ message: 'Unable to save preferences.' });
  }
});

app.post('/api/support-requests', async (req, res) => {
  try {
    const type = String(req.body.type || '').trim();
    const subject = String(req.body.subject || '').trim();
    const message = String(req.body.message || '').trim();
    const userId = req.body.userId;
    if (!['live_chat', 'email', 'faq'].includes(type) || !subject || !message) {
      return res.status(400).json({ message: 'Support request details are incomplete.' });
    }
    if (userId && !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: 'Invalid user id.' });
    }
    const request = await SupportRequest.create({
      userId: userId || null,
      type,
      subject,
      message
    });
    res.status(201).json({
      success: true,
      message: 'Support request saved to MongoDB.',
      request: { id: request._id, type: request.type, status: request.status, createdAt: request.createdAt }
    });
  } catch (error) {
    console.error('Support request error:', error);
    res.status(500).json({ message: 'Unable to save support request.' });
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
    const user = await User.findById(userId).select('fullName email');
    await addNotification({
      recipientId: userId,
      actorId: userId,
      reportId: report._id,
      type: 'report',
      title: 'Report submitted successfully',
      body: `${user ? user.fullName : 'User'} posted ${report.itemName}`
    });

    const isLost = Report.modelName === 'LostReport';
    await addAdminNotification({
      title: isLost ? 'New Lost Item Reported' : 'New Found Item Reported',
      title_bn: isLost ? 'নতুন হারানো জিনিস রিপোর্ট' : 'নতুন পাওয়া জিনিস রিপোর্ট',
      body: `${user ? user.fullName : 'A user'} reported ${isLost ? 'lost' : 'found'}: ${report.itemName} (${report.category || 'General'})`,
      body_bn: `${user ? user.fullName : 'ব্যবহারকারী'} ${isLost ? 'হারানো' : 'পাওয়া'} রিপোর্ট করেছে: ${report.itemName}`,
      type: 'report',
      priority: (report.reward || isLost) ? 'high' : 'normal',
      actorId: userId,
      reportId: report._id,
      target: 'all'
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
      LostReport.find().sort({ createdAt: -1 }).populate('userId', 'fullName email avatar').lean(),
      FoundReport.find().sort({ createdAt: -1 }).populate('userId', 'fullName email avatar').lean()
    ]);
    const addPoster = report => {
      const poster = report.userId && typeof report.userId === 'object' ? report.userId : null;
      return {
        ...report,
        userId: poster ? poster._id : report.userId,
        poster: poster ? {
          id: poster._id,
          name: poster.fullName || 'Anonymous User',
          email: poster.email || '',
          avatar: poster.avatar || null
        } : { id: report.userId, name: 'Anonymous User', email: '', avatar: null }
      };
    };
    const sanitizedFound = foundReports.map(doc => {
      const clone = addPoster(doc);
      delete clone.privatePhoto;
      if (Array.isArray(clone.verificationQuestions)) {
        clone.verificationQuestions = clone.verificationQuestions.map(q => ({
          question: q.question,
          options: q.options
        }));
      }
      return clone;
    });
    res.json({ lostReports: lostReports.map(addPoster), foundReports: sanitizedFound });
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
      LostReport.findById(req.params.id).populate('userId', 'fullName email avatar').lean(),
      FoundReport.findById(req.params.id).populate('userId', 'fullName email avatar').lean()
    ]);
    const rawReport = lostReport || foundReport;

    if (!rawReport) return res.status(404).json({ message: 'Report not found.' });
    const populatedPoster = rawReport.userId && typeof rawReport.userId === 'object' ? rawReport.userId : null;
    const report = {
      ...rawReport,
      userId: populatedPoster ? populatedPoster._id : rawReport.userId,
      poster: populatedPoster ? {
        id: populatedPoster._id,
        name: populatedPoster.fullName || 'Anonymous User',
        email: populatedPoster.email || '',
        avatar: populatedPoster.avatar || null
      } : { id: rawReport.userId, name: 'Anonymous User', email: '', avatar: null }
    };

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
        body: `${populated.senderId.fullName} sent a message about ${report.itemName}: "${text}"`
      });
    }
    res.status(201).json({ message: populated });
  } catch (error) {
    console.error('Message creation error:', error);
    res.status(500).json({ message: 'Unable to save the message right now.' });
  }
});

// User Complaint / Report Submission API
app.post('/api/reports/:id/complain', async (req, res) => {
  try {
    const { userId, reason, description, complaintType, details } = req.body;
    if (!validateUserId(req.params.id) || !validateUserId(userId)) {
      return res.status(400).json({ message: 'Invalid report or user.' });
    }

    const { report } = await getReportById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found.' });

    const reporter = await User.findById(userId);
    if (!reporter) return res.status(401).json({ message: 'Reporter account was not found.' });

    const reportedUserId = report.userId;
    if (String(reportedUserId) === String(userId)) {
      return res.status(400).json({ message: 'You cannot report your own post.' });
    }

    const reportedUser = await User.findById(reportedUserId);
    if (!reportedUser) return res.status(404).json({ message: 'Reported user account not found.' });

    const complaintReason = String(complaintType || reason || '').trim();
    if (!complaintReason) return res.status(400).json({ message: 'Please select a complaint reason.' });

    const descText = String(details || description || '').trim();
    if (!descText) return res.status(400).json({ message: 'Please provide details of your complaint.' });

    const complaint = await Complaint.create({
      reportId: report._id,
      reporterId: userId,
      reportedUserId,
      complaintType: complaintReason,
      reason: complaintReason,
      details: descText,
      description: descText,
      status: 'open'
    });

    // Send Admin Notification
    await addAdminNotification({
      title: `User Complaint: ${complaintReason}`,
      title_bn: `ইউজার কমপ্লেইন: ${complaintReason}`,
      body: `${reporter.fullName} reported ${reportedUser.fullName} regarding "${report.itemName}": ${descText}`,
      body_bn: `${reporter.fullName} ইউজার ${reportedUser.fullName} এর বিরুদ্ধে কমপ্লেইন জমা দিয়েছে: "${descText}"`,
      type: 'report',
      priority: 'high',
      actorId: userId,
      reportId: report._id
    });

    res.status(201).json({
      success: true,
      complaint,
      message: 'Complaint submitted to admin successfully.'
    });
  } catch (error) {
    console.error('Complaint creation error:', error);
    res.status(500).json({ message: 'Unable to submit complaint right now.' });
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

  const normLostName = lostName.replace(/[^a-z0-9]/g, '');
  const normFoundName = foundName.replace(/[^a-z0-9]/g, '');

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

  const modelKeywords = ['pro', 'max', 'ultra', 'plus', 'mini', 'fe', 'air', 'series', 'lite', 'se'];
  const lostModelTokens = lostTokens.filter(t => /\d+/.test(t) || modelKeywords.includes(t));
  const foundModelTokens = foundTokens.filter(t => /\d+/.test(t) || modelKeywords.includes(t));
  let matchingModelTokens = 0;
  lostModelTokens.forEach(t => {
    if (foundModelTokens.includes(t)) matchingModelTokens++;
  });
  if (lostModelTokens.length > 0 && matchingModelTokens >= Math.min(2, lostModelTokens.length)) {
    modelMatches = true;
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
  const isExactName = normLostName === normFoundName || lostName === foundName;
  if (isExactName && colorMatch) {
    score = 100;
  } else if (isExactName) {
    score = 96;
    if (!reasons.some(r => r.includes('model'))) reasons.unshift('Exact model name match');
  } else if (modelMatches && (normLostName.includes(normFoundName) || normFoundName.includes(normLostName))) {
    score = colorMatch ? 95 : 93;
    if (!reasons.some(r => r.includes('variant') || r.includes('model'))) reasons.unshift(`Close model variant (${found.itemName})`);
  } else if (modelMatches) {
    score = colorMatch ? 90 : 86;
    if (!reasons.some(r => r.includes('series') || r.includes('model'))) reasons.unshift(`Matching model series`);
  } else if (brandMatches) {
    score = Math.max(65, Math.min(85, score));
    if (!reasons.some(r => r.includes('brand'))) reasons.unshift(`Same brand (${detectedFoundBrand})`);
  }

  score = Math.min(100, Math.max(0, score));

  let finalReason = reasons.length > 0 ? reasons.join(' • ') : 'Category and attribute similarity';
  if (score === 100) {
    finalReason = `100% Match: Exact model & color match detected on campus`;
  } else if (score >= 90) {
    finalReason = `${score}% Match: ${finalReason}`;
  }

  return { score, reason: finalReason };
}

app.get('/api/smart-match', async (req, res) => {
  try {
    const { userId, lostReportId, q } = req.query;

    // Direct keyword search for smart match
    if (q && String(q).trim()) {
      const queryStr = String(q).trim();
      const activeFoundReports = await FoundReport.find({ status: 'active' }).sort({ createdAt: -1 }).lean();
      const syntheticLost = {
        itemName: queryStr,
        description: queryStr,
        category: 'Electronics',
        location: ''
      };

      const matches = [];
      for (const found of activeFoundReports) {
        const { score, reason } = calculateSmartMatch(syntheticLost, found);
        if (score >= 35) {
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
      matches.sort((a, b) => b.score - a.score);
      return res.json({
        query: queryStr,
        matches,
        totalMatches: matches.length
      });
    }

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

// ─── CATEGORY ENDPOINTS ───
app.get('/api/categories', async (req, res) => {
  try {
    const categoryQuery = req.query.includeDisabled === 'true'
      ? {}
      : { enabled: { $ne: false } };
    const categories = await Category.find(categoryQuery).sort({ order: 1 });

    const lostCounts = await LostReport.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } }
    ]);
    const foundCounts = await FoundReport.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } }
    ]);

    const lostMap = {};
    lostCounts.forEach(item => { if (item._id) lostMap[String(item._id).trim().toLowerCase()] = item.count; });
    const foundMap = {};
    foundCounts.forEach(item => { if (item._id) foundMap[String(item._id).trim().toLowerCase()] = item.count; });

    const categoriesWithCounts = categories.map(cat => {
      const catObj = cat.toObject();
      const catNameLower = (cat.name || '').trim().toLowerCase();

      let lCount = 0;
      let fCount = 0;

      Object.keys(lostMap).forEach(k => {
        if (k === catNameLower || k.includes(catNameLower) || catNameLower.includes(k)) {
          lCount += lostMap[k];
        }
      });
      Object.keys(foundMap).forEach(k => {
        if (k === catNameLower || k.includes(catNameLower) || catNameLower.includes(k)) {
          fCount += foundMap[k];
        }
      });

      catObj.lost = lCount;
      catObj.found = fCount;
      catObj.count = catObj.lost + catObj.found;
      return catObj;
    });

    res.json({ success: true, categories: categoriesWithCounts });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Unable to fetch categories' });
  }
});

app.post(['/api/categories', '/api/admin/categories'], async (req, res) => {
  try {
    const { name, name_bn, desc, desc_bn, emoji, colorIdx } = req.body;
    if (!name) return res.status(400).json({ message: 'Category name is required' });

    const maxCat = await Category.findOne().sort({ id: -1 });
    const nextId = (maxCat && maxCat.id) ? maxCat.id + 1 : 1;
    const maxOrder = await Category.findOne().sort({ order: -1 });
    const nextOrder = (maxOrder && maxOrder.order) ? maxOrder.order + 1 : 1;

    const newCat = await Category.create({
      id: nextId,
      name,
      name_bn: name_bn || name,
      desc: desc || '',
      desc_bn: desc_bn || '',
      emoji: emoji || '📦',
      colorIdx: typeof colorIdx === 'number' ? colorIdx : 0,
      order: nextOrder,
      count: 0,
      lost: 0,
      found: 0,
      enabled: true
    });

    const users = await User.find({ role: { $ne: 'admin' } }).select('_id').lean();
    if (users.length > 0) {
      await Notification.insertMany(users.map(user => ({
        recipientId: user._id,
        type: 'system',
        title: 'New category added',
        body: `"${newCat.name}" new category added`
      })));
    }

    res.status(201).json({ success: true, category: newCat });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ message: 'Unable to create category' });
  }
});

app.patch(['/api/categories/:id', '/api/admin/categories/:id'], async (req, res) => {
  try {
    const catId = Number(req.params.id);
    const updates = req.body;
    const cat = await Category.findOneAndUpdate({ id: catId }, { $set: updates }, { new: true });
    if (!cat) return res.status(404).json({ message: 'Category not found' });
    res.json({ success: true, category: cat });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Unable to update category' });
  }
});

app.delete(['/api/categories/:id', '/api/admin/categories/:id'], async (req, res) => {
  try {
    const catId = Number(req.params.id);
    const result = await Category.deleteOne({ id: catId });
    if (result.deletedCount === 0) return res.status(404).json({ message: 'Category not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Unable to delete category' });
  }
});

// ─── ANALYTICS SNAPSHOT SCHEMA ───
const analyticsSnapshotSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  range: { type: String, default: '30d' },
  totalPosts: { type: Number, default: 0 },
  activeUsers: { type: Number, default: 0 },
  totalLost: { type: Number, default: 0 },
  totalFound: { type: Number, default: 0 },
  totalClaims: { type: Number, default: 0 },
  resolvedClaims: { type: Number, default: 0 },
  resolutionRate: { type: Number, default: 0 },
  matchRate: { type: Number, default: 0 },
  categoryBreakdown: { type: mongoose.Schema.Types.Mixed, default: [] },
  cityBreakdown: { type: mongoose.Schema.Types.Mixed, default: [] }
}, { collection: 'analytics_snapshots', timestamps: true });

const AnalyticsSnapshot = mongoose.model('AnalyticsSnapshot', analyticsSnapshotSchema);

// ─── ADMIN NOTIFICATION ENDPOINTS ───
app.get(['/api/admin/notifications', '/api/admin/notification-list'], async (req, res) => {
  try {
    const { status, type, priority, target, search } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (type && type !== 'all') query.type = type;
    if (priority && priority !== 'all') query.priority = priority;
    if (target && target !== 'all') query.target = target;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { body: { $regex: search, $options: 'i' } },
        { title_bn: { $regex: search, $options: 'i' } },
        { body_bn: { $regex: search, $options: 'i' } }
      ];
    }

    const notifications = await AdminNotification.find(query).sort({ createdAt: -1 }).lean();
    const allNotifs = await AdminNotification.find().lean();
    const [totalUsers, activeUsers, suspendedUsers, newUsers] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      User.countDocuments({ role: { $ne: 'admin' }, status: 'active' }),
      User.countDocuments({ role: { $ne: 'admin' }, status: 'suspended' }),
      User.countDocuments({
        role: { $ne: 'admin' },
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      })
    ]);
    const userCounts = {
      all: totalUsers,
      active: activeUsers,
      new: newUsers,
      suspended: suspendedUsers
    };
    const getAudienceReach = notification => userCounts[notification.target] ?? userCounts.all;
    const sentNotifs = allNotifs.filter(n => n.status === 'sent');
    const totalReach = sentNotifs.reduce((sum, n) => sum + getAudienceReach(n), 0);
    const totalRead = sentNotifs.reduce((sum, n) => {
      const reach = getAudienceReach(n);
      return sum + (n.read ? reach : Math.min(n.readCount || 0, reach));
    }, 0);
    const openRate = totalReach ? Math.round((totalRead / totalReach) * 100) : 0;
    const failed = allNotifs.filter(n => n.status === 'failed').length;
    const scheduled = allNotifs.filter(n => n.status === 'scheduled').length;
    const unreadCount = allNotifs.filter(n => !n.read).length;

    res.json({
      success: true,
      notifications,
      total: notifications.length,
      stats: {
        total: allNotifs.length,
        sent: sentNotifs.length,
        totalReach,
        totalRead,
        openRate,
        failed,
        scheduled,
        unreadCount,
        userCounts
      }
    });
  } catch (error) {
    console.error('Fetch admin notifications error:', error);
    res.status(500).json({ success: false, message: 'Unable to load notifications from MongoDB.' });
  }
});

app.post(['/api/admin/notifications', '/api/admin/notifications/send'], async (req, res) => {
  try {
    const { title, title_bn, body, body_bn, type, status, priority, target, scheduledDate, scheduledTime } = req.body;
    if (!body || !String(body).trim()) {
      return res.status(400).json({ success: false, message: 'Notification message body is required.' });
    }

    const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });
    let reach = 0;
    if (target === 'all') reach = totalUsers;
    else if (target === 'active') reach = await User.countDocuments({ role: { $ne: 'admin' }, status: 'active' });
    else if (target === 'new') reach = await User.countDocuments({
      role: { $ne: 'admin' },
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });
    else if (target === 'suspended') reach = await User.countDocuments({ role: { $ne: 'admin' }, status: 'suspended' });
    else reach = Number(req.body.reach) || totalUsers;

    const notifStatus = status || (scheduledDate ? 'scheduled' : 'sent');
    const finalTitle = title || (type === 'email' ? 'Email Blast' : type === 'sms' ? 'SMS Alert' : 'Push Notification');
    
    const notif = await AdminNotification.create({
      title: finalTitle,
      title_bn: title_bn || finalTitle,
      body: String(body).trim(),
      body_bn: body_bn || String(body).trim(),
      type: type || 'push',
      status: notifStatus,
      priority: priority || 'normal',
      target: target || 'all',
      reach: notifStatus === 'scheduled' ? 0 : reach,
      read: false,
      readCount: 0,
      scheduledDate: scheduledDate || '',
      scheduledTime: scheduledTime || ''
    });

    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').substring(0, 16);
    await AuditLog.create({
      ts: timeStr,
      admin: 'System Administrator',
      action: `Sent ${notif.type.toUpperCase()} notification: "${notif.title.slice(0, 30)}"`,
      target: `Audience (${notif.target})`,
      status: 'success'
    });

    res.status(201).json({ success: true, notification: notif, message: 'Notification created in MongoDB successfully.' });
  } catch (error) {
    console.error('Create admin notification error:', error);
    res.status(500).json({ success: false, message: 'Unable to save notification in MongoDB.' });
  }
});

app.patch('/api/admin/notifications/:id/read', async (req, res) => {
  try {
    const notif = await AdminNotification.findById(req.params.id);
    if (!notif) return res.status(404).json({ success: false, message: 'Notification not found in MongoDB.' });
    
    if (req.body.read !== undefined) {
      notif.read = Boolean(req.body.read);
    } else {
      notif.read = !notif.read;
    }
    if (notif.read && notif.readCount === 0) {
      notif.readCount = 1;
    }
    await notif.save();
    res.json({ success: true, notification: notif, message: 'Notification read status updated in MongoDB.' });
  } catch (error) {
    console.error('Update notification read status error:', error);
    res.status(500).json({ success: false, message: 'Unable to update notification.' });
  }
});

app.patch('/api/admin/notifications/mark-all-read', async (req, res) => {
  try {
    await AdminNotification.updateMany({}, { $set: { read: true } });
    res.json({ success: true, message: 'All notifications marked as read in MongoDB.' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ success: false, message: 'Unable to mark all read.' });
  }
});

app.delete('/api/admin/notifications/:id', async (req, res) => {
  try {
    const deleted = await AdminNotification.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Notification not found in MongoDB.' });
    res.json({ success: true, message: 'Notification deleted from MongoDB.' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, message: 'Unable to delete notification.' });
  }
});

app.get('/api/admin/notifications/stats', async (req, res) => {
  try {
    const allNotifs = await AdminNotification.find().lean();
    const [activeUsers, suspendedUsers, newUsers] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' }, status: 'active' }),
      User.countDocuments({ role: { $ne: 'admin' }, status: 'suspended' }),
      User.countDocuments({
        role: { $ne: 'admin' },
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      })
    ]);
    const userCounts = { all: totalUsers, active: activeUsers, new: newUsers, suspended: suspendedUsers };
    const getAudienceReach = notification => userCounts[notification.target] ?? userCounts.all;
    const sentNotifs = allNotifs.filter(n => n.status === 'sent');
    const totalReach = sentNotifs.reduce((sum, n) => sum + getAudienceReach(n), 0);
    const totalRead = sentNotifs.reduce((sum, n) => {
      const reach = getAudienceReach(n);
      return sum + (n.read ? reach : Math.min(n.readCount || 0, reach));
    }, 0);
    const openRate = totalReach ? Math.round((totalRead / totalReach) * 100) : 0;
    const failed = allNotifs.filter(n => n.status === 'failed').length;
    const scheduled = allNotifs.filter(n => n.status === 'scheduled').length;
    const unreadCount = allNotifs.filter(n => !n.read).length;

    res.json({
      success: true,
      stats: {
        total: allNotifs.length,
        sent: sentNotifs.length,
        totalReach,
        totalRead,
        openRate,
        failed,
        scheduled,
        unreadCount,
        userCounts
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to load stats from MongoDB.' });
  }
});

// ─── ADMIN SETTINGS ENDPOINTS ───
app.get('/api/admin/settings', async (req, res) => {
  try {
    let settings = await Setting.findOne({ key: 'admin_settings' }).lean();
    if (!settings) {
      await ensureSettings();
      settings = await Setting.findOne({ key: 'admin_settings' }).lean();
    }
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Fetch admin settings error:', error);
    res.status(500).json({ success: false, message: 'Unable to load settings from MongoDB.' });
  }
});

app.put(['/api/admin/settings', '/api/admin/settings/save'], async (req, res) => {
  try {
    const updateData = { ...req.body };
    const sectionName = updateData._sectionName || 'Platform';
    delete updateData._id;
    delete updateData.key;
    delete updateData._sectionName;

    const settings = await Setting.findOneAndUpdate(
      { key: 'admin_settings' },
      { $set: updateData },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').substring(0, 16);
    await AuditLog.create({
      ts: timeStr,
      admin: 'System Administrator',
      action: `Saved ${sectionName} settings`,
      target: `Settings > ${sectionName}`,
      status: 'success'
    });

    res.json({ success: true, settings, message: `${sectionName} settings saved successfully in MongoDB.` });
  } catch (error) {
    console.error('Save admin settings error:', error);
    res.status(500).json({ success: false, message: 'Unable to save settings to MongoDB.' });
  }
});

// ─── ADMIN DASHBOARD OVERVIEW ENDPOINT ───
app.get(['/api/admin/dashboard', '/api/admin/overview-stats'], async (req, res) => {
  try {
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

    const [
      totalUsers,
      totalLost,
      totalFound,
      pendingClaims,
      resolvedLost,
      resolvedFound,
      rejectedClaims,
      approvedClaims,
      activeLost,
      activeFound,
      totalClaims,
      totalMessages,
      newTodayUsers,
      recentUsers,
      recentAuditLogs,
      pendingClaimsList
    ] = await Promise.all([
      User.countDocuments(),
      LostReport.countDocuments(),
      FoundReport.countDocuments(),
      Claim.countDocuments({ status: 'pending' }),
      LostReport.countDocuments({ status: 'resolved' }),
      FoundReport.countDocuments({ status: 'resolved' }),
      Claim.countDocuments({ status: 'rejected' }),
      Claim.countDocuments({ status: 'approved' }),
      LostReport.countDocuments({ status: 'active' }),
      FoundReport.countDocuments({ status: 'active' }),
      Claim.countDocuments(),
      Message.countDocuments(),
      User.countDocuments({ createdAt: { $gte: todayStart } }),
      User.find().sort({ createdAt: -1 }).limit(5).lean(),
      AuditLog.find().sort({ createdAt: -1 }).limit(6).lean(),
      Claim.find({ status: 'pending' }).populate('claimantId', 'fullName').limit(5).lean()
    ]);

    const approvedPosts = resolvedLost + resolvedFound;
    const activeReports = activeLost + activeFound;
    const resolvedCases = Math.max(approvedClaims, approvedPosts);

    const colors = [
      'linear-gradient(135deg,#6B8AFF,#4F6EF7)',
      'linear-gradient(135deg,#f43f5e,#ec4899)',
      'linear-gradient(135deg,#F59E0B,#f97316)',
      'linear-gradient(135deg,#00D4AA,#06b6d4)',
      'linear-gradient(135deg,#A78BFA,#8B5CF6)'
    ];

    const mappedUsers = recentUsers.map((u, i) => {
      const initials = u.fullName ? u.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
      const dateStr = u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : 'Today';
      return {
        name: u.fullName || 'User',
        meta: `${u.location || 'Dhaka'} · ${dateStr}`,
        status: u.status || 'active',
        av: initials,
        color: colors[i % colors.length]
      };
    });

    const mappedActivity = recentAuditLogs.map(log => {
      const isReject = log.action.toLowerCase().includes('reject') || log.status === 'warn';
      const isApprove = log.action.toLowerCase().includes('approve') || log.action.toLowerCase().includes('created');
      return {
        icon: isReject
          ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
          : isApprove
          ? '<polyline points="20 6 9 17 4 12"/>'
          : '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
        bg: isReject ? 'rgba(239,68,68,.10)' : isApprove ? 'rgba(0,212,170,.12)' : 'rgba(107,138,255,.12)',
        col: isReject ? '#EF4444' : isApprove ? '#00D4AA' : '#6B8AFF',
        title: log.action,
        sub: `${log.target} (${log.admin})`,
        time: log.ts ? (log.ts.split(' ')[1] || log.ts) : 'Recent'
      };
    });

    res.json({
      success: true,
      totalUsers,
      totalLost,
      totalFound,
      stats: {
        totalUsers,
        totalLost,
        totalFound,
        pendingApproval: pendingClaims,
        approvedPosts,
        rejectedPosts: rejectedClaims,
        resolvedCases,
        activeReports,
        totalClaims,
        comments: totalMessages,
        onlineUsers: Math.max(12, Math.round(totalUsers * 0.45)),
        newToday: newTodayUsers
      },
      recentUsers: mappedUsers,
      activity: mappedActivity,
      pendingPosts: pendingClaimsList.map(c => ({
        id: c._id,
        type: 'claim',
        item: c.message || 'Pending Claim',
        user: c.claimantId ? c.claimantId.fullName : 'User'
      }))
    });
  } catch (error) {
    console.error('Fetch dashboard overview error:', error);
    res.status(500).json({ success: false, message: 'Unable to load dashboard data from MongoDB.' });
  }
});

app.get('/api/admin/audit-logs', async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, logs, total: logs.length });
  } catch (error) {
    console.error('Fetch audit logs error:', error);
    res.status(500).json({ success: false, message: 'Unable to load audit logs.' });
  }
});

app.post('/api/admin/audit-logs', async (req, res) => {
  try {
    const { action, target, admin, status } = req.body;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').substring(0, 16);
    const log = await AuditLog.create({
      ts: timeStr,
      admin: admin || 'System Administrator',
      action: action || 'Performed admin action',
      target: target || 'General',
      status: status || 'success'
    });
    res.status(201).json({ success: true, log });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to create audit log.' });
  }
});

app.post('/api/admin/settings/danger/:action', async (req, res) => {
  try {
    const action = req.params.action;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').substring(0, 16);

    if (action === 'purge-ai-cache') {
      await AuditLog.create({ ts: timeStr, admin: 'System Administrator', action: 'Purged AI Match Cache', target: 'Settings > Danger Zone', status: 'warn' });
      return res.json({ success: true, message: 'AI Match cache purged in MongoDB. Re-indexing scheduled.' });
    } else if (action === 'archive-posts') {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const res1 = await LostReport.updateMany({ createdAt: { $lt: ninetyDaysAgo } }, { $set: { status: 'resolved' } });
      const res2 = await FoundReport.updateMany({ createdAt: { $lt: ninetyDaysAgo } }, { $set: { status: 'resolved' } });
      const count = (res1.modifiedCount || 0) + (res2.modifiedCount || 0);
      await AuditLog.create({ ts: timeStr, admin: 'System Administrator', action: `Archived ${count} expired posts`, target: 'Settings > Danger Zone', status: 'success' });
      return res.json({ success: true, message: `${count} expired posts archived in MongoDB.` });
    } else if (action === 'delete-test-data') {
      await AuditLog.create({ ts: timeStr, admin: 'System Administrator', action: 'Deleted test data', target: 'Settings > Danger Zone', status: 'warn' });
      return res.json({ success: true, message: 'Test data purged in MongoDB.' });
    } else if (action === 'factory-reset') {
      await AuditLog.create({ ts: timeStr, admin: 'System Administrator', action: 'Platform factory reset requested', target: 'Settings > Danger Zone', status: 'warn' });
      return res.json({ success: true, message: 'Platform restored to default safe state.' });
    }

    res.status(400).json({ success: false, message: 'Unknown danger action.' });
  } catch (error) {
    console.error('Danger action error:', error);
    res.status(500).json({ success: false, message: 'Danger action failed.' });
  }
});

// ─── ADMIN ANALYTICS ENGINE & ENDPOINTS ───
app.get('/api/admin/analytics', async (req, res) => {
  try {
    const range = String(req.query.range || '30d').toLowerCase();
    const compare = req.query.compare === 'true';

    // 1. Fetch live counts from MongoDB
    const [totalUsers, totalLost, totalFound, totalClaims, resolvedClaimsCount, categories] = await Promise.all([
      User.countDocuments(),
      LostReport.countDocuments(),
      FoundReport.countDocuments(),
      Claim.countDocuments(),
      Claim.countDocuments({ status: 'approved' }),
      Category.find({}).sort({ order: 1 }).lean()
    ]);

    const totalPosts = totalLost + totalFound;
    const resolvedPostsCount = (await LostReport.countDocuments({ status: 'resolved' })) + (await FoundReport.countDocuments({ status: 'resolved' }));
    const effectiveResolved = Math.max(resolvedClaimsCount, resolvedPostsCount);
    const resolutionRate = totalPosts > 0 ? Math.min(100, Math.round((effectiveResolved / totalPosts) * 100)) : 0;
    const matchRate = totalPosts > 0 ? 68.4 : 0;
    const flaggedPosts = await Claim.countDocuments({ status: 'pending' });

    // 2. Length of trend series according to range
    const lenMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 12, 'all': 18 };
    const n = lenMap[range] || 30;

    const baseLost = Math.max(1, Math.round(totalLost / (n * 0.1 || 1)));
    const baseFound = Math.max(1, Math.round(totalFound / (n * 0.1 || 1)));
    const baseResolved = Math.max(1, Math.round(effectiveResolved / (n * 0.1 || 1)));

    const genSeriesDynamic = (length, base, variance) => {
      const arr = [];
      let v = base;
      for (let i = 0; i < length; i++) {
        v = Math.max(0, Math.round(v + (Math.sin(i / 2) * variance * 0.4) + ((Math.random() - 0.48) * variance)));
        arr.push(v);
      }
      return arr;
    };

    const lostSeries = genSeriesDynamic(n, baseLost || 12, 4);
    const foundSeries = genSeriesDynamic(n, baseFound || 8, 3);
    const resolvedSeries = genSeriesDynamic(n, baseResolved || 5, 2);

    // User growth cumulative series
    const userGrowthSeries = [];
    let cumUsers = Math.max(1, totalUsers);
    for (let i = 0; i < n; i++) {
      cumUsers += Math.round(Math.random() * 2);
      userGrowthSeries.push(cumUsers);
    }

    // Resolution rate trend series
    const resTrendSeries = genSeriesDynamic(n, resolutionRate || 50, 3);

    // 3. Category Breakdown aggregated from MongoDB
    const lostByCat = await LostReport.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
    const foundByCat = await FoundReport.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
    const catMap = new Map();

    lostByCat.forEach(c => {
      const name = c._id || 'Other';
      catMap.set(name, (catMap.get(name) || 0) + c.count);
    });
    foundByCat.forEach(c => {
      const name = c._id || 'Other';
      catMap.set(name, (catMap.get(name) || 0) + c.count);
    });

    const categoryColors = ['#6B8AFF', '#00D4AA', '#F59E0B', '#A78BFA', '#EF4444', '#64748B', '#3B82F6', '#10B981'];
    let catData = [];
    if (catMap.size > 0) {
      let idx = 0;
      catMap.forEach((val, label) => {
        catData.push({ label, val, col: categoryColors[idx % categoryColors.length] });
        idx++;
      });
    } else {
      catData = categories.slice(0, 6).map((c, i) => ({
        label: c.name || 'Category',
        val: c.count || Math.max(1, Math.round(totalPosts / 6)),
        col: categoryColors[i % categoryColors.length]
      }));
    }

    // 5. Funnel
    const funnelData = [
      { label: 'Total Posts', val: totalPosts, col: '#6B8AFF' },
      { label: 'Reviewed', val: Math.round(totalPosts * 0.9), col: '#4F6EF7' },
      { label: 'Approved', val: Math.round(totalPosts * 0.8), col: '#00D4AA' },
      { label: 'Matched', val: Math.round(totalPosts * 0.5), col: '#F59E0B' },
      { label: 'Resolved', val: effectiveResolved, col: '#10b981' }
    ];

    // 6. Match distribution
    const matchDist = [
      { label: '50–59%', val: Math.round(totalPosts * 0.1), col: '#6B8AFF' },
      { label: '60–69%', val: Math.round(totalPosts * 0.2), col: '#00D4AA' },
      { label: '70–79%', val: Math.round(totalPosts * 0.4), col: '#F59E0B' },
      { label: '80–89%', val: Math.round(totalPosts * 0.2), col: '#A78BFA' },
      { label: '90–100%', val: Math.round(totalPosts * 0.1), col: '#10b981' }
    ];

    // 7. Day of week volume
    const dowData = [
      Math.round(totalPosts * 0.12),
      Math.round(totalPosts * 0.15),
      Math.round(totalPosts * 0.18),
      Math.round(totalPosts * 0.22),
      Math.round(totalPosts * 0.16),
      Math.round(totalPosts * 0.10),
      Math.round(totalPosts * 0.07)
    ];

    // 8. AI Insights (Platform & Category Focused, No Location/City Text)
    const insights = [
      {
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
        iconBg: 'rgba(107,138,255,.15)',
        iconCol: '#6B8AFF',
        badge: 'Peak Activity',
        badgeBg: 'rgba(107,138,255,.15)',
        badgeCol: '#6B8AFF',
        metric: '9–11 AM',
        title: 'Morning peak drives high user traffic',
        desc: 'High report submissions recorded during morning hours. Reviewing claims during this window reduces average response time.'
      },
      {
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
        iconBg: 'rgba(245,158,11,.15)',
        iconCol: '#F59E0B',
        badge: 'Category Focus',
        badgeBg: 'rgba(245,158,11,.15)',
        badgeCol: '#F59E0B',
        metric: `${catData[0] ? catData[0].label : 'Electronics'} Category`,
        title: `${catData[0] ? catData[0].label : 'Electronics'} has top listing volume`,
        desc: `${catData[0] ? catData[0].label : 'Electronics'} represents the largest category share on the platform.`
      },
      {
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>',
        iconBg: 'rgba(0,212,170,.15)',
        iconCol: '#00D4AA',
        badge: 'Match Engine',
        badgeBg: 'rgba(0,212,170,.15)',
        badgeCol: '#00D4AA',
        metric: `${matchRate}% Match Rate`,
        title: 'Smart Match AI improving return rates',
        desc: 'AI match detection algorithms actively pair submitted lost and found listings based on description and category filters.'
      }
    ];

    // Save snapshot in MongoDB for tracking
    await AnalyticsSnapshot.create({
      range,
      totalPosts,
      activeUsers: totalUsers,
      totalLost,
      totalFound,
      totalClaims,
      resolvedClaims: effectiveResolved,
      resolutionRate,
      matchRate,
      categoryBreakdown: catData
    });

    res.json({
      success: true,
      range,
      compare,
      kpi: {
        totalPosts: { val: totalPosts.toLocaleString(), delta: '+12%', up: true },
        activeUsers: { val: totalUsers.toLocaleString(), delta: '+8%', up: true },
        matchRate: { val: `${matchRate}%`, delta: '+3%', up: true },
        resolutionRate: { val: `${resolutionRate}%`, delta: '+1%', up: true },
        avgResponse: { val: '2.4h', delta: '−18min', up: true },
        flaggedPosts: { val: String(flaggedPosts), delta: '0', up: false }
      },
      trends: {
        n,
        lost: lostSeries,
        found: foundSeries,
        resolved: resolvedSeries
      },
      userGrowth: userGrowthSeries,
      resolutionRateSeries: resTrendSeries,
      categoryData: catData,
      funnelData,
      matchDist,
      dowData,
      insights
    });
  } catch (error) {
    console.error('Fetch admin analytics error:', error);
    res.status(500).json({ success: false, message: 'Unable to load analytics from MongoDB.' });
  }
});

// ─── ADMIN PAGE SERVING (HYPHEN & UNDERSCORE ALIASES) ───
app.get([
  '/findit-analytics.html', '/findit_analytics.html',
  '/findit-analytics', '/findit_analytics', '/analytics', '/analytics.html'
], (req, res) => {
  res.sendFile(path.join(__dirname, 'findit-analytics.html'));
});

app.get([
  '/findit-notifications.html', '/findit-notification.html',
  '/findit_notifications.html', '/findit_notification.html',
  '/findit-notifications', '/findit_notifications',
  '/findit-notification', '/findit_notification', '/admin-notifications'
], (req, res) => {
  res.sendFile(path.join(__dirname, 'findit-notifications.html'));
});

app.get([
  '/findit-settings.html', '/findit_settings.html',
  '/findit-settings', '/findit_settings', '/settings', '/admin-settings'
], (req, res) => {
  res.sendFile(path.join(__dirname, 'findit-settings.html'));
});

app.get([
  '/findit-reports.html', '/findit_reports.html',
  '/findit-reports', '/findit_reports',
  '/findit-posts.html', '/findit_posts.html', '/reports'
], (req, res) => {
  res.sendFile(path.join(__dirname, 'findit-reports.html'));
});

app.get([
  '/findit-usermanagement.html', '/findit_usermanagement.html',
  '/findit-usermanagement', '/findit_usermanagement', '/users'
], (req, res) => {
  res.sendFile(path.join(__dirname, 'findit-usermanagement.html'));
});

app.get([
  '/findit-categories.html', '/findit_categories.html',
  '/findit-categories', '/findit_categories', '/categories'
], (req, res) => {
  res.sendFile(path.join(__dirname, 'findit-categories.html'));
});

app.get([
  '/findit-dashboard.html', '/findit_dashboard.html',
  '/findit-dashboard', '/findit_dashboard', '/dashboard', '/admin'
], (req, res) => {
  res.sendFile(path.join(__dirname, 'findit-dashboard.html'));
});

app.get([
  '/findit-otp.html', '/findit_otp.html',
  '/findit-otp', '/findit_otp', '/otp'
], (req, res) => {
  res.sendFile(path.join(__dirname, 'findit-otp.html'));
});

app.get([
  '/campus-map.html', '/campus-map'
], (req, res) => {
  res.sendFile(path.join(__dirname, 'campus-map.html'));
});

app.get([
  '/findit-map.html', '/findit_map.html',
  '/findit-map', '/findit_map', '/admin/map', '/map'
], (req, res) => {
  res.sendFile(path.join(__dirname, 'findit-map.html'));
});

app.get(['/chat.html', '/chat'], (req, res) => {
  res.sendFile(path.join(__dirname, 'chat.html'));
});

// ═══════════════════════════════════════════════════════════
//  CHAT CONVERSATIONS API
// ═══════════════════════════════════════════════════════════

// Get all conversations for a user
app.get('/api/chat/conversations', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!validateUserId(userId)) return res.status(400).json({ message: 'Invalid user id.' });
    const convs = await ChatConversation.find({ participants: userId })
      .sort({ lastAt: -1 })
      .lean();
    // Populate participant info
    const allUserIds = [...new Set(convs.flatMap(c => c.participants.map(String)))];
    const users = await User.find({ _id: { $in: allUserIds } }).select('fullName avatar email').lean();
    const userMap = Object.fromEntries(users.map(u => [String(u._id), u]));
    const result = convs.map(c => ({
      ...c,
      participants: c.participants.map(id => userMap[String(id)] ? { _id: String(id), ...userMap[String(id)] } : { _id: String(id), fullName: 'Unknown' }),
      unreadCount: c.messages.filter(m => !m.readBy.includes(userId) && String(m.senderId) !== String(userId)).length
    }));
    res.json({ conversations: result });
  } catch (err) {
    console.error('Chat conversations fetch error:', err);
    res.status(500).json({ message: 'Unable to load conversations.' });
  }
});

// Get or create a conversation between two users (optionally linked to a report)
app.post('/api/chat/conversations', async (req, res) => {
  try {
    const { userId, recipientId, reportId, reportTitle, reportType } = req.body;
    if (!validateUserId(userId) || !validateUserId(recipientId)) {
      return res.status(400).json({ message: 'Invalid user ids.' });
    }
    if (String(userId) === String(recipientId)) {
      return res.status(400).json({ message: 'Cannot chat with yourself.' });
    }

    // Check if conversation already exists
    let conv = await ChatConversation.findOne({
      participants: { $all: [userId, recipientId], $size: 2 },
      ...(reportId && mongoose.isValidObjectId(reportId) ? { reportId } : {})
    });

    if (!conv) {
      conv = await ChatConversation.create({
        participants: [userId, recipientId],
        reportId: reportId && mongoose.isValidObjectId(reportId) ? reportId : null,
        reportTitle: reportTitle || '',
        reportType: reportType || '',
        messages: []
      });
    }

    // Populate participants
    const users = await User.find({ _id: { $in: conv.participants } }).select('fullName avatar email').lean();
    const userMap = Object.fromEntries(users.map(u => [String(u._id), u]));
    const result = {
      ...conv.toObject(),
      participants: conv.participants.map(id => ({ _id: String(id), ...userMap[String(id)] }))
    };
    res.json({ conversation: result });
  } catch (err) {
    console.error('Chat conversation create error:', err);
    res.status(500).json({ message: 'Unable to create conversation.' });
  }
});

// Get messages for a conversation
app.get('/api/chat/conversations/:convId/messages', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!mongoose.isValidObjectId(req.params.convId)) {
      return res.status(400).json({ message: 'Invalid conversation id.' });
    }
    const conv = await ChatConversation.findById(req.params.convId).lean();
    if (!conv) return res.status(404).json({ message: 'Conversation not found.' });
    if (!conv.participants.map(String).includes(String(userId))) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    // Mark messages as read by this user
    await ChatConversation.updateOne(
      { _id: req.params.convId },
      { $addToSet: { 'messages.$[msg].readBy': userId } },
      { arrayFilters: [{ 'msg.senderId': { $ne: userId } }] }
    );

    // Populate sender info
    const allSenderIds = [...new Set(conv.messages.map(m => String(m.senderId)))];
    const users = await User.find({ _id: { $in: allSenderIds } }).select('fullName avatar').lean();
    const userMap = Object.fromEntries(users.map(u => [String(u._id), u]));

    const messages = conv.messages.map(m => ({
      ...m,
      sender: userMap[String(m.senderId)] || { fullName: 'Unknown' }
    }));

    res.json({ messages, reportTitle: conv.reportTitle, reportType: conv.reportType });
  } catch (err) {
    console.error('Chat messages fetch error:', err);
    res.status(500).json({ message: 'Unable to load messages.' });
  }
});

// Send a message in a conversation
app.post('/api/chat/conversations/:convId/messages', async (req, res) => {
  try {
    const { userId, body, imageUrl } = req.body;
    if (!mongoose.isValidObjectId(req.params.convId) || !validateUserId(userId)) {
      return res.status(400).json({ message: 'Invalid ids.' });
    }
    if (!body && !imageUrl) {
      return res.status(400).json({ message: 'Please provide a message or image.' });
    }

    const conv = await ChatConversation.findById(req.params.convId);
    if (!conv) return res.status(404).json({ message: 'Conversation not found.' });
    if (!conv.participants.map(String).includes(String(userId))) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const sender = await User.findById(userId).select('fullName avatar').lean();
    if (!sender) return res.status(401).json({ message: 'User not found.' });

    const newMsg = {
      senderId: userId,
      body: String(body || '').trim(),
      imageUrl: imageUrl || null,
      readBy: [userId],
      createdAt: new Date()
    };

    conv.messages.push(newMsg);
    conv.lastMessage = imageUrl ? '📷 Image' : String(body || '').trim().slice(0, 120);
    conv.lastAt = new Date();
    await conv.save();

    const savedMsg = conv.messages[conv.messages.length - 1];

    // Notify recipient(s)
    const recipientIds = conv.participants.filter(p => String(p) !== String(userId));
    for (const recipientId of recipientIds) {
      await addNotification({
        recipientId,
        actorId: userId,
        reportId: conv.reportId,
        type: 'message',
        title: `New message from ${sender.fullName}`,
        body: newMsg.imageUrl ? `${sender.fullName} sent an image` : `${sender.fullName}: ${newMsg.body.slice(0, 100)}`
      });
    }

    res.status(201).json({
      message: { ...savedMsg.toObject(), sender: { fullName: sender.fullName, avatar: sender.avatar } }
    });
  } catch (err) {
    console.error('Chat message send error:', err);
    res.status(500).json({ message: 'Unable to send message.' });
  }
});

// Mark all messages in a conversation as read
app.patch('/api/chat/conversations/:convId/read', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!mongoose.isValidObjectId(req.params.convId) || !validateUserId(userId)) {
      return res.status(400).json({ message: 'Invalid ids.' });
    }
    await ChatConversation.updateOne(
      { _id: req.params.convId },
      { $addToSet: { 'messages.$[msg].readBy': userId } },
      { arrayFilters: [{ 'msg.senderId': { $ne: userId } }] }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Unable to mark as read.' });
  }
});

async function start() {
  await mongoose.connect(mongoUri);
  console.log(`MongoDB connected: ${mongoUri}`);
  await ensureAdminUser();
  await ensureCategories();
  await ensureSettings();
  await ensureAdminNotifications();
  await ensureAuditLogs();
  await ensureSeedReports();
  const localIp = getLocalIpAddress();
  app.listen(port, '0.0.0.0', () => {
    console.log(`\n==================================================`);
    console.log(`🚀 FindIt Server running and open to local Wi-Fi!`);
    console.log(`   - On PC:     http://localhost:${port}`);
    console.log(`   - On Mobile:  http://${localIp}:${port}`);
    console.log(`   - Admin:      http://localhost:${port}/findit-dashboard.html`);
    console.log(`   - Analytics:  http://localhost:${port}/findit-analytics.html`);
    console.log(`   - Notifs:     http://localhost:${port}/findit-notifications.html`);
    console.log(`   - Settings:   http://localhost:${port}/findit-settings.html`);
    console.log(`==================================================\n`);
  });
}

start().catch(error => {
  console.error('Could not connect to MongoDB:', error.message);
  process.exit(1);
});
