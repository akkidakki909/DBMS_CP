import { useState } from 'react';
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
  const user = post.user;
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
  const [showReport, setShowReport] = useState(false);
  const [animateLike, setAnimateLike] = useState(false);

  if (!user) return null;

  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });

  const handleLike = (e) => {
    e.stopPropagation();
    setLiked(!liked);
    setLikesCount((prev) => (liked ? prev - 1 : prev + 1));
    if (!liked) {
      setAnimateLike(true);
      setTimeout(() => setAnimateLike(false), 500);
    }
    onLike?.(post.id);
  };

  const handleRepost = (e) => {
    e.stopPropagation();
    setReposted(!reposted);
    setRepostsCount((prev) => (reposted ? prev - 1 : prev + 1));
    onRepost?.(post.id);
  };

  const handleBookmark = (e) => {
    e.stopPropagation();
    setBookmarked(!bookmarked);
    onBookmark?.(post.id);
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
              {post.isEdited && (
                <button
                  className="post-edited badge badge-accent"
                  onClick={(e) => { e.stopPropagation(); setShowEditHistory(true); }}
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
                {post.userId === 1 && (
                  <button className="post-menu-item text-danger" onClick={() => onDelete?.(post.id)}>
                    <FiTrash2 size={16} /> Delete post
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="post-content">
            <p className="post-text">{post.content}</p>
          </div>

          {/* Images */}
          {post.images && post.images.length > 0 && (
            <div className={`post-images post-images-${Math.min(post.images.length, 4)}`}>
              {post.images.map((img, i) => (
                <img key={i} src={img} alt={`Post image ${i + 1}`} className="post-image" />
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
            <button className="post-action action-share" onClick={(e) => e.stopPropagation()}>
              <FiShare size={18} />
            </button>
          </div>
        </div>
      </article>

      {showEditHistory && (
        <EditHistoryModal
          editHistory={post.editHistory}
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
