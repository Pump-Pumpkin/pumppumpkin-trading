import React from 'react';
import { MAINTENANCE_MESSAGE, ESTIMATED_COMPLETION, PROGRESS_PERCENTAGE } from '../config/maintenance';

const UnderConstruction: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="text-center text-white max-w-2xl mx-auto">
        {/* Construction Icon */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto bg-yellow-500 rounded-full flex items-center justify-center mb-4">
            <svg 
              className="w-16 h-16 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M19 14l-7 7m0 0l-7-7m7 7V3" 
              />
            </svg>
          </div>
        </div>

        {/* Main Message */}
        <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
          Under Construction
        </h1>
        
        <p className="text-xl text-gray-300 mb-8 leading-relaxed">
          {MAINTENANCE_MESSAGE}
        </p>

        {/* Status Bar */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-300">Progress</span>
            <span className="text-yellow-400 font-semibold">{PROGRESS_PERCENTAGE}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-yellow-400 to-orange-400 h-3 rounded-full" 
              style={{ width: `${PROGRESS_PERCENTAGE}%` }}
            ></div>
          </div>
        </div>

        {/* Estimated Time */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <p className="text-gray-300 mb-2">Estimated completion</p>
          <p className="text-2xl font-bold text-yellow-400">{ESTIMATED_COMPLETION}</p>
        </div>

        {/* Social Links or Contact */}
        <div className="text-gray-400 text-sm">
          <p>Stay tuned for updates!</p>
          <p className="mt-2">We'll be back before you know it ✨</p>
        </div>

        {/* Animated Elements */}
        <div className="mt-12 flex justify-center space-x-2">
          <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );
};

export default UnderConstruction;
