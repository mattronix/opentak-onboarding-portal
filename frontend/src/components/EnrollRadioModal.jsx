import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { radiosAPI } from '../services/api';
import { meshtasticSerial } from '../services/meshtasticSerial';
import './EnrollRadioModal.css';

function EnrollRadioModal({ onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    platform: 'meshtastic',
    radioType: 'meshtastic',
    description: '',
    softwareVersion: '',
    model: '',
    vendor: '',
    shortName: '',
    longName: '',
    mac: ''
  });
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [scanLog, setScanLog] = useState([]);
  const terminalRef = useRef(null);

  // Auto-scroll terminal to bottom when new log entries are added
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [scanLog]);

  // Check browser support
  const browserSupport = meshtasticSerial.getBrowserSupport();

  const enrollMutation = useMutation({
    mutationFn: (data) => radiosAPI.enroll(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['radios']);
      queryClient.invalidateQueries(['userRadios']);
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to enroll radio');
    }
  });

  const handleLearnFromUSB = async () => {
    if (!browserSupport.isSupported) {
      setError('Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.');
      return;
    }

    // Disconnect any existing connection first
    try {
      await meshtasticSerial.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }

    setScanning(true);
    setScanStatus('Connecting to radio...');
    setError('');
    setScanLog([]);

    let gotData = false;

    // Log handler for terminal output
    const handleLog = (entry) => {
      setScanLog(prev => [...prev, entry]);
    };

    try {
      // Instant update callback - updates form as soon as data arrives
      const handleInstantUpdate = (info) => {
        gotData = true;
        setScanning(false);

        // Format name as "longName (shortName)"
        const longName = info.longName || '';
        const shortName = info.shortName || '';
        let displayName = longName;
        if (longName && shortName) {
          displayName = `${longName} (${shortName})`;
        } else if (shortName) {
          displayName = shortName;
        }

        setScanStatus(`Done: ${displayName}`);
        setFormData(prev => ({
          ...prev,
          platform: 'meshtastic',
          radioType: 'meshtastic',
          shortName: shortName || prev.shortName,
          longName: longName || prev.longName,
          softwareVersion: info.firmwareVersion || prev.softwareVersion,
          model: info.hwModel ? String(info.hwModel) : prev.model,
          name: displayName || prev.name,
          mac: info.macAddr || prev.mac
        }));

        // Disconnect after getting data
        meshtasticSerial.disconnect();
      };

      await meshtasticSerial.connect(
        (status, message) => {
          if (!gotData) {
            setScanStatus(message);
          }
        },
        null, // onProgress
        handleInstantUpdate,
        handleLog
      );

      // If we reach here without data, wait a bit for packets
      if (!gotData) {
        setScanStatus('Waiting for device info...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        if (!gotData) {
          // Try to get info from device
          const info = meshtasticSerial.getDeviceInfo();
          if (info && (info.shortName || info.longName)) {
            handleInstantUpdate(info);
          } else {
            setScanStatus('No device info received');
            setScanning(false);
          }
        }
      }
    } catch (err) {
      setError(err.message);
      setScanStatus('');
      setScanning(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Radio name is required');
      return;
    }

    enrollMutation.mutate(formData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal enroll-radio-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Register Your Radio</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <p className="enroll-description">
              Connect your Meshtastic radio via USB to automatically detect its information,
              or enter the details manually below.
            </p>

            {/* Learn from USB button */}
            {browserSupport.isSupported ? (
              <div className="usb-scan-section">
                <div className="usb-scan-controls">
                  <button
                    type="button"
                    className="btn btn-info"
                    onClick={handleLearnFromUSB}
                    disabled={scanning}
                  >
                    {scanning ? 'Scanning...' : 'Learn from USB'}
                  </button>
                  <span className="scan-status">
                    {scanStatus || 'Click to scan a connected radio'}
                  </span>
                </div>

                {/* Terminal Log Box */}
                {scanLog.length > 0 && (
                  <div className="scan-terminal">
                    <div className="terminal-header">Connection Log</div>
                    <div className="terminal-content" ref={terminalRef}>
                      {scanLog.map((entry, i) => (
                        <div key={i} className={`terminal-line ${entry.type}`}>
                          <span className="terminal-time">[{entry.timestamp}]</span>
                          <span className="terminal-msg">{entry.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="alert alert-warning">
                USB scanning requires Chrome, Edge, or Opera browser.
              </div>
            )}

            <div className="form-divider">
              <span>Radio Details</span>
            </div>

            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., My Meshtastic Radio"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Short Name</label>
                <input
                  type="text"
                  value={formData.shortName}
                  onChange={(e) => setFormData({...formData, shortName: e.target.value})}
                  placeholder="e.g., F001"
                />
              </div>
              <div className="form-group">
                <label>Long Name</label>
                <input
                  type="text"
                  value={formData.longName}
                  onChange={(e) => setFormData({...formData, longName: e.target.value})}
                  placeholder="e.g., Matthew"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Firmware Version</label>
                <input
                  type="text"
                  value={formData.softwareVersion}
                  onChange={(e) => setFormData({...formData, softwareVersion: e.target.value})}
                  placeholder="e.g., 2.3.0"
                />
              </div>
              <div className="form-group">
                <label>Model</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({...formData, model: e.target.value})}
                  placeholder="e.g., TBEAM"
                />
              </div>
            </div>

            <div className="form-group">
              <label>MAC Address</label>
              <input
                type="text"
                value={formData.mac}
                onChange={(e) => setFormData({...formData, mac: e.target.value})}
                placeholder="e.g., AA:BB:CC:DD:EE:FF"
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Optional notes about this radio"
                rows={2}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={enrollMutation.isPending || !formData.name.trim()}
            >
              {enrollMutation.isPending ? 'Registering...' : 'Register Radio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EnrollRadioModal;
