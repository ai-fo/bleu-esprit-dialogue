
import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import FeedbackButtons from './FeedbackButtons';

export interface ChatMessageProps {
  content: string;
  role: 'user' | 'assistant';
  timestamp?: Date;
  onNewChunkDisplayed?: () => void;
}

// Fonction pour formater le texte avec du Markdown basique et rendre les liens PDF cliquables
const formatText = (text: string): JSX.Element => {
  // Remplacer les astérisques doubles pour le gras
  let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Détecter les URLs PDF et les rendre cliquables avec seulement le nom du fichier affiché
  formattedText = formattedText.replace(
    /(https?:\/\/[^\s]+\.pdf)/g, 
    (match) => {
      try {
        const url = new URL(match);
        const filename = url.pathname.split('/').pop() || match;
        const displayName = filename.replace(/\.pdf$/i, '');
        return `<a href="${match}" target="_blank" class="text-blue-600 hover:underline font-medium">${displayName}</a>`;
      } catch (e) {
        return match;
      }
    }
  );

  // Gérer les listes numérotées (détection de format comme "1.", "2.", etc. au début d'une ligne)
  formattedText = formattedText.replace(
    /(\d+\.\s+)(.*?)(?=\n\d+\.|\n\n|$)/g,
    '<div class="flex gap-2"><span class="font-bold">$1</span><span>$2</span></div>'
  );

  return <div dangerouslySetInnerHTML={{ __html: formattedText }} />;
};

// Fonction utilitaire pour découper un texte en paragraphes
const splitTextIntoChunks = (text: string, maxLength = 300): string[] => {
  if (text.length <= maxLength) return [text];
  
  // Diviser d'abord par les sauts de ligne existants
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  
  // Si les paragraphes sont déjà courts, les retourner directement
  if (paragraphs.every(p => p.length <= maxLength)) {
    return paragraphs;
  }
  
  // Sinon, découper les longs paragraphes en phrases
  const result: string[] = [];
  
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxLength) {
      result.push(paragraph);
      continue;
    }
    
    // Découper en phrases
    const sentences = paragraph.split(/(?<=[.!?])\s+/);
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxLength) {
        if (currentChunk) result.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }
    
    if (currentChunk) result.push(currentChunk.trim());
  }
  
  return result;
};

// Fonction pour obtenir un délai aléatoire
const getRandomDelay = (minDelay: number, maxDelay: number): number => {
  return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
};

// Fonction pour grouper les chunks en MAXIMUM 3 messages
const groupChunksRandomly = (chunks: string[]): string[][] => {
  if (chunks.length <= 1) return [chunks];
  
  const result: string[][] = [];
  
  // Assurer un maximum strict de 3 messages
  const maxMessages = Math.min(3, chunks.length);
  // Déterminer le nombre de messages - entre 1 et maxMessages
  const numberOfMessages = Math.max(1, Math.min(maxMessages, Math.floor(Math.random() * maxMessages) + 1));
  
  // Calculer approximativement combien de chunks par message
  const chunksPerMessage = Math.ceil(chunks.length / numberOfMessages);
  
  let currentGroup: string[] = [];
  
  chunks.forEach((chunk, index) => {
    currentGroup.push(chunk);
    
    // Vérification de fin de groupe
    // Si on est à la fin d'un groupe OU au dernier chunk
    const isLastGroup = result.length === numberOfMessages - 2;
    const isLastChunk = index === chunks.length - 1;
    
    if (isLastChunk) {
      // Si c'est le dernier chunk, ajouter le groupe actuel
      if (currentGroup.length > 0) {
        result.push([...currentGroup]);
      }
    } else if (!isLastGroup && currentGroup.length >= chunksPerMessage) {
      // Si ce n'est pas le dernier groupe et qu'on a atteint la taille cible
      result.push([...currentGroup]);
      currentGroup = [];
    }
  });
  
  // Vérifier qu'on n'a pas dépassé le nombre maximum de messages
  while (result.length > 3) {
    // Fusionner les deux derniers groupes
    const lastGroup = result.pop() || [];
    const secondLastGroup = result.pop() || [];
    result.push([...secondLastGroup, ...lastGroup]);
  }
  
  return result;
};

const ChatMessage: React.FC<ChatMessageProps> = ({
  content,
  role,
  timestamp = new Date(),
  onNewChunkDisplayed
}) => {
  const isUser = role === 'user';
  const contentChunks = splitTextIntoChunks(content);
  const [displayedGroups, setDisplayedGroups] = useState<string[][]>([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(isUser);
  const messageId = React.useMemo(() => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, []);
  
  // Effet pour regrouper les chunks aléatoirement (uniquement pour les messages de l'assistant)
  useEffect(() => {
    if (isUser) {
      setDisplayedGroups([contentChunks]);
      setIsComplete(true);
      return;
    }
    
    // Pour l'assistant, regrouper les chunks en 1-3 groupes
    const groupedChunks = groupChunksRandomly(contentChunks);
    setDisplayedGroups(groupedChunks);
    setCurrentGroupIndex(0);
    setIsComplete(false);
  }, [content, isUser]); // Supprimé contentChunks des dépendances pour éviter des cycles de rendu
  
  // Effet pour afficher progressivement les groupes de messages de l'assistant
  useEffect(() => {
    if (isUser || isComplete || displayedGroups.length === 0) return;
    
    let timerId: NodeJS.Timeout | undefined;
    
    if (currentGroupIndex < displayedGroups.length - 1) {
      const randomDelay = getRandomDelay(700, 1500); // Entre 700ms et 1.5s
      
      timerId = setTimeout(() => {
        setCurrentGroupIndex(prev => prev + 1);
        if (onNewChunkDisplayed) onNewChunkDisplayed();
      }, randomDelay);
    } else {
      setIsComplete(true);
      if (onNewChunkDisplayed) onNewChunkDisplayed();
    }
    
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [currentGroupIndex, displayedGroups.length, isComplete, isUser, onNewChunkDisplayed]); 
  
  // Trigger scroll to bottom when a new chunk is displayed
  useEffect(() => {
    if (onNewChunkDisplayed && !isUser) {
      onNewChunkDisplayed();
    }
  }, [currentGroupIndex, onNewChunkDisplayed, isUser]);
  
  if (displayedGroups.length === 0) return null;
  
  return (
    <div className="flex flex-col w-full gap-1 my-4 animate-slide-in">
      {displayedGroups.slice(0, currentGroupIndex + 1).map((group, groupIndex) => (
        <div 
          key={groupIndex}
          className={cn(
            "flex flex-col max-w-3xl mx-auto w-full",
            isUser ? "items-end" : "items-start"
          )}
        >
          {group.map((chunk, chunkIndex) => (
            <div 
              key={`${groupIndex}-${chunkIndex}`}
              className={cn(
                "group relative max-w-[80%] break-words transition-all duration-300 mb-1",
                "animate-fade-in",
                isUser ? 
                  "px-4 py-3 rounded-2xl bg-gradient-to-r from-[#004c92] to-[#1a69b5] text-white shadow-lg hover:shadow-xl backdrop-blur-sm hover:scale-[1.02] origin-right" : 
                  "px-4 py-3 rounded-2xl bg-white/80 text-[#003366] shadow-sm hover:shadow backdrop-blur-sm"
              )}
            >
              {formatText(chunk)}
            </div>
          ))}
          
          {/* Ajouter les boutons de feedback uniquement à la fin du dernier groupe pour les messages de l'assistant */}
          {!isUser && isComplete && groupIndex === displayedGroups.length - 1 && (
            <div className="ml-2">
              <FeedbackButtons messageId={messageId} />
            </div>
          )}
        </div>
      ))}
      
      {/* Indicateur de frappe pour l'assistant */}
      {!isUser && !isComplete && (
        <div className="flex justify-start my-1 max-w-3xl mx-auto w-full">
          <div className="flex items-center px-4 py-3 bg-white/80 rounded-2xl shadow-sm mb-1">
            <div className="flex space-x-2">
              <span className="w-2.5 h-2.5 bg-[#003366] rounded-full animate-bounce" style={{ animationDelay: '0s', animationDuration: '1s' }}></span>
              <span className="w-2.5 h-2.5 bg-[#003366] rounded-full animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '1s' }}></span>
              <span className="w-2.5 h-2.5 bg-[#003366] rounded-full animate-bounce" style={{ animationDelay: '0.4s', animationDuration: '1s' }}></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
