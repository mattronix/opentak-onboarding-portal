import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { radiosAPI } from '../services/api';
import { meshtasticSerial } from '../services/meshtasticSerial';
import './EnrollRadioModal.css';

function EnrollRadioModal({ onClose, onSuccess }) {
  const { t } = useTranslation();
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
      setError(err.response?.data?.error || t('radio.failedToRegister'));
    }
  });

  const handleLearnFromUSB = async () => {
    if (!browserSupport.isSupported) {
      setError(t('radio.webSerialNotSupported'));
      return;
    }

    // Disconnect any existing connection first
    try {
      await meshtasticSerial.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }

    setScanning(true);
    setScanStatus(t('radio.connectingToRadio'));
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
          model: info.model || prev.model,
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
        handleLog,
        { detectOnly: true }
      );

      // If we reach here without data, wait a bit for packets
      if (!gotData) {
        setScanStatus(t('radio.waitingDeviceInfo'));
        await new Promise(resolve => setTimeout(resolve, 3000));

        if (!gotData) {
          // Try to get info from device
          const info = meshtasticSerial.getDeviceInfo();
          if (info && (info.shortName || info.longName)) {
            handleInstantUpdate(info);
          } else {
            setScanStatus(t('radio.noDeviceInfo'));
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
      setError(t('radio.radioNameRequired'));
      return;
    }

    enrollMutation.mutate(formData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal enroll-radio-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('radio.registerTitle')}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label>{t('radio.radioType')}</label>
              <select
                value={formData.radioType}
                onChange={(e) => setFormData({...formData, radioType: e.target.value, platform: e.target.value === 'meshtastic' ? 'meshtastic' : 'other'})}
                required
              >
                <option value="meshtastic">{t('radio.meshtastic')}</option>
                <option value="other">{t('radio.other')}</option>
              </select>
            </div>

            {formData.radioType === 'meshtastic' && (
              <p className="enroll-description">
                {t('radio.connectUsbDesc')}
              </p>
            )}

            {/* Learn from USB button - only for Meshtastic */}
            {formData.radioType === 'meshtastic' && browserSupport.isSupported ? (
              <div className="usb-scan-section">
                <div className="usb-scan-controls">
                  <button
                    type="button"
                    className="btn btn-info"
                    onClick={handleLearnFromUSB}
                    disabled={scanning}
                  >
                    {scanning ? t('radio.scanning') : t('radio.learnFromUsb')}
                  </button>
                  <span className="scan-status">
                    {scanStatus || t('radio.clickToScan')}
                  </span>
                </div>

                {/* Terminal Log Box */}
                {scanLog.length > 0 && (
                  <div className="scan-terminal">
                    <div className="terminal-header">{t('radio.connectionLog')}</div>
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
            ) : formData.radioType === 'meshtastic' ? (
              <div className="alert alert-warning">
                {t('radio.usbRequiresChrome')}
              </div>
            ) : null}

            <div className="form-divider">
              <span>{t('radio.radioDetails')}</span>
            </div>

            <div className="form-group">
              <label>{t('radio.radioName')}</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder={t('radio.radioNamePlaceholder')}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('radio.shortName')}</label>
                <input
                  type="text"
                  value={formData.shortName}
                  onChange={(e) => setFormData({...formData, shortName: e.target.value})}
                  placeholder={t('radio.shortNamePlaceholder')}
                />
              </div>
              <div className="form-group">
                <label>{t('radio.longName')}</label>
                <input
                  type="text"
                  value={formData.longName}
                  onChange={(e) => setFormData({...formData, longName: e.target.value})}
                  placeholder={t('radio.longNamePlaceholder')}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('radio.firmwareVersion')}</label>
                <input
                  type="text"
                  value={formData.softwareVersion}
                  onChange={(e) => setFormData({...formData, softwareVersion: e.target.value})}
                  placeholder={t('radio.firmwarePlaceholder')}
                />
              </div>
              <div className="form-group">
                <label>{t('radio.modelLabel')}</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({...formData, model: e.target.value})}
                  placeholder={t('radio.modelPlaceholder')}
                />
              </div>
            </div>

            <div className="form-group">
              <label>{t('radio.macAddress')}</label>
              <input
                type="text"
                value={formData.mac}
                onChange={(e) => setFormData({...formData, mac: e.target.value})}
                placeholder={t('radio.macPlaceholder')}
              />
            </div>

            <div className="form-group">
              <label>{t('radio.descriptionLabel')}</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder={t('radio.descriptionPlaceholder')}
                rows={2}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={enrollMutation.isPending || !formData.name.trim()}
            >
              {enrollMutation.isPending ? t('radio.registeringRadio') : t('radio.registerRadio')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EnrollRadioModal;
