const CalendarEvent = require('../models/calendar.model');

exports.createEvent = async (req, res) => {
  try {
    const { title, description, start, end, caseId } = req.body;
    const createdBy = req.user.id;

    const newEvent = new CalendarEvent({
      title,
      description,
      start,
      end,
      case: caseId,
      createdBy
    });

    await newEvent.save();
    res.status(201).json(newEvent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllEvents = async (req, res) => {
  try {
    const events = await CalendarEvent.find()
      .populate('createdBy', 'email')
      .populate('case', 'title');
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getCaseEvents = async (req, res) => {
  try {
    const events = await CalendarEvent.find({ case: req.params.caseId })
      .populate('createdBy', 'email');
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const updatedEvent = await CalendarEvent.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedEvent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    await CalendarEvent.findByIdAndDelete(req.params.id);
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
