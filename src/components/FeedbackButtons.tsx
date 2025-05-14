
import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

interface FeedbackButtonsProps {
  messageId: string;
  theme?: 'user' | 'technician';
}

const FeedbackButtons: React.FC<FeedbackButtonsProps> = ({ messageId, theme = 'user' }) => {
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);
  const { toast } = useToast();

  // Theme-based colors
  const colors = {
    user: {
      activeBg: 'bg-[#004c92]/10',
      hoverBg: 'hover:bg-[#004c92]/5',
      activeStroke: 'stroke-[#004c92]',
      inactiveStroke: 'stroke-gray-400'
    },
    technician: {
      activeBg: 'bg-[#4c9200]/10',
      hoverBg: 'hover:bg-[#4c9200]/5',
      activeStroke: 'stroke-[#4c9200]',
      inactiveStroke: 'stroke-gray-400'
    }
  };

  const themeColors = colors[theme];

  const handleFeedback = (type: 'positive' | 'negative') => {
    setFeedback(type);
    
    // Simulate API call to send feedback
    console.log(`Sending ${type} feedback for message ${messageId}`);
    
    toast({
      title: "Merci pour votre retour",
      description: type === 'positive' 
        ? "C'est noté ! Votre feedback positif a été enregistré." 
        : "Nous sommes désolés que cette réponse ne soit pas satisfaisante. Votre retour nous aidera à nous améliorer.",
      duration: 3000,
    });
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleFeedback('positive')}
        className={cn(
          "rounded-full p-1 transition-colors",
          feedback === 'positive' ? themeColors.activeBg : themeColors.hoverBg
        )}
        aria-label="Feedback positif"
      >
        <ThumbsUp 
          className={cn(
            "h-3.5 w-3.5", 
            feedback === 'positive' ? themeColors.activeStroke : themeColors.inactiveStroke
          )}
        />
      </button>
      
      <button
        onClick={() => handleFeedback('negative')}
        className={cn(
          "rounded-full p-1 transition-colors",
          feedback === 'negative' ? themeColors.activeBg : themeColors.hoverBg
        )}
        aria-label="Feedback négatif"
      >
        <ThumbsDown 
          className={cn(
            "h-3.5 w-3.5", 
            feedback === 'negative' ? themeColors.activeStroke : themeColors.inactiveStroke
          )}
        />
      </button>
    </div>
  );
};

export default FeedbackButtons;
