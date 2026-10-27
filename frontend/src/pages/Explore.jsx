import { useEffect, useState } from 'react';

import { apiClient } from '../api/client';
import PostCard from '../components/Post/PostCard';
import { FiSearch, FiTrendingUp } from 'react-icons/fi';
import './Explore.css';

export default function Explore() {
  const [searchQuery, setSearchQuery] = useState('');
  const [people, setPeople] = useState([]);
  const [trendWindow, setTrendWindow] = useState('hourly');
  const [trendData, setTrendData] = useState({hourly:[],daily:[]});
  const [trendError, setTrendError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  useEffect(() => { apiClient.get('/trending').then(({data}) => setTrendData(data)).catch(e => setTrendError(e.response?.data?.error || 'Could not load trending topics.')); apiClient.get('/people').then(({data}) => setPeople(data)).catch(() => setPeople([])); }, []);
  const toggleFollow = async (person) => { try { if (person.isFollowing) await apiClient.delete(`/follows/${person.id}`); else await apiClient.post(`/follows/${person.id}`); setPeople(prev => prev.map(p => p.id===person.id ? {...p,isFollowing:!p.isFollowing} : p)); } catch (e) { window.alert(e.response?.data?.error || 'Could not update follow.'); } };

  const filteredTrending = (trendData[trendWindow] || []).map((t, i) => ({id:t.tag,tag:`#${t.tag}`,category:trendWindow==='hourly'?'Last hour':'Last 24 hours',postsCount:t.posts,rank:i+1}));

  // Search live PostgreSQL-backed results, not mock data.
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setSearchResults([]); setSearchError(''); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchLoading(true); setSearchError('');
      try {
        const { data } = await apiClient.get('/search', { params: { q } });
        if (!cancelled) setSearchResults((Array.isArray(data) ? data : data.results || []).map((t) => ({
          id:t.id, userId:t.user_id || t.userId, content:t.content, createdAt:t.created_at || t.createdAt,
          likes:t.like_count || t.likeCount || 0, comments:t.reply_count || 0, reposts:t.retweet_count || 0,
          user:t.user || { id:t.user_id, username:t.username || 'user', displayName:t.display_name || t.username || 'User', handle:`@${t.username || 'user'}`, avatar:t.avatar_url || '' },
          images:t.images || [], poll:t.poll || null, isLiked:false, isReposted:false, isBookmarked:false
        })));
      } catch (e) { if (!cancelled) { setSearchResults([]); setSearchError(e.response?.data?.error || 'Search failed.'); } }
      finally { if (!cancelled) setSearchLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery]);

  return (
    <div className="feed-container page-enter" id="explore-page">
      {/* Header */}
      <div className="page-header">
        <h1>Explore</h1>
      </div>

      {/* Search */}
      <div className="explore-search">
        <FiSearch className="explore-search-icon" />
        <input
          type="text"
          placeholder="Search posts, people, hashtags..."
          className="search-input explore-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          id="explore-search-input"
        />
      </div>

      {/* Search Results */}
      {searchQuery.trim() ? (
        <div className="explore-results">
          <h2 className="explore-section-title">
            Results for "{searchQuery}" <span className="text-tertiary text-sm">({searchResults.length})</span>
          </h2>
          {searchLoading ? <p className="text-secondary text-sm">Searching…</p> : searchError ? <p className="text-danger text-sm">{searchError}</p> : searchResults.length > 0 ? (
            searchResults.map((post) => (
              <PostCard key={post.id} post={post} />
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <p className="font-semibold">No results found</p>
              <p className="text-sm text-tertiary">Try searching for something else.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Trending window selector */}
          <div className="explore-categories">
            {[{id:'hourly',label:'Hourly'}, {id:'daily',label:'Daily'}].map((cat) => (
              <button
                key={cat.id}
                className={`explore-category-btn ${trendWindow === cat.id ? 'active' : ''}`}
                onClick={() => setTrendWindow(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Trending */}
          <div className="explore-trending">
            <h2 className="explore-section-title">
              <FiTrendingUp size={20} />
              Trending
            </h2>
            {trendError && <p className="text-danger text-sm">{trendError}</p>}
            {filteredTrending.map((item, index) => (
              <div key={item.id} className="explore-trend-item">
                <span className="explore-trend-rank text-tertiary">{index + 1}</span>
                <div className="explore-trend-info">
                  <span className="explore-trend-category text-xs text-tertiary">{item.category}</span>
                  <span className="explore-trend-tag font-semibold">{item.tag}</span>
                  <span className="explore-trend-count text-sm text-tertiary">
                    {item.postsCount.toLocaleString()} posts
                  </span>
                </div>
              </div>
            ))}
            {!filteredTrending.length && !trendError && <p className="text-secondary text-sm">No hashtags trending in this window yet. Create posts with #hashtags to populate the rankings.</p>}
          </div>

          {/* Suggested Users */}
          <div className="explore-users">
            <h2 className="explore-section-title">People to follow</h2>
            {people.map((user) => (
              <div key={user.id} className="explore-user-card">
                <img src={user.avatar || ''} alt={user.displayName} className="avatar avatar-lg" />
                <div className="explore-user-info">
                  <div className="explore-user-top">
                    <span className="font-semibold">{user.displayName}</span>
                    {user.isVerified && <span className="verified-badge" title="Verified">✓</span>}
                  </div>
                  <span className="text-sm text-secondary">@{user.username}</span>
                  <p className="text-sm text-secondary explore-user-bio">{user.bio || ''}</p>
                </div>
                <button className={`btn ${user.isFollowing ? 'btn-secondary' : 'btn-primary'} btn-sm`} onClick={() => toggleFollow(user)}>
                  {user.isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
