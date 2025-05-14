
import React from 'react';
import { cn } from '@/lib/utils';
import FeedbackButtons from './FeedbackButtons';
import ReliabilityIndicator from './ReliabilityIndicator';

export interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  id?: string;
  createdAt?: string;
  onNewChunkDisplayed?: () => void;
  theme?: 'user' | 'technician';
}

const ChatMessage: React.FC<ChatMessageProps> = ({ role, content, onNewChunkDisplayed, theme = 'user' }) => {
  const isUser = role === 'user';

  // Theme-based colors
  const themeColors = {
    user: {
      userBg: 'bg-[#004c92]',
      assistantBg: 'bg-[#f6f8fc]',
      userText: 'text-white',
      assistantText: 'text-[#1a1a1a]',
      assistantBorder: 'border-[#e6f0ff]'
    },
    technician: {
      userBg: 'bg-[#4c9200]',
      assistantBg: 'bg-[#f8fcf6]',
      userText: 'text-white',
      assistantText: 'text-[#1a1a1a]',
      assistantBorder: 'border-[#e6ffe6]'
    }
  };

  const colors = themeColors[theme];

  return (
    <div
      className={cn(
        'mb-4 flex w-full max-w-full flex-col',
        isUser ? 'items-end' : 'items-start'
      )}
    >
      <div
        className={cn(
          'rounded-2xl px-4 py-2 max-w-[80%] sm:max-w-[70%] break-words',
          isUser
            ? `${colors.userBg} ${colors.userText}`
            : `${colors.assistantBg} ${colors.assistantText} border ${colors.assistantBorder}`
        )}
      >
        <div className="prose prose-sm max-w-none">
          {content}
        </div>
      </div>

      {!isUser && (
        <div className="mt-1.5 flex items-center space-x-2 px-1">
          <ReliabilityIndicator score={95} />
          <FeedbackButtons messageId="1" theme={theme} />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
