import React, { useState, useEffect } from 'react';
import { FileText, Download, Users, ClipboardList, Search, Filter, Printer } from 'lucide-react';
import { eventProgramsAPI, eventValuationSheetAPI, eventCallingSheetAPI } from '../../services/api';

const EventDocuments = ({ event, eventId, onRefresh }) => {
  const [programs, setPrograms] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('calling');
  
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
    if (selectedProgram && activeTab === 'calling') {
      fetchParticipants();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgram, activeTab]);

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

    setSearching(true);
    setSearchError('');
    setSearchResult(null);

    try {
      const response = await eventCallingSheetAPI.searchByChestNumber(eventId, chestNumber);
      setSearchResult(response.data);
    } catch (error) {
      console.error('Error searching chest number:', error);
      setSearchError(error.response?.data?.error || 'Chest number not found');
    } finally {
      setSearching(false);
    }
  };

  // Evaluation Sheet Functions
  const handleGenerateEvaluationPDF = async (programId = null) => {
    try {
      setGenerating(true);
      const response = await eventCallingSheetAPI.generateFormattedEvaluationSheet(programId || selectedProgram.id);
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const programName = programId ? 
        programs.find(p => p.id === programId)?.name || 'Program' : 
        selectedProgram.name;
      link.download = `${programName}_evaluation_sheet.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating evaluation sheet:', error);
      alert('Error generating evaluation sheet. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrintEvaluationPDF = async (programId = null) => {
    try {
      setGenerating(true);
      const response = await eventCallingSheetAPI.generateFormattedEvaluationSheet(programId || selectedProgram.id);
      
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
      console.error('Error printing evaluation sheet:', error);
      alert('Error printing evaluation sheet. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkGenerateEvaluation = async () => {
    try {
      setGenerating(true);
      const response = await eventValuationSheetAPI.generateBulkValuationSheets(eventId);
      
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${event.title}_evaluation_sheets.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating bulk evaluation sheets:', error);
      alert('Error generating bulk evaluation sheets. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Calling List Functions
  const handleGenerateCallingPDF = async (programId = null) => {
    try {
      setGenerating(true);
      const response = await eventCallingSheetAPI.generateFormattedCallingSheet(programId || selectedProgram.id);
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const programName = programId ? 
        programs.find(p => p.id === programId)?.name || 'Program' : 
        selectedProgram.name;
      link.download = `${programName}_calling_list.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating calling list:', error);
      alert('Error generating calling list. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrintCallingPDF = async (programId = null) => {
    try {
      setGenerating(true);
      const response = await eventCallingSheetAPI.generateFormattedCallingSheet(programId || selectedProgram.id);
      
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
      console.error('Error printing calling list:', error);
      alert('Error printing calling list. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkGenerateCalling = async () => {
    try {
      setGenerating(true);
      const response = await eventCallingSheetAPI.generateBulkCallingSheets(eventId);
      
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${event.title}_calling_lists.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating bulk calling lists:', error);
      alert('Error generating bulk calling lists. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category === '' ? null : category);
    setSelectedProgram(null);
    setParticipants([]);
  };

  const handleProgramChange = (programId) => {
    const program = programs.find(p => p.id === parseInt(programId));
    setSelectedProgram(program);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const categories = [
    { value: 'hs', label: 'High School (HS)' },
    { value: 'hss', label: 'Higher Secondary (HSS)' },
            { value: 'general', label: 'General' },
  ];

  const filteredPrograms = programs.filter(program => {
    return !selectedCategory || program.category === selectedCategory;
  });

  const tabs = [
    { id: 'calling', name: 'Calling List', icon: ClipboardList, description: 'Participant lists for calling' },
    { id: 'evaluation', name: 'Evaluation', icon: FileText, description: 'Judge evaluation forms' },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Event Documents</h2>
          <p className="text-gray-600 mt-1">Generate calling lists and evaluation forms for {event.title}</p>
        </div>
        {selectedProgram && (
          <button
            onClick={activeTab === 'evaluation' ? handleBulkGenerateEvaluation : handleBulkGenerateCalling}
            disabled={generating || programs.length === 0}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center disabled:opacity-50"
          >
            {generating ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Download className="w-5 h-5 mr-2" />
            )}
            Bulk Generate All {activeTab === 'evaluation' ? 'Evaluation Sheets' : 'Calling Lists'}
          </button>
        )}
      </div>

      {/* Category Selection */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Filter className="w-5 h-5 mr-2" />
          Step 1: Select Category
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleCategoryChange('')}
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              selectedCategory === ''
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All Categories
          </button>
          {categories.map((category) => (
            <button
              key={category.value}
              onClick={() => handleCategoryChange(category.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                selectedCategory === category.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
        {selectedCategory && (
          <div className="mt-3 text-sm text-gray-600">
            Showing programs for: <span className="font-medium">{categories.find(c => c.value === selectedCategory)?.label}</span>
          </div>
        )}
      </div>

      {/* Program Selection - Only show if category is selected */}
      {selectedCategory !== null && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
            📋 Step 2: Select Program
          </h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-blue-900 mb-2">Choose a program</label>
            <select
              value={selectedProgram?.id || ''}
              onChange={(e) => handleProgramChange(e.target.value)}
              disabled={filteredPrograms.length === 0}
              className="w-full md:w-96 px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {filteredPrograms.length === 0 
                  ? selectedCategory 
                    ? `No programs found for ${categories.find(c => c.value === selectedCategory)?.label}` 
                    : 'Please select a category first'
                  : 'Select a program'
                }
              </option>
              {filteredPrograms.map(program => (
                <option key={program.id} value={program.id}>
                  {program.name} ({program.category?.toUpperCase()})
                </option>
              ))}
            </select>
            {filteredPrograms.length > 0 && (
              <p className="mt-1 text-sm text-blue-600">
                {filteredPrograms.length} program{filteredPrograms.length !== 1 ? 's' : ''} available
              </p>
            )}
          </div>
        </div>
      )}

      {/* Document Type Selection - Only show if program is selected */}
      {selectedProgram && (
        <>
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              📄 Step 3: Choose Document Type
            </h3>
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
                  >
                    <IconComponent className="w-5 h-5 mr-2" />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Selected Program Details */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedProgram.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedProgram.category?.toUpperCase()} • 
                    {selectedProgram.is_team_based ? ' Team Based' : ' Individual'}
                    {activeTab === 'calling' && ` • ${participants.length} Participants`}
                  </p>
                </div>
                <div className="flex gap-3">
                  {activeTab === 'evaluation' ? (
                    <>
                      <button
                        onClick={() => handleGenerateEvaluationPDF()}
                        disabled={generating}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center disabled:opacity-50"
                      >
                        {generating ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        ) : (
                          <Download className="w-5 h-5 mr-2" />
                        )}
                        📝 Download Evaluation Sheet
                      </button>
                      <button
                        onClick={() => handlePrintEvaluationPDF()}
                        disabled={generating}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center disabled:opacity-50"
                      >
                        {generating ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        ) : (
                          <Printer className="w-5 h-5 mr-2" />
                        )}
                        Print Evaluation Sheet
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleGenerateCallingPDF()}
                        disabled={generating || participants.length === 0}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center disabled:opacity-50"
                      >
                        {generating ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        ) : (
                          <ClipboardList className="w-5 h-5 mr-2" />
                        )}
                        📋 Download Calling List
                      </button>
                      <button
                        onClick={() => handlePrintCallingPDF()}
                        disabled={generating || participants.length === 0}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center disabled:opacity-50"
                      >
                        {generating ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        ) : (
                          <Printer className="w-5 h-5 mr-2" />
                        )}
                        Print Calling List
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6">
              {activeTab === 'evaluation' ? (
                // Evaluation Sheet Preview
                <div className="space-y-6">
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-4">Evaluation Sheet Preview</h4>
                    <p className="text-sm text-gray-600 mb-6">
                      The PDF will include evaluation criteria, participant details, and scoring sections for judges.
                    </p>
                    
                    {/* Mock Evaluation Form */}
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

                      {/* Sample evaluation criteria */}
                      <div className="mb-6">
                        <h4 className="font-semibold text-gray-900 mb-3">Evaluation Criteria</h4>
                        <div className="space-y-3">
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
                          <div className="flex justify-between items-center font-semibold pt-2">
                            <span>Total</span>
                            <span>100 points</span>
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
              ) : (
                // Calling List Preview
                <div className="space-y-4">
                  {participants.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-gray-400 text-6xl mb-4">👥</div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">No participants assigned</h4>
                      <p className="text-gray-500">Please assign students to this program first.</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-2">Calling List Preview</h4>
                        <p className="text-sm text-gray-600 mb-4">
                          The PDF will include participant details, team information, and venue details.
                        </p>
                        
                        {/* Preview Table */}
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Participant</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {participants.map((participant, index) => (
                                <tr key={participant.id}>
                                  <td className="px-4 py-2 text-sm text-gray-900">{index + 1}</td>
                                  <td className="px-4 py-2 text-sm font-medium text-gray-900">{participant.name}</td>
                                  <td className="px-4 py-2 text-sm text-gray-500">{participant.identifier}</td>
                                  <td className="px-4 py-2 text-sm text-gray-500">{participant.team_name || '-'}</td>
                                  <td className="px-4 py-2 text-sm text-gray-500">{participant.category_display}</td>
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
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Initial State - No category selected */}
      {selectedCategory === null && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📄</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to Document Generation</h3>
          <p className="text-gray-500 mb-6">Please select a category above to start generating documents.</p>
          <div className="bg-blue-50 p-6 rounded-lg max-w-md mx-auto">
            <h4 className="font-medium text-blue-900 mb-3">How it works:</h4>
            <ol className="text-sm text-blue-800 space-y-2">
                              <li>1. <strong>Select Category</strong> - Choose HS, HSS, General, or All Categories</li>
              <li>2. <strong>Choose Program</strong> - Select from available programs</li>
              <li>3. <strong>Pick Document Type</strong> - Generate Calling List or Evaluation Sheet</li>
              <li>4. <strong>Download or Print</strong> - Get your document ready</li>
            </ol>
          </div>
        </div>
      )}

      {/* No programs available for selected category */}
      {selectedCategory !== null && filteredPrograms.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📄</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {selectedCategory 
              ? `No programs found for ${categories.find(c => c.value === selectedCategory)?.label}` 
              : 'Please select a category to view programs'
            }
          </h3>
          <p className="text-gray-500">
            {selectedCategory 
              ? 'No programs are available for the selected category.' 
              : 'Choose a category above to see available programs.'
            }
          </p>
        </div>
      )}

      {programs.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📄</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No programs available</h3>
          <p className="text-gray-500">Please add programs first to generate documents.</p>
        </div>
      )}
    </div>
  );
};

export default EventDocuments; 