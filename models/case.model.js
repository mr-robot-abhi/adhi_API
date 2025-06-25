const mongoose = require("mongoose");

const CaseSchema = new mongoose.Schema(
  {
    // Core Case Information - Only these 4 fields are required
    title: {
      type: String,
      required: [true, "Please add a case title"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    caseNumber: {
      type: String,
      required: [true, "Case number is required"],
      unique: true,
      index: true
    },
    caseType: {
      type: String,
      required: [true, "Case type is required"],
      enum: ["civil", "criminal", "family", "commercial", "writ", "arbitration", "labour", "revenue", "motor_accident", "appeal", "revision", "execution", "other"],
    },
    status: {
      type: String,
      required: [true, "Status is required"],
      default: "active",
      enum: ["active", "closed"],
      index: true,
    },

    // Optional fields below
    description: {
      type: String,
      default: "No description provided",
    },

    // Court Information
    courtState: {
      type: String,
      default: "karnataka",
      enum: ["karnataka", "maharashtra", "delhi", "tamil_nadu", "andhra_pradesh", "kerala", "telangana", "goa"],
    },
    district: {
      type: String,
      default: "bengaluru_urban",
      enum: [
        "bengaluru_urban", "bengaluru_rural", "mysuru", "mangaluru", "belagavi", 
        "kalaburagi", "dharwad", "tumakuru", "shivamogga", "vijayapura", 
        "davanagere", "ballari", "udupi", "raichur", "hassan",
        "mumbai", "pune", "nagpur",
        "chennai", "coimbatore", "madurai",
        "visakhapatnam", "vijayawada", "guntur",
        "thiruvananthapuram", "kochi", "kottayam",
        "hyderabad", "warangal", "nizamabad",
        "panaji", "margao", "vasco"
      ],
    },
    bench: {
      type: String,
      enum: ["bengaluru", "dharwad", "kalaburagi", ""],
      default: "",
    },
    courtType: {
      type: String,
      enum: ["high_court", "district_court", "supreme_court", "tribunal", "family_court", "consumer_court", "labour_court", "sessions_court", "civil_court", "magistrate_court", "special_court"],
      default: "district_court",
    },
    court: {
      type: String,
      default: "Bangalore Urban District Court",
    },
    courtHall: {
      type: String,
      default: "1",
    },
    courtComplex: {
      type: String,
      default: "City Civil Court Complex",
    },

    // Case Timeline
    filingDate: {
      type: Date,
      default: Date.now,
      validate: {
        validator: (v) => v <= new Date(),
        message: "Filing date cannot be in the future",
      },
    },
    hearingDate: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 1 week from now
    },
    nextHearingDate: {
      type: Date,
    },

    // Parties Section (revised structure)
    parties: {
      petitioner: [{
        _id: false, // No separate _id for subdocuments unless needed
        name: {
          type: String,
          trim: true,
          required: true
        },
        type: {
          type: String,
          enum: ['Individual', 'Corporation', 'Organization'],
          default: 'Individual'
        },
        role: {
          type: String,
          enum: ['Petitioner', 'Appellant', 'Plaintiff', 'Complainant'],
        },
        email: { type: String, trim: true, lowercase: true },
        contact: { type: String, trim: true },
        address: { type: String, trim: true }
      }],
      respondent: [{
        _id: false,
        name: {
          type: String,
          trim: true,
          required: true
        },
        type: {
          type: String,
          enum: ['Individual', 'Corporation', 'Organization'],
          default: 'Individual'
        },
        role: {
          type: String,
          enum: ['Respondent', 'Accused', 'Defendant', 'Opponent'],
        },
        email: { type: String, trim: true, lowercase: true },
        contact: { type: String, trim: true },
        address: { type: String, trim: true },
        opposingCounsel: { type: String, trim: true }
      }]
      // No 'required: true' here, so the 'parties' object itself is optional
    },

    // Advocates Section (updated structure)
    advocates: [
      {
        name: { type: String, required: true },
        email: { type: String },
        contact: { type: String },
        company: { type: String },
        gst: { type: String },
        spock: { type: String }, // Spock number
        poc: { type: String },   // Point of contact
        isLead: { type: Boolean, default: false },
        level: { type: String, enum: ["Senior", "Junior"] }
      }
    ],

    // Clients associated with the case (primarily added by a lawyer)
    clients: [
      {
        _id: false, // No separate _id for subdocuments
        name: { type: String, required: true, trim: true },
        email: { type: String, trim: true, lowercase: true },
        contact: { type: String, trim: true },
        address: { type: String, trim: true }
      }
    ],

    // Stakeholders associated with the case
    stakeholders: [
      {
        _id: false, // No separate _id for subdocuments
        name: { type: String, required: true, trim: true },
        roleInCase: { type: String, trim: true }, // e.g., Witness, Expert, Beneficiary
        email: { type: String, trim: true, lowercase: true },
        contact: { type: String, trim: true },
        address: { type: String, trim: true }
      }
    ],

    // Case Management
    priority: {
      type: String,
      default: "normal",
      enum: ["low", "normal", "high", "urgent"],
    },
    isUrgent: {
      type: Boolean,
      default: false,
    },
    caseStage: {
      type: String,
      default: "filing",
      enum: ["filing", "pre_trial", "trial", "evidence", "arguments", "judgment", "execution", "appeal"],
    },
    actSections: {
      type: String,
    },
    reliefSought: {
      type: String,
    },
    notes: {
      type: String,
    },

    // Relationships
    lawyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Array of lawyers associated with the case
    lawyers: [{
      _id: false,
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      name: { 
        type: String, 
        required: [true, 'Lawyer name is required'] 
      },
      email: { 
        type: String, 
        trim: true, 
        lowercase: true 
      },
      contact: { 
        type: String, 
        trim: true 
      },
      company: { 
        type: String, 
        trim: true 
      },
      gst: { 
        type: String, 
        trim: true 
      },
      role: { 
        type: String, 
        enum: ['lead', 'associate', 'junior', 'senior', 'counsel', 'other'],
        default: 'associate'
      },
      position: { 
        type: String, 
        enum: ['first_chair', 'second_chair', 'supporting', 'other'],
        default: 'supporting'
      },
      level: {
        type: String,
        enum: ['Senior', 'Junior', 'Associate', null],
        default: null
      },
      chairPosition: {
        type: String,
        enum: ['first_chair', 'second_chair', 'supporting', null],
        default: null
      },
      isPrimary: { 
        type: Boolean, 
        default: false 
      },
      addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    documents: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
    }],
    events: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    }],

    // System Fields
    createdAt: { 
      type: Date, 
      default: Date.now 
    },
    updatedAt: { 
      type: Date, 
      default: Date.now 
    },
    closedAt: { 
      type: Date 
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for hearing count
CaseSchema.virtual("hearingCount").get(function () {
  return this.events?.filter((e) => e.type === "hearing").length || 0;
});

// Auto-generate case number if not provided
CaseSchema.pre("save", function (next) {
  if (!this.caseNumber) {
    const prefix = this.courtType ? this.courtType.substring(0, 3).toUpperCase() : "GEN";
    this.caseNumber = `${prefix}-${Date.now().toString().slice(-6)}`;
  }
  next();
});

// Update timestamp on save
CaseSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Post-save hook to create hearing event when nextHearingDate is set
CaseSchema.post("save", async function(doc) {
  // Only create event if this is a new case and has nextHearingDate
  if (doc.nextHearingDate && this.isNew) {
    try {
      const Event = mongoose.model('Event');
      
      // Create a hearing event for the next hearing date
      const hearingEvent = new Event({
        title: `Hearing - ${doc.title}`,
        description: `Court hearing for case: ${doc.caseNumber}`,
        start: doc.nextHearingDate,
        end: new Date(doc.nextHearingDate.getTime() + 60 * 60 * 1000), // 1 hour duration
        type: 'hearing',
        case: doc._id,
        caseTitle: doc.title,
        caseNumber: doc.caseNumber,
        location: doc.court || 'Court',
        createdBy: doc.creator || doc.lawyer || doc.client,
        status: 'scheduled',
        priority: doc.isUrgent ? 'high' : 'medium'
      });
      
      await hearingEvent.save();
      
      // Add the event to the case's events array
      await mongoose.model('Case').updateOne(
        { _id: doc._id },
        { $push: { events: hearingEvent._id } }
      );
      
    } catch (error) {
      console.error('Error creating hearing event:', error);
    }
  }
});

// Post-update hook to handle nextHearingDate updates
CaseSchema.post("findOneAndUpdate", async function(doc) {
  if (doc && this._update && this._update.nextHearingDate) {
    try {
      const Event = mongoose.model('Event');
      
      // Check if there's already a hearing event for this case
      const existingEvent = await Event.findOne({
        case: doc._id,
        type: 'hearing',
        status: 'scheduled'
      });
      
      if (existingEvent) {
        // Update existing event
        await Event.findByIdAndUpdate(existingEvent._id, {
          start: this._update.nextHearingDate,
          end: new Date(this._update.nextHearingDate.getTime() + 60 * 60 * 1000),
          title: `Hearing - ${doc.title}`,
          description: `Court hearing for case: ${doc.caseNumber}`
        });
      } else {
        // Create new hearing event
        const hearingEvent = new Event({
          title: `Hearing - ${doc.title}`,
          description: `Court hearing for case: ${doc.caseNumber}`,
          start: this._update.nextHearingDate,
          end: new Date(this._update.nextHearingDate.getTime() + 60 * 60 * 1000),
          type: 'hearing',
          case: doc._id,
          caseTitle: doc.title,
          caseNumber: doc.caseNumber,
          location: doc.court || 'Court',
          createdBy: doc.creator || doc.lawyer || doc.client,
          status: 'scheduled',
          priority: doc.isUrgent ? 'high' : 'medium'
        });
        
        await hearingEvent.save();
        
        // Add the event to the case's events array
        await mongoose.model('Case').updateOne(
          { _id: doc._id },
          { $push: { events: hearingEvent._id } }
        );
      }
      
    } catch (error) {
      console.error('Error updating hearing event:', error);
    }
  }
});

// Indexes for better query performance
CaseSchema.index({ status: 1, hearingDate: 1 });
CaseSchema.index({ lawyer: 1, isUrgent: 1 });
CaseSchema.index({ title: "text", description: "text", caseNumber: "text" });

module.exports = mongoose.model("Case", CaseSchema);