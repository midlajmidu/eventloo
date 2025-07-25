import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Trophy, 
  Award, 
  Medal, 
  Download, 
  Filter,
  Search,
  Users,
  Target,
  Star,
  Calendar,
  Clock,
  Hash,
  ExternalLink,
  Printer
} from 'lucide-react';
import { eventProgramsAPI, markEntryAPI, eventsAPI } from '../../services/api';

const EventResults = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [results, setResults] = useState([]);
  const [programData, setProgramData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Helper function to safely format numbers
  const safeFormatNumber = (value, decimals = 2) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '-';
    }
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? '-' : num.toFixed(decimals);
  };

  useEffect(() => {
    fetchPrograms();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, selectedCategory]);

  const fetchPrograms = async () => {
    try {
      console.log('Fetching programs with results for event:', eventId);
      console.log('Selected category:', selectedCategory);
      
      // Use the new endpoint to get only programs with results entered
      let url = `events/${eventId}/programs_with_results/`;
      if (selectedCategory) {
        url += `?category=${selectedCategory}`;
      }
      console.log('Calling URL:', url);
      
      const response = await eventsAPI.get(url);
      console.log('Response received:', response.data);
      setPrograms(response.data);
    } catch (error) {
      console.error('Error fetching programs with results:', error);
      console.error('Error details:', error.response?.data);
      
      // Fallback to old method to see what programs exist
      console.log('Trying fallback method...');
      try {
        const fallbackResponse = await eventProgramsAPI.getPrograms(eventId, 'page_size=100');
        console.log('Fallback response:', fallbackResponse.data);
        setPrograms(fallbackResponse.data.results || fallbackResponse.data);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        setPrograms([]);
      }
    }
  };

  const fetchResults = async (programId) => {
    if (!programId) return;
    
    setLoading(true);
    try {
      // Use mark entry API to get all participants (consistent with mark entry section)
      const markEntryResponse = await markEntryAPI.getParticipants(eventId, programId);
      const allParticipants = markEntryResponse.data;
      
      // Filter to only show participants with marks entered
      const participantsWithMarks = allParticipants.filter(participant => 
        (participant.judge1_marks && participant.judge1_marks > 0) ||
        (participant.judge2_marks && participant.judge2_marks > 0) ||
        (participant.judge3_marks && participant.judge3_marks > 0)
      );
      
      // Sort by position, then by average marks (descending)
      const sortedResults = participantsWithMarks.sort((a, b) => {
        // First sort by position
        if (a.position && b.position) {
          return a.position - b.position;
        }
        if (a.position) return -1;
        if (b.position) return 1;
        
        // Then sort by average marks (descending)
        if (a.average_marks && b.average_marks) {
          return b.average_marks - a.average_marks;
        }
        if (a.average_marks) return -1;
        if (b.average_marks) return 1;
        
        return 0;
      });
      
      setResults(sortedResults);
      
      // Get program details from the first participant or fetch separately
      if (sortedResults.length > 0) {
        // Create program data object from participant data
        const firstResult = sortedResults[0];
        setProgramData({
          id: programId,
          name: firstResult.program_name || 'Program',
          category: firstResult.program_category || 'unknown',
          start_time: firstResult.program_start_time || new Date().toISOString(),
          is_team_based: firstResult.is_team_based || false
        });
      } else {
        // If no results, fetch program details separately
        try {
          const programResponse = await eventProgramsAPI.getProgram(programId);
          setProgramData(programResponse.data);
        } catch (error) {
          console.error('Error fetching program details:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setSelectedProgram('');
    setResults([]);
    setProgramData(null);
  };

  const handleProgramChange = (programId) => {
    setSelectedProgram(programId);
    fetchResults(programId);
  };

  const handleGeneratePDF = async () => {
    if (!selectedProgram) return;
    
    try {
      const response = await markEntryAPI.generatePDF(eventId, selectedProgram);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `results_${programData?.name?.replace(/\s+/g, '_') || selectedProgram}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const handlePrintMainPDF = async () => {
    if (!selectedProgram) return;
    
    try {
      const response = await markEntryAPI.generatePDF(eventId, selectedProgram);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Open PDF in new window for printing
      const printWindow = window.open(url, '_blank');
      
      // Wait for PDF to load then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 1000); // Small delay to ensure PDF is fully loaded
      };
      
      // Clean up URL after printing
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 5000);
    } catch (error) {
      console.error('Error printing main PDF:', error);
    }
  };



  const handleViewTopPerformers = () => {
    navigate(`/events/${eventId}/top-performers`);
  };

  // Enhanced filtering logic (removed status filter)
  const filteredPrograms = programs.filter(program => {
    const categoryMatch = !selectedCategory || program.category === selectedCategory;
    return categoryMatch;
  });

  const filteredResults = results.filter(result => {
    const searchMatch = result.participant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       result.chest_number?.toString().includes(searchTerm) ||
                       result.team_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return searchMatch;
  });

  const categories = [
    { value: 'hs', label: 'HS' },
    { value: 'hss', label: 'HSS' },
            { value: 'general', label: 'General' }
  ];

  const getPositionIcon = (position) => {
    switch(position) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-500" />;
      case 3:
        return <Award className="w-5 h-5 text-orange-500" />;
      default:
        return <Star className="w-5 h-5 text-blue-500" />;
    }
  };

  const getPositionBadge = (position) => {
    if (!position) return null;
    
    const colors = {
      1: 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white',
      2: 'bg-gradient-to-r from-gray-400 to-gray-600 text-white',
      3: 'bg-gradient-to-r from-orange-400 to-orange-600 text-white'
    };
    
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-bold ${colors[position] || 'bg-blue-100 text-blue-800'}`}>
        {position === 1 ? '🥇 1st Place' : position === 2 ? '🥈 2nd Place' : position === 3 ? '🥉 3rd Place' : `${position}th Place`}
      </span>
    );
  };

  const getCategoryColor = (category) => {
    const colors = {
      'hs': 'bg-blue-100 text-blue-800',
      'hss': 'bg-green-100 text-green-800',
      'general': 'bg-purple-100 text-purple-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryLabel = (category) => {
    const labels = {
      'hs': 'High School',
      'hss': 'HSS',
              'general': 'General'
    };
    return labels[category] || category;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Results & Rankings</h1>
          <p className="text-gray-600">Programs get sequential result numbers (1, 2, 3...) when completed - track your progress easily!</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleViewTopPerformers}
            className="flex items-center gap-2 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700"
          >
            <Trophy className="w-4 h-4" />
            Category Champions
            <ExternalLink className="w-4 h-4" />
          </button>
          {selectedProgram && results.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handleGeneratePDF}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
              <button
                onClick={handlePrintMainPDF}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Printer className="w-4 h-4" />
                Print PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Selection Controls */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="w-4 h-4 inline mr-1" />
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          {/* Program Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Trophy className="w-4 h-4 inline mr-1" />
              Program
            </label>
            <select
              value={selectedProgram}
              onChange={(e) => handleProgramChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Program</option>
              {filteredPrograms.map(program => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Program Info */}
      {programData && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold text-gray-900">{programData.name}</h2>
                {results.length > 0 && results[0].result_number && (
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                    <Hash className="w-4 h-4" />
                    Result No. {results[0].result_number}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-2">
                <span className={`px-2 py-1 rounded-full text-sm font-medium ${getCategoryColor(programData.category)}`}>
                  {getCategoryLabel(programData.category)}
                </span>
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  {new Date(programData.start_time).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  {new Date(programData.start_time).toLocaleTimeString()}
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  {results.length} participants
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {selectedProgram && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Results ({filteredResults.length})
              </h2>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search participants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            {/* Data Source Info */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-green-700">
                  {filteredResults.length} with marks
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-blue-700">
                  Data from Mark Entry section
                </span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading results...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Position
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Chest No.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Participant Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Team
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Judge 1
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Judge 2
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Judge 3
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Average
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Points Awarded
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredResults.map((result, index) => (
                    <tr key={result.id} className={`hover:bg-gray-50 ${index < 3 ? 'bg-gradient-to-r from-yellow-50 to-transparent' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getPositionIcon(result.position)}
                          {getPositionBadge(result.position)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                          {result.chest_number || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {result.student_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {result.student_code}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {result.team_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900">
                          {safeFormatNumber(result.judge1_marks)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900">
                          {safeFormatNumber(result.judge2_marks)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900">
                          {safeFormatNumber(result.judge3_marks)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Target className="w-4 h-4 text-green-500" />
                          <span className="font-bold text-lg text-gray-900">
                            {safeFormatNumber(result.average_marks)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm font-medium">
                          {result.points_earned || 0} pts
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredResults.length === 0 && selectedProgram && (
            <div className="p-8 text-center text-gray-500">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No results found for this program</p>
              <p className="text-sm mt-1">Results will appear here once marks are entered in the Mark Entry section</p>
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="text-sm text-blue-800">
                    <strong>Note:</strong> This results section now shows the same data as the Mark Entry section. 
                    Only participants with marks entered will appear here. To add marks, go to the Mark Entry section.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EventResults; 