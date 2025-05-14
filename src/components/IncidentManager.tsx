
import React, { useState, useEffect } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppIncident } from './IncidentStatus';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface IncidentManagerProps {
  incidents: AppIncident[];
  onIncidentStatusChange: (updatedIncidents: AppIncident[]) => void;
}

const IncidentManager: React.FC<IncidentManagerProps> = ({ incidents, onIncidentStatusChange }) => {
  const [localIncidents, setLocalIncidents] = useState<AppIncident[]>([...incidents]);
  
  // Update checkbox state when an incident's status is changed
  const handleIncidentStatusChange = (id: string, isIncident: boolean) => {
    const updatedIncidents = localIncidents.map(incident => 
      incident.id === id ? { ...incident, status: isIncident ? 'incident' as const : 'ok' as const } : incident
    );
    setLocalIncidents(updatedIncidents);
  };

  // Apply changes to parent component
  const handleApplyChanges = () => {
    onIncidentStatusChange(localIncidents);
    toast({
      title: "Incidents mis à jour",
      description: "Le statut des applications a été mis à jour"
    });
  };

  // Reset to original state
  const handleReset = () => {
    setLocalIncidents([...incidents]);
  };

  // Keep local incidents in sync with parent incidents
  useEffect(() => {
    setLocalIncidents([...incidents]);
  }, [incidents]);

  return (
    <Card className="w-full shadow-sm border border-[#4c9200]/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-[#4c9200] text-lg">Gestion des Incidents</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-3">
            {localIncidents.map((app) => (
              <div key={app.id} className="flex items-center space-x-2">
                <Checkbox 
                  id={`incident-${app.id}`}
                  checked={app.status === 'incident'}
                  onCheckedChange={(checked) => handleIncidentStatusChange(app.id, !!checked)}
                  className="border-[#4c9200]"
                />
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-[#4c9200]">{app.icon}</span>
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
        
        <div className="flex justify-end space-x-2 mt-4">
          <Button 
            variant="outline" 
            onClick={handleReset}
            className="border-[#4c9200] text-[#4c9200] hover:bg-[#e6ffe6]/80"
          >
            Réinitialiser
          </Button>
          <Button 
            onClick={handleApplyChanges}
            className="bg-[#4c9200] hover:bg-[#4c9200]/90"
          >
            Appliquer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default IncidentManager;
