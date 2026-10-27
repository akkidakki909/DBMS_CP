import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import PostCard from '../components/Post/PostCard';
import { FiArrowLeft } from 'react-icons/fi';
import './Profile.css';
export default function Profile(){
 const {username}=useParams(); const {user:currentUser}=useAuth(); const navigate=useNavigate(); const [posts,setPosts]=useState([]); const [profile,setProfile]=useState(null); const [error,setError]=useState(''); const [tab,setTab]=useState('posts');
 useEffect(()=>{let alive=true;(async()=>{try{const {data}=await apiClient.get('/feed',{params:{mode:'pull',limit:50}});const all=(data.tweets||[]).map(t=>({id:t.id,userId:t.userId,user:t.user,content:t.content,createdAt:t.createdAt,likes:t.likes||0,reposts:t.reposts||0,comments:t.comments||0,images:t.images||[],poll:t.poll,isLiked:t.isLiked,isReposted:t.isReposted,isBookmarked:t.isBookmarked}));if(!alive)return;setPosts(all);const found=all.find(p=>p.user?.username===username)?.user;if(username && !found){setProfile({username,displayName:username,handle:`@${username}`});}else setProfile(found||currentUser);}catch(e){if(alive)setError(e.response?.data?.error||'Could not load profile.');}})();return()=>{alive=false};},[username,currentUser]);
 const ownId=profile?.id||currentUser?.id; const shown=posts.filter(p=>tab==='likes'?p.isLiked:String(p.userId)===String(ownId));
 return <div className="feed-container page-enter"><div className="page-header"><button className="btn-ghost" onClick={()=>navigate(-1)}><FiArrowLeft/></button><h1>{profile?.displayName||profile?.username||'Profile'}</h1><p className="text-secondary text-sm">{profile?.handle|| (profile?.username?`@${profile.username}`:'')}</p></div>{error&&<p className="text-danger text-sm">{error}</p>}<div className="tabs"><button className={`tab ${tab==='posts'?'active':''}`} onClick={()=>setTab('posts')}>Posts</button><button className={`tab ${tab==='likes'?'active':''}`} onClick={()=>setTab('likes')}>Likes</button></div>{shown.length?shown.map(p=><PostCard key={p.id} post={p}/>):<div className="empty-state"><div className="empty-state-icon">👤</div><p className="font-semibold">{tab==='likes'?'No liked posts available':'No posts found for this profile'}</p></div>}</div>;
}
