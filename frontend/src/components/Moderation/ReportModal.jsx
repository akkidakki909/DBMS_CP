import { useState } from 'react';
import { FiX, FiAlertTriangle } from 'react-icons/fi';
import apiClient from '../../api/client';
import { reportReasons } from '../../data/mockData';
import './ReportModal.css';

const reasonMap = {
  spam: 'spam', harassment: 'harassment', hate: 'hate', violence: 'violence',
  misinformation: 'misinformation', nudity: 'nudity', other: 'other',
};
function normalizeReason(reason) {
  if (typeof reason === 'number' || /^\d+$/.test(String(reason))) {
    const numeric = Number(reason);
    return ({1:'spam',2:'harassment',3:'hate',4:'misinformation',5:'violence',6:'nudity',7:'other'})[numeric] || 'other';
  }
  const value = String(reason || '').toLowerCase();
  if (value.includes('spam')) return 'spam';
  if (value.includes('harass') || value.includes('bully')) return 'harassment';
  if (value.includes('hate')) return 'hate';
  if (value.includes('violence') || value.includes('threat')) return 'violence';
  if (value.includes('misinformation') || value.includes('false')) return 'misinformation';
  if (value.includes('nudity') || value.includes('sexual')) return 'nudity';
  return reasonMap[value] || 'other';
}

export default function ReportModal({ postId, onClose }) {
  const [selectedReason, setSelectedReason] = useState(null);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason || sending) return;
    setSending(true); setError('');
    try {
      await apiClient.post('/reports', { targetType: 'tweet', targetId: postId, reason: normalizeReason(selectedReason), details: additionalInfo });
      setSubmitted(true);
    } catch (e) { setError(e.response?.data?.error || 'Could not submit report. Please log in and try again.'); }
    finally { setSending(false); }
  };

  if (submitted) return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="report-success animate-bounce-in"><div className="report-success-icon">✅</div><h3 className="font-heading">Report Submitted</h3><p className="text-secondary text-sm">Your report has been saved for moderator review.</p><button className="btn btn-full" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2 className="font-heading" style={{ fontSize: 'var(--text-xl)' }}><FiAlertTriangle size={20} style={{ marginRight: '8px', color: 'var(--color-warning)' }} />Report Post</h2><button className="btn-ghost" onClick={onClose} style={{ padding: '6px', borderRadius: '50%' }}><FiX size={20} /></button></div>
        <div className="modal-body"><p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-md)' }}>Why are you reporting this post?</p>
          <div className="report-reasons">{reportReasons.map((reason) => <label key={reason.id} className={`report-reason ${selectedReason === reason.id ? 'selected' : ''}`}><input type="radio" name="report-reason" value={reason.id} checked={selectedReason === reason.id} onChange={() => setSelectedReason(reason.id)} className="visually-hidden" /><div className="report-reason-radio" /><div><span className="report-reason-label font-semibold">{reason.label}</span><span className="report-reason-desc text-sm text-secondary">{reason.description}</span></div></label>)}</div>
          <textarea className="report-textarea" placeholder="Additional details (optional)" value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} rows={3} />
          {error && <p className="text-danger text-sm" role="alert">{error}</p>}
          <button className="btn btn-danger btn-full" onClick={handleSubmit} disabled={!selectedReason || sending} style={{ marginTop: 'var(--space-md)' }}>{sending ? 'Submitting…' : 'Submit Report'}</button>
        </div>
      </div>
    </div>
  );
}
