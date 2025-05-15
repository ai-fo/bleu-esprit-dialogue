
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
  isLoading?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  role, 
  content, 
  onNewChunkDisplayed, 
  theme = 'user',
  isLoading = false 
}) => {
  const isUser = role === 'user';

  // Theme-based colors
  const colors = {
    user: {
      userBg: 'bg-[#004c92]',
      assistantBg: 'bg-[#f6f8fc]',
      userText: 'text-white',
      assistantText: 'text-[#1a1a1a]',
      assistantBorder: 'border-[#e6f0ff]'
    },
    technician: {
      userBg: 'bg-[#F97316]', // Changed from green to orange
      assistantBg: 'bg-[#fff8eb]', // Changed from green to orange
      userText: 'text-white',
      assistantText: 'text-[#1a1a1a]',
      assistantBorder: 'border-[#fff0e0]' // Changed from green to orange
    }
  };

  const themeColors = colors[theme];

  return (
    <div
      className={cn(
        'mb-5 flex w-full max-w-full flex-col', // Increased bottom margin
        isUser ? 'items-end' : 'items-start'
      )}
    >
      <div
        className={cn(
          'rounded-2xl px-6 py-3 max-w-[85%] sm:max-w-[75%] break-words', // Increased padding and max-width
          isUser
            ? `${themeColors.userBg} ${themeColors.userText}`
            : `${themeColors.assistantBg} ${themeColors.assistantText} border ${themeColors.assistantBorder}`
        )}
      >
        <div className="prose prose-sm max-w-none text-base"> 
          {content}
          {isLoading && (
            <span className="inline-flex ml-2">
              <span className="animate-pulse text-lg">.</span>
              <span className="animate-pulse text-lg animation-delay-200">.</span>
              <span className="animate-pulse text-lg animation-delay-400">.</span>
            </span>
          )}
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
