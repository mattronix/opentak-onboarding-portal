import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { radiosAPI, usersAPI, settingsAPI } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { meshtasticSerial } from '../../services/meshtasticSerial';
import { getModelOptions } from '../../constants/hardwareModels';
import ProgramRadioModal from '../../components/ProgramRadioModal';
import ConfigValidatorModal from '../../components/ConfigValidatorModal';
import '../../components/AdminTable.css';

const FRONTEND_URL = window.location.origin;

function RadiosList() {
  const { t } = useTranslation();
  const { radioId } = useParams();
  const queryClient = useQueryClient();
  const { showError, confirm } = useNotification();
  const { hasRole } = useAuth();
  const canEdit = hasRole('radio_admin') || hasRole('administrator');
  const [showModal, setShowModal] = useState(false);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [programmingRadio, setProgrammingRadio] = useState(null);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [validatingRadio, setValidatingRadio] = useState(null);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    radioType: 'meshtastic',
    description: '',
    softwareVersion: '',
    model: '',
    vendor: '',
    shortName: '',
    longName: '',
    mac: '',
    assignedTo: null,
    owner: null
  });
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [scanLog, setScanLog] = useState([]);
  const [findingRadio, setFindingRadio] = useState(false);
  const [highlightedRadioId, setHighlightedRadioId] = useState(null);
  const [resettingRadio, setResettingRadio] = useState(null);

  // Check if Web Serial is supported
  const browserSupport = meshtasticSerial.getBrowserSupport();

  const { data: radiosData, isLoading } = useQuery({
    queryKey: ['radios'],
    queryFn: async () => {
      const response = await radiosAPI.getAll();
      return response.data;
    },
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await usersAPI.getAll({ per_page: 1000 });
      return response.data;
    },
  });

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await settingsAPI.get();
      return response.data;
    },
  });

  const claimRadioEnabled = settingsData?.claim_radio_enabled || false;

  const copyClaimUrl = async (radio) => {
    try {
      if (!radio.meshtasticId) {
        showError(t('admin.radios.noNodeId'));
        return;
      }
      const claimUrl = `${FRONTEND_URL}/claim-radio/${encodeURIComponent(radio.meshtasticId)}`;
      await navigator.clipboard.writeText(claimUrl);
      // Brief visual feedback could be added here
    } catch (err) {
      showError(t('admin.radios.failedCopyUrl'));
    }
  };

  const createMutation = useMutation({
    mutationFn: (data) => radiosAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['radios']);
      setShowModal(false);
      resetForm();
    },
    onError: (err) => setError(err.response?.data?.error || t('admin.radios.failedCreate')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => radiosAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['radios']);
      setShowModal(false);
      resetForm();
    },
    onError: (err) => setError(err.response?.data?.error || t('admin.radios.failedUpdate')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => radiosAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['radios']),
    onError: (err) => showError(err.response?.data?.error || t('admin.radios.failedDelete')),
  });

  const resetForm = () => {
    setFormData({
      name: '',
      radioType: 'meshtastic',
      description: '',
      softwareVersion: '',
      model: '',
      vendor: '',
      shortName: '',
      longName: '',
      mac: '',
      assignedTo: null,
      owner: null
    });
    setEditing(null);
    setError('');
    setScanStatus('');
    setScanLog([]);
  };

  const handleFactoryReset = async (radio) => {
    const confirmed = await confirm(
      t('radio.factoryResetConfirm', { name: radio.name }),
      t('radio.factoryResetTitle')
    );
    if (!confirmed) return;

    setResettingRadio(radio.id);
    try {
      // Full connect (not detectOnly) so the device completes its config
      // handshake — required before admin commands like factory reset.
      await meshtasticSerial.connect(
        () => {}, null, null,
        () => {}
      );
      await meshtasticSerial.factoryReset();
      await meshtasticSerial.disconnect();
    } catch (err) {
      showError(t('admin.radios.factoryResetFailed', { error: err.message }));
    } finally {
      setResettingRadio(null);
    }
  };

  const handleEdit = async (radio) => {
    try {
      const response = await radiosAPI.getById(radio.id);
      const fullRadio = response.data;

      setEditing(fullRadio);
      setFormData({
        name: fullRadio.name || '',
        radioType: fullRadio.radioType || 'meshtastic',
        description: fullRadio.description || '',
        softwareVersion: fullRadio.softwareVersion || '',
        model: fullRadio.model || '',
        vendor: fullRadio.vendor || '',
        shortName: fullRadio.shortName || '',
        longName: fullRadio.longName || '',
        mac: fullRadio.mac || '',
        assignedTo: fullRadio.assignedTo || null,
        owner: fullRadio.owner || null
      });
      setError('');
      setScanStatus('');
      setScanLog([]);
      setShowModal(true);
    } catch (err) {
      showError(t('admin.radios.failedLoadDetails', { error: err.response?.data?.error || err.message }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // Convert empty strings to null for user IDs and set platform based on radioType
    const submitData = {
      ...formData,
      platform: formData.radioType === 'meshtastic' ? 'meshtastic' : 'other',
      assignedTo: formData.assignedTo || null,
      owner: formData.owner || null
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

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
        setScanning(false); // Stop scanning immediately

        // Format name as "longName (shortName)"
        const longName = info.longName || '';
        const shortName = info.shortName || '';
        let displayName = longName;
        if (longName && shortName) {
          displayName = `${longName} (${shortName})`;
        } else if (shortName) {
          displayName = shortName;
        }

        setScanStatus(t('admin.radios.deviceInfoLoaded'));
        setFormData(prev => ({
          ...prev,
          platform: 'meshtastic',
          radioType: 'meshtastic',
          shortName: shortName || prev.shortName,
          longName: longName || prev.longName,
          softwareVersion: info.firmwareVersion || prev.softwareVersion,
          model: info.model || prev.model,
          name: displayName || prev.name,
          mac: info.macAddr || prev.mac,
        }));
        // Disconnect in background
        meshtasticSerial.disconnect().catch(() => {});
      };

      // Connect with instant callback and log handler
      await meshtasticSerial.connect(
        (status, message) => {
          if (!gotData) setScanStatus(message);
        },
        null,
        handleInstantUpdate,
        handleLog
      );

      // If we already got data, we're done
      if (gotData) return;

      // Otherwise wait a bit for data
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!gotData) {
        const finalInfo = meshtasticSerial.getDeviceInfo();
        if (finalInfo?.shortName || finalInfo?.longName) {
          setScanStatus(t('admin.radios.deviceInfoLoaded'));
        } else {
          setScanStatus(t('admin.radios.limitedInfo'));
        }
        await meshtasticSerial.disconnect();
      }
    } catch (err) {
      console.error('Scan error:', err);
      setError(t('admin.radios.failedRead', { error: err.message }));
    } finally {
      setScanning(false);
      if (!gotData) {
        setTimeout(() => setScanStatus(''), 3000);
      }
    }
  };

  const _findRadioByMac = (mac) => {
    if (!mac || radios.length === 0) return null;
    const normMac = mac.replace(/[:\-]/g, '').toLowerCase();
    return radios.find(r => {
      if (!r.mac) return false;
      return r.mac.replace(/[:\-]/g, '').toLowerCase() === normMac;
    }) || null;
  };

  const _showFoundRadio = (found) => {
    // Full page navigation to /admin/radios/:id — this forces a complete
    // browser refresh which guarantees all Web Serial port locks are released,
    // so the "Program" button will get a clean serial connection.
    window.location.href = `/admin/radios/${found.id}`;
  };

  const _showCreateForInfo = (info) => {
    setFindingRadio(false);
    const longName = info.longName || '';
    const shortName = info.shortName || '';
    let displayName = longName;
    if (longName && shortName) displayName = `${longName} (${shortName})`;
    else if (shortName) displayName = shortName;

    setFormData({
      name: displayName || '',
      radioType: 'meshtastic',
      description: '',
      softwareVersion: info.firmwareVersion || '',
      model: info.model || '',
      vendor: '',
      shortName: shortName,
      longName: longName,
      mac: info.macAddr || '',
      assignedTo: null,
      owner: null
    });
    setEditing(null);
    setError('');
    setScanStatus('');
    setScanLog([]);
    setShowModal(true);
  };

  const handleFindViaUSB = async () => {
    if (!browserSupport.isSupported) {
      showError(t('radio.webSerialNotSupported'));
      return;
    }

    try {
      await meshtasticSerial.disconnect();
    } catch (e) { /* ignore */ }

    setFindingRadio(true);
    setHighlightedRadioId(null);

    let resolved = false;

    try {
      // Don't act on instant callback — MAC may not be available yet.
      // Instead, just track that we got connected.
      const handleInstantUpdate = () => {};

      await meshtasticSerial.connect(
        () => {},
        null,
        handleInstantUpdate,
        null
      );

      // Poll for MAC to arrive (up to 5 seconds)
      for (let i = 0; i < 25; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        const info = meshtasticSerial.getDeviceInfo();
        if (info?.macAddr) {
          resolved = true;
          try { await meshtasticSerial.disconnect(); } catch (e) { /* ignore */ }
          const found = _findRadioByMac(info.macAddr);
          if (found) {
            _showFoundRadio(found);
          } else {
            _showCreateForInfo(info);
          }
          break;
        }
      }

      if (!resolved) {
        // MAC never arrived — use whatever info we have
        const info = meshtasticSerial.getDeviceInfo();
        try { await meshtasticSerial.disconnect(); } catch (e) { /* ignore */ }
        if (info) {
          _showCreateForInfo(info);
        } else {
          showError(t('admin.radios.couldNotRead'));
        }
      }
    } catch (err) {
      showError(t('admin.radios.failedRead', { error: err.message }));
    } finally {
      setFindingRadio(false);
    }
  };

  // Helper to format MAC address from bytes
  const formatMacAddress = (macBytes) => {
    if (!macBytes) return '';
    if (typeof macBytes === 'string') return macBytes;
    if (macBytes instanceof Uint8Array || Array.isArray(macBytes)) {
      return Array.from(macBytes)
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(':');
    }
    return String(macBytes);
  };

  // CSV Export
  const exportRadiosCSV = () => {
    const csvRadios = radiosData?.radios || [];
    const csvUsers = usersData?.users || [];
    if (csvRadios.length === 0) return;

    const headers = [
      'ID', 'Name', 'Platform', 'Type', 'Model', 'Vendor', 'Short Name', 'Long Name',
      'MAC', 'Node ID', 'Firmware', 'Description', 'Assigned To', 'Assigned To Username',
      'Owner', 'Owner Username', 'Claim URL', 'Created At', 'Updated At'
    ];

    const escapeCSV = (val) => {
      if (val == null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = csvRadios.map(radio => {
      const assignedUser = csvUsers.find(u => u.id === radio.assignedTo);
      const ownerUser = csvUsers.find(u => u.id === radio.owner);
      const claimUrl = radio.meshtasticId && !radio.assignedTo
        ? `${FRONTEND_URL}/claim-radio/${encodeURIComponent(radio.meshtasticId)}`
        : '';

      return [
        radio.id, radio.name, radio.platform, radio.radioType, radio.model,
        radio.vendor, radio.shortName, radio.longName, radio.mac, radio.meshtasticId,
        radio.softwareVersion, radio.description,
        radio.assignedTo, assignedUser?.username, radio.owner, ownerUser?.username,
        claimUrl, radio.createdAt, radio.updatedAt
      ].map(escapeCSV).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `radios-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Auto-highlight and scroll to a radio when navigating to /admin/radios/:radioId
  // Must be above the early return so hooks run in the same order every render.
  const radios = radiosData?.radios || [];
  const users = usersData?.users || [];

  useEffect(() => {
    if (!radioId || radios.length === 0) return;
    const id = parseInt(radioId, 10);
    const found = radios.find(r => r.id === id);
    if (found) {
      setHighlightedRadioId(id);
      setTimeout(() => {
        const row = document.getElementById(`radio-row-${id}`);
        if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      setTimeout(() => setHighlightedRadioId(null), 5000);
    }
  }, [radioId, radios.length]);

  if (isLoading) return <div className="admin-page"><div className="loading-state">{t('common.loading')}</div></div>;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>{t('admin.radios.title')}</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            onClick={exportRadiosCSV}
            disabled={!radios.length}
          >
            {t('admin.radios.exportCsv')}
          </button>
          {canEdit && browserSupport.isSupported && (
            <button
              className="btn btn-secondary"
              onClick={handleFindViaUSB}
              disabled={findingRadio}
            >
              {findingRadio ? t('radio.scanning') : t('admin.radios.findViaUsb')}
            </button>
          )}
          {canEdit && (
            <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
              {t('admin.radios.addRadio')}
            </button>
          )}
        </div>
      </div>

      <div className="admin-table-container">
        {radios.length === 0 ? (
          <div className="empty-state">{t('admin.radios.noRadios')}</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('common.name')}</th>
                <th>{t('admin.radios.platform')}</th>
                <th>{t('admin.radios.type')}</th>
                <th>{t('admin.radios.model')}</th>
                <th>{t('admin.radios.mac')}</th>
                <th>{t('admin.radios.nodeId')}</th>
                <th>{t('admin.radios.assignedTo')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {radios.map(radio => (
                <tr
                  key={radio.id}
                  id={`radio-row-${radio.id}`}
                  style={highlightedRadioId === radio.id ? {
                    background: 'var(--badge-warning-bg)',
                    transition: 'background 0.3s ease'
                  } : {}}
                >
                  <td><strong>{radio.name}</strong></td>
                  <td><span className="badge badge-primary">{radio.platform}</span></td>
                  <td>{radio.radioType || '-'}</td>
                  <td>{radio.model || '-'}</td>
                  <td>{radio.mac || '-'}</td>
                  <td><code>{radio.meshtasticId || '-'}</code></td>
                  <td>{users.find(u => u.id === radio.assignedTo)?.username || '-'}</td>
                  <td>
                    <div className="table-actions">
                      {radio.radioType === 'meshtastic' && (
                        <>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                              setValidatingRadio(radio);
                              setShowValidateModal(true);
                            }}
                          >
                            {t('common.validate')}
                          </button>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              setProgrammingRadio(radio);
                              setShowProgramModal(true);
                            }}
                          >
                            {t('common.program')}
                          </button>
                          {canEdit && (
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleFactoryReset(radio)}
                              disabled={resettingRadio === radio.id}
                            >
                              {resettingRadio === radio.id ? t('radio.resetting') : t('radio.factoryReset')}
                            </button>
                          )}
                        </>
                      )}
                      {canEdit && claimRadioEnabled && !radio.assignedTo && radio.meshtasticId && (
                        <button
                          className="btn btn-sm btn-info"
                          onClick={() => copyClaimUrl(radio)}
                          title={t('radio.copyClaimUrl')}
                        >
                          {t('radio.copyClaimUrl')}
                        </button>
                      )}
                      {canEdit && (
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(radio)}>
                          {t('common.edit')}
                        </button>
                      )}
                      {canEdit && (
                        <button className="btn btn-sm btn-danger" onClick={async () => {
                          const confirmed = await confirm(t('admin.radios.deleteConfirm', { name: radio.name }), t('admin.radios.deleteRadio'));
                          if (confirmed) deleteMutation.mutate(radio.id);
                        }}>
                          {t('common.delete')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? t('admin.radios.editRadio') : t('admin.radios.createRadio')}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}

                <div className="form-group">
                  <label>{t('radio.radioType')} *</label>
                  <select value={formData.radioType} onChange={(e) => setFormData({...formData, radioType: e.target.value, model: ''})} required>
                    <option value="meshtastic">{t('radio.meshtastic')}</option>
                    <option value="other">{t('radio.other')}</option>
                  </select>
                </div>

                {/* Learn from USB button - only show for Meshtastic radios */}
                {formData.radioType === 'meshtastic' && browserSupport.isSupported && (
                  <div className="form-group" style={{
                    padding: '12px',
                    background: '#f0f7ff',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    border: '1px solid #cce0ff'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-info"
                        onClick={handleLearnFromUSB}
                        disabled={scanning}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {scanning ? t('radio.scanning') : t('admin.radios.learnFromUsb')}
                      </button>
                      <span style={{ color: '#666', fontSize: '0.9rem' }}>
                        {scanStatus || t('admin.radios.learnFromUsbHelp')}
                      </span>
                    </div>
                    {/* Terminal Log Box */}
                    {scanLog.length > 0 && (
                      <div style={{
                        marginTop: '12px',
                        background: '#1e1e1e',
                        borderRadius: '4px',
                        padding: '8px 12px',
                        fontFamily: 'Monaco, Menlo, monospace',
                        fontSize: '11px',
                        maxHeight: '120px',
                        overflowY: 'auto',
                        color: '#d4d4d4'
                      }}>
                        {scanLog.map((entry, i) => (
                          <div key={i} style={{
                            color: entry.type === 'success' ? '#4ec9b0' :
                                   entry.type === 'error' ? '#f14c4c' :
                                   entry.type === 'warn' ? '#cca700' : '#d4d4d4'
                          }}>
                            <span style={{ color: '#858585' }}>[{entry.timestamp}]</span> {entry.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {formData.radioType === 'meshtastic' && !browserSupport.isSupported && (
                  <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
                    {t('radio.usbRequiresChrome')}
                  </div>
                )}

                <div className="form-group">
                  <label>{t('common.name')} *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                </div>

                <div className="form-group">
                  <label>{t('common.description')}</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                </div>

                <div className="form-group">
                  <label>{t('admin.radios.modelLabel')}</label>
                  {formData.radioType === 'meshtastic' ? (
                    <select value={formData.model} onChange={(e) => setFormData({...formData, model: e.target.value})}>
                      <option value="">{t('admin.radios.selectModel')}</option>
                      {getModelOptions().map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" value={formData.model} onChange={(e) => setFormData({...formData, model: e.target.value})} placeholder={t('admin.radios.enterModel')} />
                  )}
                </div>

                <div className="form-group">
                  <label>{t('admin.radios.vendorLabel')}</label>
                  <input type="text" value={formData.vendor} onChange={(e) => setFormData({...formData, vendor: e.target.value})} />
                </div>

                <div className="form-group">
                  <label>{t('admin.radios.softwareVersion')}</label>
                  <input type="text" value={formData.softwareVersion} onChange={(e) => setFormData({...formData, softwareVersion: e.target.value})} />
                </div>

                <div className="form-group">
                  <label>{t('admin.radios.shortNameLabel')}</label>
                  <input type="text" value={formData.shortName} onChange={(e) => setFormData({...formData, shortName: e.target.value})} maxLength={4} />
                  <span className="help-text">{t('admin.radios.shortNameHelp')}</span>
                </div>

                <div className="form-group">
                  <label>{t('admin.radios.longNameLabel')}</label>
                  <input type="text" value={formData.longName} onChange={(e) => setFormData({...formData, longName: e.target.value})} />
                </div>

                <div className="form-group">
                  <label>{t('admin.radios.macLabel')}</label>
                  <input type="text" value={formData.mac} onChange={(e) => setFormData({...formData, mac: e.target.value})} placeholder="AA:BB:CC:DD:EE:FF" />
                </div>

                <div className="form-group">
                  <label>{t('admin.radios.assignedToLabel')}</label>
                  <select value={formData.assignedTo || ''} onChange={(e) => setFormData({...formData, assignedTo: e.target.value ? parseInt(e.target.value) : null})}>
                    <option value="">{t('admin.radios.unassigned')}</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.username} ({user.firstName} {user.lastName})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>{t('admin.radios.ownerLabel')}</label>
                  <select value={formData.owner || ''} onChange={(e) => setFormData({...formData, owner: e.target.value ? parseInt(e.target.value) : null})}>
                    <option value="">{t('admin.radios.noOwner')}</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.username} ({user.firstName} {user.lastName})</option>
                    ))}
                  </select>
                </div>

              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {editing && editing.radioType === 'meshtastic' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setShowModal(false);
                          setValidatingRadio(editing);
                          setShowValidateModal(true);
                        }}
                      >
                        {t('common.validate')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          setShowModal(false);
                          setProgrammingRadio(editing);
                          setShowProgramModal(true);
                        }}
                      >
                        {t('common.program')}
                      </button>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editing ? t('admin.radios.updateRadio') : t('admin.radios.createRadio')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Program Radio Modal */}
      {showProgramModal && programmingRadio && (
        <ProgramRadioModal
          radio={programmingRadio}
          onClose={() => {
            setShowProgramModal(false);
            setProgrammingRadio(null);
          }}
        />
      )}

      {/* Config Validator Modal */}
      {showValidateModal && validatingRadio && (
        <ConfigValidatorModal
          radio={validatingRadio}
          onClose={() => {
            setShowValidateModal(false);
            setValidatingRadio(null);
          }}
        />
      )}
    </div>
  );
}

export default RadiosList;
