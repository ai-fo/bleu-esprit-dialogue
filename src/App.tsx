
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import AdminView from "./pages/AdminView";
import CockpitView from "./pages/CockpitView";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";
import { initializeIncidentStorage } from "./utils/incidentStorage";

const queryClient = new QueryClient();

const App = () => {
  // Initialize incident storage when the app first loads
  useEffect(() => {
    initializeIncidentStorage();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/admin" element={<AdminView />} />
            <Route path="/cockpit" element={<CockpitView />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
