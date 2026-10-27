import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

import {
  FiImage,
  FiBarChart2,
  FiSmile,
  FiX,
} from 'react-icons/fi';

import './ComposePost.css';

export default function ComposePost({
  onPost,
  placeholder = "What's happening?",
}) {
  const { user } = useAuth();

  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojis = ['😀','😃','😄','😁','😆','🥹','😂','🤣','😊','😍','🥰','😘','😎','🤔','🙌','👏','👍','👎','🙏','💪','🔥','❤️','💙','🎉','✨','🚀','🌈','☕','📚','💯'];

  const [pollOptions, setPollOptions] = useState([
    '',
    '',
  ]);

  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const maxLength = 280;

  const charCount = content.length;
  const charPercent = (charCount / maxLength) * 100;

  const isOverLimit = charCount > maxLength;

  const canPost =
    content.trim().length > 0 &&
    !isOverLimit &&
    !posting;

  const handlePost = async () => {
    if (!canPost) return;
    if (showPollCreator) {
      const cleanOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (cleanOptions.length < 2 || cleanOptions.length > 4 || new Set(cleanOptions).size !== cleanOptions.length) {
        setError('A poll needs 2–4 non-empty, unique options.'); return;
      }
    }

    setPosting(true);
    setError('');

    try {
      const response = await apiClient.post('/tweets', { content: content.trim() });

      /*
       * Backend returns the newly created tweet.
       * Convert it into the structure expected by PostCard.
       */
      const tweet = response.data;

      const newPost = {
        ...tweet,

        userId: tweet.userId || user?.id,

        likes: tweet.likes ?? tweet.likeCount ?? 0,
        reposts: tweet.reposts ?? tweet.retweetCount ?? 0,
        comments: tweet.comments ?? tweet.replyCount ?? 0,

        createdAt:
          tweet.createdAt ||
          new Date().toISOString(),

        isLiked: false,
        isReposted: false,
        isBookmarked: false,
        isEdited: false,

        images: [],
        poll: null,
        editHistory: [],

        author: tweet.author || tweet.user || {
          id: user?.id,
          username: user?.username,
          displayName: user?.displayName,
          handle:
            user?.handle ||
            `@${user?.username}`,
          avatar: user?.avatar,
          isVerified: user?.isVerified,
        },
      };

      // Persist optional poll and image URL after the post has an ID.
      if (showPollCreator) {
        const cleanOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
        if (cleanOptions.length < 2 || new Set(cleanOptions).size !== cleanOptions.length) {
          throw new Error('A poll needs 2–4 non-empty, unique options.');
        }
        await apiClient.post(`/tweets/${tweet.id}/poll`, { question: content.trim(), options: cleanOptions, durationHours: 24 });
      }
      if (images[0]) {
        await apiClient.post(`/tweets/${tweet.id}/media`, { mediaUrl: images[0], altText: 'Post image' });
      }

      // Reload from PostgreSQL only after optional features have been saved.
      onPost?.(newPost);

      // Clear composer
      setContent('');
      setImages([]);
      setShowPollCreator(false);
      setPollOptions(['', '']);
    } catch (err) {
      console.error('Post creation failed:', err);
      setError(err.response?.data?.error || err.message || 'Failed to create post. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const addPollOption = () => {
    if (pollOptions.length < 4) {
      setPollOptions([
        ...pollOptions,
        '',
      ]);
    }
  };

  const updatePollOption = (index, value) => {
    const updated = [...pollOptions];
    updated[index] = value;
    setPollOptions(updated);
  };

  const removePollOption = (index) => {
    if (pollOptions.length > 2) {
      setPollOptions(
        pollOptions.filter(
          (_, i) => i !== index
        )
      );
    }
  };

  return (
    <div
      className="compose-post"
      id="compose-post"
    >
      <img
        src={user?.avatar}
        alt={user?.displayName || 'User'}
        className="avatar avatar-lg"
      />

      <div className="compose-body">

        {/* Text input */}
        <textarea
          className="compose-textarea"
          placeholder={placeholder}
          value={content}
          onChange={(e) =>
            setContent(e.target.value)
          }
          rows={3}
          id="compose-textarea"
        />

        {/* Error */}
        {error && (
          <div
            style={{
              color: 'var(--color-danger)',
              fontSize: '13px',
              marginTop: '8px',
            }}
          >
            {error}
          </div>
        )}

        {/* Poll Creator */}
        {showPollCreator && (
          <div className="compose-poll animate-slide-down">

            {pollOptions.map((option, i) => (
              <div
                key={i}
                className="compose-poll-option"
              >
                <input
                  type="text"
                  placeholder={`Option ${i + 1}`}
                  value={option}
                  onChange={(e) =>
                    updatePollOption(
                      i,
                      e.target.value
                    )
                  }
                  className="compose-poll-input"
                />

                {pollOptions.length > 2 && (
                  <button
                    className="compose-poll-remove"
                    onClick={() =>
                      removePollOption(i)
                    }
                    type="button"
                  >
                    <FiX size={14} />
                  </button>
                )}
              </div>
            ))}

            {pollOptions.length < 4 && (
              <button
                className="compose-poll-add"
                onClick={addPollOption}
                type="button"
              >
                + Add option
              </button>
            )}
          </div>
        )}

        {images.length > 0 && <div style={{margin:'8px 0'}}><img src={images[0]} alt="Image preview" style={{maxWidth:'100%',maxHeight:220,borderRadius:12}} onError={() => setError('This image URL could not be loaded. Use a direct HTTPS link to an image file.')} /><button type="button" className="btn btn-secondary btn-sm" onClick={() => setImages([])}>Remove image</button></div>}

        {/* Bottom Bar */}
        <div className="compose-bottom">

          <div className="compose-tools">

            <button className={`compose-tool ${images.length ? 'active' : ''}`} title="Attach image URL" type="button" onClick={() => { const url = window.prompt('Paste an HTTPS image URL (image hosting is external):', images[0] || ''); if (url === null) return; if (url && !/^https:\/\//i.test(url)) { setError('Image URL must start with https://'); return; } setImages(url ? [url] : []); setError(''); }}>
              <FiImage size={18} />
            </button>

            <button
              className={`compose-tool ${
                showPollCreator
                  ? 'active'
                  : ''
              }`}
              title="Create poll"
              onClick={() =>
                setShowPollCreator(
                  !showPollCreator
                )
              }
              type="button"
            >
              <FiBarChart2 size={18} />
            </button>

            <button className={`compose-tool ${showEmojiPicker ? 'active' : ''}`} title="Choose emoji" type="button" onClick={() => setShowEmojiPicker((v) => !v)}>
              <FiSmile size={18} />
            </button>

          </div>
          {showEmojiPicker && <div className="compose-emoji-picker" role="group" aria-label="Choose an emoji">{emojis.map((emoji) => <button key={emoji} type="button" title={emoji} onClick={() => { setContent((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${emoji}`); setShowEmojiPicker(true); }}>{emoji}</button>)}</div>}

          <div className="compose-right">

            {/* Character counter */}
            {content.length > 0 && (
              <div className="compose-counter">

                <svg
                  className="compose-counter-svg"
                  viewBox="0 0 36 36"
                >
                  <circle
                    className="compose-counter-bg"
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    strokeWidth="2"
                  />

                  <circle
                    className="compose-counter-fill"
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    strokeWidth="2"
                    strokeDasharray={`${
                      Math.min(
                        charPercent,
                        100
                      )
                    } 100`}
                    style={{
                      stroke:
                        isOverLimit
                          ? 'var(--color-danger)'
                          : charPercent > 90
                          ? 'var(--color-warning)'
                          : 'var(--color-primary)',
                    }}
                  />
                </svg>

                {charPercent > 90 && (
                  <span
                    className={`compose-counter-text ${
                      isOverLimit
                        ? 'over'
                        : ''
                    }`}
                  >
                    {maxLength - charCount}
                  </span>
                )}

              </div>
            )}

            {/* Post button */}
            <button
              className="btn btn-primary btn-sm"
              onClick={handlePost}
              disabled={!canPost}
              id="compose-post-btn"
              type="button"
            >
              {posting
                ? 'Posting...'
                : 'Post'}
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}