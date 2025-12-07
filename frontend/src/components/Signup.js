import React, { useState } from 'react';
import axios from 'axios';

export default function Signup({ onSignupSuccess }) {
  const [teacherID, setTeacherID] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [msgType, setMsgType] = useState('info');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    
    try {
      const res = await axios.post('http://localhost:5000/api/auth/signup', { 
        teacherID, 
        name, 
        password 
      });
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setMsgType('success');
      setMsg(res.data.message || '✓ Account created successfully! Redirecting to login...');
      
      // Clear form
      setTeacherID('');
      setName('');
      setPassword('');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        if (onSignupSuccess) onSignupSuccess();
      }, 2000);
    } catch (err) {
      setMsgType('danger');
      setMsg(err.response?.data?.message || 'Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <div className="loading-text">Creating account...</div>
        </div>
      )}
      
      <h4>Create Your Account</h4>
      <form onSubmit={submit}>
        <div className="mb-2">
          <input
            className="form-control"
            placeholder="Teacher ID"
            value={teacherID}
            onChange={e => setTeacherID(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        <div className="mb-2">
          <input
            className="form-control"
            placeholder="Full Name"
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        <div className="mb-2">
          <input
            type="password"
            className="form-control"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={loading}
            required
            minLength="6"
          />
        </div>
        <button 
          className="btn btn-primary w-100" 
          type="submit"
          disabled={loading}
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>
      {msg && (
        <div className={`mt-2 alert alert-${msgType}`}>
          {msg}
        </div>
      )}
    </div>
  );
}