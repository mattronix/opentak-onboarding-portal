import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { radiosAPI, meshtasticGroupsAPI } from '../services/api';
import { meshtasticSerial } from '../services/meshtasticSerial';
import './ProgramRadioModal.css';

function ProgramRadioModal({ radio, onClose }) {
  const [step, setStep] = useState(1); // 1: Select config, 2: Connect, 3: Programming, 4: Result
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [statusMessage, setStatusMessage] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [previewConfig, setPreviewConfig] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [scanLog, setScanLog] = useState([]);
  const [isProgramming, setIsProgramming] = useState(false);
  const terminalRef = useRef(null);

  // Check browser support
  const browserSupport = meshtasticSerial.getBrowserSupport();

  // Fetch channel groups
  const { data: groupsData, isLoading: loadingGroups } = useQuery({
    queryKey: ['meshtasticGroupsAdmin'],
    queryFn: async () => {
      const response = await meshtasticGroupsAPI.getAllAdmin();
      return response.data;
    },
  });

  // Clean up connection on unmount
  useEffect(() => {
    return () => {
      if (meshtasticSerial.isConnected) {
        meshtasticSerial.disconnect();
      }
    };
  }, []);

  // Auto-scroll terminal to bottom when new log entries are added
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [scanLog]);

  // Fetch preview config when a group is selected
  const handleSelectGroup = async (groupId) => {
    setSelectedGroupId(groupId);
    setPreviewConfig(null);

    if (groupId) {
      setLoadingPreview(true);
      try {
        const response = await radiosAPI.getProgramConfig(radio.id, {
          channelGroupId: groupId
        });
        setPreviewConfig(response.data);
      } catch (err) {
        console.error('Failed to load preview:', err);
        // Don't show error - preview is optional
      } finally {
        setLoadingPreview(false);
      }
    }
  };

  const handleStatusChange = (status, message) => {
    // Only update connectionStatus for terminal states; keep 'connecting' for intermediate updates
    if (status === 'connected' || status === 'error' || status === 'disconnected') {
      setConnectionStatus(status);
    }
    setStatusMessage(message);
  };

  const handleProgress = (current, total, message) => {
    setProgress({ current, total, message });
  };

  const handleLog = (entry) => {
    // _log passes a single object { timestamp, message, type }
    setScanLog(prev => [...prev, entry]);
  };

  const handleConnect = async () => {
    setError('');
    setScanLog([]);
    setConnectionStatus('connecting');

    try {
      // connect() handles disconnecting any existing connection internally
      const info = await meshtasticSerial.connect(handleStatusChange, handleProgress, null, handleLog);
      setDeviceInfo(info);
      setStep(3);
      // Auto-start programming after connection
      await startProgramming();
    } catch (err) {
      setError(err.message);
    }
  };

  const startProgramming = async () => {
    setError('');
    setIsProgramming(true);
    try {
      // Get programming config from backend
      const configResponse = await radiosAPI.getProgramConfig(radio.id, {
        channelGroupId: selectedGroupId
      });
      const config = configResponse.data;

      // Program the radio
      await meshtasticSerial.programRadio({
        radio: config.radio,
        channels: config.channels,
        yamlConfig: config.yaml_config
      });

      setSuccess(true);
      setStep(4);
    } catch (err) {
      setError(err.message);
      setStep(4);
    } finally {
      setIsProgramming(false);
    }
  };

  const handleClose = () => {
    if (isProgramming) {
      const confirmed = window.confirm(
        'Programming is in progress!\n\nClosing now may leave your radio in an incomplete state.\n\nAre you sure you want to cancel?'
      );
      if (!confirmed) return;
    }
    onClose();
  };

  const groups = groupsData?.groups || [];

  return (
    <div className="modal-overlay">
      <div className="modal program-radio-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Program Radio: {radio.name}</h2>
          <button className="modal-close" onClick={handleClose} disabled={isProgramming}>×</button>
        </div>

        <div className="modal-body">
          {!browserSupport.isSupported ? (
            <div className="browser-warning">
              <h3>Browser Not Supported</h3>
              <p>{browserSupport.message}</p>
              <p>You are using: <strong>{browserSupport.browser}</strong></p>
            </div>
          ) : (
            <>
              {/* Step Indicator */}
              <div className="step-indicator">
                <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
                  <span className="step-number">1</span>
                  <span className="step-label">Select Config</span>
                </div>
                <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
                  <span className="step-number">2</span>
                  <span className="step-label">Connect</span>
                </div>
                <div className={`step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
                  <span className="step-number">3</span>
                  <span className="step-label">Program</span>
                </div>
                <div className={`step ${step >= 4 ? 'active' : ''}`}>
                  <span className="step-number">4</span>
                  <span className="step-label">Done</span>
                </div>
              </div>

              {error && <div className="alert alert-error">{error}</div>}

              {/* Step 1: Select Configuration */}
              {step === 1 && (
                <div className="program-step">
                  <h3>Select Channel Group</h3>
                  <p>Choose which channel group configuration to program onto this radio.</p>

                  {loadingGroups ? (
                    <div className="loading">Loading channel groups...</div>
                  ) : groups.length === 0 ? (
                    <div className="empty-state">No channel groups available. Create one first.</div>
                  ) : (
                    <>
                      <div className="group-select">
                        {groups.map(group => (
                          <div
                            key={group.id}
                            className={`group-option ${selectedGroupId === group.id ? 'selected' : ''}`}
                            onClick={() => handleSelectGroup(group.id)}
                          >
                            <div className="group-name">{group.name}</div>
                            <div className="group-details">
                              <span className="channel-count">{group.channel_count} channels</span>
                              {group.yamlConfig && <span className="has-config">Has device config</span>}
                            </div>
                            {group.description && (
                              <div className="group-description">{group.description}</div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Config Preview */}
                      {selectedGroupId && (
                        <div className="config-preview">
                          <div
                            className="preview-header"
                            onClick={() => setShowPreview(!showPreview)}
                          >
                            <span className="preview-toggle">{showPreview ? '▼' : '▶'}</span>
                            <h4>Configuration Preview</h4>
                            {loadingPreview && <span className="preview-loading">Loading...</span>}
                          </div>

                          {showPreview && previewConfig && (
                            <div className="preview-content">
                              {/* Radio Info */}
                              <div className="preview-section">
                                <h5>Target Radio</h5>
                                <div className="preview-radio-info">
                                  <span><strong>{previewConfig.radio.name}</strong></span>
                                  {previewConfig.radio.shortName && (
                                    <span className="radio-detail">Short: {previewConfig.radio.shortName}</span>
                                  )}
                                  {previewConfig.radio.longName && (
                                    <span className="radio-detail">Long: {previewConfig.radio.longName}</span>
                                  )}
                                </div>
                              </div>

                              {/* Channels */}
                              <div className="preview-section">
                                <h5>Channels ({previewConfig.channels.length})</h5>
                                <div className="preview-channels">
                                  {previewConfig.channels.map((channel, idx) => (
                                    <div key={idx} className="preview-channel">
                                      <span className="channel-slot">Slot {channel.slot_number}</span>
                                      <span className="channel-name">{channel.name}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* YAML Config */}
                              {previewConfig.yaml_config && (
                                <div className="preview-section">
                                  <h5>Device Configuration (Rendered)</h5>
                                  {previewConfig.unresolved_placeholders?.length > 0 && (
                                    <div className="preview-warning">
                                      Missing values for: {previewConfig.unresolved_placeholders.join(', ')}
                                    </div>
                                  )}
                                  <pre className="preview-yaml">{previewConfig.yaml_config}</pre>
                                </div>
                              )}

                              {/* User Info */}
                              {previewConfig.user && (
                                <div className="preview-section">
                                  <h5>Assigned User</h5>
                                  <div className="preview-user">
                                    {previewConfig.user.callsign && (
                                      <span>Callsign: <strong>{previewConfig.user.callsign}</strong></span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Step 2: Connect to Radio */}
              {step === 2 && (
                <div className="program-step">
                  {connectionStatus === 'connecting' ? (
                    /* Show loading overlay when connecting */
                    <div className="connecting-overlay">
                      <div className="connecting-header">
                        <div className="programming-spinner"></div>
                        <h3>Connecting to Radio...</h3>
                      </div>
                      <p className="connecting-message">Please wait while we establish connection</p>
                      <div className="connecting-status">
                        {statusMessage || 'Initializing...'}
                      </div>
                      {scanLog.length > 0 && (
                        <div className="scan-terminal" style={{ marginTop: '20px', textAlign: 'left' }}>
                          <div className="terminal-header">Connection Log</div>
                          <div className="terminal-content" ref={terminalRef}>
                            {scanLog.map((entry, idx) => (
                              <div key={idx} className={`terminal-line ${entry.type}`}>
                                <span className="terminal-time">[{entry.timestamp}]</span>
                                <span className="terminal-msg">{entry.message}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Show connection instructions when not connecting */
                    <>
                      <h3>Connect to Radio</h3>
                      <p>Connect your Meshtastic radio via USB and click the button below.</p>

                      <div className="connection-status">
                        <div className={`status-indicator ${connectionStatus}`}></div>
                        <span>{statusMessage || 'Ready to connect'}</span>
                      </div>

                      <div className="connection-instructions">
                        <ol>
                          <li>Connect your Meshtastic radio to your computer via USB</li>
                          <li>Click "Connect Radio" and select the serial port</li>
                          <li>Wait for the connection to be established</li>
                        </ol>
                      </div>

                      <button
                        className="btn btn-primary btn-lg"
                        onClick={handleConnect}
                        disabled={connectionStatus === 'connecting'}
                      >
                        Connect Radio
                      </button>

                      {scanLog.length > 0 && (
                        <div className="scan-terminal">
                          <div className="terminal-header">Connection Log</div>
                          <div className="terminal-content" ref={terminalRef}>
                            {scanLog.map((entry, idx) => (
                              <div key={idx} className={`terminal-line ${entry.type}`}>
                                <span className="terminal-time">[{entry.timestamp}]</span>
                                <span className="terminal-msg">{entry.message}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Step 3: Programming */}
              {step === 3 && (
                <div className="program-step">
                  <div className="programming-header">
                    <div className="programming-spinner"></div>
                    <h3>Configuring Radio...</h3>
                  </div>

                  <div className="programming-warning">
                    <strong>Please wait</strong> — Do not disconnect or close this window
                  </div>

                  {deviceInfo && (
                    <div className="device-info">
                      <strong>Device:</strong>
                      <span>{deviceInfo.longName || deviceInfo.shortName || 'Unknown'}</span>
                      {deviceInfo.firmwareVersion && (
                        <span className="firmware">v{deviceInfo.firmwareVersion}</span>
                      )}
                    </div>
                  )}

                  <div className="progress-container">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: progress.total ? `${(progress.current / progress.total) * 100}%` : '0%' }}
                      ></div>
                    </div>
                    <div className="progress-text">
                      {progress.message || 'Starting configuration...'}
                    </div>
                    <div className="progress-count">
                      {progress.total > 0 ? `${progress.current} / ${progress.total}` : 'Preparing...'}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Result */}
              {step === 4 && (
                <div className="program-step">
                  {success ? (
                    <div className="result-success">
                      <div className="result-icon">&#10004;</div>
                      <h3>Programming Complete!</h3>
                      <p>The radio has been successfully programmed with the selected configuration.</p>
                      {deviceInfo && (
                        <p className="device-name">Device: {deviceInfo.longName || deviceInfo.shortName}</p>
                      )}
                    </div>
                  ) : (
                    <div className="result-error">
                      <div className="result-icon">&#10006;</div>
                      <h3>Programming Failed</h3>
                      <p>{error || 'An unknown error occurred'}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          {step === 1 && (
            <>
              <button className="btn btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setStep(2)}
                disabled={!selectedGroupId}
              >
                Next: Connect Radio
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setStep(1)}
                disabled={connectionStatus === 'connecting'}
              >
                Back
              </button>
            </>
          )}

          {step === 3 && (
            <div className="programming-footer-notice">
              Configuration in progress...
            </div>
          )}

          {step === 4 && (
            <>
              {!success && (
                <button
                  className="btn btn-secondary"
                  onClick={() => { setStep(2); setError(''); }}
                >
                  Try Again
                </button>
              )}
              <button className="btn btn-primary" onClick={handleClose}>
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProgramRadioModal;
