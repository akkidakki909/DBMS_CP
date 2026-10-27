import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { apiClient } from '../api/client';
import PostCard from '../components/Post/PostCard';
import { useAuth } from '../context/AuthContext';
import './PostDetail.css';

function mapTweet(t) { return { id:t.id, userId:t.userId || t.user_id, content:t.content, createdAt:t.createdAt || t.created_at, likes:t.likeCount ?? t.like_count ?? 0, reposts:t.retweetCount ?? t.retweet_count ?? 0, comments:t.replyCount ?? t.reply_count ?? 0, images:t.images || (t.imageUrl ? [t.imageUrl] : []), poll:t.poll || null, editCount:t.editCount || 0, isLiked:!!t.isLiked, isReposted:!!t.isReposted, isBookmarked:!!t.isBookmarked, user:t.user || {id:t.user_id, username:t.username || 'user', displayName:t.display_name || t.username || 'User', handle:`@${t.username || 'user'}`, avatar:t.avatar_url || ''} }; }
export default function PostDetail() {
 const { id } = useParams(); const navigate = useNavigate(); const { user } = useAuth();
 const [thread,setThread]=useState([]); const [reply,setReply]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
 const load=async()=>{try{const {data}=await apiClient.get(`/tweets/${id}/thread`);setThread(data.map(mapTweet));setError('');}catch(e){setError(e.response?.data?.error||'Could not load this post.');}};
 useEffect(()=>{load();},[id]);
 const sendReply=async()=>{if(!reply.trim()||busy)return;setBusy(true);try{await apiClient.post('/tweets',{content:reply.trim(),parentTweetId:id});setReply('');await load();}catch(e){setError(e.response?.data?.error||'Reply could not be saved.');}finally{setBusy(false);}};
 return <div className="feed-container page-enter" id="post-detail"><div className="page-header"><button className="back-btn btn-ghost" onClick={()=>navigate(-1)}><FiArrowLeft size={20}/></button><h1>Post</h1></div>{error&&<p className="text-danger text-sm">{error}</p>}{thread.length? <><PostCard post={thread[0]}/><div className="reply-composer-section"><textarea className="compose-textarea" placeholder="Write a reply…" value={reply} onChange={e=>setReply(e.target.value)} maxLength={280}/><button className="btn btn-primary btn-sm" onClick={sendReply} disabled={!reply.trim()||busy}>{busy?'Sending…':'Reply'}</button></div>{thread.slice(1).map(t=><PostCard key={t.id} post={t}/>)}</>:!error&&<p className="text-secondary">Loading post…</p>}</div>;
}
