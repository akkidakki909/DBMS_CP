import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { formatCount } from '../../data/mockData';
import { formatDistanceToNow } from 'date-fns';
import {
  FiMessageCircle, FiRepeat, FiHeart, FiBookmark,
  FiShare, FiMoreHorizontal, FiEdit3, FiFlag, FiTrash2
} from 'react-icons/fi';
import { FaHeart } from 'react-icons/fa';
import PollComponent from './PollComponent';
import EditHistoryModal from './EditHistoryModal';
import ReportModal from '../Moderation/ReportModal';
import './PostCard.css';

export default function PostCard({ post, onLike, onRepost, onBookmark, onDelete }) {
  const author = post.user;
  const { user: currentUser } = useAuth();
  const user = author;
  const navigate = useNavigate();
  const [liked, setLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(
  post.likes ?? post.likeCount ?? 0
   );
  const [reposted, setReposted] = useState(post.isReposted);
  const [repostsCount, setRepostsCount] = useState(
  post.reposts ?? post.retweetCount ?? 0
  );
  const [bookmarked, setBookmarked] = useState(post.isBookmarked);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditHistory, setShowEditHistory] = useState(false);
  const [fetchedEditHistory, setFetchedEditHistory] = useState(post.editHistory || []);
  const [showReport, setShowReport] = useState(false);
  const [animateLike, setAnimateLike] = useState(false);
  const [content, setContent] = useState(post.content);
  const [editCount, setEditCount] = useState(post.editCount || 0);
  const isOwner = String(currentUser?.id) === String(post.userId);

  const handleEdit = async () => {
    const nextContent = window.prompt('Edit your post (maximum 280 characters):', content);
    if (nextContent == null || !nextContent.trim() || nextContent.trim() === content) return;
    if (nextContent.trim().length > 280) { window.alert('Posts can contain at most 280 characters.'); return; }
    try {
      const response = await apiClient.patch(`/tweets/${post.id}`, { content: nextContent.trim() });
      setContent(response.data.content); setEditCount(response.data.editCount); setShowMenu(false);
    } catch (error) { window.alert(error.response?.data?.error || 'Could not edit post.'); }
  };

  const handleShowEditHistory = async () => {
    try { const response = await apiClient.get(`/tweets/${post.id}/edits`); setFetchedEditHistory(response.data.history || []); setShowEditHistory(true); }
    catch (error) { window.alert(error.response?.data?.error || 'Could not load edit history.'); }
  };

  if (!user) return null;

  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });

  const handleLike = async (e) => {
    e.stopPropagation();
    const next = !liked;
    try {
      if (next) await apiClient.post(`/likes/${post.id}`);
      else await apiClient.delete(`/likes/${post.id}`);
      setLiked(next);
      setLikesCount((prev) => Math.max(0, prev + (next ? 1 : -1)));
      if (next) { setAnimateLike(true); setTimeout(() => setAnimateLike(false), 500); }
      onLike?.(post.id, next);
    } catch (error) { window.alert(error.response?.data?.error || 'Could not save like.'); }
  };

  const handleRepost = async (e) => {
    e.stopPropagation();
    const next = !reposted;
    try {
      if (next) await apiClient.post(`/retweets/${post.id}`);
      else await apiClient.delete(`/retweets/${post.id}`);
      setReposted(next);
      setRepostsCount((prev) => Math.max(0, prev + (next ? 1 : -1)));
      onRepost?.(post.id, next);
    } catch (error) { window.alert(error.response?.data?.error || 'Could not save repost.'); }
  };

  const handleBookmark = async (e) => {
    e.stopPropagation();
    const next = !bookmarked;
    try {
      if (next) await apiClient.post(`/bookmarks/${post.id}`);
      else await apiClient.delete(`/bookmarks/${post.id}`);
      setBookmarked(next);
      onBookmark?.(post.id, next);
    } catch (error) { window.alert(error.response?.data?.error || 'Could not save bookmark.'); }
  };

  const goToPost = () => navigate(`/post/${post.id}`);
  const goToProfile = (e) => {
    e.stopPropagation();
    navigate(`/profile/${user.username}`);
  };

  return (
    <>
      <article className="post-card post-border" onClick={goToPost} id={`post-${post.id}`}>
        <div className="post-avatar" onClick={goToProfile}>
          <img src={user.avatar} alt={user.displayName} className="avatar avatar-lg" />
        </div>
        <div className="post-body">
          {/* Header */}
          <div className="post-header">
            <div className="post-user-info" onClick={goToProfile}>
              <span className="post-display-name font-semibold">{user.displayName}</span>
              {user.isVerified && <span className="verified-badge" title="Verified">✓</span>}
              <span className="post-handle text-secondary">{user.handle}</span>
              <span className="post-separator text-tertiary">·</span>
              <span className="post-time text-tertiary">{timeAgo}</span>
              {(editCount > 0 || post.isEdited) && (
                <button
                  className="post-edited badge badge-accent"
                  onClick={(e) => { e.stopPropagation(); handleShowEditHistory(); }}
                  title="View edit history"
                >
                  <FiEdit3 size={10} /> Edited
                </button>
              )}
            </div>
            <button
              className="post-menu-btn btn-ghost"
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            >
              <FiMoreHorizontal size={18} />
            </button>
            {showMenu && (
              <div className="post-menu animate-slide-down" onClick={(e) => e.stopPropagation()}>
                <button className="post-menu-item" onClick={() => { setShowReport(true); setShowMenu(false); }}>
                  <FiFlag size={16} /> Report post
                </button>
                {isOwner && <button className="post-menu-item" onClick={handleEdit}><FiEdit3 size={16} /> Edit post</button>}
                {(isOwner || ['admin','moderator'].includes(currentUser?.role)) && (
                  <button className="post-menu-item text-danger" onClick={() => { setShowMenu(false); onDelete?.(post.id); }}>
                    <FiTrash2 size={16} /> Delete post
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="post-content">
            <p className="post-text">{content}</p>
          </div>

          {/* Images */}
          {post.images && post.images.length > 0 && (
            <div className={`post-images post-images-${Math.min(post.images.length, 4)}`}>
              {post.images.map((img, i) => (
                <img key={i} src={img} alt={`Post image ${i + 1}`} className="post-image" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ))}
            </div>
          )}

          {/* Poll */}
          {post.poll && <PollComponent poll={post.poll} />}

          {/* Actions */}
          <div className="post-actions">
            <button className="post-action action-reply" onClick={(e) => { e.stopPropagation(); goToPost(); }}>
              <FiMessageCircle size={18} />
              <span>{formatCount(post.comments ?? post.replyCount ?? 0)}</span>
            </button>
            <button className={`post-action action-repost ${reposted ? 'reposted' : ''}`} onClick={handleRepost}>
              <FiRepeat size={18} />
              <span>{formatCount(repostsCount)}</span>
            </button>
            <button className={`post-action action-like ${liked ? 'liked' : ''}`} onClick={handleLike}>
              {liked ? (
                <FaHeart size={18} className={animateLike ? 'animate-heart' : ''} />
              ) : (
                <FiHeart size={18} />
              )}
              <span>{formatCount(likesCount)}</span>
            </button>
            <button className={`post-action action-bookmark ${bookmarked ? 'bookmarked' : ''}`} onClick={handleBookmark}>
              <FiBookmark size={18} />
            </button>
            <button className="post-action action-share" title="Copy post link" onClick={async (e) => { e.stopPropagation(); try { await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`); window.alert('Post link copied.'); } catch { window.prompt('Copy this post link:', `${window.location.origin}/post/${post.id}`); } }}>
              <FiShare size={18} />
            </button>
          </div>
        </div>
      </article>

      {showEditHistory && (
        <EditHistoryModal
          editHistory={fetchedEditHistory}
          onClose={() => setShowEditHistory(false)}
        />
      )}

      {showReport && (
        <ReportModal
          postId={post.id}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  );
}
