
import React, { useEffect, useState } from 'react';
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

  // Update incidents if provided via props or when localStorage changes
  useEffect(() => {
    if (propIncidents) {
      setIncidents(propIncidents);
    } else {
      setIncidents(loadIncidentsFromStorage());
    }
    
    // Listen for storage events to update incidents when changed in another tab/window
    const handleStorageChange = () => {
      if (!propIncidents) {
        setIncidents(loadIncidentsFromStorage());
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [propIncidents]);

  // Force re-render when incidents change by including a key
  const tickerKey = JSON.stringify(incidents);

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

  // Default message when no active incidents
  const defaultMessage = {
    id: "system-no-incidents",
    name: "Système",
    message: "Aucun incident actif",
    status: "incident" as const
  };

  // Use default message if no active incidents
  const displayIncidents = activeIncidents.length === 0 ? [defaultMessage] : activeIncidents;
  
  // Create many more repetitions to ensure the ticker never shows empty space
  // Significantly increased repetitions to ensure continuous content
  const repeatedIncidents = Array(30).fill(displayIncidents).flat();

  return (
    <div className={`py-2 ${colors.bg} border-t ${colors.border} overflow-hidden fixed bottom-0 left-0 right-0 w-full z-50`}>
      <div className="overflow-hidden relative w-full">
        <div key={tickerKey} className="ticker-content whitespace-nowrap">
          {repeatedIncidents.map((incident, index) => (
            <span key={`${incident.id}-${index}`} className="inline-block mx-4 text-sm font-medium">
              <span className="inline-flex items-center">
                <span className={`h-1.5 w-1.5 rounded-full ${colors.dotBg} mr-2 animate-pulse`}></span>
                <span className={`${colors.alertText} mr-1`}>{incident.name}:</span>
                <span className={colors.text}>Problème en cours</span>
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IncidentTicker;
