
import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  getInputRef?: (ref: HTMLInputElement | null) => void;
  theme?: 'user' | 'technician';
  onTrendingClick?: () => void;
  showTrendingIcon?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  getInputRef,
  theme = 'user',
  onTrendingClick,
  showTrendingIcon = false
}) => {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Theme-based colors - Updated with reddish-orange for technician theme
  const colors = {
    user: {
      primary: '#004c92',
      inputBorder: 'border-transparent focus-visible:border-transparent',
      buttonHover: 'hover:bg-[#004c92]/90',
    },
    technician: {
      primary: '#F05941', // Updated to reddish-orange
      inputBorder: 'border-transparent focus-visible:border-transparent',
      buttonHover: 'hover:bg-[#F05941]/90', // Updated to reddish-orange
    }
  };

  const themeColors = colors[theme];

  useEffect(() => {
    // Pass the input reference up to the parent component if needed
    if (getInputRef && inputRef.current) {
      getInputRef(inputRef.current);
    }
  }, [getInputRef]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center w-full gap-2 px-3 py-2">
      <div className="relative flex-1">
        <Input
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Posez votre question ici..."
          className={`rounded-full pl-4 pr-12 py-6 ${themeColors.inputBorder} bg-transparent shadow-none focus:shadow-none focus-visible:shadow-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-transparent focus-visible:ring-offset-0`}
          disabled={disabled}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <Button
            type="submit"
            size="icon"
            disabled={!message.trim() || disabled}
            className={`rounded-full h-10 w-10 bg-[${themeColors.primary}] ${themeColors.buttonHover}`}
          >
            <Send className="h-4 w-4 text-white" />
          </Button>
        </div>
      </div>
    </form>
  );
};

export default ChatInput;
