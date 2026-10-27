import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { FiSend, FiArrowLeft, FiEdit } from 'react-icons/fi';
import './Messages.css';

export default function Messages() {
  const { user: currentUser } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadConversations = async () => {
    try { const { data } = await apiClient.get('/messages'); setConversations(data); setError(''); }
    catch (e) { setError(e.response?.data?.error || 'Could not load messages. Please make sure you are logged in and the latest database migration has run.'); }
  };
  useEffect(() => { loadConversations(); }, []);

  const openThread = async (convo) => {
    setActive(convo);
    try { const { data } = await apiClient.get('/messages', { params: { with: convo.userId } }); setMessages(data); }
    catch (e) { setError(e.response?.data?.error || 'Could not load this conversation.'); }
  };

  const startConversation = async () => {
    const username = window.prompt('Enter the exact username of the person you want to message (without @):');
    if (!username?.trim()) return;
    try {
      const { data } = await apiClient.get('/people', { params: { q: username.trim() } });
      const person = data.find((u) => u.username.toLowerCase() === username.trim().replace(/^@/, '').toLowerCase());
      if (!person) { window.alert('No user found with that username.'); return; }
      const convo = { userId: person.id, username: person.username, displayName: person.displayName, lastMessage: '', lastMessageAt: new Date().toISOString(), unreadCount: 0 };
      await openThread(convo);
    } catch (e) { window.alert(e.response?.data?.error || 'Could not find user.'); }
  };

  const handleSend = async () => {
    if (!messageText.trim() || !active || busy) return;
    setBusy(true);
    try {
      const { data } = await apiClient.post('/messages', { recipientId: active.userId, content: messageText.trim() });
      setMessages((prev) => [...prev, data]); setMessageText(''); await loadConversations();
    } catch (e) { setError(e.response?.data?.error || 'Message could not be sent.'); }
    finally { setBusy(false); }
  };
  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  if (!active) return <div className="feed-container page-enter" id="messages-page"><div className="page-header"><div className="flex items-center justify-between w-full"><h1>Messages</h1><button className="btn-ghost" onClick={startConversation} title="New message" style={{ padding: '8px', borderRadius: '50%' }}><FiEdit size={18} /></button></div></div>
    {error && <p className="text-danger text-sm" role="alert">{error}</p>}
    <div className="msg-list">{conversations.map((convo) => <div key={convo.userId} className="msg-convo-item" onClick={() => openThread(convo)}><div className="msg-convo-info"><div className="msg-convo-top"><span className="font-semibold">{convo.displayName || convo.username}</span><span className="text-sm text-tertiary msg-convo-handle">@{convo.username}</span><span className="text-tertiary">·</span><span className="text-sm text-tertiary">{convo.lastMessageAt ? formatDistanceToNow(new Date(convo.lastMessageAt), { addSuffix: true }) : ''}</span></div><p className={`msg-convo-last text-sm ${convo.unreadCount > 0 ? 'font-semibold' : 'text-secondary'}`}>{convo.lastMessage || 'Start a conversation'}</p></div>{convo.unreadCount > 0 && <span className="msg-unread-badge">{convo.unreadCount}</span>}</div>)}</div>
    {!conversations.length && !error && <p className="text-secondary text-sm">No conversations yet. Use the pencil icon to start one.</p>}
  </div>;

  return <div className="feed-container page-enter" id="message-thread"><div className="page-header"><div className="flex items-center gap-md"><button className="btn-ghost" style={{ padding: '8px', borderRadius: '50%' }} onClick={() => { setActive(null); loadConversations(); }}><FiArrowLeft size={20} /></button><div><span className="font-semibold text-sm">{active.displayName || active.username}</span><span className="text-xs text-tertiary" style={{ display: 'block' }}>@{active.username}</span></div></div></div>
    {error && <p className="text-danger text-sm" role="alert">{error}</p>}
    <div className="msg-thread">{messages.map((msg) => { const mine = String(msg.senderId) === String(currentUser?.id); return <div key={msg.id} className={`msg-bubble-wrapper ${mine ? 'mine' : 'theirs'}`}><div className={`msg-bubble ${mine ? 'mine' : 'theirs'}`}><p>{msg.content}</p></div><span className="msg-time text-xs text-tertiary">{formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}</span></div>; })}</div>
    <div className="msg-compose"><input type="text" placeholder="Write a message…" className="msg-compose-input" value={messageText} onChange={(e) => setMessageText(e.target.value)} onKeyDown={handleKeyDown} /><button className="msg-send-btn" onClick={handleSend} disabled={!messageText.trim() || busy}><FiSend size={18} /></button></div>
  </div>;
}
