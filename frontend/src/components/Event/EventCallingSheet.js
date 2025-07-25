import React, { useState, useEffect } from 'react';
import { eventProgramsAPI, eventCallingSheetAPI } from '../../services/api';

const EventCallingSheet = ({ event, eventId, onRefresh }) => {
  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // Chest number search state
  const [chestNumber, setChestNumber] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    fetchPrograms();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    if (selectedProgram) {
      fetchParticipants();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgram]);

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      const response = await eventProgramsAPI.getPrograms(eventId, 'page_size=100');
      setPrograms(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching programs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async () => {
    if (!selectedProgram) return;

    try {
      const response = await eventCallingSheetAPI.getProgramParticipants(selectedProgram.id);
      setParticipants(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const handleChestNumberSearch = async () => {
    if (!chestNumber.trim()) {
      setSearchError('Please enter a chest number');
      return;
    }

    try {
      setSearching(true);
      setSearchError('');
      setSearchResult(null);
      
      const response = await eventCallingSheetAPI.searchByChestNumber(eventId, chestNumber.trim());
      setSearchResult(response.data);
    } catch (error) {
      console.error('Error searching by chest number:', error);
      if (error.response && error.response.data && error.response.data.error) {
        setSearchError(error.response.data.error);
      } else {
        setSearchError('Error searching. Please try again.');
      }
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setChestNumber('');
    setSearchResult(null);
    setSearchError('');
  };

  const handleGeneratePDF = async (programId = null) => {
    try {
      setGenerating(true);
      const response = await eventCallingSheetAPI.generateCallingSheet(programId || selectedProgram.id);
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const programName = programId ? 
        programs.find(p => p.id === programId)?.name || 'Program' : 
        selectedProgram.name;
      link.download = `${programName}_calling_sheet.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating calling sheet:', error);
      alert('Error generating calling sheet. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateFormattedPDF = async (programId = null) => {
    try {
      setGenerating(true);
      const response = await eventCallingSheetAPI.generateFormattedCallingSheet(programId || selectedProgram.id);
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const programName = programId ? 
        programs.find(p => p.id === programId)?.name || 'Program' : 
        selectedProgram.name;
      link.download = `${programName}_formatted_calling_sheet.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating formatted calling sheet:', error);
      alert('Error generating formatted calling sheet. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkGenerate = async () => {
    try {
      setGenerating(true);
      const response = await eventCallingSheetAPI.generateBulkCallingSheets(eventId);
      
      // Create download link for ZIP file
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${event.title}_calling_sheets.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating bulk calling sheets:', error);
      alert('Error generating bulk calling sheets. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Calling Sheet PDF</h2>
          <p className="text-gray-600 mt-1">Generate participant lists for {event.title}</p>
        </div>
        <button
          onClick={handleBulkGenerate}
          disabled={generating || programs.length === 0}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center disabled:opacity-50"
        >
          {generating ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          Bulk Generate All
        </button>
      </div>

      {/* Chest Number Search Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Search by Chest Number</h3>
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <input
              type="number"
              value={chestNumber}
              onChange={(e) => setChestNumber(e.target.value)}
              placeholder="Enter chest number (e.g., 1001, 2005)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && handleChestNumberSearch()}
            />
          </div>
          <button
            onClick={handleChestNumberSearch}
            disabled={searching}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center disabled:opacity-50"
          >
            {searching ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0118 0z" />
              </svg>
            )}
            Search
          </button>
          {(searchResult || searchError) && (
            <button
              onClick={clearSearch}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md"
            >
              Clear
            </button>
          )}
        </div>

        {/* Search Error */}
        {searchError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-red-700">{searchError}</p>
            </div>
          </div>
        )}

        {/* Search Result */}
        {searchResult && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex items-center mb-3">
              <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4 className="text-lg font-semibold text-green-900">
                Student Found - Chest #{searchResult.chest_number}
              </h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <h5 className="font-medium text-green-900 mb-2">Student Details</h5>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Name:</span> {searchResult.student.name}</p>
                  <p><span className="font-medium">Student ID:</span> {searchResult.student.student_id}</p>
                  <p><span className="font-medium">Email:</span> {searchResult.student.email}</p>
                  <p><span className="font-medium">Category:</span> {searchResult.student.category?.toUpperCase()}</p>
                  <p><span className="font-medium">Grade:</span> {searchResult.student.grade}</p>
                  <p><span className="font-medium">Section:</span> {searchResult.student.section}</p>
                </div>
              </div>
              
              <div>
                <h5 className="font-medium text-green-900 mb-2">Team Information</h5>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Team:</span> {searchResult.team.name}</p>
                  <p><span className="font-medium">Assigned:</span> {new Date(searchResult.assigned_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Programs */}
            {searchResult.programs.length > 0 && (
              <div className="mb-4">
                <h5 className="font-medium text-green-900 mb-2">Participating Programs ({searchResult.programs.length})</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {searchResult.programs.map((program) => (
                    <div key={program.id} className="bg-white border border-green-200 rounded p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{program.name}</p>
                          <p className="text-sm text-gray-600">{program.category?.toUpperCase()}</p>
                          {program.venue && (
                            <p className="text-sm text-gray-600">📍 {program.venue}</p>
                          )}
                          {program.start_time && (
                            <p className="text-sm text-gray-600">
                              🕐 {new Date(program.start_time).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          program.status === 'finished' ? 'bg-gray-100 text-gray-800' :
                          program.status === 'ongoing' ? 'bg-yellow-100 text-yellow-800' :
                          program.status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {program.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Results */}
            {searchResult.results.length > 0 && (
              <div>
                <h5 className="font-medium text-green-900 mb-2">Results ({searchResult.results.length})</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {searchResult.results.map((result) => (
                    <div key={result.program_id} className="bg-white border border-green-200 rounded p-3">
                      <p className="font-medium text-gray-900">{result.program_name}</p>
                      <div className="flex justify-between items-center mt-1">
                        <div>
                          {result.position && (
                            <span className="text-sm font-medium text-blue-600">
                              Position: {result.position}
                            </span>
                          )}
                          {result.marks && (
                            <span className="text-sm text-gray-600 ml-2">
                              Marks: {result.marks}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-green-600">
                          {result.points_earned} pts
                        </span>
                      </div>
                      {result.comments && (
                        <p className="text-sm text-gray-600 mt-1">{result.comments}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Program Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Program</label>
        <select
          value={selectedProgram?.id || ''}
          onChange={(e) => {
            const program = programs.find(p => p.id === parseInt(e.target.value));
            setSelectedProgram(program);
          }}
          className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a program</option>
          {programs.map(program => (
            <option key={program.id} value={program.id}>
              {program.name} ({program.category?.toUpperCase()})
            </option>
          ))}
        </select>
      </div>

      {/* Programs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {programs.map((program) => (
          <div key={program.id} className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{program.name}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {program.category?.toUpperCase()} • {program.is_team_based ? 'Team' : 'Individual'}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleGenerateFormattedPDF(program.id)}
                  disabled={generating}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center disabled:opacity-50"
                >
                  {generating ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                  ) : (
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  Formatted PDF
                </button>
                <button
                  onClick={() => handleGeneratePDF(program.id)}
                  disabled={generating}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm flex items-center disabled:opacity-50"
                >
                  {generating ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                  ) : (
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  Simple PDF
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {program.venue && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Venue:</span>
                  <span className="font-medium">{program.venue}</span>
                </div>
              )}
              {program.scheduled_time && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Time:</span>
                  <span className="font-medium">
                    {new Date(program.scheduled_time).toLocaleString()}
                  </span>
                </div>
              )}
              {program.max_participants && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Max Participants:</span>
                  <span className="font-medium">{program.max_participants}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Program Details */}
      {selectedProgram && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedProgram.name}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedProgram.category?.toUpperCase()} • 
                  {selectedProgram.is_team_based ? ' Team Based' : ' Individual'} • 
                  {participants.length} Participants
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleGenerateFormattedPDF()}
                  disabled={generating || participants.length === 0}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center disabled:opacity-50"
                >
                  {generating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  📋 Formatted Calling Sheet
                </button>
                <button
                  onClick={() => handleGeneratePDF()}
                  disabled={generating || participants.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center disabled:opacity-50"
                >
                  {generating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  Simple Calling Sheet
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {participants.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">👥</div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No participants assigned</h4>
                <p className="text-gray-500">Please assign students to this program first.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Calling Sheet Preview</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    The PDF will include participant details, team information, and venue details.
                  </p>
                  
                  {/* Preview Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            #
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Participant
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            ID
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Team
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Category
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {participants.map((participant, index) => (
                          <tr key={participant.id}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {index + 1}
                            </td>
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">
                              {participant.name}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {participant.identifier}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {participant.team_name || '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {participant.category_display}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Program Details for PDF */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Program Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-blue-600">Venue:</span>
                      <span className="ml-2 text-blue-900">{selectedProgram.venue || 'TBD'}</span>
                    </div>
                    <div>
                      <span className="text-blue-600">Time:</span>
                      <span className="ml-2 text-blue-900">
                        {selectedProgram.scheduled_time ? 
                          new Date(selectedProgram.scheduled_time).toLocaleString() : 
                          'TBD'
                        }
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-600">Duration:</span>
                      <span className="ml-2 text-blue-900">{selectedProgram.duration || 'TBD'} minutes</span>
                    </div>
                    <div>
                      <span className="text-blue-600">Type:</span>
                      <span className="ml-2 text-blue-900">
                        {selectedProgram.is_team_based ? 'Team Based' : 'Individual'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {programs.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No programs available</h3>
          <p className="text-gray-500">Please add programs first to generate calling sheets.</p>
        </div>
      )}
    </div>
  );
};

export default EventCallingSheet; 