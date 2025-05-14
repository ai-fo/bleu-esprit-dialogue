
import { AppIncident } from '@/components/IncidentStatus';

// Default incidents data that will be used if no data is found in localStorage
import { appIncidents as defaultIncidents } from '@/components/IncidentStatus';

// Key for storing incidents in localStorage
const STORAGE_KEY = 'oskour_app_incidents';

/**
 * Save incident data to localStorage
 * Converts React nodes to string representations for storage
 */
export const saveIncidentsToStorage = (incidents: AppIncident[]): void => {
  try {
    // Create a serializable version of the incidents
    const serializableIncidents = incidents.map(incident => ({
      id: incident.id,
      name: incident.name,
      status: incident.status,
      // We can't store React nodes in localStorage, so we'll recreate them on load
      iconType: incident.id // Store the id which we'll use to recreate the icon
    }));
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableIncidents));
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
      // Parse the stored data
      const parsedData = JSON.parse(storedData);
      
      // Map the stored data back to AppIncident objects
      // Find matching default incidents to get the proper icon
      return parsedData.map(item => {
        // Find the matching default incident to get its icon
        const matchingDefault = defaultIncidents.find(def => def.id === item.id);
        return {
          id: item.id,
          name: item.name,
          status: item.status,
          // Use the icon from the default incidents
          icon: matchingDefault ? matchingDefault.icon : null
        };
      });
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
