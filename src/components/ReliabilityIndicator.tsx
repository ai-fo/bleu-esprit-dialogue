
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import { ShieldCheck, ShieldAlert, AlertCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ReliabilityLevel = 'high' | 'medium' | 'low';

interface ReliabilityIndicatorProps {
  score: number;
  className?: string;
}

const ReliabilityIndicator: React.FC<ReliabilityIndicatorProps> = ({ score, className }) => {
  // Determine level based on score
  const level: ReliabilityLevel = score >= 90 ? 'high' : score >= 70 ? 'medium' : 'low';
  
  const getConfig = () => {
    switch (level) {
      case 'high':
        return {
          icon: ShieldCheck,
          color: 'bg-gradient-to-r from-purple-50 to-[#E5DEFF] text-[#6E59A5] border border-purple-200 shadow-sm',
          label: 'Fiabilité élevée',
          description: 'Cette réponse est basée sur des sources fiables et vérifiées.'
        };
      case 'medium':
        return {
          icon: AlertCircle,
          color: 'bg-gradient-to-r from-amber-50 to-[#FEF7CD] text-amber-700 border border-amber-200 shadow-sm',
          label: 'Fiabilité moyenne',
          description: 'Cette réponse est basée sur des sources partiellement vérifiées.'
        };
      case 'low':
        return {
          icon: ShieldAlert,
          color: 'bg-gradient-to-r from-red-50 to-[#FFDEE2] text-[#ea384c] border border-red-200 shadow-sm',
          label: 'Fiabilité faible',
          description: 'Cette réponse pourrait contenir des imprécisions.'
        };
      default:
        return {
          icon: AlertCircle,
          color: 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-500 border border-gray-200 shadow-sm',
          label: 'Fiabilité inconnue',
          description: 'Impossible de déterminer la fiabilité de cette réponse.'
        };
    }
  };

  const config = getConfig();
  const IconComponent = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          className={cn(
            "flex items-center justify-center h-6 w-6 rounded-full transition-all p-0",
            "hover:scale-110 hover:shadow-md backdrop-blur-sm",
            config.color,
            className
          )}
        >
          <IconComponent className="animate-pulse" size={14} strokeWidth={2.5} />
        </Badge>
      </TooltipTrigger>
      <TooltipContent 
        side="top" 
        className="max-w-xs text-center bg-white/90 backdrop-blur-lg border shadow-lg rounded-xl p-3"
      >
        <p className="font-medium">{config.label}</p>
        <p className="text-sm text-gray-600">{config.description}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default ReliabilityIndicator;
