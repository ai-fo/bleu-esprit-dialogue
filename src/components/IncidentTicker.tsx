
import React from 'react';
import { appIncidents } from './IncidentStatus';

interface IncidentTickerProps {
  theme?: 'user' | 'technician';
}

const IncidentTicker: React.FC<IncidentTickerProps> = ({ theme = 'user' }) => {
  const themeColors = {
    user: {
      bg: 'bg-[#004c92]/5',
      border: 'border-[#004c92]/10',
      text: 'text-[#004c92]/80',
      alertBg: 'bg-[#ea384c]/10',
      alertText: 'text-[#ea384c]/90',
      dotBg: 'bg-[#ea384c]'
    },
    technician: {
      bg: 'bg-[#4c9200]/5',
      border: 'border-[#4c9200]/10',
      text: 'text-[#4c9200]/80',
      alertBg: 'bg-[#ea384c]/10',
      alertText: 'text-[#ea384c]/90',
      dotBg: 'bg-[#ea384c]'
    }
  };

  const colors = themeColors[theme];
  
  // Filter to only show incidents with status 'incident'
  const activeIncidents = appIncidents.filter(incident => incident.status === 'incident');

  if (activeIncidents.length === 0) {
    return null;
  }

  return (
    <div className={`py-2 ${colors.bg} border-t ${colors.border} overflow-hidden relative`}>
      <div className="animate-ticker whitespace-nowrap">
        {[...activeIncidents, ...activeIncidents].map((incident, index) => (
          <span key={index} className="inline-block mx-4 text-sm font-medium">
            <span className="inline-flex items-center">
              <span className={`h-1.5 w-1.5 rounded-full ${colors.dotBg} mr-2 animate-pulse`}></span>
              <span className={`${colors.alertText} mr-1`}>{incident.name}:</span>
              <span className={colors.text}>Problème en cours</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};

export default IncidentTicker;
