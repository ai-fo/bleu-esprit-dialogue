import React, { useState, useRef, useEffect } from 'react';
import ChatInterface from '@/components/ChatInterface';
import { Button } from "@/components/ui/button";
import { RefreshCw } from 'lucide-react';
import { clearConversation } from '@/lib/api';
import { useToast } from "@/hooks/use-toast";
import { waitTimeInfo } from '@/components/IncidentStatus';
import IncidentTicker from '@/components/IncidentTicker';
import IncidentManager from '@/components/IncidentManager';
import { Clock } from 'lucide-react';
import { loadIncidentsFromStorage, initializeIncidentStorage, saveIncidentsToStorage } from '@/utils/incidentStorage';

// Trending questions for admin view
const ADMIN_TRENDING_QUESTIONS = ["Comment résoudre les problèmes avec Artis?", "Problèmes fréquents avec SAS", "Guide de dépannage rapide"];

const AdminView = () => {
  const [isAnimated, setIsAnimated] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const logoRef = useRef(null);
  const { toast } = useToast();
  const [managedIncidents, setManagedIncidents] = useState(loadIncidentsFromStorage());
  const [tickerUpdateKey, setTickerUpdateKey] = useState(Date.now());
  
  // Initialize localStorage with default incidents if needed
  useEffect(() => {
    initializeIncidentStorage();
    setManagedIncidents(loadIncidentsFromStorage());
  }, []);
  
  const handleIncidentStatusChange = (updatedIncidents) => {
    console.log('Updating incidents in AdminView:', updatedIncidents);
    setManagedIncidents(updatedIncidents);
    saveIncidentsToStorage(updatedIncidents);
    setTickerUpdateKey(Date.now()); // Force ticker update
    
    // Dispatch custom event for cross-tab communication
    const incidentUpdateEvent = new Event('incident-update');
    window.dispatchEvent(incidentUpdateEvent);
  };
  
  const handleFirstMessage = () => {
    setIsAnimated(true);
  };
  
  const handleNewChat = async () => {
    try {
      await clearConversation();
      setIsAnimated(false);
      setChatKey(prev => prev + 1);
      toast({
        title: "Conversation réinitialisée",
        description: "Une nouvelle conversation a été démarrée"
      });
    } catch (error) {
      console.error("Erreur lors de la réinitialisation de la conversation:", error);
      toast({
        title: "Erreur",
        description: "Impossible de réinitialiser la conversation",
        variant: "destructive"
      });
    }
  };

  // Mouse movement effect for logo - applied regardless of isAnimated state
  useEffect(() => {
    const logo = logoRef.current;
    if (!logo) return;
    const handleMouseMove = e => {
      const rect = logo.getBoundingClientRect();
      const logoX = rect.left + rect.width / 2;
      const logoY = rect.top + rect.height / 2;

      // Calculate mouse position relative to the center of the logo
      const mouseX = e.clientX - logoX;
      const mouseY = e.clientY - logoY;

      // Calculate rotation angles (limit the effect to a reasonable range)
      const rotateY = mouseX * 0.05; // Horizontal axis rotation
      const rotateX = -mouseY * 0.05; // Vertical axis rotation (note the negative to make it intuitive)

      // Apply the transform with perspective for 3D effect
      logo.style.transform = `perspective(500px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    };

    // Reset transform when mouse leaves the window or stops moving
    const handleMouseLeave = () => {
      logo.style.transform = 'perspective(500px) rotateX(0deg) rotateY(0deg)';
    };

    // Add a debounced reset to initial position when mouse stops moving
    let timeout;
    const handleMouseStop = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        logo.style.transform = 'perspective(500px) rotateX(0deg) rotateY(0deg)';
      }, 200); // Reset after 200ms of no movement
    };
    
    window.addEventListener('mousemove', e => {
      handleMouseMove(e);
      handleMouseStop();
    });
    window.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#fff8eb]/80">
      {/* Header */}
      <header className="pt-2 pb-1 px-4 sm:px-6 lg:px-8 border-b border-[#F97316]/10">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          {/* Logo and title - fully left aligned with large font size */}
          <div className="flex items-center pl-0">
            {/* Logo shown only in chat mode */}
            {isAnimated && (
              <div className="w-8 h-8 flex-shrink-0 animate-scale-in">
                <img 
                  ref={logoRef} 
                  src="/lovable-uploads/fb0ab2b3-5c02-4037-857a-19b40f122960.png" 
                  alt="Oskour Logo" 
                  className="w-full h-full object-contain transition-transform duration-200 ease-out" 
                />
              </div>
            )}
            <h1 className="text-3xl sm:text-4xl font-bold text-[#F97316] transition-all duration-500 cursor-pointer ml-0 mr-2">
              Oskour Admin
            </h1>
            
            {/* Refresh button - positioned next to the title when in chat mode */}
            {isAnimated && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-[#FFF0E0]/50 h-8 w-8" 
                onClick={handleNewChat} 
                title="Nouvelle conversation"
              >
                <RefreshCw className="h-4 w-4 text-[#F97316]" />
              </Button>
            )}
          </div>
          
          {/* Actions and wait time info */}
          <div className="flex items-center gap-3 sm:gap-4">
            <IncidentManager 
              incidents={managedIncidents}
              onIncidentStatusChange={handleIncidentStatusChange}
            />
            
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/'} 
              className="border-[#F97316] text-[#F97316] hover:bg-[#F97316]/10"
            >
              Vue Utilisateur
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/cockpit'} 
              className="border-[#F97316] text-[#F97316] hover:bg-[#F97316]/10"
            >
              Cockpit
            </Button>
            
            {/* Wait time info */}
            <div className="flex items-center">
              <div className="flex items-center gap-2 bg-[#FEC6A1] rounded-full px-3 py-1 shadow-sm border border-[#F97316]">
                <Clock className="h-3 w-3 text-[#ea384c]" />
                <span className="text-xs text-[#F97316] font-medium">~{waitTimeInfo.minutes} min</span>
                <span className="hidden sm:inline text-xs text-[#F97316]/80">{waitTimeInfo.callers} appelants</span>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content with chat interface */}
      <main className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full overflow-hidden pb-10">
        <div className="flex flex-1 w-full h-full">
          {/* Chat interface */}
          <div className="flex flex-col h-full w-full transition-all duration-500">
            <ChatInterface 
              key={`admin-${chatKey}`} 
              chatbotName="Charles" 
              initialMessage="Bonjour ! Je suis Charles, votre assistant administrateur. Comment puis-je vous aider aujourd'hui ?" 
              onFirstMessage={handleFirstMessage} 
              trendingQuestions={ADMIN_TRENDING_QUESTIONS}
              theme="technician"
              trendingQuestionsTitle="Questions fréquentes posées par les admins"
              source="admin"
            />
          </div>
        </div>
      </main>
      
      {/* Incident ticker placed at the bottom of the page */}
      <IncidentTicker 
        key={`ticker-${tickerUpdateKey}`} 
        theme="technician" 
        incidents={managedIncidents} 
      />
    </div>
  );
};

export default AdminView;
