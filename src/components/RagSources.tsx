
import React from 'react';

export interface RagSourceProps {
  files: string[];
}

const RagSources: React.FC<RagSourceProps> = ({ files }) => {
  if (!files || files.length === 0) return null;
  
  return (
    <div className="mt-2 pt-2 border-t border-dashed border-blue-200">
      <p className="text-xs text-blue-600 font-medium mb-1">Sources utilisées:</p>
      <ul className="flex flex-wrap gap-1">
        {files.map((file, index) => (
          <li 
            key={index} 
            className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200"
            title={file}
          >
            {file.split('/').pop() || file}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RagSources;
