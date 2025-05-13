
import React, { useState, useEffect } from 'react';

interface ChatMessageProps {
  content: string;
  isUser?: boolean;
  isLoading?: boolean;
  onNewChunkDisplayed?: () => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  content, 
  isUser = false, 
  isLoading = false,
  onNewChunkDisplayed 
}) => {
  const [displayText, setDisplayText] = useState('');
  
  // Effect to handle typing animation for bot messages
  useEffect(() => {
    if (isUser || !content) {
      setDisplayText(content);
      return;
    }

    let index = 0;
    const typingEffect = setInterval(() => {
      if (index <= content.length) {
        setDisplayText(content.substring(0, index));
        index++;
        
        // Call onNewChunkDisplayed callback if provided
        if (onNewChunkDisplayed) {
          onNewChunkDisplayed();
        }
      } else {
        clearInterval(typingEffect);
      }
    }, 10); // Typing speed can be adjusted

    return () => clearInterval(typingEffect);
  }, [content, isUser, onNewChunkDisplayed]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div 
        className={`rounded-lg px-4 py-2 max-w-[85%] ${
          isUser 
            ? 'bg-blue-600 text-white rounded-tr-none' 
            : 'bg-gray-100 text-gray-800 rounded-tl-none'
        }`}
      >
        {isLoading ? (
          <div className="flex items-center space-x-1">
            <div className="bg-gray-500 rounded-full h-2 w-2 animate-bounce"></div>
            <div className="bg-gray-500 rounded-full h-2 w-2 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="bg-gray-500 rounded-full h-2 w-2 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>
        ) : (
          <div className="whitespace-pre-wrap">{displayText}</div>
        )}
      </div>
    </div>
  );
};

// Export the RagSources component that was originally in ChatMessage.tsx
export interface RagSourceProps {
  files: string[];
}

export const RagSources: React.FC<RagSourceProps> = ({ files }) => {
  if (!files || files.length === 0) return null;
  
  return (
    <div className="mt-2 pt-2 border-t border-dashed border-blue-200">
      <p className="text-xs text-blue-600 font-medium mb-1">Sources utilisées:</p>
      <ul className="flex flex-wrap gap-1">
        {files.map((file, index) => (
          <li 
            key={index} 
            className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200"
            title={file}
          >
            {file.split('/').pop() || file}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ChatMessage;
