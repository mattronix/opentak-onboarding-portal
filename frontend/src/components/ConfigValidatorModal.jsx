import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { radiosAPI, meshtasticGroupsAPI } from '../services/api';
import { meshtasticSerial } from '../services/meshtasticSerial';
import './ConfigValidatorModal.css';

function ConfigValidatorModal({ radio, onClose }) {
  const [step, setStep] = useState(1); // 1: Select config, 2: Connect & Compare
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [statusMessage, setStatusMessage] = useState('');
  const [scanLog, setScanLog] = useState([]);
  const [error, setError] = useState('');
  const [currentConfig, setCurrentConfig] = useState(null);
  const [targetConfig, setTargetConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [noConfigData, setNoConfigData] = useState(false);
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

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [scanLog]);

  const handleStatusChange = (status, message) => {
    if (status === 'connected' || status === 'error' || status === 'disconnected') {
      setConnectionStatus(status);
    }
    setStatusMessage(message);
  };

  const handleLog = (entry) => {
    setScanLog(prev => [...prev, entry]);
  };

  const handleCompare = async () => {
    setError('');
    setScanLog([]);
    setLoading(true);
    setConnectionStatus('connecting');
    setNoConfigData(false);

    try {
      // Connect to radio
      await meshtasticSerial.connect(handleStatusChange, null, null, handleLog);

      // Read current config from radio
      const current = await meshtasticSerial.readCurrentConfig();
      setCurrentConfig(current);

      // Check if we actually got config data
      const hasChannels = current.channels && current.channels.length > 0;
      const hasDeviceConfig = current.deviceConfig && Object.keys(current.deviceConfig).length > 0;

      if (!hasChannels && !hasDeviceConfig) {
        setNoConfigData(true);
      }

      // Disconnect after reading - we don't need to stay connected
      try {
        await meshtasticSerial.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }

      // Get target config from backend
      const targetResponse = await radiosAPI.getProgramConfig(radio.id, {
        channelGroupId: selectedGroupId
      });
      setTargetConfig(targetResponse.data);

      setConnectionStatus('disconnected');
    } catch (err) {
      setError(err.message);
      setConnectionStatus('error');
      // Try to disconnect on error too
      try {
        await meshtasticSerial.disconnect();
      } catch (e) {
        // Ignore
      }
    } finally {
      setLoading(false);
    }
  };

  const groups = groupsData?.groups || [];

  // Convert config object to YAML-like lines array
  const configToYamlLines = (config, indent = 0) => {
    const lines = [];
    const pad = '  '.repeat(indent);

    for (const [key, value] of Object.entries(config)) {
      if (value === null || value === undefined) {
        continue;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        lines.push(`${pad}${key}:`);
        lines.push(...configToYamlLines(value, indent + 1));
      } else if (Array.isArray(value)) {
        lines.push(`${pad}${key}:`);
        value.forEach((item, idx) => {
          if (typeof item === 'object') {
            lines.push(`${pad}  - slot: ${item.slot_number ?? idx}`);
            if (item.name) lines.push(`${pad}    name: "${item.name}"`);
            if (item.role) lines.push(`${pad}    role: ${item.role}`);
          } else {
            lines.push(`${pad}  - ${item}`);
          }
        });
      } else if (typeof value === 'string') {
        lines.push(`${pad}${key}: "${value}"`);
      } else {
        lines.push(`${pad}${key}: ${value}`);
      }
    }

    return lines;
  };

  // Convert config object to YAML-like string (for backward compatibility)
  const configToYaml = (config) => {
    return configToYamlLines(config).join('\n');
  };

  // Compute line-by-line diff between two YAML line arrays
  const computeLineDiff = (currentLines, targetLines) => {
    const maxLines = Math.max(currentLines.length, targetLines.length);
    const currentDiff = [];
    const targetDiff = [];

    for (let i = 0; i < maxLines; i++) {
      const currentLine = currentLines[i] || '';
      const targetLine = targetLines[i] || '';
      const isDifferent = currentLine !== targetLine;

      currentDiff.push({
        text: currentLine,
        type: isDifferent ? (currentLine ? 'removed' : 'empty') : 'unchanged',
        lineNum: i + 1,
      });

      targetDiff.push({
        text: targetLine,
        type: isDifferent ? (targetLine ? 'added' : 'empty') : 'unchanged',
        lineNum: i + 1,
      });
    }

    return { currentDiff, targetDiff };
  };

  // Build a flat key-value map from nested config
  const flattenConfig = (obj, prefix = '') => {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (value === null || value === undefined) {
        continue;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, flattenConfig(value, fullKey));
      } else if (Array.isArray(value)) {
        // For channels, flatten each item
        value.forEach((item, idx) => {
          if (typeof item === 'object') {
            const channelPrefix = `${fullKey}[${item.slot_number ?? idx}]`;
            Object.assign(result, flattenConfig(item, channelPrefix));
          } else {
            result[`${fullKey}[${idx}]`] = item;
          }
        });
      } else {
        result[fullKey] = value;
      }
    }
    return result;
  };

  // Generate unified config objects for comparison
  const generateDiff = () => {
    if (!currentConfig || !targetConfig) return null;

    // Build current config YAML object
    const currentYaml = {
      owner: {
        shortName: currentConfig.owner?.shortName || '',
        longName: currentConfig.owner?.longName || '',
      },
      channels: currentConfig.channels || [],
      ...(currentConfig.deviceConfig || {}),
    };

    // Parse target YAML config if available
    const targetDeviceConfig = targetConfig.yaml_config ? parseYamlConfig(targetConfig.yaml_config) : {};

    // Build target config YAML object
    const targetYaml = {
      owner: {
        shortName: targetConfig.radio?.shortName || '',
        longName: targetConfig.radio?.longName || '',
      },
      channels: (targetConfig.channels || []).map(ch => ({
        slot_number: ch.slot_number,
        name: ch.name || '',
        role: ch.slot_number === 0 ? 'PRIMARY' : 'SECONDARY',
      })),
      ...targetDeviceConfig,
    };

    // Flatten both configs for comparison
    const currentFlat = flattenConfig(currentYaml);
    const targetFlat = flattenConfig(targetYaml);

    // Find all unique keys
    const allKeys = new Set([...Object.keys(currentFlat), ...Object.keys(targetFlat)]);

    // Build diff entries
    const diffs = [];
    for (const key of Array.from(allKeys).sort()) {
      const currentVal = currentFlat[key];
      const targetVal = targetFlat[key];
      const currentStr = currentVal !== undefined ? String(currentVal) : '';
      const targetStr = targetVal !== undefined ? String(targetVal) : '';

      diffs.push({
        key,
        current: currentStr || '(not set)',
        target: targetStr || '(not set)',
        changed: currentStr !== targetStr,
        onlyInCurrent: currentVal !== undefined && targetVal === undefined,
        onlyInTarget: targetVal !== undefined && currentVal === undefined,
      });
    }

    // Get line arrays for diff comparison
    const currentLines = configToYamlLines(currentYaml);
    const targetLines = configToYamlLines(targetYaml);
    const { currentDiff, targetDiff } = computeLineDiff(currentLines, targetLines);

    return {
      currentYaml: currentLines.join('\n'),
      targetYaml: targetLines.join('\n'),
      currentLines: currentDiff,
      targetLines: targetDiff,
      diffs,
      hasChanges: diffs.some(d => d.changed),
    };
  };

  // Parse simple YAML config into object
  const parseYamlConfig = (yamlString) => {
    const config = {};
    let currentSection = null;

    if (!yamlString) return config;

    const lines = yamlString.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Check for section header (no leading spaces, ends with :)
      if (!line.startsWith(' ') && !line.startsWith('\t') && trimmed.endsWith(':') && !trimmed.includes(': ')) {
        currentSection = trimmed.slice(0, -1).toLowerCase();
        config[currentSection] = {};
      } else if (currentSection && trimmed.includes(':')) {
        // Key-value pair within a section
        const colonIndex = trimmed.indexOf(':');
        const key = trimmed.slice(0, colonIndex).trim();
        let value = trimmed.slice(colonIndex + 1).trim();

        // Parse value types
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (!isNaN(value) && value !== '') value = Number(value);
        else if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);

        // Handle nested sections (e.g., "config:" followed by "bluetooth:")
        if (value === '' || value === undefined) {
          // This is a nested section
          currentSection = key.toLowerCase();
          config[currentSection] = config[currentSection] || {};
        } else {
          config[currentSection][key] = value;
        }
      }
    }

    return config;
  };

  const diff = (currentConfig && targetConfig) ? generateDiff() : null;
  const hasChanges = diff?.hasChanges || false;

  return (
    <div className="modal-overlay">
      <div className="modal config-validator-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Validate Config: {radio.name}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {!browserSupport.isSupported ? (
            <div className="browser-warning">
              <h3>Browser Not Supported</h3>
              <p>{browserSupport.message}</p>
            </div>
          ) : (
            <>
              {error && <div className="alert alert-error">{error}</div>}

              {/* Step 1: Select config to compare against */}
              {step === 1 && (
                <div className="validator-step">
                  <h3>Select Channel Group to Compare</h3>
                  <p>Choose the configuration you want to validate against.</p>

                  {loadingGroups ? (
                    <div className="loading">Loading channel groups...</div>
                  ) : groups.length === 0 ? (
                    <div className="empty-state">No channel groups available.</div>
                  ) : (
                    <div className="group-select">
                      {groups.map(group => (
                        <div
                          key={group.id}
                          className={`group-option ${selectedGroupId === group.id ? 'selected' : ''}`}
                          onClick={() => setSelectedGroupId(group.id)}
                        >
                          <div className="group-name">{group.name}</div>
                          <div className="group-details">
                            <span className="channel-count">{group.channel_count} channels</span>
                            {group.yamlConfig && <span className="has-config">Has device config</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Connect and show diff */}
              {step === 2 && (
                <div className="validator-step">
                  {loading || connectionStatus === 'connecting' ? (
                    <div className="connecting-overlay">
                      <div className="connecting-header">
                        <div className="programming-spinner"></div>
                        <h3>Reading Configuration...</h3>
                      </div>
                      <p className="connecting-message">
                        {statusMessage || 'Connecting to radio...'}
                      </p>
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
                    </div>
                  ) : noConfigData ? (
                    <div className="no-config-warning">
                      <div className="warning-icon">⚠</div>
                      <h3>Could Not Read Configuration</h3>
                      <p>Unable to read channel and device configuration from the radio.</p>
                      <p>This can happen if the radio firmware doesn&apos;t support reading config via Web Serial.</p>

                      <div className="alternative-options">
                        <h4>Alternative Options:</h4>
                        <ol>
                          <li>
                            <strong>Use Meshtastic Web Client:</strong>
                            <p>Open <a href="https://client.meshtastic.org" target="_blank" rel="noopener noreferrer">client.meshtastic.org</a> to export your radio&apos;s config</p>
                          </li>
                          <li>
                            <strong>Use the Program feature:</strong>
                            <p>Instead of comparing, program the radio with the target configuration directly</p>
                          </li>
                        </ol>
                      </div>
                    </div>
                  ) : diff ? (
                    <div className="diff-container">
                      <div className="diff-summary">
                        {hasChanges ? (
                          <div className="diff-status changes">
                            <span className="diff-icon">⚠</span>
                            <span>Configuration differs from target - {diff.diffs.filter(d => d.changed).length} differences found</span>
                          </div>
                        ) : (
                          <div className="diff-status match">
                            <span className="diff-icon">✓</span>
                            <span>Configuration matches target</span>
                          </div>
                        )}
                      </div>

                      {/* YAML Side-by-Side Comparison with line-by-line diff */}
                      <div className="yaml-comparison">
                        <div className="yaml-panel current-panel">
                          <div className="yaml-header">Current (Radio)</div>
                          <div className="yaml-content">
                            {diff.currentLines.map((line, idx) => (
                              <div key={idx} className={`diff-line ${line.type}`}>
                                <span className="line-number">{line.lineNum}</span>
                                <span className="line-text">{line.text || '\u00A0'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="yaml-panel target-panel">
                          <div className="yaml-header">Target (Config)</div>
                          <div className="yaml-content">
                            {diff.targetLines.map((line, idx) => (
                              <div key={idx} className={`diff-line ${line.type}`}>
                                <span className="line-number">{line.lineNum}</span>
                                <span className="line-text">{line.text || '\u00A0'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Diff Details - show changed keys */}
                      {hasChanges && (
                        <div className="diff-section">
                          <h4>Changed Settings</h4>
                          <table className="diff-table">
                            <thead>
                              <tr>
                                <th>Key</th>
                                <th className="current">Current</th>
                                <th className="target">Target</th>
                              </tr>
                            </thead>
                            <tbody>
                              {diff.diffs.filter(d => d.changed).map((item, idx) => (
                                <tr key={idx} className="changed">
                                  <td className="diff-key">{item.key}</td>
                                  <td className="current">
                                    <span className="diff-marker remove">-</span>
                                    {item.current}
                                  </td>
                                  <td className="target">
                                    <span className="diff-marker add">+</span>
                                    {item.target}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="validator-instructions">
                      <h3>Connect Radio to Compare</h3>
                      <p>Connect your Meshtastic radio via USB to read its current configuration.</p>
                      <button
                        className="btn btn-primary btn-lg"
                        onClick={handleCompare}
                        disabled={loading}
                      >
                        Connect & Compare
                      </button>
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
              <button className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setStep(2)}
                disabled={!selectedGroupId}
              >
                Next: Compare Config
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setStep(1);
                  setCurrentConfig(null);
                  setTargetConfig(null);
                  setError('');
                  if (meshtasticSerial.isConnected) {
                    meshtasticSerial.disconnect();
                  }
                }}
                disabled={loading}
              >
                Back
              </button>
              {diff && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    // Could add "Apply Changes" functionality here
                    onClose();
                  }}
                >
                  Close
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConfigValidatorModal;
