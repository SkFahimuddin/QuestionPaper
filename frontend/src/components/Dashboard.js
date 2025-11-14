import React, {useState, useEffect} from 'react';
import axios from 'axios';
import QuestionForm from './QuestionForm';

export default function Dashboard({ token, user, onLogout }){
  const [myQuestions, setMyQuestions] = useState([]);
  const [canGenerate, setCanGenerate] = useState(false);
  const [currentSubject, setCurrentSubject] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [generationType, setGenerationType] = useState(''); // 'combined' or 'individual'

  useEffect(()=> {
    if (currentSubject) {
      fetchMy();
      checkCan();
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

  async function checkCan(){
    if (!currentSubject) return;
    try{
      const res = await axios.get(`http://localhost:5000/api/paper/can-generate?subject=${currentSubject}`, { 
        headers: { Authorization: 'Bearer '+token }
      });
      setCanGenerate(res.data.canGenerate);
    }catch(err){ console.error(err); }
  }

  function openGenerateModal(type) {
    setGenerationType(type);
    setShowSubjectModal(true);
  }

  async function generatePaper(selectedSubject) {
    try{
      const endpoint = generationType === 'individual' 
        ? 'http://localhost:5000/api/individual-paper/generate-individual-paper'
        : 'http://localhost:5000/api/paper/generate';
      
      const win = window.open('about:blank','_blank');
      const res = await axios.get(`${endpoint}?subject=${selectedSubject}`, { 
        headers: { Authorization: 'Bearer '+token } 
      });
      win.document.write(res.data);
      win.document.close();
      setShowSubjectModal(false);
    }catch(err){
      alert(err.response?.data?.message || 'Error generating paper');
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
          <div>
            <button className="btn btn-primary me-2" onClick={() => openGenerateModal('combined')}>
              Generate Combined Paper
            </button>
            <button className="btn btn-success" onClick={() => openGenerateModal('individual')}>
              Generate Individual Paper
            </button>
            {!canGenerate && <div className="text-muted mt-2">Waiting for all teachers to submit for this subject.</div>}
          </div>
        </>
      )}

      {/* Subject Selection Modal for Paper Generation */}
      {showSubjectModal && (
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
            minWidth: '400px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <h5>Select Subject for Paper Generation</h5>
            <p className="text-muted">Choose which subject's question paper to generate:</p>
            <div className="d-flex flex-column gap-2 mt-3">
              {subjects.map((subj, i) => (
                <button 
                  key={i}
                  className="btn btn-outline-primary"
                  onClick={() => generatePaper(subj)}
                >
                  {subj}
                </button>
              ))}
            </div>
            <button 
              className="btn btn-secondary mt-3 w-100" 
              onClick={() => setShowSubjectModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}