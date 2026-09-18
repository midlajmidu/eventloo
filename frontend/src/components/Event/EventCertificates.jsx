import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Save, 
  Check, 
  Layers, 
  User, 
  Plus,
  Sparkles,
  Eye,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type
} from 'lucide-react';
import { eventCertificatesAPI } from '../../services/api';

const TEMPLATE_TYPES = [
  { id: 'first_place', title: '1st Place Certificate', subtitle: 'Choose a template', defaultStatus: 'Missing' },
  { id: 'second_place', title: '2nd Place Certificate', subtitle: 'Choose a template', defaultStatus: 'Missing' },
  { id: 'third_place', title: '3rd Place Certificate', subtitle: 'Choose a template', defaultStatus: 'Missing' },
  { id: 'participation', title: 'Participation Certificate', subtitle: 'Choose a template', defaultStatus: 'Missing' },
  { id: 'common_prize', title: 'Common Prize Certificate', subtitle: 'Coming Soon', defaultStatus: 'Missing', comingSoon: true },
  { id: 'grade_certificate', title: 'Grade Certificate', subtitle: 'Coming Soon', defaultStatus: 'Missing', comingSoon: true },
  { id: 'result_poster', title: 'Result Poster', subtitle: 'Coming Soon', defaultStatus: 'Missing', comingSoon: true },
  { id: 'badge', title: 'Badge', subtitle: 'Coming Soon', defaultStatus: 'Missing', comingSoon: true }
];

const FONT_OPTIONS = [
  { label: 'Helvetica (Clean Sans)', value: 'helvetica', css: 'Helvetica, Arial, sans-serif' },
  { label: 'Times (Classic Serif)', value: 'times', css: 'Times New Roman, Times, serif' },
  { label: 'Courier (Monospace)', value: 'courier', css: 'Courier New, Courier, monospace' },
  { label: 'Zapf Chancery (Script)', value: 'zapf', css: 'Zapf Chancery, cursive' }
];

const certificateFontCss = (fontKey) => (
  FONT_OPTIONS.find(option => option.value === fontKey)?.css || FONT_OPTIONS[0].css
);

const certificateTransform = (alignment = 'center') => {
  if (alignment === 'left') return 'translate(0, -50%)';
  if (alignment === 'right') return 'translate(-100%, -50%)';
  return 'translate(-50%, -50%)';
};

const INITIAL_FIELDS = {
  participantName: { id: 'participantName', label: 'Participant Name', sample: 'Ayisha Amna', x: 42, y: 60, fontSize: 22, color: '#000000', fontFamily: 'helvetica', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: true },
  chestNo: { id: 'chestNo', label: 'Participant ID / Chest No', sample: 'Chest No: 4003', x: 42, y: 68, fontSize: 16, color: '#1E40AF', fontFamily: 'helvetica', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: true },
  category: { id: 'category', label: 'Category', sample: 'Higher Secondary', x: 42, y: 75, fontSize: 14, color: '#374151', fontFamily: 'helvetica', textAlign: 'center', bold: false, letterSpacing: 0, uppercase: false, enabled: true },
  teamName: { id: 'teamName', label: 'Team / Institution', sample: 'Palakkutty Unit', x: 42, y: 82, fontSize: 14, color: '#374151', fontFamily: 'helvetica', textAlign: 'center', bold: false, letterSpacing: 0, uppercase: false, enabled: true },
  eventName: { id: 'eventName', label: 'Event Name', sample: 'School Arts Festival', x: 42, y: 88, fontSize: 14, color: '#1F2937', fontFamily: 'helvetica', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: false },
  programName: { id: 'programName', label: 'Program Name', sample: 'Solo Song', x: 42, y: 92, fontSize: 13, color: '#374151', fontFamily: 'helvetica', textAlign: 'center', bold: false, letterSpacing: 0, uppercase: false, enabled: false },
  rank: { id: 'rank', label: 'Rank / Place', sample: '1st Place', x: 75, y: 60, fontSize: 16, color: '#D97706', fontFamily: 'helvetica', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: false }
};

const EventCertificates = ({ event, eventId }) => {
  const [activeTemplateId, setActiveTemplateId] = useState('first_place');
  const [templates, setTemplates] = useState({});
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState('participantName');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [sampleData, setSampleData] = useState({
    participantName: 'Ayisha Amna',
    chestNo: 'Chest No: 4003',
    category: 'Higher Secondary',
    teamName: 'Palakkutty Unit',
    eventName: event?.title || 'School Arts Festival',
    programName: 'Solo Song',
    rank: '1st Place'
  });

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    fetchSampleData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, activeTemplateId]);

  useEffect(() => {
    if (TEMPLATE_TYPES.find(type => type.id === activeTemplateId)?.comingSoon) {
      setActiveTemplateId('first_place');
    }
  }, [activeTemplateId]);

  const fetchSampleData = async () => {
    try {
      const response = await eventCertificatesAPI.getPreviewData(eventId, activeTemplateId);
      if (response.data?.recipient) {
        setSampleData(response.data.recipient);
      } else {
        setSampleData(prev => ({
          ...prev,
          eventName: event?.title || 'School Arts Festival',
          rank: activeTemplateId === 'first_place' ? '1st Place'
            : activeTemplateId === 'second_place' ? '2nd Place'
            : activeTemplateId === 'third_place' ? '3rd Place' : 'Participant'
        }));
      }
    } catch (err) {
      console.error('Error fetching sample DB participant:', err);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await eventCertificatesAPI.getTemplates(eventId);
      const loaded = {};
      (response.data?.results || []).forEach(template => {
        loaded[template.certificateType] = {
          ...template,
          id: template.certificateType,
          fields: template.fields || JSON.parse(JSON.stringify(INITIAL_FIELDS))
        };
      });
      setTemplates(loaded);
    } catch (e) {
      console.error('Error loading templates:', e);
      setErrorMessage(e.response?.data?.error || 'Unable to load certificate templates.');
    }
  };

  const saveTemplates = async (updated = templates) => {
    const template = updated[activeTemplateId] || currentTemplate;
    setSaving(true);
    setErrorMessage('');
    try {
      const response = await eventCertificatesAPI.updateTemplate(eventId, activeTemplateId, {
        fields: template.fields
      });
      setTemplates(prev => ({
        ...prev,
        [activeTemplateId]: { ...response.data, id: activeTemplateId }
      }));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (e) {
      console.error('Error saving templates:', e);
      setErrorMessage(e.response?.data?.error || 'Unable to save the certificate template.');
    } finally {
      setSaving(false);
    }
  };

  const currentTemplate = templates[activeTemplateId] || {
    id: activeTemplateId,
    bgImage: '',
    status: 'Missing',
    fields: JSON.parse(JSON.stringify(INITIAL_FIELDS))
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setErrorMessage('Use a PNG, JPEG or WebP certificate image.');
      e.target.value = '';
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErrorMessage('Certificate images must be 8 MB or smaller.');
      e.target.value = '';
      return;
    }

    setSaving(true);
    setErrorMessage('');
    try {
      const payload = new FormData();
      payload.append('background_image', file);
      payload.append('fields', JSON.stringify(currentTemplate.fields || INITIAL_FIELDS));
      const response = await eventCertificatesAPI.updateTemplate(
        eventId, activeTemplateId, payload
      );
      setTemplates(prev => ({
        ...prev,
        [activeTemplateId]: { ...response.data, id: activeTemplateId }
      }));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (error) {
      setErrorMessage(error.response?.data?.error || 'Unable to upload the certificate image.');
    } finally {
      setSaving(false);
      e.target.value = '';
    }
  };

  const handleMouseDown = (fieldKey, e) => {
    e.preventDefault();
    setSelectedFieldId(fieldKey);

    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();

    const onMouseMove = (moveEvent) => {
      let x = ((moveEvent.clientX - canvasRect.left) / canvasRect.width) * 100;
      let y = ((moveEvent.clientY - canvasRect.top) / canvasRect.height) * 100;
      
      x = Math.max(2, Math.min(95, x));
      y = Math.max(2, Math.min(95, y));

      setTemplates(prev => {
        const cur = prev[activeTemplateId] || currentTemplate;
        const updatedFields = {
          ...cur.fields,
          [fieldKey]: { ...cur.fields[fieldKey], x, y }
        };
        return {
          ...prev,
          [activeTemplateId]: { ...cur, fields: updatedFields }
        };
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleResizeMouseDown = (fieldKey, handleType, e) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFieldId(fieldKey);

    const startX = e.clientX;
    const startSize = currentTemplate.fields[fieldKey]?.fontSize || 18;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const delta = handleType.includes('right') ? deltaX : -deltaX;
      
      const newFontSize = Math.max(10, Math.min(90, Math.round(startSize + delta * 0.25)));

      setTemplates(prev => {
        const cur = prev[activeTemplateId] || currentTemplate;
        const updatedFields = {
          ...cur.fields,
          [fieldKey]: { ...cur.fields[fieldKey], fontSize: newFontSize }
        };
        return {
          ...prev,
          [activeTemplateId]: { ...cur, fields: updatedFields }
        };
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const toggleFieldEnabled = (fieldKey) => {
    const cur = currentTemplate;
    const updatedFields = {
      ...cur.fields,
      [fieldKey]: { ...cur.fields[fieldKey], enabled: !cur.fields[fieldKey].enabled }
    };
    setTemplates({
      ...templates,
      [activeTemplateId]: { ...cur, fields: updatedFields }
    });
  };

  const updateFieldProp = (fieldKey, prop, val) => {
    const cur = currentTemplate;
    const updatedFields = {
      ...cur.fields,
      [fieldKey]: { ...cur.fields[fieldKey], [prop]: val }
    };
    setTemplates({
      ...templates,
      [activeTemplateId]: { ...cur, fields: updatedFields }
    });
  };

  const activeTypeInfo = TEMPLATE_TYPES.find(t => t.id === activeTemplateId) || TEMPLATE_TYPES[0];
  const availableTemplateIds = TEMPLATE_TYPES.filter(t => !t.comingSoon).map(t => t.id);
  const configuredCount = availableTemplateIds.filter(id => templates[id]?.status === 'Custom' || templates[id]?.bgImage).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      
      {/* Save Success Toast */}
      {savedSuccess && (
        <div className="fixed top-20 right-8 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center space-x-2 animate-bounce">
          <Check className="w-5 h-5 stroke-[3]" />
          <span className="text-xs font-bold">Template layout saved successfully!</span>
        </div>
      )}
      {errorMessage && (
        <div className="fixed top-20 right-8 z-50 max-w-sm bg-rose-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-start space-x-2">
          <X className="w-5 h-5 shrink-0" />
          <span className="text-xs font-bold">{errorMessage}</span>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left / Center Canvas Workspace (Col 8) */}
        <div className="lg:col-span-8 bg-white border border-gray-100 rounded-3xl p-6 shadow-2xs space-y-4">
          
          {/* Header Title & Top Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {activeTypeInfo.subtitle}
              </div>
              <h2 className="text-xl font-extrabold text-gray-900">
                {activeTypeInfo.title}
              </h2>
            </div>

            <div className="flex items-center space-x-2 flex-wrap">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-colors inline-flex items-center space-x-1.5 cursor-pointer shadow-2xs"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Image</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewModalOpen(true)}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-colors inline-flex items-center space-x-1.5 cursor-pointer shadow-2xs"
              >
                <Eye className="w-4 h-4" />
                <span>Preview</span>
              </button>

              <button
                type="button"
                onClick={() => saveTemplates(templates)}
                disabled={saving}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-wait text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center space-x-1.5 cursor-pointer shadow-2xs"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Layout'}</span>
              </button>
            </div>
          </div>

          {/* Canva-Style Canvas Container */}
          <div className="relative w-full rounded-2xl p-4 bg-slate-50 border-2 border-dashed border-indigo-300 flex justify-center items-center overflow-hidden min-h-[580px]">
            
            {/* Template Badge Label Top Left */}
            <div className="absolute top-4 left-4 z-20 px-3 py-1 bg-white/90 backdrop-blur-xs border border-gray-200 rounded-lg text-[11px] font-bold text-gray-700 shadow-2xs">
              {activeTypeInfo.title}
            </div>

            {/* Canvas Main Image / Layout Container */}
            <div
              ref={canvasRef}
              style={{
                aspectRatio: currentTemplate.aspectRatio 
                  ? `${currentTemplate.aspectRatio}` 
                  : (activeTemplateId === 'badge' ? '3/4' : '4/3')
              }}
              className="relative w-full max-w-xl bg-white rounded-xl shadow-md overflow-hidden select-none border border-gray-200"
            >
              {/* Background Poster Image */}
              {currentTemplate.bgImage ? (
                <img
                  src={currentTemplate.bgImage}
                  alt="Template Background"
                  className="w-full h-full object-cover pointer-events-none"
                />
              ) : (
                <div className="w-full h-full relative bg-slate-50 p-6 flex flex-col justify-center items-center text-center border-2 border-dashed border-gray-300">
                  <div className="p-4 rounded-2xl bg-white shadow-2xs border border-gray-200 mb-2">
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                    <div className="text-xs font-bold text-gray-800">Upload Custom Template Image</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">Click "Upload Image" to set background design</div>
                  </div>
                  <div className="text-[11px] font-semibold text-gray-400">
                    {event?.title || 'Event Design Canvas'}
                  </div>
                </div>
              )}

              {/* Draggable & Resizable Canva Fields Overlaid on Canvas */}
              {Object.values(currentTemplate.fields || {}).map((f) => {
                if (!f.enabled) return null;

                const isSelected = selectedFieldId === f.id;

                if (f.isPhoto) {
                  return (
                    <div
                      key={f.id}
                      onMouseDown={(e) => handleMouseDown(f.id, e)}
                      style={{
                        left: `${f.x}%`,
                        top: `${f.y}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                      className={`absolute z-30 w-16 h-16 rounded-full border-2 border-dashed border-sky-500 bg-sky-100/50 backdrop-blur-xs flex flex-col items-center justify-center cursor-move hover:ring-2 hover:ring-sky-400 transition-all ${
                        isSelected ? 'ring-2 ring-sky-500 shadow-md scale-105' : ''
                      }`}
                    >
                      <User className="w-5 h-5 text-sky-600" />
                      <span className="text-[9px] font-bold text-sky-700 mt-0.5">Photo</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={f.id}
                    onMouseDown={(e) => handleMouseDown(f.id, e)}
                    style={{
                      left: `${f.x}%`,
                      top: `${f.y}%`,
                      transform: certificateTransform(f.textAlign),
                      fontSize: `${f.fontSize || 16}px`,
                      color: f.color || '#000000',
                      fontFamily: certificateFontCss(f.fontFamily),
                      textAlign: f.textAlign || 'center',
                      fontWeight: f.bold ? 'bold' : 'normal',
                      letterSpacing: `${f.letterSpacing || 0}px`,
                      textTransform: f.uppercase ? 'uppercase' : 'none'
                    }}
                    className={`absolute z-30 px-2 py-1 rounded cursor-move whitespace-nowrap transition-all ${
                      isSelected 
                        ? 'border border-dashed border-indigo-500 bg-transparent ring-1 ring-indigo-400' 
                        : 'border border-transparent hover:border-gray-300/40 bg-transparent'
                    }`}
                  >
                    <span className="pointer-events-none">{sampleData[f.id] || f.sample}</span>

                    {/* Interactive Canva Drag-Resize Handles when selected */}
                    {isSelected && (
                      <>
                        <div 
                          onMouseDown={(e) => handleResizeMouseDown(f.id, 'top-left', e)}
                          className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-indigo-600 border-2 border-white rounded-full cursor-nwse-resize hover:scale-125 transition-transform shadow-xs"
                          title="Drag corner to resize font"
                        />
                        <div 
                          onMouseDown={(e) => handleResizeMouseDown(f.id, 'top-right', e)}
                          className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-indigo-600 border-2 border-white rounded-full cursor-nesw-resize hover:scale-125 transition-transform shadow-xs"
                          title="Drag corner to resize font"
                        />
                        <div 
                          onMouseDown={(e) => handleResizeMouseDown(f.id, 'bottom-left', e)}
                          className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-indigo-600 border-2 border-white rounded-full cursor-nesw-resize hover:scale-125 transition-transform shadow-xs"
                          title="Drag corner to resize font"
                        />
                        <div 
                          onMouseDown={(e) => handleResizeMouseDown(f.id, 'bottom-right', e)}
                          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-indigo-600 border-2 border-white rounded-full cursor-nwse-resize hover:scale-125 transition-transform shadow-xs"
                          title="Drag corner to resize font"
                        />
                      </>
                    )}
                  </div>
                );
              })}

            </div>

          </div>

          {/* Canva-Style Property Controls Toolbar */}
          {selectedFieldId && currentTemplate.fields[selectedFieldId] && (
            <div className="bg-slate-50 p-5 rounded-2xl border border-gray-200 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2">
                  <Type className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-gray-900">
                    Typography & Styling Controls: {currentTemplate.fields[selectedFieldId].label}
                  </span>
                </div>
              </div>

              {!currentTemplate.fields[selectedFieldId].isPhoto && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-center">
                  
                  {/* Font Family Selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Font Family</label>
                    <select
                      value={currentTemplate.fields[selectedFieldId].fontFamily || 'helvetica'}
                      onChange={(e) => updateFieldProp(selectedFieldId, 'fontFamily', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      {FONT_OPTIONS.map(font => (
                        <option key={font.value} value={font.value}>{font.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Font Size Control */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Font Size ({currentTemplate.fields[selectedFieldId].fontSize || 16}px)
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="60"
                      value={currentTemplate.fields[selectedFieldId].fontSize || 16}
                      onChange={(e) => updateFieldProp(selectedFieldId, 'fontSize', parseInt(e.target.value, 10))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>

                  {/* Text Color Picker */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Text Color</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={currentTemplate.fields[selectedFieldId].color || '#000000'}
                        onChange={(e) => updateFieldProp(selectedFieldId, 'color', e.target.value)}
                        className="w-8 h-8 rounded-lg border border-gray-300 cursor-pointer bg-white"
                      />
                      <span className="text-xs font-mono font-bold text-gray-700">
                        {currentTemplate.fields[selectedFieldId].color || '#000000'}
                      </span>
                    </div>
                  </div>

                  {/* Align & Format Controls */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Text Alignment</label>
                    <div className="flex items-center space-x-1 bg-white p-1 border border-gray-200 rounded-xl">
                      <button
                        type="button"
                        onClick={() => updateFieldProp(selectedFieldId, 'textAlign', 'left')}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          currentTemplate.fields[selectedFieldId].textAlign === 'left' ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        <AlignLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateFieldProp(selectedFieldId, 'textAlign', 'center')}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          currentTemplate.fields[selectedFieldId].textAlign === 'center' ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        <AlignCenter className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateFieldProp(selectedFieldId, 'textAlign', 'right')}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          currentTemplate.fields[selectedFieldId].textAlign === 'right' ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        <AlignRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Letter Spacing</label>
                    <input
                      type="range"
                      min="-2"
                      max="12"
                      step="0.5"
                      value={currentTemplate.fields[selectedFieldId].letterSpacing || 0}
                      onChange={(e) => updateFieldProp(selectedFieldId, 'letterSpacing', Number(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>

                  <div className="sm:col-span-2 md:col-span-3">
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Formatting</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateFieldProp(selectedFieldId, 'bold', !currentTemplate.fields[selectedFieldId].bold)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border ${currentTemplate.fields[selectedFieldId].bold ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}
                      >
                        Bold
                      </button>
                      <button
                        type="button"
                        onClick={() => updateFieldProp(selectedFieldId, 'uppercase', !currentTemplate.fields[selectedFieldId].uppercase)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border ${currentTemplate.fields[selectedFieldId].uppercase ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}
                      >
                        Uppercase
                      </button>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

        </div>

        {/* Right Template Library Sidebar (Col 4) */}
        <div className="lg:col-span-4 bg-white border border-gray-100 rounded-3xl p-6 shadow-2xs space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-gray-700" />
              <h3 className="text-base font-bold text-gray-900">Template Library</h3>
            </div>
            <span className="px-2.5 py-1 text-xs font-extrabold bg-slate-100 text-slate-700 rounded-full">
              {configuredCount}/{availableTemplateIds.length}
            </span>
          </div>

          {/* List of 8 Template Cards */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {TEMPLATE_TYPES.map((item) => {
              const tmpl = templates[item.id] || {};
              const isSelected = activeTemplateId === item.id;
              const isCustom = !item.comingSoon && (tmpl.status === 'Custom' || tmpl.bgImage);

              return (
                <div
                  key={item.id}
                  onClick={() => !item.comingSoon && setActiveTemplateId(item.id)}
                  className={`p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between ${
                    item.comingSoon ? 'cursor-not-allowed opacity-70 bg-gray-50 border-gray-100' : 'cursor-pointer'
                  } ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/40 shadow-2xs'
                      : item.comingSoon ? '' : 'border-gray-100 hover:border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 ${
                    item.comingSoon
                      ? 'border-gray-300 bg-gray-100'
                      : isCustom 
                        ? 'border-emerald-600 bg-emerald-500' 
                        : 'border-gray-300 bg-white'
                    }`} />

                    <div>
                      <div className={`text-xs font-bold ${isSelected ? 'text-indigo-700' : 'text-gray-900'}`}>
                        {item.title}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                    item.comingSoon
                      ? 'bg-gray-100 text-gray-600 border border-gray-200'
                      : isCustom 
                      ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' 
                      : 'bg-rose-50/70 text-rose-500 border border-rose-100'
                  }`}>
                    {item.comingSoon ? 'Coming Soon' : (isCustom ? 'Custom' : 'Missing')}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Section: CHOOSE FOR [Selected Item] */}
          <div className="pt-4 border-t border-gray-100 space-y-4">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Choose for {activeTypeInfo.title}
            </div>

            {/* Custom Option Card */}
            <div className="p-4 rounded-2xl border border-gray-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900">Create Custom Template</span>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-[11px] text-gray-500">
                Upload your certificate design image and drag fields into place.
              </p>
            </div>

            {/* Add / Toggle Draggable Fields Toolbar */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-900">
                Available Canvas Fields
              </label>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(currentTemplate.fields || {}).map((field) => (
                  <button
                    key={field.id}
                    type="button"
                    onClick={() => toggleFieldEnabled(field.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors inline-flex items-center space-x-1 cursor-pointer ${
                      field.enabled
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                    }`}
                  >
                    {field.enabled ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>{field.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Save Layout Button */}
            <button
              type="button"
              onClick={() => saveTemplates(templates)}
              disabled={saving}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-wait text-white text-xs font-bold rounded-xl shadow-2xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : `Save ${activeTypeInfo.title} Template`}</span>
            </button>

          </div>

        </div>

      </div>

      {/* High-Res Full-Screen Preview Modal */}
      {previewModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Full Preview: {activeTypeInfo.title}
                </h3>
                <p className="text-xs text-gray-500">Live preview with sample database participant details</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-center p-4 bg-slate-100 rounded-2xl overflow-hidden">
              <div
                style={{
                  aspectRatio: currentTemplate.aspectRatio 
                    ? `${currentTemplate.aspectRatio}` 
                    : (activeTemplateId === 'badge' ? '3/4' : '4/3')
                }}
                className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200"
              >
                {currentTemplate.bgImage ? (
                  <img
                    src={currentTemplate.bgImage}
                    alt="Certificate Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-50 flex items-center justify-center text-xs font-bold text-gray-400">
                    No custom image uploaded yet
                  </div>
                )}

                {Object.values(currentTemplate.fields || {}).map((f) => {
                  if (!f.enabled) return null;
                  if (f.isPhoto) {
                    return (
                      <div
                        key={f.id}
                        style={{
                          left: `${f.x}%`,
                          top: `${f.y}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                        className="absolute z-30 w-16 h-16 rounded-full border-2 border-sky-500 bg-sky-100/60 flex items-center justify-center"
                      >
                        <User className="w-6 h-6 text-sky-600" />
                      </div>
                    );
                  }
                  return (
                    <div
                      key={f.id}
                      style={{
                        left: `${f.x}%`,
                        top: `${f.y}%`,
                        transform: certificateTransform(f.textAlign),
                        fontSize: `${f.fontSize || 16}px`,
                        color: f.color || '#000000',
                        fontFamily: certificateFontCss(f.fontFamily),
                        textAlign: f.textAlign || 'center',
                        fontWeight: f.bold ? 'bold' : 'normal',
                        letterSpacing: `${f.letterSpacing || 0}px`,
                        textTransform: f.uppercase ? 'uppercase' : 'none'
                      }}
                      className="absolute z-30 whitespace-nowrap"
                    >
                      {sampleData[f.id] || f.sample}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EventCertificates;
