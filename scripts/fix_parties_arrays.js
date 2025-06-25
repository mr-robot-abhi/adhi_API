// Usage: node scripts/fix_parties_arrays.js
const mongoose = require('mongoose');
const Case = require('../models/case.model');

(async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI environment variable not set');
    }
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Print the parties field for the problematic case
    const problematic = await Case.findById('68593d479a563afe375dbebe');
    if (problematic) {
      console.log('Problematic case parties field:', JSON.stringify(problematic.parties, null, 2));
    } else {
      console.log('Problematic case not found.');
    }

    // Find all cases with malformed parties.petitioner or parties.respondent
    const cases = await Case.find({
      $or: [
        { 'parties.petitioner': { $exists: true, $not: { $type: 'array' } } },
        { 'parties.respondent': { $exists: true, $not: { $type: 'array' } } },
      ],
    });

    console.log(`Found ${cases.length} cases to fix.`);

    let fixed = 0;
    for (const c of cases) {
      let changed = false;
      if (!Array.isArray(c.parties?.petitioner)) {
        c.parties.petitioner = [];
        changed = true;
      }
      if (!Array.isArray(c.parties?.respondent)) {
        c.parties.respondent = [];
        changed = true;
      }
      if (changed) {
        await c.save();
        fixed++;
        console.log(`Fixed case: ${c._id}`);
      }
    }

    console.log(`Done. Fixed ${fixed} cases.`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})(); 