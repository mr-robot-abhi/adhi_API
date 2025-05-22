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
      enum: ["draft", "active", "inactive", "closed", "archived", "pending"],
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
        role: { 
          type: String, 
          enum: ['Petitioner', 'Appellant', 'Plaintiff', 'Complainant'], 
          required: function() { return this.parent().petitioner && this.parent().petitioner.length > 0; } // Required if petitioner array is not empty
        },
        type: { 
          type: String, 
          enum: ['Individual', 'Corporation', 'Organization'], 
          required: function() { return this.parent().petitioner && this.parent().petitioner.length > 0; }
        },
        name: { 
          type: String, 
          trim: true,
          required: function() { return this.parent().petitioner && this.parent().petitioner.length > 0; }
        },
        email: { type: String, trim: true, lowercase: true },
        contact: { type: String, trim: true },
        address: { type: String, trim: true }
      }],
      respondent: [{
        _id: false,
        role: { 
          type: String, 
          enum: ['Respondent', 'Accused', 'Defendant', 'Opponent'], 
          required: function() { return this.parent().respondent && this.parent().respondent.length > 0; }
        },
        type: { 
          type: String, 
          enum: ['Individual', 'Corporation', 'Organization'], 
          required: function() { return this.parent().respondent && this.parent().respondent.length > 0; }
        },
        name: { 
          type: String, 
          trim: true,
          required: function() { return this.parent().respondent && this.parent().respondent.length > 0; }
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

// Indexes for better query performance
CaseSchema.index({ status: 1, hearingDate: 1 });
CaseSchema.index({ lawyer: 1, isUrgent: 1 });
CaseSchema.index({ title: "text", description: "text", caseNumber: "text" });

module.exports = mongoose.model("Case", CaseSchema);