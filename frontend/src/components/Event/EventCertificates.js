import React, { useState, useEffect } from 'react';
import { eventCertificatesAPI, eventProgramsAPI } from '../../services/api';

const EventCertificates = ({ event, eventId, onRefresh }) => {
  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [certificateType, setCertificateType] = useState('winner');

  useEffect(() => {
    fetchPrograms();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    if (selectedProgram) {
      fetchWinners();
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

  const fetchWinners = async () => {
    if (!selectedProgram) return;

    try {
      const response = await eventCertificatesAPI.getProgramWinners(selectedProgram.id);
      setWinners(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching winners:', error);
    }
  };

  const handleGenerateCertificate = async (participantId, type) => {
    try {
      setGenerating(true);
      const response = await eventCertificatesAPI.generateCertificate({
        event_id: eventId,
        program_id: selectedProgram.id,
        participant_id: participantId,
        certificate_type: type,
      });
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `certificate_${type}_${participantId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating certificate:', error);
      alert('Error generating certificate. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkGenerate = async (type) => {
    try {
      setGenerating(true);
      const response = await eventCertificatesAPI.generateBulkCertificates({
        event_id: eventId,
        program_id: selectedProgram.id,
        certificate_type: type,
      });
      
      // Create download link for ZIP file
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedProgram.name}_${type}_certificates.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating bulk certificates:', error);
      alert('Error generating bulk certificates. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleEventBulkGenerate = async () => {
    try {
      setGenerating(true);
      const response = await eventCertificatesAPI.generateEventCertificates(eventId);
      
      // Create download link for ZIP file
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${event.title}_all_certificates.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating event certificates:', error);
      alert('Error generating event certificates. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const getPositionDisplay = (position) => {
    if (position === 1) return '1st Place';
    if (position === 2) return '2nd Place';
    if (position === 3) return '3rd Place';
    return `${position}th Place`;
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
          <h2 className="text-2xl font-bold text-gray-900">Certificates</h2>
          <p className="text-gray-600 mt-1">Generate certificates for {event.title}</p>
        </div>
        <button
          onClick={handleEventBulkGenerate}
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
          Generate All Event Certificates
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

      {/* Certificate Type Selection */}
      {selectedProgram && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Certificate Type</label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="winner"
                checked={certificateType === 'winner'}
                onChange={(e) => setCertificateType(e.target.value)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Winners Only</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="participation"
                checked={certificateType === 'participation'}
                onChange={(e) => setCertificateType(e.target.value)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">All Participants</span>
            </label>
          </div>
        </div>
      )}

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
              <button
                onClick={() => setSelectedProgram(program)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
              >
                Select
              </button>
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
                    {new Date(program.scheduled_time).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Program Certificate Generation */}
      {selectedProgram && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedProgram.name}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Generate certificates for participants
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => handleBulkGenerate(certificateType)}
                  disabled={generating || winners.length === 0}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center disabled:opacity-50"
                >
                  {generating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  Bulk Generate
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {winners.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">🏆</div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No results available</h4>
                <p className="text-gray-500">Please enter program results first to generate certificates.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {certificateType === 'winner' && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Winners & Runners-up</h4>
                    <div className="space-y-3">
                      {winners.filter(w => w.position <= 3).map((winner) => (
                        <div key={winner.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center">
                            <div className="text-2xl mr-4">
                              {winner.position === 1 ? '🥇' : winner.position === 2 ? '🥈' : '🥉'}
                            </div>
                            <div>
                              <h5 className="font-medium text-gray-900">{winner.participant_name}</h5>
                              <p className="text-sm text-gray-500">
                                {getPositionDisplay(winner.position)} • {winner.marks} marks
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                              winner.position === 1 ? 'bg-yellow-100 text-yellow-800' :
                              winner.position === 2 ? 'bg-gray-100 text-gray-800' :
                              'bg-orange-100 text-orange-800'
                            }`}>
                              {getPositionDisplay(winner.position)}
                            </span>
                            <button
                              onClick={() => handleGenerateCertificate(winner.participant_id, 'winner')}
                              disabled={generating}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                            >
                              Generate
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {certificateType === 'participation' && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">All Participants</h4>
                    <div className="space-y-3">
                      {winners.map((participant) => (
                        <div key={participant.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold mr-4">
                              {participant.participant_name?.charAt(0) || 'P'}
                            </div>
                            <div>
                              <h5 className="font-medium text-gray-900">{participant.participant_name}</h5>
                              <p className="text-sm text-gray-500">
                                {participant.participant_id} • {participant.marks ? `${participant.marks} marks` : 'Participated'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="px-2 py-1 text-xs rounded-full font-medium bg-blue-100 text-blue-800">
                              Participant
                            </span>
                            <button
                              onClick={() => handleGenerateCertificate(participant.participant_id, 'participation')}
                              disabled={generating}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                            >
                              Generate
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Certificate Templates Preview */}
                <div className="mt-8 bg-gray-50 p-6 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-4">Certificate Preview</h4>
                  <div className="bg-white p-8 rounded-lg border-2 border-dashed border-gray-300">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-800 mb-4">CERTIFICATE OF {certificateType === 'winner' ? 'ACHIEVEMENT' : 'PARTICIPATION'}</div>
                      <div className="text-lg text-gray-600 mb-6">This is to certify that</div>
                      <div className="text-2xl font-bold text-blue-600 mb-6 border-b-2 border-blue-600 pb-2 inline-block">
                        [PARTICIPANT NAME]
                      </div>
                      <div className="text-lg text-gray-600 mb-4">
                        {certificateType === 'winner' ? 
                          'has achieved excellence in' : 
                          'has successfully participated in'
                        }
                      </div>
                      <div className="text-xl font-semibold text-gray-800 mb-4">{selectedProgram.name}</div>
                      <div className="text-lg text-gray-600 mb-6">
                        held during <span className="font-semibold">{event.title}</span>
                      </div>
                      {certificateType === 'winner' && (
                        <div className="text-lg text-yellow-600 font-semibold mb-4">
                          [POSITION] • [MARKS] marks
                        </div>
                      )}
                      <div className="flex justify-between items-end mt-12 pt-8">
                        <div className="text-center">
                          <div className="border-t-2 border-gray-400 pt-2">Date</div>
                        </div>
                        <div className="text-center">
                          <div className="border-t-2 border-gray-400 pt-2">Event Coordinator</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-4 text-center">
                    Actual certificates will be generated as PDF with official formatting and school branding.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {programs.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">🏅</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No programs available</h3>
          <p className="text-gray-500">Please add programs first to generate certificates.</p>
        </div>
      )}
    </div>
  );
};

export default EventCertificates; 