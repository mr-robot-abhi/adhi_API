require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const Case = require('../models/case.model');
const Document = require('../models/document.model');
const Event = require('../models/event.model');
const logger = require('../utils/logger');

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    logger.error('MONGO_URI is not defined');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info('MongoDB connected for seeding');
  } catch (err) {
    logger.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

const clearCollections = async () => {
  try {
    await User.deleteMany({});
    await Case.deleteMany({});
    await Document.deleteMany({});
    await Event.deleteMany({});
    logger.info('Successfully cleared collections');
  } catch (err) {
    logger.error(`Error clearing collections: ${err.message}`);
    throw err;
  }
};

const createUsers = async () => {
  const password = await bcrypt.hash('password123', 10);

  const users = await User.insertMany([
    {
      name: 'John Lawyer',
      email: 'lawyer@example.com',
      password,
      role: 'lawyer',
      phone: '9876543210',
      barCouncilNumber: 'KAR12345',
      specialization: 'Civil Law',
      yearsOfExperience: 5,
    },
    {
      name: 'Jane Client',
      email: 'client@example.com',
      password,
      role: 'client',
      phone: '9876543211',
    },
    {
      name: 'Alice Admin',
      email: 'admin@example.com',
      password,
      role: 'admin',
      phone: '9876543212',
    },
  ]);

  logger.info('Successfully created sample users');
  return users;
};

const createCases = async (users) => {
  const lawyer = users.find((u) => u.role === 'lawyer');
  const client = users.find((u) => u.role === 'client');

  const cases = await Case.insertMany([
    {
      title: 'Smith v. Johnson',
      caseNumber: 'CV-1234',
      caseType: 'civil',
      user: lawyer._id,
      client: client._id,
      petitionerNames: ['John Smith'],
      opposingPartyNames: ['Robert Johnson'],
      status: 'active',
    },
    {
      title: 'Brown v. Green Corp',
      caseNumber: 'COM-5678',
      caseType: 'commercial',
      user: lawyer._id,
      client: client._id,
      petitionerNames: ['Brown Ltd'],
      opposingPartyNames: ['Green Corp'],
      status: 'active',
    },
    {
      title: 'Miller Divorce Case',
      caseNumber: 'FAM-9876',
      caseType: 'family',
      user: lawyer._id,
      client: client._id,
      petitionerNames: ['Amy Miller'],
      opposingPartyNames: ['John Miller'],
      status: 'active',
    },
  ]);

  logger.info('Successfully created sample cases');
  return cases;
};

const createDocuments = async (users, cases) => {
  const lawyer = users.find((u) => u.role === 'lawyer');
  const client = users.find((u) => u.role === 'client');

  await Document.insertMany([
    {
      name: 'Complaint - Smith v. Johnson',
      originalName: 'complaint.pdf',
      description: 'Complaint document',
      type: 'pdf',
      mimeType: 'application/pdf',
      size: 123456,
      extension: 'pdf',
      storagePath: 'documents/complaint.pdf',
      category: 'pleading',
      status: 'active',
      case: cases[0]._id,
      caseTitle: cases[0].title,
      uploadedBy: lawyer._id,
      uploadedByName: lawyer.name,
      owner: lawyer._id,
      accessibleTo: [{ user: client._id, permission: 'view' }],
    },
    {
      name: 'Evidence - Brown Case',
      originalName: 'contract.pdf',
      description: 'Contract agreement as evidence',
      type: 'pdf',
      mimeType: 'application/pdf',
      size: 220000,
      extension: 'pdf',
      storagePath: 'documents/contract.pdf',
      category: 'evidence',
      status: 'active',
      case: cases[1]._id,
      caseTitle: cases[1].title,
      uploadedBy: lawyer._id,
      uploadedByName: lawyer.name,
      owner: lawyer._id,
      accessibleTo: [{ user: client._id, permission: 'view' }],
    },
    {
      name: 'Affidavit - Divorce',
      originalName: 'affidavit.pdf',
      description: 'Affidavit filed for divorce case',
      type: 'pdf',
      mimeType: 'application/pdf',
      size: 180000,
      extension: 'pdf',
      storagePath: 'documents/affidavit.pdf',
      category: 'affidavit',
      status: 'active',
      case: cases[2]._id,
      caseTitle: cases[2].title,
      uploadedBy: client._id,
      uploadedByName: client.name,
      owner: client._id,
      accessibleTo: [{ user: lawyer._id, permission: 'download' }],
    },
  ]);

  logger.info('Successfully created sample documents');
};

const createEvents = async (users, cases) => {
  const lawyer = users.find((u) => u.role === 'lawyer');
  const client = users.find((u) => u.role === 'client');

  const now = new Date();
  const future = (days, hour) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0);
    return d;
  };

  await Event.insertMany([
    {
      title: 'Hearing - Smith v. Johnson',
      description: 'Property dispute hearing',
      start: future(1, 10),
      end: future(1, 11),
      type: 'hearing',
      priority: 'medium',
      status: 'scheduled',
      location: 'Court Hall 1',
      case: cases[0]._id,
      caseTitle: 'Smith v. Johnson',
      caseNumber: cases[0].caseNumber,
      createdBy: lawyer._id,
      participants: [
        { user: lawyer._id, role: 'lawyer', status: 'confirmed' },
        { user: client._id, role: 'client', status: 'invited' },
      ],
      reminders: [{ method: 'email', minutesBefore: 60 }],
    },
    {
      title: 'Evidence Submission - Brown Case',
      description: 'Submit all documents before this date',
      start: future(2, 14),
      end: future(2, 15),
      type: 'evidence_submission',
      status: 'scheduled',
      case: cases[1]._id,
      caseTitle: cases[1].title,
      caseNumber: cases[1].caseNumber, // Fixed typo
      createdBy: lawyer._id,
      participants: [{ user: lawyer._id, role: 'lawyer', status: 'confirmed' }],
      reminders: [{ method: 'email', minutesBefore: 90 }],
    },
    {
      title: 'Client Meeting - Divorce Prep',
      description: 'Discuss settlement strategies',
      start: future(3, 16),
      end: future(3, 17),
      type: 'client_meeting',
      isVirtual: true,
      meetingLink: 'https://meet.example.com/divorce',
      status: 'scheduled',
      createdBy: client._id,
      participants: [
        { user: lawyer._id, role: 'lawyer', status: 'invited' },
        { user: client._id, role: 'client', status: 'confirmed' },
      ],
      reminders: [{ method: 'email', minutesBefore: 30 }],
    },
  ]);

  logger.info('Successfully created sample events');
};

const seed = async () => {
  try {
    await connectDB();
    console.log('Starting database seeding process...');
    await clearCollections();
    const users = await createUsers();
    const cases = await createCases(users);
    await createDocuments(users, cases);
    await createEvents(users, cases);
    logger.info('✅ Database seeded successfully!');
    await mongoose.connection.close();
  } catch (err) {
    logger.error(`❌ Fatal error during seeding: ${err.message}`);
    process.exit(1);
  }
};

seed();