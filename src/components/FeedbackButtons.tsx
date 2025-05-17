import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { sendFeedback } from '@/lib/api';

interface FeedbackButtonsProps {
  messageId: number | string;
  theme?: 'user' | 'technician';
}

const FeedbackButtons: React.FC<FeedbackButtonsProps> = ({ messageId, theme = 'user' }) => {
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);
  const [loading, setLoading] = useState(false);
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

  const handleFeedback = async (type: 'positive' | 'negative') => {
    if (loading) return;
    
    try {
      setLoading(true);
      setFeedback(type);
      
      // Convertir messageId en nombre si c'est une chaîne
      const numericMessageId = typeof messageId === 'string' ? parseInt(messageId, 10) : messageId;
      
      // Ne pas envoyer si le messageId n'est pas un nombre valide ou est -1
      if (isNaN(numericMessageId) || numericMessageId < 0) {
        console.log("MessageId invalide, feedback non envoyé:", messageId);
        return;
      }
      
      // Rating: 5 pour positif, 1 pour négatif
      const rating = type === 'positive' ? 5 : 1;
      
      // Envoyer le feedback au backend via notre API
      await sendFeedback({
        message_id: numericMessageId,
        rating,
        comment: type === 'positive' ? 'Réponse utile' : 'Réponse non satisfaisante'
      });
      
      console.log(`Feedback ${type} envoyé pour le message ${messageId}`);
      
      toast({
        title: "Merci pour votre retour",
        description: type === 'positive' 
          ? "C'est noté ! Votre feedback positif a été enregistré." 
          : "Nous sommes désolés que cette réponse ne soit pas satisfaisante. Votre retour nous aidera à nous améliorer.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Erreur lors de l'envoi du feedback:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer votre feedback. Veuillez réessayer plus tard.",
        duration: 3000,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleFeedback('positive')}
        className={cn(
          "rounded-full p-1 transition-colors",
          feedback === 'positive' ? themeColors.activeBg : themeColors.hoverBg,
          loading && "opacity-50 cursor-not-allowed"
        )}
        aria-label="Feedback positif"
        disabled={loading}
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
          feedback === 'negative' ? themeColors.activeBg : themeColors.hoverBg,
          loading && "opacity-50 cursor-not-allowed"
        )}
        aria-label="Feedback négatif"
        disabled={loading}
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
