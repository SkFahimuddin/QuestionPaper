import React, {useState, useEffect} from 'react';
import axios from 'axios';
import QuestionForm from './QuestionForm';
import FormatBuilder from './FormatBuilder';

export default function Dashboard({ token, user, onLogout }){
  const [myQuestions, setMyQuestions] = useState([]);
  const [currentSubject, setCurrentSubject] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [formats, setFormats] = useState([]);
  const [showFormatBuilder, setShowFormatBuilder] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [generationType, setGenerationType] = useState('');
  const [editingFormat, setEditingFormat] = useState(null);

  useEffect(()=> {
    if (currentSubject) {
      fetchMy();
      fetchFormats();
    }
    fetchSubjects();
  }, [currentSubject]);

  async function fetchSubjects() {
    try {
      const res = await axios.get('http://localhost:5000/api/questions/subjects', { 
        headers: { Authorization: 'Bearer '+token }
      });
      setSubjects(res.data.subjects || []);
    } catch(err) { 
      console.error(err); 
    }
  }

  async function fetchMy(){
    if (!currentSubject) return;
    try{
      const res = await axios.get(`http://localhost:5000/api/questions/my?subject=${currentSubject}`, { 
        headers: { Authorization: 'Bearer '+token }
      });
      setMyQuestions(res.data);
    }catch(err){ console.error(err); }
  }

  async function fetchFormats(){
    if (!currentSubject) return;
    try{
      const res = await axios.get(`http://localhost:5000/api/formats/list?subject=${currentSubject}`, { 
        headers: { Authorization: 'Bearer '+token }
      });
      setFormats(res.data.formats || []);
    }catch(err){ console.error(err); }
  }

  // This was missing - needed by QuestionForm component
  async function checkCan(){
    // This function can be empty or you can implement checking logic if needed
    // The QuestionForm calls this after saving a question
  }

  function openGenerateModal(type) {
    setGenerationType(type);
    setShowGenerateModal(true);
  }

  async function generatePaper(formatId) {
    try{
      const endpoint = generationType === 'individual' 
        ? 'http://localhost:5000/api/individual-paper/generate-with-format'
        : 'http://localhost:5000/api/paper/generate-with-format';
      
      const win = window.open('about:blank','_blank');
      const res = await axios.get(`${endpoint}?subject=${currentSubject}&formatId=${formatId}`, { 
        headers: { Authorization: 'Bearer '+token } 
      });
      win.document.write(res.data);
      win.document.close();
      setShowGenerateModal(false);
    }catch(err){
      alert(err.response?.data?.message || 'Error generating paper');
    }
  }

  async function deleteFormat(formatId) {
    if (!window.confirm('Are you sure you want to delete this format?')) return;
    
    try {
      await axios.delete(`http://localhost:5000/api/formats/${formatId}`, {
        headers: { Authorization: 'Bearer '+token }
      });
      alert('Format deleted successfully');
      fetchFormats();
    } catch(err) {
      alert(err.response?.data?.message || 'Error deleting format');
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center">
        <div>Welcome, <strong>{user?.name || user?.teacherID}</strong></div>
        <div>
          <button className="btn btn-secondary me-2" onClick={onLogout}>Logout</button>
        </div>
      </div>

      <hr />
      
      {/* Subject Selection */}
      <div className="mb-4">
        <h5>Select Subject</h5>
        <div className="d-flex gap-2 align-items-center">
          <select 
            className="form-select" 
            style={{maxWidth: '300px'}}
            value={currentSubject} 
            onChange={(e) => setCurrentSubject(e.target.value)}
          >
            <option value="">-- Choose Subject --</option>
            {subjects.map((subj, i) => (
              <option key={i} value={subj}>{subj}</option>
            ))}
          </select>
          <button 
            className="btn btn-outline-primary btn-sm"
            onClick={() => {
              const newSubject = prompt('Enter new subject name:');
              if (newSubject && newSubject.trim()) {
                setCurrentSubject(newSubject.trim());
                if (!subjects.includes(newSubject.trim())) {
                  setSubjects([...subjects, newSubject.trim()]);
                }
              }
            }}
          >
            + Add New Subject
          </button>
        </div>
      </div>

      {currentSubject && (
        <>
          {/* Format Management Section */}
          <div className="mb-4 p-3" style={{backgroundColor: '#f8f9fa', borderRadius: '8px'}}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">Question Paper Formats</h5>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setEditingFormat(null);
                  setShowFormatBuilder(true);
                }}
              >
                + Create New Format
              </button>
            </div>

            {formats.length === 0 ? (
              <p className="text-muted">No formats created yet. Create your first custom format!</p>
            ) : (
              <div className="row">
                {formats.map((format) => (
                  <div key={format._id} className="col-md-6 mb-3">
                    <div className="card">
                      <div className="card-body">
                        <h6 className="card-title">
                          {format.name}
                          {format.isShared && <span className="badge bg-info ms-2">Shared</span>}
                        </h6>
                        <p className="card-text small text-muted mb-2">
                          Total: {format.totalMarks} marks | Duration: {format.duration}
                        </p>
                        <p className="card-text small">
                          <strong>Sections: {format.sections.length}</strong>
                          {format.sections.map((s, i) => (
                            <span key={i} className="d-block ms-2">
                              • {s.name}: {s.totalMarks} marks
                            </span>
                          ))}
                        </p>
                        <div className="d-flex gap-2">
                          {format.createdBy === user.teacherID && (
                            <>
                              <button 
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => {
                                  setEditingFormat(format);
                                  setShowFormatBuilder(true);
                                }}
                              >
                                Edit
                              </button>
                              <button 
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => deleteFormat(format._id)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <hr />

          {/* Questions Section */}
          <h5>Your Questions for {currentSubject}</h5>
          <ul>
            {myQuestions.map((q,i)=> (
              <li key={i}>
                {q.questionText} - ({q.marks}m) - Section {q.section} [{q.co}][{q.k}]-[{q.module}]
              </li>
            ))}
          </ul>

          <QuestionForm 
            token={token} 
            subject={currentSubject}
            onSaved={fetchMy}
            onCheck={checkCan}
          />

          <hr />

          {/* Generate Paper Section */}
          <div>
            <h5>Generate Question Paper</h5>
            {formats.length === 0 ? (
              <p className="text-warning">⚠️ Please create at least one format before generating papers.</p>
            ) : (
              <div className="d-flex gap-2">
                <button 
                  className="btn btn-primary"
                  onClick={() => openGenerateModal('combined')}
                >
                  Generate Combined Paper
                </button>
                <button 
                  className="btn btn-success"
                  onClick={() => openGenerateModal('individual')}
                >
                  Generate Individual Paper
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Format Builder Modal */}
      {showFormatBuilder && (
        <FormatBuilder
          token={token}
          subject={currentSubject}
          existingFormat={editingFormat}
          onClose={() => {
            setShowFormatBuilder(false);
            setEditingFormat(null);
            fetchFormats();
          }}
        />
      )}

      {/* Format Selection Modal for Paper Generation */}
      {showGenerateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            minWidth: '500px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <h5>Select Format for Paper Generation</h5>
            <p className="text-muted">Choose which format to use:</p>
            <div className="d-flex flex-column gap-2 mt-3">
              {formats.map((format) => (
                <button 
                  key={format._id}
                  className="btn btn-outline-primary text-start"
                  onClick={() => generatePaper(format._id)}
                >
                  <strong>{format.name}</strong>
                  <br />
                  <small className="text-muted">
                    {format.totalMarks} marks | {format.sections.length} sections | {format.duration}
                  </small>
                </button>
              ))}
            </div>
            <button 
              className="btn btn-secondary mt-3 w-100" 
              onClick={() => setShowGenerateModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}