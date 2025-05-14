
import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { appIncidents } from '@/components/IncidentStatus';
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";

const IncidentTicker = () => {
  const activeIncidents = appIncidents.filter(app => app.status === 'incident');
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-advance the carousel every 5 seconds
  useEffect(() => {
    if (activeIncidents.length <= 1) return;
    
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % activeIncidents.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [activeIncidents.length]);

  if (activeIncidents.length === 0) {
    return (
      <div className="bg-[#e6f0ff] border-t border-[#d0e1ff] py-1.5 px-4 text-center flex items-center justify-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 text-[#004c92] font-medium">
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full"></span>
          Tous les systèmes fonctionnent normalement
        </span>
      </div>
    );
  }

  return (
    <div className="bg-[#e6f0ff] border-t border-[#d0e1ff] py-1.5 overflow-hidden">
      <Carousel 
        className="max-w-4xl mx-auto" 
        opts={{ 
          align: 'start',
          loop: true,
        }}
      >
        <CarouselContent>
          {activeIncidents.map((incident) => (
            <CarouselItem key={incident.id} className="basis-full">
              <div className="flex items-center justify-center gap-2 text-sm px-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-[#004c92] font-medium flex items-center gap-2">
                  <span className="text-red-500 font-semibold">{incident.name}</span>
                  <span>rencontre des difficultés</span>
                </span>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
};

export default IncidentTicker;
