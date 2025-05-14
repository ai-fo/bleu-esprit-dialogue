
import { AppIncident } from '@/components/IncidentStatus';

// Default incidents data that will be used if no data is found in localStorage
import { appIncidents as defaultIncidents } from '@/components/IncidentStatus';

// Key for storing incidents in localStorage
const STORAGE_KEY = 'oskour_app_incidents';

/**
 * Save incident data to localStorage
 */
export const saveIncidentsToStorage = (incidents: AppIncident[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(incidents));
  } catch (error) {
    console.error('Error saving incidents to localStorage:', error);
  }
};

/**
 * Load incident data from localStorage
 * If no data is found, return default incidents
 */
export const loadIncidentsFromStorage = (): AppIncident[] => {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      return JSON.parse(storedData);
    }
  } catch (error) {
    console.error('Error loading incidents from localStorage:', error);
  }
  
  // Return default incidents if no data in localStorage or error occurs
  return [...defaultIncidents];
};

/**
 * Initialize localStorage with default incidents if it doesn't exist yet
 */
export const initializeIncidentStorage = (): void => {
  if (!localStorage.getItem(STORAGE_KEY)) {
    saveIncidentsToStorage(defaultIncidents);
  }
};
