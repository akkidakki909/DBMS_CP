import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import ComposePost from '../components/Post/ComposePost';
import PostCard from '../components/Post/PostCard';
import './HomeFeed.css';

function convertApiTweet(tweet) {
  return {
    id: tweet.id,
    userId: tweet.userId,
    user: tweet.user,
    content: tweet.content,
    createdAt: tweet.createdAt,

    likes: tweet.likeCount ?? 0,
    comments: tweet.replyCount ?? 0,
    reposts: tweet.retweetCount ?? 0,
    bookmarks: 0,

    isLiked: false,
    isReposted: false,
    isBookmarked: false,

    images: [],
    poll: null,
    isEdited: false,
    editHistory: [],
  };
}

export default function HomeFeed() {
  const { user, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState('foryou');
  const [feedPosts, setFeedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load posts directly from PostgreSQL through the backend
  const loadFeed = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await apiClient.get('/feed', {
        params: {
          mode: 'pull',
          limit: 20,
        },
      });

      const posts = (response.data.tweets || []).map(
        convertApiTweet
      );

      setFeedPosts(posts);
    } catch (err) {
      console.error('Failed to load feed:', err);

      if (err.response?.status === 401) {
        setError(
          'Authentication expired. Please refresh the page.'
        );
      } else {
        setError(
          'Could not load posts from the database.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Initial feed load
  useEffect(() => {
    if (!authLoading && user) {
      loadFeed();
    }
  }, [authLoading, user]);

  // IMPORTANT:
  // After ComposePost successfully inserts the tweet into
  // PostgreSQL, reload the feed from the database.
  const handleNewPost = async () => {
    await loadFeed();
  };

  // Delete post
  const handleDelete = async (postId) => {
    try {
      await apiClient.delete(`/tweets/${postId}`);

      // Immediately remove from UI
      setFeedPosts((prev) =>
        prev.filter((post) => post.id !== postId)
      );
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Loading screen
  if (authLoading || loading) {
    return (
      <div
        className="feed-container page-enter"
        id="home-feed"
      >
        <div className="page-header">
          <h1>Home</h1>

          <div className="tabs home-tabs">
            <button className="tab active">
              For you
            </button>

            <button className="tab">
              Following
            </button>
          </div>
        </div>

        <div
          style={{
            padding: '80px 20px',
            textAlign: 'center',
            color: 'var(--color-text-secondary)',
          }}
        >
          Loading posts...
        </div>
      </div>
    );
  }

  // Following tab
  const displayPosts =
    activeTab === 'following'
      ? feedPosts.filter(
          (post) =>
            String(post.userId) !== String(user?.id)
        )
      : feedPosts;

  return (
    <div
      className="feed-container page-enter"
      id="home-feed"
    >
      {/* Header */}
      <div className="page-header">
        <h1>Home</h1>

        <div className="tabs home-tabs">
          <button
            className={`tab ${
              activeTab === 'foryou'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              setActiveTab('foryou')
            }
            id="tab-foryou"
          >
            For you
          </button>

          <button
            className={`tab ${
              activeTab === 'following'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              setActiveTab('following')
            }
            id="tab-following"
          >
            Following
          </button>
        </div>
      </div>

      {/* Compose Post */}
      <ComposePost
        onPost={handleNewPost}
      />

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '20px',
            textAlign: 'center',
            color: '#ff6b6b',
          }}
        >
          {error}

          <br />

          <button
            className="btn btn-primary btn-sm"
            style={{ marginTop: '10px' }}
            onClick={loadFeed}
          >
            Retry
          </button>
        </div>
      )}

      {/* Feed */}
      {!error && (
        <div className="home-feed-list">
          {displayPosts.length > 0 ? (
            displayPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onDelete={handleDelete}
              />
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                📭
              </div>

              <p className="font-semibold">
                No posts yet
              </p>

              <p className="text-sm text-tertiary">
                When people you follow post,
                it'll show up here.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}