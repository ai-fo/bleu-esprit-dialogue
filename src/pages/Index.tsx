
import React, { useState, useRef, useEffect } from 'react';
import ChatInterface from '@/components/ChatInterface';
import { Button } from "@/components/ui/button";
import { RefreshCw } from 'lucide-react';
import { clearConversation } from '@/lib/api';
import { useToast } from "@/components/ui/use-toast";
import { waitTimeInfo } from '@/components/IncidentStatus';
import IncidentTicker from '@/components/IncidentTicker';
import { Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Trending questions without having to access them from ChatInterface
const TRENDING_QUESTIONS = ["Problème avec Artis", "SAS est très lent aujourd'hui", "Impossible d'accéder à mon compte"];

const Index = () => {
  const [isAnimated, setIsAnimated] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [activeTab, setActiveTab] = useState("user");
  const logoRef = useRef(null);
  const { toast } = useToast();

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

    const handleMouseMove = (e) => {
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

    window.addEventListener('mousemove', (e) => {
      handleMouseMove(e);
      handleMouseStop();
    });
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      clearTimeout(timeout);
    };
  }, []);  // No dependencies needed since the effect runs only once

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Tabs 
        defaultValue="user" 
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <div className={`transition-all duration-500 ease-in-out pt-2 pb-1 px-6 bg-${activeTab === "user" ? "[#e6f0ff]/80" : "[#f0ffe6]/80"}`}>
          <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-4">
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
              <div className="flex items-center">
                <h1 className={`text-xl sm:text-2xl font-bold text-${activeTab === "user" ? "[#004c92]" : "[#4c9200]"} transition-all duration-500 cursor-pointer`}>
                  Oskour
                </h1>
                
                {/* Refresh button - positioned next to the title when in chat mode */}
                {isAnimated && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`rounded-full hover:bg-${activeTab === "user" ? "[#E6F0FF]" : "[#E6FFE6]"}/50 h-8 w-8 ml-2`}
                    onClick={handleNewChat} 
                    title="Nouvelle conversation"
                  >
                    <RefreshCw className={`h-4 w-4 text-${activeTab === "user" ? "[#004c92]" : "[#4c9200]"}`} />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Tabs navigation */}
              <TabsList className={`bg-${activeTab === "user" ? "[#e6f0ff]" : "[#e6ffe6]"}`}>
                <TabsTrigger 
                  value="user"
                  className={activeTab === "user" ? "bg-white text-[#004c92]" : "text-[#4c9200]/70"}
                >
                  Vue Utilisateur
                </TabsTrigger>
                <TabsTrigger 
                  value="technician"
                  className={activeTab === "technician" ? "bg-white text-[#4c9200]" : "text-[#004c92]/70"}
                >
                  Vue Technicien
                </TabsTrigger>
              </TabsList>
              
              {/* Wait time info in the top right */}
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-2 bg-${activeTab === "user" ? "[#0a5db3]" : "[#0ab35d]"} rounded-full px-3 py-1 shadow-sm border border-${activeTab === "user" ? "[#1a6dc3]" : "[#1ac36d]"}`}>
                  <Clock className="h-3 w-3 text-[#ea384c]" />
                  <span className="text-xs text-white font-medium">~{waitTimeInfo.minutes} min d'attente</span>
                  <span className="text-xs text-white/80">{waitTimeInfo.callers} appelants</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <TabsContent 
          value="user" 
          className="flex-1 flex flex-col bg-[#e6f0ff]/80 m-0 outline-none border-none"
        >
          {/* Main content with chat */}
          <main className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full overflow-hidden">
            <div className="flex flex-1 w-full gap-4 h-full">
              {/* Chat interface */}
              <div className={`flex flex-col h-full w-full transition-all duration-500`}>
                <ChatInterface 
                  key={`user-${chatKey}`} 
                  chatbotName="Bill" 
                  initialMessage="Bonjour ! Je suis Bill, votre assistant personnel. Comment puis-je vous aider aujourd'hui ?" 
                  onFirstMessage={handleFirstMessage} 
                  trendingQuestions={TRENDING_QUESTIONS} 
                />
              </div>
            </div>
          </main>
          
          {/* Incident ticker */}
          <IncidentTicker />
        </TabsContent>
        
        <TabsContent 
          value="technician" 
          className="flex-1 flex flex-col bg-[#f0ffe6]/80 m-0 outline-none border-none"
        >
          {/* Main content with chat - technician view */}
          <main className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full overflow-hidden">
            <div className="flex flex-1 w-full gap-4 h-full">
              {/* Chat interface */}
              <div className={`flex flex-col h-full w-full transition-all duration-500`}>
                <ChatInterface 
                  key={`technician-${chatKey}`} 
                  chatbotName="Bill (Tech)" 
                  initialMessage="Bonjour ! Je suis Bill, votre assistant technique. Comment puis-je vous aider aujourd'hui ?" 
                  onFirstMessage={handleFirstMessage} 
                  trendingQuestions={["Mise à jour serveur bloquée", "Problème de déploiement", "Accès VPN impossible"]} 
                  theme="technician"
                />
              </div>
            </div>
          </main>
          
          {/* Incident ticker - with technician theme */}
          <IncidentTicker theme="technician" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
