const Case = require('../models/case.model');
const Event = require('../models/event.model');
const Document = require('../models/document.model');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

/**
 * @desc    Get dashboard summary
 * @route   GET /api/dashboard/summary
 * @access  Private
 */
exports.getSummary = async (req, res, next) => {
  try {
    // Build filter based on user role
    const userId = req.user.id;
    const caseOrFilter = {
      $or: [
        { creator: userId },
        { lawyer: userId },
        { client: userId }
      ]
    };
    console.log('Query for GET /api/dashboard/summary:', JSON.stringify(caseOrFilter));

    // Get total cases
    const totalCases = await Case.countDocuments(caseOrFilter);
    
    // Get active cases
    const activeCases = await Case.countDocuments({
      ...caseOrFilter,
      status: 'active'
    });
    
    // Get closed cases
    const closedCases = await Case.countDocuments({
      ...caseOrFilter,
      status: 'closed'
    });
    
    // Get urgent cases
    const urgentCases = await Case.countDocuments({
      ...caseOrFilter,
      isUrgent: true
    });
    
    // Get upcoming hearings (events of type 'hearing' in the next 30 days)
    const today = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);
    
    // Get case IDs based on user role
    let caseIds = [];
    if (req.user.role === 'lawyer') {
      const lawyerCases = await Case.find({ lawyer: req.user.id }).select('_id');
      caseIds = lawyerCases.map(c => c._id);
    } else if (req.user.role === 'client') {
      const clientCases = await Case.find({ client: req.user.id }).select('_id');
      caseIds = clientCases.map(c => c._id);
    }
    
    const upcomingHearings = await Event.countDocuments({
      type: 'hearing',
      case: { $in: caseIds },
      start: { $gte: today, $lte: thirtyDaysLater },
      status: { $ne: 'cancelled' }
    });
    
    // Get document count
    const documents = await Document.countDocuments({
      case: { $in: caseIds }
    });
    
    // Calculate active clients (unique clients with active cases)
    let activeClients = 0;
    if (req.user.role === 'lawyer') {
      const activeCasesWithClients = await Case.find({
        lawyer: req.user.id,
        status: 'active'
      }).populate('client', '_id');
      
      const uniqueClientIds = new Set(
        activeCasesWithClients
          .map(caseItem => caseItem.client?._id?.toString())
          .filter(Boolean)
      );
      activeClients = uniqueClientIds.size;
    } else {
      // For clients, active clients would be the lawyers they work with
      const activeCasesWithLawyers = await Case.find({
        client: req.user.id,
        status: 'active'
      }).populate('lawyer', '_id');
      
      const uniqueLawyerIds = new Set(
        activeCasesWithLawyers
          .map(caseItem => caseItem.lawyer?._id?.toString())
          .filter(Boolean)
      );
      activeClients = uniqueLawyerIds.size;
    }
    
    // Calculate success rate (closed cases with successful outcome)
    const successfulCases = await Case.countDocuments({
      ...caseOrFilter,
      status: 'closed',
      outcome: 'successful'
    });
    
    const successRate = closedCases > 0 
      ? Math.round((successfulCases / closedCases) * 100) + '%'
      : '0%';

    res.status(200).json({
      success: true,
      data: {
        totalCases,
        activeCases,
        closedCases,
        urgentCases,
        upcomingHearings,
        documents,
        successRate,
        activeClients
      }
    });
  } catch (error) {
    logger.error(`Error getting dashboard summary: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Get recent cases
 * @route   GET /api/dashboard/recent-cases
 * @access  Private
 */
exports.getRecentCases = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const caseOrFilter = {
      $or: [
        { creator: userId },
        { lawyer: userId },
        { client: userId }
      ]
    };
    console.log('Query for GET /api/dashboard/recent-cases:', JSON.stringify(caseOrFilter));

    // Get recent cases with advocates
    const recentCases = await Case.find(caseOrFilter)
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate('lawyer', 'name email')
      .populate('client', 'name email')
      .lean(); // Convert to plain JavaScript objects
    
    console.log('Cases returned:', recentCases.map(c => c._id));

    // Format cases for frontend
    const formattedCases = recentCases.map(caseItem => {
      // Get lead advocate or first advocate
      const leadAdvocate = caseItem.advocates?.find(a => a.isLead) || caseItem.advocates?.[0];
      
      return {
        id: caseItem._id,
        title: caseItem.title,
        type: caseItem.caseType,
        court: caseItem.court,
        date: `Updated ${getTimeAgo(caseItem.updatedAt)}`,
        urgent: caseItem.isUrgent,
        status: caseItem.status,
        lawyer: caseItem.lawyer ? { name: caseItem.lawyer.name, email: caseItem.lawyer.email } : null,
        client: caseItem.client ? { name: caseItem.client.name, email: caseItem.client.email } : null,
        hearingDate: caseItem.hearingDate ? formatDate(caseItem.hearingDate) : null,
        nextHearingDate: caseItem.nextHearingDate ? formatDate(caseItem.nextHearingDate) : null,
        // Include advocates array and lead advocate info
        advocates: caseItem.advocates || [],
        leadAdvocate: leadAdvocate ? {
          name: leadAdvocate.name,
          email: leadAdvocate.email,
          contact: leadAdvocate.contact,
          company: leadAdvocate.company,
          isLead: leadAdvocate.isLead
        } : null
      };
    });

    res.status(200).json(formattedCases);
  } catch (error) {
    logger.error(`Error getting recent cases: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Get upcoming events
 * @route   GET /api/dashboard/upcoming-events
 * @access  Private
 */
exports.getUpcomingEvents = async (req, res, next) => {
  try {
    // Get case IDs based on user role
    let caseIds = [];
    if (req.user.role === 'lawyer') {
      const lawyerCases = await Case.find({ lawyer: req.user.id }).select('_id');
      caseIds = lawyerCases.map(c => c._id);
    } else if (req.user.role === 'client') {
      const clientCases = await Case.find({ client: req.user.id }).select('_id');
      caseIds = clientCases.map(c => c._id);
    }
    // Use IST (Asia/Kolkata) for today (set to 22nd June 2024 for demo)
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    // Set 'today' to 22nd June 2024, 00:00 IST
    const todayIST = new Date(Date.UTC(2024, 5, 22, 0, 0, 0)); // Month is 0-indexed
    const sevenDaysLaterIST = new Date(todayIST.getTime() + 7 * 24 * 60 * 60 * 1000);
    // Get all event types for the user's cases in the next 7 days
    const upcomingEvents = await Event.find({
      case: { $in: caseIds },
      start: { $gte: todayIST, $lte: sevenDaysLaterIST },
      status: { $ne: 'cancelled' }
    })
    .sort({ start: 1 })
      .populate('case', 'title caseNumber');
    // Format events for frontend (date in IST)
    const formattedEvents = upcomingEvents.map(event => {
      // Format date in IST
      const istDate = new Date(event.start.getTime() + IST_OFFSET);
      const day = istDate.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' });
      const time = istDate.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
      return {
        id: event._id,
        title: event.title,
        case: event.case ? event.case.title : '',
        court: event.location,
        type: event.type,
        date: `${day}, ${time}`
      };
    });
    res.status(200).json(formattedEvents);
  } catch (error) {
    logger.error(`Error getting upcoming events: ${error.message}`);
    next(error);
  }
};

// Helper function to format date
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Helper function to format event date with time
function formatEventDate(date) {
  const day = new Date(date).toLocaleDateString('en-US', {
    weekday: 'short'
  });
  
  const time = new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  return `${day}, ${time}`;
}

// Helper function to get time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  let interval = Math.floor(seconds / 31536000);
  if (interval > 1) return `${interval} years ago`;
  if (interval === 1) return 'a year ago';
  
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) return `${interval} months ago`;
  if (interval === 1) return 'a month ago';
  
  interval = Math.floor(seconds / 86400);
  if (interval > 1) return `${interval} days ago`;
  if (interval === 1) return 'a day ago';
  
  interval = Math.floor(seconds / 3600);
  if (interval > 1) return `${interval} hours ago`;
  if (interval === 1) return 'an hour ago';
  
  interval = Math.floor(seconds / 60);
  if (interval > 1) return `${interval} minutes ago`;
  if (interval === 1) return 'a minute ago';
  
  return 'just now';
}