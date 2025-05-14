
import React, { useState, useEffect } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AppIncident } from './IncidentStatus';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { AlertTriangle } from "lucide-react";
import { saveIncidentsToStorage, loadIncidentsFromStorage } from '@/utils/incidentStorage';

interface IncidentManagerProps {
  incidents: AppIncident[];
  onIncidentStatusChange: (updatedIncidents: AppIncident[]) => void;
}

const IncidentManager: React.FC<IncidentManagerProps> = ({ incidents, onIncidentStatusChange }) => {
  // Initialize with incidents from props or localStorage
  const [localIncidents, setLocalIncidents] = useState<AppIncident[]>([...incidents]);
  const incidentCount = localIncidents.filter(app => app.status === 'incident').length;
  
  // Update checkbox state when an incident's status is changed
  const handleIncidentStatusChange = (id: string, isIncident: boolean) => {
    const updatedIncidents = localIncidents.map(incident => 
      incident.id === id ? { ...incident, status: isIncident ? 'incident' as const : 'ok' as const } : incident
    );
    setLocalIncidents(updatedIncidents);
  };

  // Apply changes to parent component and localStorage
  const handleApplyChanges = () => {
    onIncidentStatusChange(localIncidents);
    saveIncidentsToStorage(localIncidents);
    toast({
      title: "Incidents mis à jour",
      description: "Le statut des applications a été mis à jour"
    });
  };

  // Reset to original state
  const handleReset = () => {
    const storedIncidents = loadIncidentsFromStorage();
    setLocalIncidents([...storedIncidents]);
  };

  // Keep local incidents in sync with parent incidents
  useEffect(() => {
    setLocalIncidents([...incidents]);
  }, [incidents]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 border-[#4c9200] bg-[#f0ffe6]/80 hover:bg-[#e6ffe6] hover:text-[#4c9200]">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span>Incidents ({incidentCount})</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-0 bg-white z-50" align="end">
        <div className="px-3 py-2 border-b border-[#4c9200]/10">
          <h3 className="text-[#4c9200] text-sm font-medium">Gestion des Incidents</h3>
        </div>
        <ScrollArea className="h-[300px]">
          <div className="p-3 space-y-3">
            {localIncidents.map((app) => (
              <div key={app.id} className="flex items-center space-x-2">
                <Checkbox 
                  id={`incident-${app.id}`}
                  checked={app.status === 'incident'}
                  onCheckedChange={(checked) => handleIncidentStatusChange(app.id, !!checked)}
                  className="border-[#4c9200]"
                />
                <div className="flex items-center gap-2 flex-1">
                  {app.icon && (
                    <span className="text-[#4c9200]">{app.icon}</span>
                  )}
                  <Label 
                    htmlFor={`incident-${app.id}`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {app.name}
                  </Label>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <div className="flex justify-end space-x-2 p-3 border-t border-[#4c9200]/10">
          <Button 
            variant="outline" 
            onClick={handleReset}
            className="border-[#4c9200] text-[#4c9200] hover:bg-[#e6ffe6]/80"
            size="sm"
          >
            Réinitialiser
          </Button>
          <Button 
            onClick={handleApplyChanges}
            className="bg-[#4c9200] hover:bg-[#4c9200]/90"
            size="sm"
          >
            Appliquer
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default IncidentManager;
