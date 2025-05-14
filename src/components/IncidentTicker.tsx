
import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { appIncidents } from '@/components/IncidentStatus';

const IncidentTicker = () => {
  const activeIncidents = appIncidents.filter(app => app.status === 'incident');
  
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
    <div className="bg-[#e6f0ff] border-t border-[#d0e1ff] py-1.5 relative overflow-hidden">
      <div className="ticker-container whitespace-nowrap overflow-hidden w-full">
        <div className="ticker-content inline-block whitespace-nowrap animate-ticker">
          {activeIncidents.map((incident, index) => (
            <React.Fragment key={incident.id}>
              <span className="inline-flex items-center gap-2 mx-6">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-[#004c92] font-medium">
                  <span className="text-red-500 font-semibold">{incident.name}</span>
                  <span className="ml-1">rencontre des difficultés</span>
                </span>
              </span>
              {index < activeIncidents.length - 1 && (
                <span className="mx-4 text-[#004c92]">•</span>
              )}
            </React.Fragment>
          ))}
          {/* Duplicate the content for seamless looping */}
          {activeIncidents.map((incident, index) => (
            <React.Fragment key={`dup-${incident.id}`}>
              <span className="inline-flex items-center gap-2 mx-6">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-[#004c92] font-medium">
                  <span className="text-red-500 font-semibold">{incident.name}</span>
                  <span className="ml-1">rencontre des difficultés</span>
                </span>
              </span>
              {index < activeIncidents.length - 1 && (
                <span className="mx-4 text-[#004c92]">•</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IncidentTicker;
