import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

const StatsCard = ({ 
  title, 
  value, 
  icon: Icon, 
  change, 
  changeType, 
  color = 'blue',
  onClick 
}) => {
  const colorClasses = {
    blue: 'bg-blue-500 text-blue-700 bg-blue-50',
    green: 'bg-green-500 text-green-700 bg-green-50',
    purple: 'bg-purple-500 text-purple-700 bg-purple-50',
    orange: 'bg-orange-500 text-orange-700 bg-orange-50',
    red: 'bg-red-500 text-red-700 bg-red-50',
    indigo: 'bg-indigo-500 text-indigo-700 bg-indigo-50',
  };

  const [, textColor, lightBgColor] = colorClasses[color].split(' ');

  return (
    <div 
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-200 hover:shadow-md ${onClick ? 'cursor-pointer hover:border-gray-300' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          
          {change && (
            <div className="flex items-center mt-2">
              {changeType === 'increase' ? (
                <ArrowUpRight className="w-4 h-4 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-500 mr-1" />
              )}
              <span className={`text-sm font-medium ${
                changeType === 'increase' ? 'text-green-600' : 'text-red-600'
              }`}>
                {change}
              </span>
              <span className="text-sm text-gray-500 ml-1">vs last month</span>
            </div>
          )}
        </div>
        
        <div className={`w-12 h-12 ${lightBgColor} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${textColor}`} />
        </div>
      </div>
    </div>
  );
};

export default StatsCard; 