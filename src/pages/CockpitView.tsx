
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { loadIncidentsFromStorage } from '@/utils/incidentStorage';
import { useToast } from "@/hooks/use-toast";
import { Clock, Bell, AlertTriangle, PhoneCall } from 'lucide-react';
import { AppIncident } from '@/components/IncidentStatus';
import IncidentTicker from '@/components/IncidentTicker';

// Type for incident analytics data
interface IncidentAnalytic {
  id: string;
  name: string;
  count: number;
  firstReported: Date;
  resolvedAt: Date | null;
}

// Type for hourly data
interface HourlyData {
  hour: string;
  incidents: number;
}

const CockpitView = () => {
  // Get incidents data
  const [incidents, setIncidents] = useState<AppIncident[]>(loadIncidentsFromStorage());
  const [tickerUpdateKey, setTickerUpdateKey] = useState(Date.now());
  const [visualAlertThreshold, setVisualAlertThreshold] = useState(20);
  const [notificationThreshold, setNotificationThreshold] = useState(30);
  const [preventDuplicateAlerts, setPreventDuplicateAlerts] = useState(true);
  const [displayView, setDisplayView] = useState<'table' | 'cards'>('table');
  const { toast } = useToast();
  
  // Simulated data for incident analytics
  const [incidentAnalytics, setIncidentAnalytics] = useState<IncidentAnalytic[]>([]);

  // Generate mock analytics data based on actual incidents
  useEffect(() => {
    const mockAnalytics: IncidentAnalytic[] = incidents
      .filter(inc => inc.status === 'incident')
      .map((inc, index) => {
        // Random count between 5 and 50
        const count = Math.floor(Math.random() * 45) + 5;
        
        // Random first reported time in the last 24 hours
        const firstReported = new Date();
        firstReported.setHours(firstReported.getHours() - Math.floor(Math.random() * 24));
        
        // 50% chance of being resolved
        const resolved = Math.random() > 0.5;
        let resolvedAt = null;
        if (resolved) {
          resolvedAt = new Date(firstReported);
          resolvedAt.setHours(resolvedAt.getHours() + Math.floor(Math.random() * 8) + 1);
        }
        
        return {
          id: inc.id,
          name: inc.name,
          count,
          firstReported,
          resolvedAt
        };
      });
      
    // Sort by count (descending)
    mockAnalytics.sort((a, b) => b.count - a.count);
    
    // Take top 10
    setIncidentAnalytics(mockAnalytics.slice(0, 10));
  }, [incidents]);
  
  // Generate hourly data for the chart
  const hourlyData = useMemo(() => {
    const data: HourlyData[] = [];
    const now = new Date();
    
    for (let i = 23; i >= 0; i--) {
      const hour = new Date();
      hour.setHours(now.getHours() - i);
      
      data.push({
        hour: hour.getHours().toString().padStart(2, '0') + ':00',
        incidents: Math.floor(Math.random() * 30) + (i < 5 ? 10 : 0) // More incidents in recent hours
      });
    }
    
    return data;
  }, []);
  
  // Function to trigger alerts
  const triggerAlert = (incident: IncidentAnalytic) => {
    if (incident.count > notificationThreshold) {
      toast({
        title: "Alert Notification Sent!",
        description: `Email and SMS alerts sent for ${incident.name} (${incident.count} reports)`
      });
    }
  };
  
  // Check and trigger alerts on threshold changes or new data
  useEffect(() => {
    // Find incidents over threshold
    const alertIncidents = incidentAnalytics.filter(inc => inc.count > notificationThreshold);
    
    if (alertIncidents.length > 0) {
      if (!preventDuplicateAlerts || localStorage.getItem('lastAlerted') !== alertIncidents[0].id) {
        triggerAlert(alertIncidents[0]);
        localStorage.setItem('lastAlerted', alertIncidents[0].id);
      }
    }
  }, [incidentAnalytics, notificationThreshold, preventDuplicateAlerts]);
  
  // Update when localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      setIncidents(loadIncidentsFromStorage());
      setTickerUpdateKey(Date.now());
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('incident-update', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('incident-update', handleStorageChange);
    };
  }, []);
  
  // Format date for display
  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#1A1F2C]">
      {/* Header - similar to other views but with purple theme */}
      <header className="pt-2 pb-1 px-4 sm:px-6 lg:px-8 border-b border-[#9b87f5]/10">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          {/* Logo and title */}
          <div className="flex items-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-[#9b87f5] ml-0 mr-2">
              Oskour Cockpit
            </h1>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/'} 
              className="border-[#9b87f5] text-[#9b87f5] hover:bg-[#9b87f5]/10"
            >
              Vue Utilisateur
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/admin'} 
              className="border-[#9b87f5] text-[#9b87f5] hover:bg-[#9b87f5]/10"
            >
              Vue Admin
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full overflow-y-auto pb-10">
        <div className="py-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Tableau de bord des incidents</h2>
            <div className="flex items-center gap-2">
              <Button 
                variant={displayView === 'table' ? "default" : "outline"}
                onClick={() => setDisplayView('table')} 
                className="bg-[#9b87f5] hover:bg-[#7E69AB] text-white"
                size="sm"
              >
                Tableau
              </Button>
              <Button 
                variant={displayView === 'cards' ? "default" : "outline"}
                onClick={() => setDisplayView('cards')} 
                className="bg-[#9b87f5] hover:bg-[#7E69AB] text-white"
                size="sm"
              >
                Cartes
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Top incidents panel */}
            <div className="md:col-span-2">
              <Card className="bg-[#252A37] border-[#9b87f5]/20 text-white shadow-lg">
                <CardHeader>
                  <CardTitle className="text-[#9b87f5]">Top 10 des incidents</CardTitle>
                  <CardDescription className="text-gray-400">
                    Les incidents les plus signalés aujourd'hui
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {displayView === 'table' ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-[#9b87f5]/20 hover:bg-[#2A3040]">
                            <TableHead className="text-[#D6BCFA]">Incident</TableHead>
                            <TableHead className="text-[#D6BCFA]">Signalements</TableHead>
                            <TableHead className="text-[#D6BCFA]">Première alerte</TableHead>
                            <TableHead className="text-[#D6BCFA]">Résolution</TableHead>
                            <TableHead className="text-[#D6BCFA]">Statut</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {incidentAnalytics.map(incident => (
                            <TableRow 
                              key={incident.id}
                              className={`border-[#9b87f5]/10 hover:bg-[#2A3040] ${
                                incident.count > visualAlertThreshold ? 'bg-[#ea384c]/10' : ''
                              }`}
                            >
                              <TableCell className="font-medium">{incident.name}</TableCell>
                              <TableCell className="font-bold">{incident.count}</TableCell>
                              <TableCell>{formatDate(incident.firstReported)}</TableCell>
                              <TableCell>{formatDate(incident.resolvedAt)}</TableCell>
                              <TableCell>
                                {incident.resolvedAt ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs">
                                    Résolu
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs">
                                    En cours
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {incidentAnalytics.map(incident => (
                        <Card key={incident.id} className={`border ${
                          incident.count > visualAlertThreshold 
                            ? 'border-[#ea384c] bg-[#ea384c]/10' 
                            : 'border-[#9b87f5]/20 bg-[#2A3040]'
                        }`}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-center mb-2">
                              <h3 className="font-bold text-white">{incident.name}</h3>
                              {incident.resolvedAt ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs">
                                  Résolu
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs">
                                  En cours
                                </span>
                              )}
                            </div>
                            <div className="flex justify-between items-center text-sm text-gray-400">
                              <span>Première: {formatDate(incident.firstReported)}</span>
                              <span>Résolution: {formatDate(incident.resolvedAt)}</span>
                            </div>
                            <div className="mt-3 text-center">
                              <span className="text-2xl font-bold text-[#9b87f5]">
                                {incident.count} signalements
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* Alert settings panel */}
            <div className="md:col-span-1">
              <Card className="bg-[#252A37] border-[#9b87f5]/20 text-white h-full shadow-lg">
                <CardHeader>
                  <CardTitle className="text-[#9b87f5]">Configuration des alertes</CardTitle>
                  <CardDescription className="text-gray-400">
                    Définir les seuils d'alerte
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between">
                        <Label className="text-white">Seuil d'alerte visuelle</Label>
                        <span className="text-[#9b87f5] font-bold">{visualAlertThreshold}</span>
                      </div>
                      <Slider 
                        defaultValue={[20]}
                        max={50}
                        min={5}
                        step={1}
                        onValueChange={(values) => setVisualAlertThreshold(values[0])}
                        className="my-2"
                      />
                      <p className="text-xs text-gray-400">
                        Les incidents dépassant ce nombre seront mis en évidence
                      </p>
                    </div>
                    
                    <div>
                      <div className="flex justify-between">
                        <Label className="text-white">Seuil de notification</Label>
                        <span className="text-[#9b87f5] font-bold">{notificationThreshold}</span>
                      </div>
                      <Slider 
                        defaultValue={[30]} 
                        max={50}
                        min={10}
                        step={1}
                        onValueChange={(values) => setNotificationThreshold(values[0])}
                        className="my-2"
                      />
                      <p className="text-xs text-gray-400">
                        Déclenche des notifications email/SMS automatiques
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="prevent-duplicates" 
                      checked={preventDuplicateAlerts}
                      onCheckedChange={setPreventDuplicateAlerts}
                    />
                    <Label htmlFor="prevent-duplicates" className="text-white">
                      Prévenir les notifications multiples
                    </Label>
                  </div>
                  
                  <div className="pt-4 space-y-3">
                    <Button 
                      className="w-full bg-[#9b87f5] hover:bg-[#7E69AB] text-white"
                      onClick={() => {
                        toast({
                          title: "Test Email",
                          description: "Un email de test a été envoyé avec succès"
                        });
                      }}
                    >
                      <Bell className="w-4 h-4 mr-2" /> Tester Email
                    </Button>
                    
                    <Button 
                      className="w-full bg-[#9b87f5] hover:bg-[#7E69AB] text-white"
                      onClick={() => {
                        toast({
                          title: "Test SMS",
                          description: "Un SMS de test a été envoyé avec succès"
                        });
                      }}
                    >
                      <PhoneCall className="w-4 h-4 mr-2" /> Tester SMS
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Analytics Chart */}
          <div className="mt-6">
            <Card className="bg-[#252A37] border-[#9b87f5]/20 text-white shadow-lg">
              <CardHeader>
                <CardTitle className="text-[#9b87f5]">Volumétrie des incidents</CardTitle>
                <CardDescription className="text-gray-400">
                  Évolution du nombre d'incidents sur les dernières 24 heures
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={hourlyData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis 
                      dataKey="hour" 
                      stroke="#9b87f5" 
                      tick={{fill: '#D6BCFA'}}
                      tickLine={{stroke: '#9b87f5'}}
                    />
                    <YAxis 
                      stroke="#9b87f5" 
                      tick={{fill: '#D6BCFA'}}
                      tickLine={{stroke: '#9b87f5'}}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#1A1F2C', 
                        borderColor: '#9b87f5',
                        color: 'white'
                      }}
                      labelStyle={{color: '#9b87f5'}}
                    />
                    <Bar 
                      dataKey="incidents" 
                      fill="#9b87f5" 
                      radius={[4, 4, 0, 0]}
                      name="Incidents"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      {/* Incident ticker at the bottom */}
      <IncidentTicker 
        key={`ticker-${tickerUpdateKey}`} 
        theme="user" 
        incidents={incidents} 
      />
    </div>
  );
};

export default CockpitView;
