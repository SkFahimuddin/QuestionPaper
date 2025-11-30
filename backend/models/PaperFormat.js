const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  totalMarks: { type: Number, required: true },
  questions: [{
    marks: { type: Number, required: true },
    count: { type: Number, required: true },
    subQuestions: [{ marks: { type: Number, required: true } }]
  }]
});

const PaperFormatSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: { type: String, required: true },
  createdBy: { type: String, required: true },
  totalMarks: { type: Number, required: true },
  duration: { type: String, default: '3 hours' },
  sections: [SectionSchema],
  isShared: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PaperFormat', PaperFormatSchema);