/**
 * Meshtastic Web Serial Service
 *
 * Provides browser-based USB communication with Meshtastic radios.
 * Uses Web Serial API (Chrome/Edge only) and @meshtastic packages.
 *
 * Web Serial API only works in:
 * - Chrome 89+
 * - Edge 89+
 * - Opera 75+
 * NOT supported in Firefox or Safari.
 */

import { MeshDevice, Protobuf, Types } from '@meshtastic/core';
import { TransportWebSerial } from '@meshtastic/transport-web-serial';
import { fromBinary, create } from '@bufbuild/protobuf';

// Debug: Log available Types to understand the library structure
console.log('[MeshtasticSerial] Available Types:', Types);
console.log('[MeshtasticSerial] DeviceStatusEnum:', Types?.DeviceStatusEnum);

class MeshtasticSerialService {
  constructor() {
    this.device = null;
    this.transport = null;
    this.isConnected = false;
    this.deviceInfo = null;
    this.onStatusChange = null;
    this.onProgress = null;
    this.onDeviceInfoReceived = null; // Callback for instant form update
    this.onLog = null; // Callback for terminal log output
    this.hasReceivedUserInfo = false; // Flag to track if we've received our device's user info
  }

  /**
   * Log a message to the terminal
   */
  _log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const logEntry = { timestamp, message, type };
    console.log(`[${timestamp}] ${message}`);
    if (this.onLog) {
      this.onLog(logEntry);
    }
  }

  /**
   * Check if Web Serial API is supported in this browser
   */
  isSupported() {
    return 'serial' in navigator;
  }

  /**
   * Get browser support info
   */
  getBrowserSupport() {
    const isSupported = this.isSupported();
    const userAgent = navigator.userAgent;
    const isChrome = /Chrome/.test(userAgent) && !/Edg/.test(userAgent);
    const isEdge = /Edg/.test(userAgent);
    const isOpera = /OPR/.test(userAgent);
    const isFirefox = /Firefox/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);

    return {
      isSupported,
      browser: isChrome ? 'Chrome' : isEdge ? 'Edge' : isOpera ? 'Opera' : isFirefox ? 'Firefox' : isSafari ? 'Safari' : 'Unknown',
      message: isSupported
        ? 'Web Serial API is supported'
        : 'Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.'
    };
  }

  /**
   * Connect to a Meshtastic radio via USB
   * @param {Function} onStatusChange - Callback for connection status changes
   * @param {Function} onProgress - Callback for progress updates
   * @param {Function} onDeviceInfoReceived - Callback when device info is received (instant update)
   * @param {Function} onLog - Callback for terminal log messages
   */
  async connect(onStatusChange, onProgress, onDeviceInfoReceived, onLog) {
    if (!this.isSupported()) {
      throw new Error('Web Serial API is not supported in this browser');
    }

    // Clean up any existing connection first
    if (this.transport || this.device) {
      try {
        await this.disconnect();
        // Brief delay to ensure port is fully released
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    this.onStatusChange = onStatusChange;
    this.onProgress = onProgress;
    this.onDeviceInfoReceived = onDeviceInfoReceived;
    this.onLog = onLog;
    this.hasReceivedUserInfo = false; // Reset flag for new connection

    try {
      this._updateStatus('connecting', 'Requesting USB port...');
      this._log('Requesting USB port selection...', 'info');

      // Create transport (this will prompt user to select the serial port)
      this.transport = await TransportWebSerial.create(115200);
      this._log('Serial port opened at 115200 baud', 'success');

      // Create the MeshDevice with the transport
      this.device = new MeshDevice(this.transport);
      this._log('MeshDevice instance created', 'info');

      // Set up event handlers
      this._log('Setting up event handlers...', 'info');
      this.device.events.onDeviceStatus.subscribe((status) => {

        // The status could be a number (enum value) or an object
        // Handle both cases
        let statusValue = status;
        let statusName = 'Unknown';

        if (typeof status === 'object' && status !== null) {
          statusValue = status.status !== undefined ? status.status : status;
        }

        // Try to get the enum name
        if (Types.DeviceStatusEnum) {
          // DeviceStatusEnum might be a regular object or a reverse-mapped enum
          if (typeof statusValue === 'number') {
            statusName = Types.DeviceStatusEnum[statusValue] || `Status ${statusValue}`;
          } else if (typeof statusValue === 'string') {
            statusName = statusValue;
          }
        }

        this._updateStatus('status', `Device status: ${statusName}`);

        // Check for connected/disconnected states
        const connectedValue = Types.DeviceStatusEnum?.DeviceConnected ?? Types.DeviceStatusEnum?.DEVICE_CONNECTED ?? 2;
        const disconnectedValue = Types.DeviceStatusEnum?.DeviceDisconnected ?? Types.DeviceStatusEnum?.DEVICE_DISCONNECTED ?? 0;

        if (statusValue === connectedValue || statusName === 'DeviceConnected' || statusName === 'DEVICE_CONNECTED') {
          this.isConnected = true;
          this._log('Device connected', 'success');
        } else if (statusValue === disconnectedValue || statusName === 'DeviceDisconnected' || statusName === 'DEVICE_DISCONNECTED') {
          this.isConnected = false;
          this._log('Device disconnected', 'warn');
        } else {
          this._log(`Device status: ${statusName}`, 'info');
        }
      });

      this.device.events.onMyNodeInfo.subscribe((nodeInfo) => {
        this._log(`Received node info: Node #${nodeInfo.myNodeNum}`, 'info');
        this.deviceInfo = {
          ...this.deviceInfo,
          nodeNum: nodeInfo.myNodeNum,
        };
      });

      this.device.events.onDeviceMetadataPacket.subscribe((metadata) => {
        const fw = metadata.data?.firmwareVersion || metadata.firmwareVersion;
        if (fw) {
          this._log(`Firmware version: ${fw}`, 'info');
        }
        if (metadata) {
          this.deviceInfo = {
            ...this.deviceInfo,
            firmwareVersion: fw,
            hwModel: metadata.data?.hwModel || metadata.hwModel,
          };
        }
      });

      this.device.events.onUserPacket.subscribe((userPacket) => {
        // Data is directly in userPacket.data (not nested under .user)
        // Structure: { data: { longName, shortName, macaddr, hwModel, ... }, from: nodeNum }
        const data = userPacket.data || userPacket;
        const fromNode = userPacket.from || data.from;

        this._log(`User packet from node ${fromNode}: shortName="${data?.shortName}", longName="${data?.longName}"`, 'info');

        // Accept the first user packet we receive (should be our device) OR
        // if we have our nodeNum, only accept packets from our node
        const isFirstPacket = !this.hasReceivedUserInfo;
        const isOurNode = this.deviceInfo?.nodeNum && fromNode === this.deviceInfo?.nodeNum;

        if (data && (data.shortName || data.longName) && (isFirstPacket || isOurNode)) {
          // Format MAC address from bytes object
          let macAddr = this.deviceInfo?.macAddr;
          if (data.macaddr) {
            macAddr = this._formatMacFromBytes(data.macaddr);
          }

          this.deviceInfo = {
            ...this.deviceInfo,
            shortName: data.shortName || this.deviceInfo?.shortName,
            longName: data.longName || this.deviceInfo?.longName,
            macAddr: macAddr,
            hwModel: data.hwModel || this.deviceInfo?.hwModel,
          };
          this._log(`Updated deviceInfo: shortName="${this.deviceInfo.shortName}", longName="${this.deviceInfo.longName}"`, 'success');

          // Mark that we've received user info (prevents other nodes overwriting)
          if (!this.hasReceivedUserInfo) {
            this.hasReceivedUserInfo = true;
            // Always call callback if it exists (used for instant resolution)
            if (this.onDeviceInfoReceived) {
              this.onDeviceInfoReceived(this.deviceInfo);
            }
          }
        } else if (!isFirstPacket && !isOurNode) {
          this._log(`Ignoring user packet from other node ${fromNode}`, 'info');
        }
      });

      // Also listen for node info updates which may contain user data
      if (this.device.events.onNodeInfoPacket) {
        this.device.events.onNodeInfoPacket.subscribe((nodeInfoPacket) => {
          // The NodeInfo protobuf has: num, user, position, snr, lastHeard, channel
          // The user field contains: id, longName, shortName, macaddr, hwModel, etc.
          const nodeNum = nodeInfoPacket.num || nodeInfoPacket.data?.num;

          // Accept first packet OR packets from our known node
          const isFirstPacket = !this.hasReceivedUserInfo;
          const isOurNode = this.deviceInfo?.nodeNum && nodeNum === this.deviceInfo?.nodeNum;

          // Try to get user from various paths
          let user = null;
          if (nodeInfoPacket.user) {
            user = nodeInfoPacket.user;
          } else if (nodeInfoPacket.data?.user) {
            user = nodeInfoPacket.data.user;
          }

          if (user && (user.shortName || user.longName) && (isFirstPacket || isOurNode)) {
            this._log(`Node info for node ${nodeNum}: shortName="${user.shortName}", longName="${user.longName}"`, 'info');
            this.deviceInfo = {
              ...this.deviceInfo,
              shortName: user.shortName || this.deviceInfo?.shortName,
              longName: user.longName || this.deviceInfo?.longName,
              macAddr: user.macaddr || user.macAddr || user.id || this.deviceInfo?.macAddr,
              hwModel: user.hwModel || this.deviceInfo?.hwModel,
            };
            this._log(`Updated from nodeInfoPacket: shortName="${this.deviceInfo.shortName}", longName="${this.deviceInfo.longName}"`, 'success');

            // Mark that we've received user info
            if (!this.hasReceivedUserInfo) {
              this.hasReceivedUserInfo = true;
              // Always call callback if it exists (used for instant resolution)
              if (this.onDeviceInfoReceived) {
                this.onDeviceInfoReceived(this.deviceInfo);
              }
            }
          } else if (user && !isFirstPacket && !isOurNode) {
            this._log(`Ignoring nodeInfoPacket from other node ${nodeNum}`, 'info');
          }
        });
      }

      // Subscribe to ALL incoming packets to see the structure
      if (this.device.events.onFromRadio) {
        this.device.events.onFromRadio.subscribe((packet) => {
          // Log packet types that might contain user info
          if (packet.payloadVariant?.case === 'nodeInfo' || packet.nodeInfo) {
            const nodeInfo = packet.payloadVariant?.value || packet.nodeInfo;
            const nodeNum = nodeInfo?.num;

            // Only use info from our own node
            const isOurNode = !this.deviceInfo?.nodeNum || nodeNum === this.deviceInfo?.nodeNum;

            if (nodeInfo?.user && isOurNode) {
              this._log(`FromRadio nodeInfo (our node ${nodeNum}): shortName="${nodeInfo.user.shortName}", longName="${nodeInfo.user.longName}"`, 'info');
              this.deviceInfo = {
                ...this.deviceInfo,
                shortName: nodeInfo.user.shortName || this.deviceInfo?.shortName,
                longName: nodeInfo.user.longName || this.deviceInfo?.longName,
                macAddr: nodeInfo.user.macaddr || nodeInfo.user.macAddr || this.deviceInfo?.macAddr,
                hwModel: nodeInfo.user.hwModel || this.deviceInfo?.hwModel,
              };
            }
          }
        });
      }

      // Listen for config complete to get final device state
      if (this.device.events.onConfigComplete) {
        this.device.events.onConfigComplete.subscribe(() => {
          this._log('Config complete, checking final device state...', 'info');
          // Try to get info from device nodes if available
          if (this.device.nodes && this.deviceInfo?.nodeNum) {
            const myNode = this.device.nodes.get(this.deviceInfo.nodeNum);
            if (myNode?.user) {
              this._log(`Config complete - our node: shortName="${myNode.user.shortName}", longName="${myNode.user.longName}"`, 'success');
              this.deviceInfo = {
                ...this.deviceInfo,
                shortName: myNode.user.shortName || this.deviceInfo?.shortName,
                longName: myNode.user.longName || this.deviceInfo?.longName,
                macAddr: myNode.user.macaddr || myNode.user.macAddr || this.deviceInfo?.macAddr,
                hwModel: myNode.user.hwModel || this.deviceInfo?.hwModel,
              };
            }
          }
        });
      }

      // Start processing
      this._log('Starting device configuration...', 'info');

      // Create a promise that resolves when we receive device info
      const deviceInfoPromise = new Promise((resolve) => {
        // Store the original callback
        const originalCallback = this.onDeviceInfoReceived;

        // Set up a callback that resolves our promise
        this.onDeviceInfoReceived = (info) => {
          this._log('Device info received via callback, proceeding immediately...', 'success');
          if (originalCallback) originalCallback(info);
          resolve(info);
        };

        // Also set up a check for hasReceivedUserInfo in case it was set before this
        const checkExisting = setInterval(() => {
          if (this.hasReceivedUserInfo && this.deviceInfo) {
            clearInterval(checkExisting);
            this._log('Device info already received, proceeding...', 'success');
            resolve(this.deviceInfo);
          }
        }, 50);

        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkExisting);
          this._log('Timeout waiting for device info, proceeding with available data...', 'warn');
          resolve(this.deviceInfo || {});
        }, 10000);
      });

      // Start configure (don't await - let it run in background)
      const configurePromise = this.device.configure();
      configurePromise.catch(err => {
        console.warn('Configure completed with error (non-blocking):', err);
      });

      // Wait for device info (will resolve as soon as callback fires)
      this._updateStatus('connecting', 'Waiting for device info...');
      await deviceInfoPromise;

      this._updateStatus('connected', 'Connected to radio');
      this._log('Connection complete', 'success');

      return this.deviceInfo;
    } catch (error) {
      this.isConnected = false;
      this._log(`Error: ${error.message}`, 'error');
      this._updateStatus('error', `Connection failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Wait for device info to be received
   */
  async _waitForDeviceInfo(timeout = 3000) {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkInfo = () => {
        // Try to get more info from the device nodes map
        this._tryGetMoreInfo();

        // Resolve immediately if we've received user info from event handlers
        if (this.hasReceivedUserInfo) {
          this._log('Device info received, proceeding...', 'success');
          resolve(this.deviceInfo);
          return;
        }

        // Consider ready when we have nodeNum AND user info
        const hasNodeNum = this.deviceInfo?.nodeNum;
        const hasUserInfo = this.deviceInfo?.shortName || this.deviceInfo?.longName;

        if (hasNodeNum && hasUserInfo) {
          this._log('Device info complete, proceeding...', 'success');
          resolve(this.deviceInfo);
        } else if (hasNodeNum && Date.now() - startTime > 1000) {
          // If we have nodeNum but no user info after 1s, proceed anyway
          this._log('Proceeding with available device info...', 'info');
          resolve(this.deviceInfo);
        } else if (Date.now() - startTime > timeout) {
          // Hard timeout - proceed with whatever we have
          this._log('Timeout waiting for device info, proceeding...', 'warn');
          resolve(this.deviceInfo || {});
        } else {
          // Check more frequently for faster response
          setTimeout(checkInfo, 50);
        }
      };

      // Start checking immediately
      checkInfo();
    });
  }

  /**
   * Try to get more info from device nodes map
   */
  _tryGetMoreInfo() {
    if (!this.device) return;

    console.log('_tryGetMoreInfo called, device:', this.device);
    console.log('Device nodes:', this.device.nodes);
    console.log('Current deviceInfo:', this.deviceInfo);

    // Check nodes map - try to find our node
    if (this.device.nodes) {
      // Log all nodes in the map
      console.log('Nodes map size:', this.device.nodes.size);
      this.device.nodes.forEach((node, nodeNum) => {
        console.log(`Node ${nodeNum}:`, node);
        if (node?.user) {
          console.log(`Node ${nodeNum} user:`, node.user);
        }
      });

      // Try to get our specific node
      if (this.deviceInfo?.nodeNum) {
        const myNode = this.device.nodes.get(this.deviceInfo.nodeNum);
        if (myNode?.user) {
          console.log('Found MY node in nodes map:', myNode);
          this.deviceInfo = {
            ...this.deviceInfo,
            shortName: myNode.user.shortName || this.deviceInfo.shortName,
            longName: myNode.user.longName || this.deviceInfo.longName,
            macAddr: myNode.user.macaddr || myNode.user.macAddr || this.deviceInfo.macAddr,
            hwModel: myNode.user.hwModel || this.deviceInfo.hwModel,
          };
        }
      }

      // If we still don't have user info, try the first node in the map
      if (!this.deviceInfo?.shortName && !this.deviceInfo?.longName) {
        const firstNode = this.device.nodes.values().next().value;
        if (firstNode?.user) {
          console.log('Using first node from map:', firstNode);
          this.deviceInfo = {
            ...this.deviceInfo,
            shortName: firstNode.user.shortName || this.deviceInfo?.shortName,
            longName: firstNode.user.longName || this.deviceInfo?.longName,
            macAddr: firstNode.user.macaddr || firstNode.user.macAddr || this.deviceInfo?.macAddr,
            hwModel: firstNode.user.hwModel || this.deviceInfo?.hwModel,
          };
        }
      }
    }

    // Check if device has direct getters
    if (this.device.myNodeInfo) {
      console.log('Device myNodeInfo:', this.device.myNodeInfo);
    }
    if (this.device.user) {
      console.log('Device user:', this.device.user);
      this.deviceInfo = {
        ...this.deviceInfo,
        shortName: this.device.user.shortName || this.deviceInfo?.shortName,
        longName: this.device.user.longName || this.deviceInfo?.longName,
        macAddr: this.device.user.macaddr || this.device.user.macAddr || this.deviceInfo?.macAddr,
      };
    }

    // Try device.config or device.localConfig
    if (this.device.config) {
      console.log('Device config:', this.device.config);
    }
    if (this.device.localConfig) {
      console.log('Device localConfig:', this.device.localConfig);
    }
  }

  /**
   * Disconnect from the radio
   */
  async disconnect() {
    // Skip logging if no callbacks (silent disconnect)
    const shouldLog = !!this.onLog;
    if (shouldLog) this._log('Disconnecting...', 'info');

    // First try to close the device gracefully
    if (this.device) {
      try {
        // Give the device a moment to finish any pending operations
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.error('Error closing device:', e);
      }
    }

    // Save port reference before disconnecting transport
    let port = null;
    if (this.transport?.port) {
      port = this.transport.port;
    }

    if (this.transport) {
      try {
        await this.transport.disconnect();
      } catch (e) {
        // Locked stream errors are common and can be ignored
        if (!e.message?.includes('locked stream') && !e.message?.includes('locked')) {
          console.error('Error disconnecting transport:', e);
        }
      }
    }

    // Try to forget the port to fully release it
    if (port) {
      try {
        await port.forget();
      } catch (e) {
        // Port may already be closed or forget not supported
      }
    }

    this.device = null;
    this.transport = null;
    this.isConnected = false;
    this.deviceInfo = null;
    if (shouldLog) {
      this._log('Disconnected', 'success');
      this._updateStatus('disconnected', 'Disconnected from radio');
    }
  }

  /**
   * Get current device info
   */
  getDeviceInfo() {
    return this.deviceInfo;
  }

  /**
   * Program the radio with channels and config
   * @param {Object} config - Programming configuration
   * @param {Object} config.radio - Radio info from backend
   * @param {Array} config.channels - Channels to program
   * @param {string} config.yamlConfig - YAML device config (optional)
   */
  async programRadio(config) {
    if (!this.isConnected || !this.device) {
      throw new Error('Not connected to radio');
    }

    const { radio, channels, yamlConfig } = config;
    const totalSteps = channels.length + (yamlConfig ? 1 : 0) + 1; // channels + yaml + owner
    let currentStep = 0;

    try {
      // Step 1: Set owner info
      this._updateProgress(++currentStep, totalSteps, 'Setting owner info...');
      await this._setOwnerInfo(radio);

      // Step 2: Program channels
      for (const channel of channels) {
        this._updateProgress(++currentStep, totalSteps, `Programming channel ${channel.slot_number}: ${channel.name}...`);
        await this._setChannel(channel);
      }

      // Step 3: Apply YAML config if provided
      if (yamlConfig) {
        this._updateProgress(++currentStep, totalSteps, 'Applying device configuration...');
        await this._applyYamlConfig(yamlConfig);
      }

      this._updateProgress(totalSteps, totalSteps, 'Programming complete!');
      this._updateStatus('success', 'Radio programmed successfully');

      return { success: true };
    } catch (error) {
      this._updateStatus('error', `Programming failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Set owner info on the radio
   */
  async _setOwnerInfo(radio) {
    if (!radio.shortName && !radio.longName) {
      console.log('No owner info to set');
      return;
    }

    try {
      await this.device.setOwner({
        shortName: radio.shortName || undefined,
        longName: radio.longName || undefined,
      });
      // Wait for confirmation
      await this._delay(500);
    } catch (error) {
      console.error('Error setting owner:', error);
      // Don't fail on owner setting error, continue with programming
    }
  }

  /**
   * Parse a Meshtastic URL and extract channel settings
   * URL format: https://meshtastic.org/e/#base64encodedProtobuf
   */
  _parseChannelUrl(url) {
    try {
      const hashIndex = url.indexOf('#');
      if (hashIndex === -1) return null;

      let base64 = url.substring(hashIndex + 1);
      // Convert URL-safe base64 to standard base64
      base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
      // Add padding if needed
      while (base64.length % 4 !== 0) base64 += '=';

      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const channelSet = fromBinary(Protobuf.AppOnly.ChannelSetSchema, bytes);
      return channelSet;
    } catch (error) {
      console.error('Error parsing channel URL:', error);
      return null;
    }
  }

  /**
   * Set a channel on the radio
   */
  async _setChannel(channelConfig) {
    const { slot_number, name, url } = channelConfig;

    try {
      if (url) {
        // Parse the Meshtastic URL to extract channel settings
        const channelSet = this._parseChannelUrl(url);
        if (channelSet && channelSet.settings.length > 0) {
          // Use the first settings entry from the URL
          const settings = channelSet.settings[0];
          const channel = create(Protobuf.Channel.ChannelSchema, {
            index: slot_number,
            settings: settings,
            role: slot_number === 0
              ? Protobuf.Channel.Channel_Role.PRIMARY
              : Protobuf.Channel.Channel_Role.SECONDARY,
          });
          await this.device.setChannel(channel);
        } else {
          throw new Error('Could not parse channel URL');
        }
      } else {
        // Set channel with just a name (disabled channel)
        const channel = create(Protobuf.Channel.ChannelSchema, {
          index: slot_number,
          settings: create(Protobuf.Channel.ChannelSettingsSchema, {
            name: name || '',
            psk: new Uint8Array(0),
          }),
          role: slot_number === 0
            ? Protobuf.Channel.Channel_Role.PRIMARY
            : Protobuf.Channel.Channel_Role.SECONDARY,
        });
        await this.device.setChannel(channel);
      }

      // Wait for confirmation
      await this._delay(300);
    } catch (error) {
      console.error(`Error setting channel ${slot_number}:`, error);
      throw new Error(`Failed to set channel ${slot_number}: ${error.message}`);
    }
  }

  /**
   * Apply YAML configuration to the radio
   * The YAML config should be a Meshtastic-compatible device config
   */
  async _applyYamlConfig(yamlConfig) {
    if (!yamlConfig || yamlConfig.trim() === '') {
      console.log('No YAML config to apply');
      return;
    }

    try {
      // Parse YAML config (simple key=value or YAML format)
      const config = this._parseYamlConfig(yamlConfig);

      // Apply each config section
      if (config.device) {
        await this._setDeviceConfig(config.device);
      }
      if (config.position) {
        await this._setPositionConfig(config.position);
      }
      if (config.power) {
        await this._setPowerConfig(config.power);
      }
      if (config.network) {
        await this._setNetworkConfig(config.network);
      }
      if (config.display) {
        await this._setDisplayConfig(config.display);
      }
      if (config.lora) {
        await this._setLoRaConfig(config.lora);
      }
      if (config.bluetooth) {
        await this._setBluetoothConfig(config.bluetooth);
      }
    } catch (error) {
      console.error('Error applying YAML config:', error);
      throw new Error(`Failed to apply config: ${error.message}`);
    }
  }

  /**
   * Parse YAML-like config string into object
   * Supports simple YAML format:
   * section:
   *   key: value
   */
  _parseYamlConfig(yamlString) {
    const config = {};
    let currentSection = null;

    const lines = yamlString.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Check for section header (no leading spaces, ends with :)
      if (!line.startsWith(' ') && !line.startsWith('\t') && trimmed.endsWith(':')) {
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

        config[currentSection][key] = value;
      }
    }

    return config;
  }

  /**
   * Resolve enum values from string names
   */
  _resolveEnumValue(enumObj, value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Try direct lookup (e.g., 'TAK' -> 7)
      if (enumObj[value] !== undefined) return enumObj[value];
      // Try uppercase
      if (enumObj[value.toUpperCase()] !== undefined) return enumObj[value.toUpperCase()];
    }
    return value;
  }

  /**
   * Set device configuration
   */
  async _setDeviceConfig(deviceConfig) {
    const configObj = {};

    if (deviceConfig.role !== undefined) {
      configObj.role = this._resolveEnumValue(
        Protobuf.Config.Config_DeviceConfig_Role,
        deviceConfig.role
      );
    }
    if (deviceConfig.serialEnabled !== undefined) {
      configObj.serialEnabled = deviceConfig.serialEnabled;
    }
    if (deviceConfig.debugLogEnabled !== undefined) {
      configObj.debugLogEnabled = deviceConfig.debugLogEnabled;
    }

    if (Object.keys(configObj).length > 0) {
      const config = create(Protobuf.Config.ConfigSchema, {
        payloadVariant: {
          case: 'device',
          value: create(Protobuf.Config.Config_DeviceConfigSchema, configObj)
        }
      });
      await this.device.setConfig(config);
      await this._delay(300);
    }
  }

  /**
   * Set position configuration
   */
  async _setPositionConfig(posConfig) {
    const configObj = {};

    if (posConfig.gpsEnabled !== undefined) {
      configObj.gpsEnabled = posConfig.gpsEnabled;
    }
    if (posConfig.fixedPosition !== undefined) {
      configObj.fixedPosition = posConfig.fixedPosition;
    }
    if (posConfig.positionBroadcastSecs !== undefined) {
      configObj.positionBroadcastSecs = posConfig.positionBroadcastSecs;
    }

    if (Object.keys(configObj).length > 0) {
      const config = create(Protobuf.Config.ConfigSchema, {
        payloadVariant: {
          case: 'position',
          value: create(Protobuf.Config.Config_PositionConfigSchema, configObj)
        }
      });
      await this.device.setConfig(config);
      await this._delay(300);
    }
  }

  /**
   * Set power configuration
   */
  async _setPowerConfig(powerConfig) {
    const configObj = {};

    if (powerConfig.isPowerSaving !== undefined) {
      configObj.isPowerSaving = powerConfig.isPowerSaving;
    }
    if (powerConfig.onBatteryShutdownAfterSecs !== undefined) {
      configObj.onBatteryShutdownAfterSecs = powerConfig.onBatteryShutdownAfterSecs;
    }

    if (Object.keys(configObj).length > 0) {
      const config = create(Protobuf.Config.ConfigSchema, {
        payloadVariant: {
          case: 'power',
          value: create(Protobuf.Config.Config_PowerConfigSchema, configObj)
        }
      });
      await this.device.setConfig(config);
      await this._delay(300);
    }
  }

  /**
   * Set network configuration
   */
  async _setNetworkConfig(netConfig) {
    const configObj = {};

    if (netConfig.wifiEnabled !== undefined) {
      configObj.wifiEnabled = netConfig.wifiEnabled;
    }
    if (netConfig.wifiSsid !== undefined) {
      configObj.wifiSsid = netConfig.wifiSsid;
    }
    if (netConfig.wifiPsk !== undefined) {
      configObj.wifiPsk = netConfig.wifiPsk;
    }

    if (Object.keys(configObj).length > 0) {
      const config = create(Protobuf.Config.ConfigSchema, {
        payloadVariant: {
          case: 'network',
          value: create(Protobuf.Config.Config_NetworkConfigSchema, configObj)
        }
      });
      await this.device.setConfig(config);
      await this._delay(300);
    }
  }

  /**
   * Set display configuration
   */
  async _setDisplayConfig(displayConfig) {
    const configObj = {};

    if (displayConfig.screenOnSecs !== undefined) {
      configObj.screenOnSecs = displayConfig.screenOnSecs;
    }
    if (displayConfig.gpsFormat !== undefined) {
      configObj.gpsFormat = displayConfig.gpsFormat;
    }

    if (Object.keys(configObj).length > 0) {
      const config = create(Protobuf.Config.ConfigSchema, {
        payloadVariant: {
          case: 'display',
          value: create(Protobuf.Config.Config_DisplayConfigSchema, configObj)
        }
      });
      await this.device.setConfig(config);
      await this._delay(300);
    }
  }

  /**
   * Set LoRa configuration
   */
  async _setLoRaConfig(loraConfig) {
    const configObj = {};

    if (loraConfig.region !== undefined) {
      configObj.region = this._resolveEnumValue(
        Protobuf.Config.Config_LoRaConfig_RegionCode,
        loraConfig.region
      );
    }
    if (loraConfig.modemPreset !== undefined) {
      configObj.modemPreset = this._resolveEnumValue(
        Protobuf.Config.Config_LoRaConfig_ModemPreset,
        loraConfig.modemPreset
      );
    }
    if (loraConfig.txPower !== undefined) {
      configObj.txPower = loraConfig.txPower;
    }
    if (loraConfig.bandwidth !== undefined) {
      configObj.bandwidth = loraConfig.bandwidth;
    }
    if (loraConfig.spreadFactor !== undefined) {
      configObj.spreadFactor = loraConfig.spreadFactor;
    }
    if (loraConfig.codingRate !== undefined) {
      configObj.codingRate = loraConfig.codingRate;
    }
    if (loraConfig.hopLimit !== undefined) {
      configObj.hopLimit = loraConfig.hopLimit;
    }
    if (loraConfig.txEnabled !== undefined) {
      configObj.txEnabled = loraConfig.txEnabled;
    }
    if (loraConfig.overrideDutyCycle !== undefined) {
      configObj.overrideDutyCycle = loraConfig.overrideDutyCycle;
    }
    if (loraConfig.overrideFrequency !== undefined) {
      configObj.overrideFrequency = loraConfig.overrideFrequency;
    }
    if (loraConfig.sx126xRxBoostedGain !== undefined) {
      configObj.sx126xRxBoostedGain = loraConfig.sx126xRxBoostedGain;
    }
    if (loraConfig.configOkToMqtt !== undefined) {
      configObj.configOkToMqtt = loraConfig.configOkToMqtt;
    }

    if (Object.keys(configObj).length > 0) {
      const config = create(Protobuf.Config.ConfigSchema, {
        payloadVariant: {
          case: 'lora',
          value: create(Protobuf.Config.Config_LoRaConfigSchema, configObj)
        }
      });
      await this.device.setConfig(config);
      await this._delay(300);
    }
  }

  /**
   * Set Bluetooth configuration
   */
  async _setBluetoothConfig(btConfig) {
    const configObj = {};

    if (btConfig.enabled !== undefined) {
      configObj.enabled = btConfig.enabled;
    }
    if (btConfig.mode !== undefined) {
      configObj.mode = btConfig.mode;
    }
    if (btConfig.fixedPin !== undefined) {
      configObj.fixedPin = btConfig.fixedPin;
    }

    if (Object.keys(configObj).length > 0) {
      const config = create(Protobuf.Config.ConfigSchema, {
        payloadVariant: {
          case: 'bluetooth',
          value: create(Protobuf.Config.Config_BluetoothConfigSchema, configObj)
        }
      });
      await this.device.setConfig(config);
      await this._delay(300);
    }
  }

  /**
   * Helper to update status
   */
  _updateStatus(status, message) {
    console.log(`[MeshtasticSerial] ${status}: ${message}`);
    if (this.onStatusChange) {
      this.onStatusChange(status, message);
    }
  }

  /**
   * Helper to update progress
   */
  _updateProgress(current, total, message) {
    console.log(`[MeshtasticSerial] Progress ${current}/${total}: ${message}`);
    if (this.onProgress) {
      this.onProgress(current, total, message);
    }
  }

  /**
   * Helper delay function
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format MAC address from bytes object like { 0: 197, 1: 253, ... }
   */
  _formatMacFromBytes(macaddr) {
    if (!macaddr) return null;
    if (typeof macaddr === 'string') return macaddr;

    // Handle object with numeric keys { 0: 197, 1: 253, ... }
    const bytes = [];
    for (let i = 0; i < 6; i++) {
      if (macaddr[i] !== undefined) {
        bytes.push(macaddr[i]);
      } else if (macaddr[String(i)] !== undefined) {
        bytes.push(macaddr[String(i)]);
      }
    }

    if (bytes.length === 6) {
      return bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
    }

    // Fallback: try Array.from if it's array-like
    if (macaddr.length === 6) {
      return Array.from(macaddr).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
    }

    return null;
  }
}

// Export singleton instance
export const meshtasticSerial = new MeshtasticSerialService();

// Also export the class for testing
export { MeshtasticSerialService };
