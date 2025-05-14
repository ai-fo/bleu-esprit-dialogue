
import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, TrendingUp } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  getInputRef?: (ref: HTMLInputElement | null) => void;
  onTrendingClick?: () => void;
  showTrendingIcon?: boolean;
  theme?: 'user' | 'technician';
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  getInputRef,
  onTrendingClick,
  showTrendingIcon = false,
  theme = 'user'
}) => {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Theme-based colors
  const colors = {
    user: {
      primary: '#004c92',
      inputBorder: 'border-[#e6f0ff] focus-visible:ring-[#3380cc]/20',
      buttonHover: 'hover:bg-[#004c92]/90',
      trendingButton: 'text-[#004c92] hover:bg-[#e6f0ff]'
    },
    technician: {
      primary: '#4c9200',
      inputBorder: 'border-[#e6ffe6] focus-visible:ring-[#33cc80]/20',
      buttonHover: 'hover:bg-[#4c9200]/90',
      trendingButton: 'text-[#4c9200] hover:bg-[#e6ffe6]'
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
    <form onSubmit={handleSubmit} className="flex items-center w-full gap-2">
      {showTrendingIcon && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`rounded-full ${themeColors.trendingButton}`}
          onClick={onTrendingClick}
        >
          <TrendingUp className="h-4 w-4" />
        </Button>
      )}
      
      <div className="relative flex-1">
        <Input
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Posez votre question ici..."
          className={`rounded-full pl-4 pr-12 py-6 shadow-sm ${themeColors.inputBorder} border bg-white`}
          disabled={disabled}
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
          <Button
            type="submit"
            size="icon"
            disabled={!message.trim() || disabled}
            className={`rounded-full h-8 w-8 bg-[${themeColors.primary}] ${themeColors.buttonHover}`}
          >
            <Send className="h-4 w-4 text-white" />
          </Button>
        </div>
      </div>
    </form>
  );
};

export default ChatInput;
