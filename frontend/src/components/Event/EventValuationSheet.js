import React, { useState, useEffect } from 'react';
import { eventProgramsAPI, eventValuationSheetAPI, eventCallingSheetAPI } from '../../services/api';

const EventValuationSheet = ({ event, eventId, onRefresh }) => {
  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchPrograms();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

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

  const handleGeneratePDF = async (programId = null) => {
    try {
      setGenerating(true);
      const response = await eventValuationSheetAPI.generateValuationSheet(programId || selectedProgram.id);
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const programName = programId ? 
        programs.find(p => p.id === programId)?.name || 'Program' : 
        selectedProgram.name;
      link.download = `${programName}_valuation_sheet.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating valuation sheet:', error);
      alert('Error generating valuation sheet. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateFormattedPDF = async (programId = null) => {
    try {
      setGenerating(true);
      const response = await eventCallingSheetAPI.generateFormattedEvaluationSheet(programId || selectedProgram.id);
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const programName = programId ? 
        programs.find(p => p.id === programId)?.name || 'Program' : 
        selectedProgram.name;
      link.download = `${programName}_formatted_evaluation_sheet.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating formatted evaluation sheet:', error);
      alert('Error generating formatted evaluation sheet. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkGenerate = async () => {
    try {
      setGenerating(true);
      const response = await eventValuationSheetAPI.generateBulkValuationSheets(eventId);
      
      // Create download link for ZIP file
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${event.title}_valuation_sheets.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating bulk valuation sheets:', error);
      alert('Error generating bulk valuation sheets. Please try again.');
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
          <h2 className="text-2xl font-bold text-gray-900">Valuation Sheet PDF</h2>
          <p className="text-gray-600 mt-1">Generate judge evaluation forms for {event.title}</p>
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
                  Generate PDF
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
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Type:</span>
                <span className="font-medium">{program.is_team_based ? 'Team' : 'Individual'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Program Preview */}
      {selectedProgram && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedProgram.name}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedProgram.category?.toUpperCase()} • 
                  {selectedProgram.is_team_based ? ' Team Based' : ' Individual'}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleGenerateFormattedPDF()}
                  disabled={generating}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center disabled:opacity-50"
                >
                  {generating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  📝 Formatted Evaluation Sheet
                </button>
                <button
                  onClick={() => handleGeneratePDF()}
                  disabled={generating}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center disabled:opacity-50"
                >
                  {generating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  Generate Valuation Sheet
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-6">
              {/* Valuation Sheet Preview */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-4">Valuation Sheet Preview</h4>
                <p className="text-sm text-gray-600 mb-6">
                  The PDF will include evaluation criteria, participant details, and scoring sections for judges.
                </p>
                
                {/* Mock Valuation Form */}
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900">{event.title}</h2>
                    <h3 className="text-lg font-semibold text-gray-700 mt-2">{selectedProgram.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Judge Evaluation Form - {selectedProgram.category?.toUpperCase()} Category
                    </p>
                  </div>

                  {/* Program Details */}
                  <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div>
                      <strong>Venue:</strong> {selectedProgram.venue || 'TBD'}
                    </div>
                    <div>
                      <strong>Time:</strong> {selectedProgram.scheduled_time ? 
                        new Date(selectedProgram.scheduled_time).toLocaleString() : 'TBD'}
                    </div>
                    <div>
                      <strong>Duration:</strong> {selectedProgram.duration || 'TBD'} minutes
                    </div>
                    <div>
                      <strong>Type:</strong> {selectedProgram.is_team_based ? 'Team Based' : 'Individual'}
                    </div>
                  </div>

                  {/* Evaluation Criteria */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 mb-3">Evaluation Criteria</h4>
                    <div className="space-y-3">
                      {selectedProgram.type === 'cultural' && (
                        <>
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm">Performance Quality</span>
                            <span className="text-sm text-gray-500">25 points</span>
                          </div>
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm">Creativity & Originality</span>
                            <span className="text-sm text-gray-500">20 points</span>
                          </div>
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm">Stage Presence</span>
                            <span className="text-sm text-gray-500">15 points</span>
                          </div>
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm">Technical Skills</span>
                            <span className="text-sm text-gray-500">20 points</span>
                          </div>
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm">Overall Impression</span>
                            <span className="text-sm text-gray-500">20 points</span>
                          </div>
                        </>
                      )}
                      {selectedProgram.type === 'academic' && (
                        <>
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm">Content Knowledge</span>
                            <span className="text-sm text-gray-500">30 points</span>
                          </div>
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm">Presentation Skills</span>
                            <span className="text-sm text-gray-500">25 points</span>
                          </div>
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm">Research Quality</span>
                            <span className="text-sm text-gray-500">25 points</span>
                          </div>
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm">Time Management</span>
                            <span className="text-sm text-gray-500">20 points</span>
                          </div>
                        </>
                      )}
                      {(!selectedProgram.type || selectedProgram.type === 'arts' || selectedProgram.type === 'literary') && (
                        <>
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm">Technical Skill</span>
                            <span className="text-sm text-gray-500">25 points</span>
                          </div>
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm">Creativity</span>
                            <span className="text-sm text-gray-500">25 points</span>
                          </div>
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm">Presentation</span>
                            <span className="text-sm text-gray-500">25 points</span>
                          </div>
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm">Overall Impact</span>
                            <span className="text-sm text-gray-500">25 points</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between items-center font-semibold pt-2">
                        <span>Total</span>
                        <span>100 points</span>
                      </div>
                    </div>
                  </div>

                  {/* Scoring Section */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 mb-3">Participant Scoring</h4>
                    <div className="space-y-4">
                      {[1, 2, 3, 4, 5].map((participant) => (
                        <div key={participant} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-center mb-3">
                            <div>
                              <h5 className="font-medium">Participant {participant}</h5>
                              <p className="text-sm text-gray-500">Name: ___________________</p>
                              <p className="text-sm text-gray-500">ID: ___________________</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-500">Total Score:</p>
                              <div className="text-lg font-bold border-b-2 border-gray-300 w-16 text-center">
                                ___
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>Criteria 1: ___/25</div>
                            <div>Criteria 2: ___/25</div>
                            <div>Criteria 3: ___/25</div>
                            <div>Criteria 4: ___/25</div>
                          </div>
                          <div className="mt-3">
                            <p className="text-sm text-gray-500">Comments:</p>
                            <div className="border-b border-gray-300 mt-1 h-8"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Judge Signature */}
                  <div className="border-t pt-6">
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Judge Name:</p>
                        <div className="border-b border-gray-300 h-8"></div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Signature & Date:</p>
                        <div className="border-b border-gray-300 h-8"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Instructions for Judges</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Evaluate each participant based on the given criteria</li>
                  <li>• Assign scores within the specified point ranges</li>
                  <li>• Provide constructive comments for feedback</li>
                  <li>• Submit completed forms to the event coordinator</li>
                  <li>• Maintain confidentiality of scores until results are announced</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {programs.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📝</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No programs available</h3>
          <p className="text-gray-500">Please add programs first to generate valuation sheets.</p>
        </div>
      )}
    </div>
  );
};

export default EventValuationSheet; 