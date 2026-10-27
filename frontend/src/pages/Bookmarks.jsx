import { useEffect, useState } from 'react';
import { bookmarkCollections } from '../data/mockData';
import { apiClient } from '../api/client';
import PostCard from '../components/Post/PostCard';
import { FiFolder, FiBookmark } from 'react-icons/fi';
import './Bookmarks.css';

export default function Bookmarks() {
  const [activeView, setActiveView] = useState('all');
  const [bookmarkedPosts, setBookmarkedPosts] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { apiClient.get('/bookmarks').then(({data}) => setBookmarkedPosts(data)).catch((e) => setError(e.response?.data?.error || 'Could not load bookmarks.')); }, []);

  // Get posts for a specific collection
  const getCollectionPosts = (collectionId) => {
    const collection = bookmarkCollections.find((c) => c.id === collectionId);
    if (!collection) return [];
    return bookmarkedPosts.filter((p) => collection.postIds.includes(p.id));
  };

  const displayPosts = activeView === 'all'
    ? bookmarkedPosts
    : getCollectionPosts(activeView);

  return (
    <div className="feed-container page-enter" id="bookmarks-page">
      {/* Header */}
      <div className="page-header">
        <h1>Bookmarks</h1>
        <span className="page-header-sub">@aditya_dev</span>
      </div>

      {/* Collections */}
      <div className="bm-collections">
        <button
          className={`bm-collection-chip ${activeView === 'all' ? 'active' : ''}`}
          onClick={() => setActiveView('all')}
        >
          <FiBookmark size={14} />
          All Bookmarks
          <span className="bm-chip-count">{bookmarkedPosts.length}</span>
        </button>
        {bookmarkCollections.map((collection) => (
          <button
            key={collection.id}
            className={`bm-collection-chip ${activeView === collection.id ? 'active' : ''}`}
            onClick={() => setActiveView(collection.id)}
          >
            <FiFolder size={14} />
            {collection.name}
            <span className="bm-chip-count">{bookmarkedPosts.filter((p) => collection.postIds.includes(p.id)).length}</span>
          </button>
        ))}
      </div>

      {/* Bookmarked Posts */}
      <div className="bm-posts">
        {error && <p className="text-danger text-sm">{error}</p>}
        {displayPosts.length > 0 ? (
          displayPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🔖</div>
            <p className="font-semibold">No bookmarks yet</p>
            <p className="text-sm text-tertiary">
              When you bookmark a post, it'll show up here for easy access.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
