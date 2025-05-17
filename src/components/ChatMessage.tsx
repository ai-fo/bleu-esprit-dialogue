import React from 'react';
import { cn } from '@/lib/utils';
import FeedbackButtons from './FeedbackButtons';
import ReliabilityIndicator from './ReliabilityIndicator';
import ReactMarkdown from 'react-markdown';

export interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  id?: string | number;
  message_id?: number;  // ID du message stocké en base de données
  createdAt?: string;
  onNewChunkDisplayed?: () => void;
  theme?: 'user' | 'technician';
  isLoading?: boolean;
  isLastInSequence?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  role, 
  content, 
  id,
  message_id,
  onNewChunkDisplayed, 
  theme = 'user',
  isLoading = false,
  isLastInSequence = true
}) => {
  const isUser = role === 'user';

  // Theme-based colors
  const colors = {
    user: {
      userBg: 'bg-[#004c92]',
      assistantBg: 'bg-[#f6f8fc]',
      userText: 'text-white',
      assistantText: 'text-[#1a1a1a]',
      assistantBorder: 'border-[#e6f0ff]',
      assistantLink: 'text-[#004c92] font-medium underline hover:text-[#0060b6]'
    },
    technician: {
      userBg: 'bg-[#F97316]', // Changed from green to orange
      assistantBg: 'bg-[#fff8eb]', // Changed from green to orange
      userText: 'text-white',
      assistantText: 'text-[#1a1a1a]',
      assistantBorder: 'border-[#fff0e0]', // Changed from green to orange
      assistantLink: 'text-[#F97316] font-medium underline hover:text-[#e05e00]'
    }
  };

  const themeColors = colors[theme];

  // Fonction pour transformer le texte avec des URLs en contenu cliquable
  const renderContentWithLinks = () => {
    if (isLoading) {
      return (
        <>
          {content}
          <span className="inline-flex items-center ml-2">
            <span className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce"></span>
            <span className="w-2 h-2 rounded-full bg-current opacity-80 animate-bounce mx-1" style={{ animationDelay: '0.2s' }}></span>
            <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '0.4s' }}></span>
          </span>
        </>
      );
    }

    // Filtrer le séparateur %%PARTIE%% s'il existe encore dans le contenu
    const filteredContent = content.replace(/%%PARTIE%%/g, '');

    return (
      <ReactMarkdown
        components={{
          a: ({ node, ...props }) => (
            <a 
              {...props} 
              className={isUser ? 'text-white underline' : themeColors.assistantLink}
              target="_blank" 
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            />
          ),
          p: ({ node, ...props }) => <p {...props} className="mb-2" />
        }}
      >
        {filteredContent.replace(/(http:\/\/\S+)/g, '[$1]($1)')}
      </ReactMarkdown>
    );
  };

  return (
    <div
      className={cn(
        'mb-5 flex w-full max-w-full flex-col', // Increased bottom margin
        isUser ? 'items-end' : 'items-start'
      )}
    >
      <div
        className={cn(
          'rounded-2xl px-6 py-3 max-w-[85%] sm:max-w-[75%] break-words animate-scale-in shadow-md transition-all duration-300', // Added animation and shadow
          isUser
            ? `${themeColors.userBg} ${themeColors.userText}`
            : `${themeColors.assistantBg} ${themeColors.assistantText} border ${themeColors.assistantBorder}`
        )}
      >
        <div className="prose prose-sm max-w-none text-base"> 
          {renderContentWithLinks()}
        </div>
      </div>

      {/* Only show feedback and reliability indicator when not loading, for assistant messages, and only for the last message in the sequence */}
      {!isUser && !isLoading && isLastInSequence && (
        <div className="mt-1.5 flex items-center space-x-2 px-1">
          <ReliabilityIndicator score={95} />
          <FeedbackButtons messageId={message_id || id || -1} theme={theme} />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
