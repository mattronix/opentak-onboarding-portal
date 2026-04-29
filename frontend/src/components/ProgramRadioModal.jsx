import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { radiosAPI, meshtasticGroupsAPI } from '../services/api';
import { meshtasticSerial } from '../services/meshtasticSerial';
import './ProgramRadioModal.css';

function ProgramRadioModal({ radio, onClose }) {
  const { t } = useTranslation();
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

  // Fetch channel groups accessible to the current user
  const { data: groupsData, isLoading: loadingGroups } = useQuery({
    queryKey: ['meshtasticGroups'],
    queryFn: async () => {
      const response = await meshtasticGroupsAPI.getAll();
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
      // connect() handles disconnecting any existing connection internally.
      // Programming requires a full connection (not detectOnly) so the device
      // reaches DeviceConfigured state before we call beginEditSettings().
      const info = await meshtasticSerial.connect(handleStatusChange, handleProgress, null, handleLog, { detectOnly: false });
      setDeviceInfo(info);
      setStep(3);
      // Auto-start programming after connection
      await startProgramming();
    } catch (err) {
      const msg = err?.message || (typeof err === 'string' ? err : t('radio.programmingFailed'));
      setError(msg);
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
      const msg = err?.message || (typeof err === 'string' ? err : t('radio.unknownError'));
      setError(msg);
      setStep(4);
    } finally {
      setIsProgramming(false);
    }
  };

  const handleClose = () => {
    if (isProgramming) {
      const confirmed = window.confirm(t('radio.configInProgress'));
      if (!confirmed) return;
    }
    onClose();
  };

  const groups = groupsData?.groups || [];

  return (
    <div className="modal-overlay">
      <div className="modal program-radio-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('common.program')}: {radio.name}</h2>
          <button className="modal-close" onClick={handleClose} disabled={isProgramming}>×</button>
        </div>

        <div className="modal-body">
          {!browserSupport.isSupported ? (
            <div className="browser-warning">
              <h3>{t('radio.browserNotSupported')}</h3>
              <p>{browserSupport.message}</p>
              <p>{t('radio.youAreUsing')} <strong>{browserSupport.browser}</strong></p>
            </div>
          ) : (
            <>
              {/* Step Indicator */}
              <div className="step-indicator">
                <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
                  <span className="step-number">1</span>
                  <span className="step-label">{t('radio.selectConfig')}</span>
                </div>
                <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
                  <span className="step-number">2</span>
                  <span className="step-label">{t('common.connect')}</span>
                </div>
                <div className={`step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
                  <span className="step-number">3</span>
                  <span className="step-label">{t('common.program')}</span>
                </div>
                <div className={`step ${step >= 4 ? 'active' : ''}`}>
                  <span className="step-number">4</span>
                  <span className="step-label">{t('common.done')}</span>
                </div>
              </div>

              {error && <div className="alert alert-error">{error}</div>}

              {/* Step 1: Select Configuration */}
              {step === 1 && (
                <div className="program-step">
                  <h3>{t('radio.selectChannelGroup')}</h3>
                  <p>{t('radio.chooseChannelGroup')}</p>

                  {loadingGroups ? (
                    <div className="loading">{t('radio.loadingChannelGroups')}</div>
                  ) : groups.length === 0 ? (
                    <div className="empty-state">{t('radio.noChannelGroups')}</div>
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
                              <span className="channel-count">{group.channel_count} {t('radio.channels')}</span>
                              {group.yamlConfig && <span className="has-config">{t('radio.hasDeviceConfig')}</span>}
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
                            <h4>{t('radio.configPreview')}</h4>
                            {loadingPreview && <span className="preview-loading">{t('common.loading')}</span>}
                          </div>

                          {showPreview && previewConfig && (
                            <div className="preview-content">
                              {/* Radio Info */}
                              <div className="preview-section">
                                <h5>{t('radio.targetRadio')}</h5>
                                <div className="preview-radio-info">
                                  <span><strong>{previewConfig.radio.name}</strong></span>
                                  {previewConfig.radio.shortName && (
                                    <span className="radio-detail">{t('radio.short')}: {previewConfig.radio.shortName}</span>
                                  )}
                                  {previewConfig.radio.longName && (
                                    <span className="radio-detail">{t('radio.long')}: {previewConfig.radio.longName}</span>
                                  )}
                                </div>
                              </div>

                              {/* Channels */}
                              <div className="preview-section">
                                <h5>{previewConfig.channels.length} {t('radio.channels')}</h5>
                                <div className="preview-channels">
                                  {previewConfig.channels.map((channel, idx) => (
                                    <div key={idx} className="preview-channel">
                                      <span className="channel-slot">{t('radio.slot')} {channel.slot_number}</span>
                                      <span className="channel-name">{channel.name}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* YAML Config */}
                              {previewConfig.yaml_config && (
                                <div className="preview-section">
                                  <h5>{t('radio.deviceConfig')}</h5>
                                  {previewConfig.unresolved_placeholders?.length > 0 && (
                                    <div className="preview-warning">
                                      {t('radio.missingValues')}{previewConfig.unresolved_placeholders.join(', ')}
                                    </div>
                                  )}
                                  <pre className="preview-yaml">{previewConfig.yaml_config}</pre>
                                </div>
                              )}

                              {/* User Info */}
                              {previewConfig.user && (
                                <div className="preview-section">
                                  <h5>{t('radio.assignedUser')}</h5>
                                  <div className="preview-user">
                                    {previewConfig.user.callsign && (
                                      <span>{t('radio.callsign')}: <strong>{previewConfig.user.callsign}</strong></span>
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
                        <h3>{t('radio.connectingToRadio')}</h3>
                      </div>
                      <p className="connecting-message">{t('radio.pleaseWait')}</p>
                      <div className="connecting-status">
                        {statusMessage || t('radio.initializing')}
                      </div>
                      {scanLog.length > 0 && (
                        <div className="scan-terminal" style={{ marginTop: '20px', textAlign: 'left' }}>
                          <div className="terminal-header">{t('radio.connectionLog')}</div>
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
                      <h3>{t('radio.connectToRadio')}</h3>
                      <p>{t('radio.connectDesc')}</p>

                      <div className="connection-status">
                        <div className={`status-indicator ${connectionStatus}`}></div>
                        <span>{statusMessage || t('radio.readyToConnect')}</span>
                      </div>

                      <div className="connection-instructions">
                        <ol>
                          <li>{t('radio.connectStep1')}</li>
                          <li>{t('radio.connectStep2')}</li>
                          <li>{t('radio.connectStep3')}</li>
                        </ol>
                      </div>

                      <button
                        className="btn btn-primary btn-lg"
                        onClick={handleConnect}
                        disabled={connectionStatus === 'connecting'}
                      >
                        {t('radio.connectRadio')}
                      </button>

                      {scanLog.length > 0 && (
                        <div className="scan-terminal">
                          <div className="terminal-header">{t('radio.connectionLog')}</div>
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
                    <h3>{t('radio.configuringRadio')}</h3>
                  </div>

                  <div className="programming-warning">
                    <strong>{t('radio.pleaseWait')}</strong> — {t('radio.doNotDisconnect')}
                  </div>

                  {deviceInfo && (
                    <div className="device-info">
                      <strong>{t('radio.device')}:</strong>
                      <span>{deviceInfo.longName || deviceInfo.shortName || t('common.unknown')}</span>
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
                      {progress.message || t('radio.startingConfig')}
                    </div>
                    <div className="progress-count">
                      {progress.total > 0 ? `${progress.current} / ${progress.total}` : t('radio.preparing')}
                    </div>
                  </div>

                  {scanLog.length > 0 && (
                    <div className="scan-terminal" style={{ marginTop: '16px' }}>
                      <div className="terminal-header">{t('radio.programmingLog')}</div>
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
              )}

              {/* Step 4: Result */}
              {step === 4 && (
                <div className="program-step">
                  {success ? (
                    <div className="result-success">
                      <div className="result-icon">&#10004;</div>
                      <h3>{t('radio.programmingComplete')}</h3>
                      <p>{t('radio.programmingSuccess')}</p>
                      {deviceInfo && (
                        <p className="device-name">{t('radio.device')}: {deviceInfo.longName || deviceInfo.shortName}</p>
                      )}
                    </div>
                  ) : (
                    <div className="result-error">
                      <div className="result-icon">&#10006;</div>
                      <h3>{t('radio.programmingFailed')}</h3>
                      <p>{error || t('radio.unknownError')}</p>
                    </div>
                  )}

                  {scanLog.length > 0 && (
                    <div className="scan-terminal" style={{ marginTop: '16px' }}>
                      <div className="terminal-header">{t('radio.programmingLog')}</div>
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
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          {step === 1 && (
            <>
              <button className="btn btn-secondary" onClick={handleClose}>
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setStep(2)}
                disabled={!selectedGroupId}
              >
                {t('radio.nextConnectRadio')}
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
                {t('common.back')}
              </button>
            </>
          )}

          {step === 3 && (
            <div className="programming-footer-notice">
              {t('radio.configInProgress')}
            </div>
          )}

          {step === 4 && (
            <>
              {!success && (
                <button
                  className="btn btn-secondary"
                  onClick={() => { setStep(2); setError(''); }}
                >
                  {t('common.tryAgain')}
                </button>
              )}
              <button className="btn btn-primary" onClick={handleClose}>
                {t('common.close')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProgramRadioModal;
