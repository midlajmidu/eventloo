import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Trophy, 
  Award, 
  Medal, 
  Star,
  ArrowLeft,
  Target,
  Hash
} from 'lucide-react';
import { eventsAPI } from '../../services/api';

const EventTopPerformers = () => {
  const { eventId } = useParams();
  const [categoryChampions, setCategoryChampions] = useState({});
  const [overallChampion, setOverallChampion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [eventData, setEventData] = useState(null);

  useEffect(() => {
    fetchEventData();
    fetchCategoryTopPerformers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      const response = await eventsAPI.getEvent(eventId);
      setEventData(response.data);
    } catch (error) {
      console.error('Error fetching event data:', error);
    }
  };

  const fetchCategoryTopPerformers = async () => {
    setLoading(true);
    try {
      const response = await eventsAPI.getCategoryTopPerformers(eventId);
      setCategoryChampions(response.data.category_champions || {});
      setOverallChampion(response.data.overall_champion || null);
    } catch (error) {
      console.error('Error fetching category top performers:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      'hs': 'bg-blue-100 text-blue-800 border-blue-300',
      'hss': 'bg-green-100 text-green-800 border-green-300',
      'general': 'bg-purple-100 text-purple-800 border-purple-300'
    };
    return colors[category] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getCategoryLabel = (category) => {
    const labels = {
      'hs': 'High School',
      'hss': 'Higher Secondary School',
              'general': 'General'
    };
    return labels[category] || category;
  };

  const getPositionIcon = (position) => {
    switch(position) {
      case 1:
        return <Trophy className="w-4 h-4 text-yellow-500" />;
      case 2:
        return <Medal className="w-4 h-4 text-gray-500" />;
      case 3:
        return <Award className="w-4 h-4 text-orange-500" />;
      default:
        return <Star className="w-4 h-4 text-blue-500" />;
    }
  };

  const getPositionBadge = (position) => {
    const colors = {
      1: 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white',
      2: 'bg-gradient-to-r from-gray-400 to-gray-600 text-white',
      3: 'bg-gradient-to-r from-orange-400 to-orange-600 text-white'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-bold ${colors[position] || 'bg-blue-100 text-blue-800'}`}>
        {position === 1 ? '🥇 1st' : position === 2 ? '🥈 2nd' : position === 3 ? '🥉 3rd' : `${position}th`}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Results
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Trophy className="w-8 h-8 text-yellow-500" />
              Champions
            </h1>
            <p className="text-gray-600">
              {eventData?.title} - Highest point scorers in each category and overall
            </p>
          </div>
        </div>
      </div>

      {/* Overall Champion */}
      {overallChampion && (
        <div className="rounded-xl border-2 p-6 shadow-lg bg-gradient-to-br from-yellow-100 to-yellow-200">
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 mb-2">
              <Trophy className="w-8 h-8 text-yellow-600" />
              <h2 className="text-2xl font-bold">Overall Champion</h2>
            </div>
            <p className="text-sm opacity-80">Highest points across all categories and program types</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">{overallChampion.student_name}</h3>
              <p className="text-sm text-gray-600">{overallChampion.team_name || 'No Team'}</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  <Hash className="w-3 h-3 inline mr-1" />
                  {overallChampion.chest_number || 'N/A'}
                </span>
              </div>
            </div>
            <div className="text-center mb-4">
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg p-3">
                <div className="text-2xl font-bold">{overallChampion.total_points}</div>
                <div className="text-sm opacity-90">Total Points</div>
              </div>
            </div>
            {/* Achievements */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
                <Target className="w-4 h-4" />
                Achievements ({overallChampion.achievements.length})
              </h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {overallChampion.achievements.map((achievement, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                    <div className="flex items-center gap-2">
                      {getPositionIcon(achievement.position)}
                      <span className="font-medium">{achievement.program_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getPositionBadge(achievement.position)}
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full font-bold">
                        +{achievement.points}pts
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Champions by Program Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading category champions...</p>
          </div>
        ) : Object.keys(categoryChampions).length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-xl font-semibold">No champions found</p>
            <p className="text-sm mt-1">Champions will appear here once marks are entered for individual programs</p>
          </div>
        ) : (
          Object.entries(categoryChampions).map(([categoryKey, progTypeObj]) => (
            Object.entries(progTypeObj).map(([progType, data]) => (
              <div key={categoryKey + '-' + progType} className={`rounded-xl border-2 p-6 shadow-lg ${getCategoryColor(categoryKey)}`}>
                {/* Category Header */}
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 mb-2">
                    <Trophy className="w-6 h-6 text-yellow-600" />
                    <h2 className="text-xl font-bold">{data.category_name} - {data.program_type} Champion</h2>
                  </div>
                  <p className="text-sm opacity-80">Category Champion</p>
                </div>
                {/* Champion Details */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Trophy className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{data.top_performer.student_name}</h3>
                    <p className="text-sm text-gray-600">{data.top_performer.team_name || 'No Team'}</p>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                        <Hash className="w-3 h-3 inline mr-1" />
                        {data.top_performer.chest_number || 'N/A'}
                      </span>
                    </div>
                  </div>
                  {/* Total Points */}
                  <div className="text-center mb-4">
                    <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg p-3">
                      <div className="text-2xl font-bold">{data.top_performer.total_points}</div>
                      <div className="text-sm opacity-90">Total Points</div>
                    </div>
                  </div>
                  {/* Achievements */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      Achievements ({data.top_performer.achievements.length})
                    </h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {data.top_performer.achievements.map((achievement, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                          <div className="flex items-center gap-2">
                            {getPositionIcon(achievement.position)}
                            <span className="font-medium">{achievement.program_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {getPositionBadge(achievement.position)}
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full font-bold">
                              +{achievement.points}pts
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ))
        )}
      </div>

      {/* Points System Explanation */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Points System</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
            <Trophy className="w-8 h-8 text-yellow-500" />
            <div>
              <div className="font-bold text-yellow-800">1st Place</div>
              <div className="text-sm text-yellow-600">5 Points</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Medal className="w-8 h-8 text-gray-500" />
            <div>
              <div className="font-bold text-gray-800">2nd Place</div>
              <div className="text-sm text-gray-600">3 Points</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
            <Award className="w-8 h-8 text-orange-500" />
            <div>
              <div className="font-bold text-orange-800">3rd Place</div>
              <div className="text-sm text-orange-600">1 Point</div>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-4">
          <strong>Note:</strong> Points are calculated from all individual program results. 
          For example: 3 first places + 1 second place = 5+5+5+3 = 18 total points.
        </p>
      </div>
    </div>
  );
};

export default EventTopPerformers; 