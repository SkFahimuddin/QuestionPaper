const mongoose = require('mongoose');

const TeacherSchema = new mongoose.Schema({
  teacherID: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true },
  // Remove single subject field - teacher can work with multiple subjects
  // subject: { type: String, required: true },
  // hasSubmitted: { type: Boolean, default: false } // Remove this too since it's per-subject
});

module.exports = mongoose.model('Teacher', TeacherSchema);