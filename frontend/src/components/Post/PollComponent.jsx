import { useState } from 'react';
import apiClient from '../../api/client';
import { formatDistanceToNow } from 'date-fns';
import './PollComponent.css';

export default function PollComponent({ poll }) {
  const [hasVoted, setHasVoted] = useState(poll.hasVoted);
  const [votedOptionId, setVotedOptionId] = useState(poll.votedOptionId);
  const [options, setOptions] = useState(poll.options);
  const [totalVotes, setTotalVotes] = useState(poll.totalVotes);

  const timeLeft = formatDistanceToNow(new Date(poll.endsAt));
  const isExpired = new Date(poll.endsAt) < new Date();

  const [voteError, setVoteError] = useState('');
  const handleVote = async (optionId) => {
    if (hasVoted || isExpired) return;
    try {
      if (poll.id) await apiClient.post(`/polls/${poll.id}/vote`, { optionId });
      setVotedOptionId(optionId); setHasVoted(true);
      setOptions((prev) => prev.map((o) => (o.id === optionId ? { ...o, votes: o.votes + 1 } : o)));
      setTotalVotes((prev) => prev + 1); setVoteError('');
    } catch (e) { setVoteError(e.response?.data?.error || 'Vote could not be saved.'); }
  };

  const showResults = hasVoted || isExpired;

  return (
    <div className="poll-component" onClick={(e) => e.stopPropagation()}>
      <div className="poll-options">
        {options.map((option) => {
          const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
          const isSelected = votedOptionId === option.id;
          const isWinning = showResults && option.votes === Math.max(...options.map((o) => o.votes));

          return (
            <button
              key={option.id}
              className={`poll-option ${showResults ? 'voted' : ''} ${isSelected ? 'selected' : ''} ${isWinning ? 'winning' : ''}`}
              onClick={() => handleVote(option.id)}
              disabled={hasVoted || isExpired}
            >
              {showResults && (
                <div className="poll-bar" style={{ width: `${percentage}%` }} />
              )}
              <span className="poll-option-text">{option.text}</span>
              {showResults && (
                <span className="poll-percentage font-semibold">{percentage}%</span>
              )}
            </button>
          );
        })}
      </div>
      {voteError && <p className="text-danger text-sm" role="alert">{voteError}</p>}
      <div className="poll-footer text-sm text-tertiary">
        <span>{totalVotes.toLocaleString()} votes</span>
        <span>·</span>
        <span>{isExpired ? 'Final results' : `${timeLeft} left`}</span>
      </div>
    </div>
  );
}
