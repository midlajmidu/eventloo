import React, { useState, useEffect, useCallback } from 'react';
import { 
  Download, 
  FileText, 
  Award, 
  Users, 
  Calendar,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { eventsAPI, teamsAPI, pointsAPI, programsAPI } from '../../services/api';

const EventReports = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [results, setResults] = useState([]);
  const [teams, setTeams] = useState([]);
  const [pointsData, setPointsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportStatus, setReportStatus] = useState('');


  const loadEventData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load event details
      const eventResponse = await eventsAPI.getEvent(eventId);
      setEvent(eventResponse.data);
      
      // Load programs
      const programsResponse = await eventsAPI.getEventPrograms(eventId);
      setPrograms(programsResponse.data.results || programsResponse.data || []);
      
      // Load teams (using teams API)
      const teamsResponse = await teamsAPI.getTeams({ event: eventId });
      setTeams(teamsResponse.data.results || teamsResponse.data || []);
      
      // Load points data (using points API)
      const pointsResponse = await pointsAPI.getPoints({ event: eventId });
      setPointsData(pointsResponse.data.results || pointsResponse.data || []);
      
      // Load results (using programs API to get results)
      try {
        const resultsResponse = await programsAPI.getPrograms({ event: eventId });
        setResults(resultsResponse.data.results || resultsResponse.data || []);
      } catch (resultsError) {
        console.warn('Could not load results data:', resultsError);
        setResults([]);
      }
      
    } catch (error) {
      console.error('Error loading event data:', error);
      setReportStatus('Error loading event data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadEventData();
  }, [loadEventData]);

  const downloadReportAsPDF = async (reportType) => {
    try {
      setGeneratingReport(true);
      setReportStatus(`Downloading ${reportType} as PDF...`);
      
      let response;
      let filename;
      
      switch (reportType) {
        case 'program-details':
          response = await eventsAPI.generateProgramDetailsReport(eventId);
          filename = `Eventloo_Program_Details_${event?.title || 'Event'}_${new Date().toISOString().split('T')[0]}.pdf`;
          break;
        case 'complete-results':
          response = await eventsAPI.generateCompleteResultsReport(eventId);
          filename = `Eventloo_Complete_Results_${event?.title || 'Event'}_${new Date().toISOString().split('T')[0]}.pdf`;
          break;
        case 'first-place':
          response = await eventsAPI.generateFirstPlaceReport(eventId);
          filename = `Eventloo_1st_Place_Winners_${event?.title || 'Event'}_${new Date().toISOString().split('T')[0]}.pdf`;
          break;
        case 'second-place':
          response = await eventsAPI.generateSecondPlaceReport(eventId);
          filename = `Eventloo_2nd_Place_Winners_${event?.title || 'Event'}_${new Date().toISOString().split('T')[0]}.pdf`;
          break;
        case 'third-place':
          response = await eventsAPI.generateThirdPlaceReport(eventId);
          filename = `Eventloo_3rd_Place_Winners_${event?.title || 'Event'}_${new Date().toISOString().split('T')[0]}.pdf`;
          break;
        case 'all-results':
          response = await eventsAPI.generateAllResultsReport(eventId);
          filename = `Eventloo_All_Results_${event?.title || 'Event'}_${new Date().toISOString().split('T')[0]}.pdf`;
          break;
        case 'participants-team':
          response = await eventsAPI.generateParticipantsTeamReport(eventId);
          filename = `Eventloo_Participants_Team_${event?.title || 'Event'}_${new Date().toISOString().split('T')[0]}.pdf`;
          break;
        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }
      
      // Check if response has data
      if (!response || !response.data) {
        throw new Error('No data received from server');
      }
      
      const blob = new Blob([response.data], { 
        type: reportType === 'backup' ? 'application/json' : 'application/pdf' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setReportStatus(`${reportType.replace('-', ' ')} downloaded successfully!`);
    } catch (error) {
      console.error(`Error downloading ${reportType}:`, error);
      let errorMessage = 'Unknown error occurred';
      
      if (error.response) {
        // Server responded with error status
        if (error.response.status === 500) {
          errorMessage = 'Backend server error. Please ensure the server is running.';
        } else if (error.response.status === 404) {
          errorMessage = 'Report endpoint not found. Please check server configuration.';
        } else if (error.response.status === 401) {
          errorMessage = 'Authentication required. Please log in again.';
        } else {
          errorMessage = error.response.data?.error || `Server error (${error.response.status})`;
        }
      } else if (error.request) {
        // Request was made but no response received
        errorMessage = 'Cannot connect to server. Please check if the backend is running on port 8000.';
      } else {
        // Something else happened
        errorMessage = error.message || 'Network error occurred';
      }
      
      setReportStatus(`Error downloading ${reportType}: ${errorMessage}`);
    } finally {
      setGeneratingReport(false);
    }
  };

  const downloadReportAsExecutable = async (reportType) => {
    try {
      setGeneratingReport(true);
      setReportStatus(`Creating executable for ${reportType}...`);
      
      let response;
      let filename;
      
      switch (reportType) {
        case 'program-details':
          response = await eventsAPI.generateProgramDetailsExecutable(eventId);
          filename = `Eventloo_Program_Details_${event?.title || 'Event'}_${new Date().toISOString().split('T')[0]}.exe`;
          break;
        case 'complete-results':
          response = await eventsAPI.generateCompleteResultsExecutable(eventId);
          filename = `Eventloo_Complete_Results_${event?.title || 'Event'}_${new Date().toISOString().split('T')[0]}.exe`;
          break;
        case 'participants-team':
          response = await eventsAPI.generateParticipantsTeamExecutable(eventId);
          filename = `Eventloo_Participants_Team_${event?.title || 'Event'}_${new Date().toISOString().split('T')[0]}.exe`;
          break;
        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }
      
      // Download the executable file
      const blob = new Blob([response.data], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setReportStatus(`${reportType.replace('-', ' ')} executable created successfully!`);
    } catch (error) {
      console.error(`Error creating executable for ${reportType}:`, error);
      setReportStatus(`Error creating executable for ${reportType}: ${error.message}`);
    } finally {
      setGeneratingReport(false);
    }
  };





  // Group programs by category
  const programsByCategory = (programs && Array.isArray(programs) ? programs : []).reduce((acc, program) => {
    if (!acc[program.category]) {
      acc[program.category] = [];
    }
    acc[program.category].push(program);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading event reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Event Reports & Backup
              </h1>
              <p className="text-gray-600">
                View and download comprehensive reports for "{event?.title}"
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="h-6 w-6 text-blue-600" />
              <span className="text-sm text-gray-500">
                {event?.start_date} - {event?.end_date}
              </span>
            </div>
          </div>
        </div>

        {/* Status Message */}
        {reportStatus && (
          <div className={`mb-6 p-4 rounded-lg flex items-center space-x-3 ${
            reportStatus.includes('Error') 
              ? 'bg-red-50 border border-red-200 text-red-700' 
              : 'bg-green-50 border border-green-200 text-green-700'
          }`}>
            {reportStatus.includes('Error') ? (
              <AlertCircle className="h-5 w-5" />
            ) : (
              <CheckCircle className="h-5 w-5" />
            )}
            <span className="text-sm font-medium">{reportStatus}</span>
          </div>
        )}

        {/* Report Sections */}
        <div className="space-y-6">
          
          {/* Program Details Report */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Complete Programs Report</h3>
                    <p className="text-sm text-gray-500">Full programs with participants, teams, venue, and all details</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => downloadReportAsPDF('program-details')}
                    disabled={generatingReport}
                    className="bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 text-sm"
                  >
                    {generatingReport ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <span>PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        <span>PDF</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => downloadReportAsExecutable('program-details')}
                    disabled={generatingReport}
                    className="bg-green-600 text-white py-2 px-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 text-sm"
                  >
                    {generatingReport ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <span>EXE...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        <span>EXE</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Complete Results Report */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Award className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Winners Report (1st, 2nd, 3rd)</h3>
                    <p className="text-sm text-gray-500">Only 1st, 2nd, and 3rd places with participant names</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => downloadReportAsPDF('complete-results')}
                    disabled={generatingReport}
                    className="bg-purple-600 text-white py-2 px-3 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 text-sm"
                  >
                    {generatingReport ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <span>PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        <span>All</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => downloadReportAsPDF('first-place')}
                    disabled={generatingReport}
                    className="bg-yellow-600 text-white py-2 px-3 rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 text-sm"
                  >
                    {generatingReport ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <span>PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        <span>🥇 1st</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => downloadReportAsPDF('second-place')}
                    disabled={generatingReport}
                    className="bg-gray-600 text-white py-2 px-3 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 text-sm"
                  >
                    {generatingReport ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <span>PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        <span>🥈 2nd</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => downloadReportAsPDF('third-place')}
                    disabled={generatingReport}
                    className="bg-orange-600 text-white py-2 px-3 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 text-sm"
                  >
                    {generatingReport ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <span>PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        <span>🥉 3rd</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => downloadReportAsPDF('all-results')}
                    disabled={generatingReport}
                    className="bg-red-600 text-white py-2 px-3 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 text-sm"
                  >
                    {generatingReport ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <span>PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        <span>📊 All Results</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => downloadReportAsExecutable('complete-results')}
                    disabled={generatingReport}
                    className="bg-green-600 text-white py-2 px-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 text-sm"
                  >
                    {generatingReport ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <span>EXE...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        <span>EXE</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Participants Team Report */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Users className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Participants Team Report</h3>
                    <p className="text-sm text-gray-500">Team-wise participants and their program participation</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => downloadReportAsPDF('participants-team')}
                    disabled={generatingReport}
                    className="bg-green-600 text-white py-2 px-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 text-sm"
                  >
                    {generatingReport ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <span>PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        <span>PDF</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => downloadReportAsExecutable('participants-team')}
                    disabled={generatingReport}
                    className="bg-green-600 text-white py-2 px-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 text-sm"
                  >
                    {generatingReport ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <span>EXE...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        <span>EXE</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
};

export default EventReports; 