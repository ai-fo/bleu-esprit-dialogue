import React, { useEffect, useState, useRef } from 'react';
import { appIncidents } from './IncidentStatus';
import { loadIncidentsFromStorage } from '@/utils/incidentStorage';
import { AppIncident } from './IncidentStatus';

interface IncidentTickerProps {
  theme?: 'user' | 'technician';
  incidents?: AppIncident[];
}

const IncidentTicker: React.FC<IncidentTickerProps> = ({ 
  theme = 'user',
  incidents: propIncidents
}) => {
  const [incidents, setIncidents] = useState<AppIncident[]>(propIncidents || loadIncidentsFromStorage());
  const [tickerKey, setTickerKey] = useState(Date.now().toString());
  const [isVisible, setIsVisible] = useState(true);
  const tickerRef = useRef<HTMLDivElement>(null);

  // Update incidents if provided via props or when localStorage changes
  useEffect(() => {
    if (propIncidents) {
      setIncidents(propIncidents);
      setTickerKey(Date.now().toString());
    } else {
      setIncidents(loadIncidentsFromStorage());
      setTickerKey(Date.now().toString());
    }
    
    // Listen for storage events to update incidents when changed in another tab/window
    const handleStorageChange = () => {
      if (!propIncidents) {
        setIncidents(loadIncidentsFromStorage());
        setTickerKey(Date.now().toString());
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('incident-update', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('incident-update', handleStorageChange);
    };
  }, [propIncidents]);

  // Regular refresh of the ticker to ensure smooth animation
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      setTickerKey(Date.now().toString());
    }, 240000); // Match the animation duration (240s - 4 minutes)
    
    return () => clearInterval(refreshInterval);
  }, []);
  
  // Update when props change
  useEffect(() => {
    if (propIncidents) {
      setIncidents(propIncidents);
      setTickerKey(Date.now().toString());
    }
  }, [propIncidents]);

  // Duplicate the incident content to ensure seamless looping
  useEffect(() => {
    if (tickerRef.current && tickerRef.current.firstChild) {
      const tickerContent = tickerRef.current.firstChild as HTMLElement;
      
      // Reset animation if needed
      tickerContent.style.animation = 'none';
      tickerContent.offsetHeight; // Trigger reflow
      tickerContent.style.animation = '';
    }
  }, [incidents, tickerKey]);

  const themeColors = {
    user: {
      bg: 'bg-[#e6f0ff]/80',
      border: 'border-[#004c92]/10',
      text: 'text-[#004c92]/80',
      alertBg: 'bg-[#ea384c]/10',
      alertText: 'text-[#ea384c]/90',
      dotBg: 'bg-[#ea384c]'
    },
    technician: {
      bg: 'bg-[#fff0e6]/80', 
      border: 'border-[#F97316]/10',
      text: 'text-[#F97316]/80', 
      alertBg: 'bg-[#ea384c]/10',
      alertText: 'text-[#ea384c]/90',
      dotBg: 'bg-[#ea384c]'
    }
  };

  const colors = themeColors[theme];
  
  // Filter to only show incidents with status 'incident'
  const activeIncidents = incidents.filter(incident => incident.status === 'incident');

  // Check if there are any active incidents
  if (activeIncidents.length === 0) {
    return null; // Don't render anything if there are no active incidents
  }
  
  // Repeat the incidents multiple times to ensure the ticker is never empty
  const minRepetitions = 10;
  const repetitions = Math.max(minRepetitions, Math.ceil(100 / activeIncidents.length));
  
  console.log('Rendering ticker with incidents:', activeIncidents);
  console.log('Current tickerKey:', tickerKey);
  console.log('Using repetitions:', repetitions);

  if (!isVisible) return null;

  // Create incident item
  const createIncidentItem = (incident: AppIncident, index: number) => (
    <div key={`${incident.id}-${index}-${tickerKey}`} className="ticker-item inline-flex items-center">
      <span className={`h-1.5 w-1.5 rounded-full ${colors.dotBg} mr-2 animate-pulse`}></span>
      <span className={`${colors.alertText} mr-1 font-medium`}>{incident.name}:</span>
      <span className={colors.text}>Problème en cours</span>
    </div>
  );

  // Create repeated incident items
  const repeatedIncidents = Array.from({ length: repetitions }).flatMap((_, repIndex) =>
    activeIncidents.map((incident, incidentIndex) => 
      createIncidentItem(incident, incidentIndex + (repIndex * activeIncidents.length))
    )
  );

  return (
    <div className={`py-2 ${colors.bg} border-t ${colors.border} overflow-hidden fixed bottom-0 left-0 right-0 w-full z-50 incident-ticker-container`}>
      <div ref={tickerRef} className="ticker-wrapper">
        <div key={tickerKey} className="ticker-content">
          {repeatedIncidents}
        </div>
      </div>
    </div>
  );
};

export default IncidentTicker;
