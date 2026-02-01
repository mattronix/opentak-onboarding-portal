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
    this.lastPort = null; // Track last used port for cleanup
    // Collected config data from events
    this.collectedChannels = new Map();
    this.collectedConfig = {};
    this.configComplete = false;
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
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    // Try to close any previously used port (but don't forget it - keep browser permission)
    if (this.lastPort) {
      try {
        if (this.lastPort.readable || this.lastPort.writable) {
          await this.lastPort.close().catch(() => {});
          // Wait a bit for the port to fully close
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (e) {
        // Port may already be closed
      }
      this.lastPort = null;
    }

    this.onStatusChange = onStatusChange;
    this.onProgress = onProgress;
    this.onDeviceInfoReceived = onDeviceInfoReceived;
    this.onLog = onLog;
    this.hasReceivedUserInfo = false; // Reset flag for new connection
    // Reset collected config data
    this.collectedChannels = new Map();
    this.collectedConfig = {};
    this.configComplete = false;

    try {
      this._updateStatus('connecting', 'Requesting USB port...');
      this._log('Requesting USB port selection...', 'info');

      // Create transport (this will prompt user to select the serial port)
      this.transport = await TransportWebSerial.create(115200);
      // Store port reference for cleanup
      if (this.transport?.port) {
        this.lastPort = this.transport.port;
      }
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
        // Request device metadata to get firmware version
        if (this.device.getMetadata) {
          this._log('Requesting device metadata...', 'info');
          this.device.getMetadata(nodeInfo.myNodeNum).catch(err => {
            this._log(`Metadata request error (non-fatal): ${err.message}`, 'warn');
          });
        }
      });

      this.device.events.onDeviceMetadataPacket.subscribe((metadata) => {
        const fw = metadata.data?.firmwareVersion || metadata.firmwareVersion;
        const hwModelRaw = metadata.data?.hwModel || metadata.hwModel;
        if (fw) {
          this._log(`Firmware version: ${fw}`, 'info');
        }
        if (hwModelRaw !== undefined) {
          this._log(`Hardware model: ${this._getHardwareModelName(hwModelRaw)}`, 'info');
        }
        if (metadata) {
          this.deviceInfo = {
            ...this.deviceInfo,
            firmwareVersion: fw,
            hwModel: hwModelRaw,
            model: this._getHardwareModelName(hwModelRaw),
          };
        }
      });

      this.device.events.onUserPacket.subscribe((userPacket) => {
        // Data is directly in userPacket.data (not nested under .user)
        // Structure: { data: { longName, shortName, macaddr, hwModel, ... }, from: nodeNum }
        const data = userPacket.data || userPacket;
        const fromNode = userPacket.from || data.from;

        this._log(`User packet from node ${fromNode}: shortName="${data?.shortName}", longName="${data?.longName}"`, 'info');

        // Only accept packets from our own node - never from other mesh nodes
        const isOurNode = this.deviceInfo?.nodeNum && fromNode === this.deviceInfo?.nodeNum;

        if (data && (data.shortName || data.longName) && isOurNode) {
          // Only use actual macaddr field from device - never fallback
          const macFromDevice = data.macaddr ? this._formatMacFromBytes(data.macaddr) : null;
          const hwModelRaw = data.hwModel || this.deviceInfo?.hwModel;

          this.deviceInfo = {
            ...this.deviceInfo,
            shortName: data.shortName || this.deviceInfo?.shortName,
            longName: data.longName || this.deviceInfo?.longName,
            macAddr: macFromDevice || this.deviceInfo?.macAddr,
            hwModel: hwModelRaw,
            model: this._getHardwareModelName(hwModelRaw) || this.deviceInfo?.model,
          };
          this._log(`Updated deviceInfo: shortName="${this.deviceInfo.shortName}", longName="${this.deviceInfo.longName}", mac="${this.deviceInfo.macAddr}", model="${this.deviceInfo.model}"`, 'success');

          // Mark that we've received user info (prevents other nodes overwriting)
          if (!this.hasReceivedUserInfo) {
            this.hasReceivedUserInfo = true;
            // Wait briefly for firmware version from metadata request before calling callback
            if (this.onDeviceInfoReceived) {
              const cb = this.onDeviceInfoReceived;
              if (this.deviceInfo?.firmwareVersion) {
                cb(this.deviceInfo);
              } else {
                // Give metadata response up to 1.5s to arrive
                const waitForFw = () => {
                  let waited = 0;
                  const interval = setInterval(() => {
                    waited += 100;
                    if (this.deviceInfo?.firmwareVersion || waited >= 1500) {
                      clearInterval(interval);
                      cb(this.deviceInfo);
                    }
                  }, 100);
                };
                waitForFw();
              }
            }
          }
        } else if (!isOurNode) {
          this._log(`Ignoring user packet from other node ${fromNode} (our node: ${this.deviceInfo?.nodeNum})`, 'info');
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

          // Only capture data from our own node - never accept from other mesh nodes
          if (user && (user.shortName || user.longName) && isOurNode) {
            this._log(`Node info for OUR node ${nodeNum}: shortName="${user.shortName}", longName="${user.longName}"`, 'info');

            // Only use actual macaddr field - never fallback to user.id which may be something else
            const macFromDevice = this._formatMacFromBytes(user.macaddr) || this._formatMacFromBytes(user.macAddr);
            const hwModelRaw = user.hwModel || this.deviceInfo?.hwModel;

            this.deviceInfo = {
              ...this.deviceInfo,
              shortName: user.shortName || this.deviceInfo?.shortName,
              longName: user.longName || this.deviceInfo?.longName,
              macAddr: macFromDevice || this.deviceInfo?.macAddr,
              hwModel: hwModelRaw,
              model: this._getHardwareModelName(hwModelRaw) || this.deviceInfo?.model,
            };
            this._log(`Updated from nodeInfoPacket: shortName="${this.deviceInfo.shortName}", longName="${this.deviceInfo.longName}", mac="${this.deviceInfo.macAddr}", model="${this.deviceInfo.model}"`, 'success');

            // Mark that we've received user info
            if (!this.hasReceivedUserInfo) {
              this.hasReceivedUserInfo = true;
              // Wait briefly for firmware version from metadata request before calling callback
              if (this.onDeviceInfoReceived) {
                const cb = this.onDeviceInfoReceived;
                if (this.deviceInfo?.firmwareVersion) {
                  cb(this.deviceInfo);
                } else {
                  let waited = 0;
                  const interval = setInterval(() => {
                    waited += 100;
                    if (this.deviceInfo?.firmwareVersion || waited >= 1500) {
                      clearInterval(interval);
                      cb(this.deviceInfo);
                    }
                  }, 100);
                }
              }
            }
          } else if (user && !isOurNode) {
            this._log(`Ignoring nodeInfoPacket from other node ${nodeNum} (our node: ${this.deviceInfo?.nodeNum})`, 'info');
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

            // Only use info from our own node - must know our nodeNum first
            const isOurNode = this.deviceInfo?.nodeNum && nodeNum === this.deviceInfo?.nodeNum;

            if (nodeInfo?.user && isOurNode) {
              // Only use actual macaddr field from device
              const macFromDevice = this._formatMacFromBytes(nodeInfo.user.macaddr) || this._formatMacFromBytes(nodeInfo.user.macAddr);
              const hwModelRaw = nodeInfo.user.hwModel || this.deviceInfo?.hwModel;

              this._log(`FromRadio nodeInfo (our node ${nodeNum}): shortName="${nodeInfo.user.shortName}", longName="${nodeInfo.user.longName}"`, 'info');
              this.deviceInfo = {
                ...this.deviceInfo,
                shortName: nodeInfo.user.shortName || this.deviceInfo?.shortName,
                longName: nodeInfo.user.longName || this.deviceInfo?.longName,
                macAddr: macFromDevice || this.deviceInfo?.macAddr,
                hwModel: hwModelRaw,
                model: this._getHardwareModelName(hwModelRaw) || this.deviceInfo?.model,
              };
            }
          }
        });
      }

      // Listen for config complete to get final device state
      if (this.device.events.onConfigComplete) {
        this.device.events.onConfigComplete.subscribe(() => {
          this._log('Config complete, checking final device state...', 'info');
          this.configComplete = true;
          // Try to get info from device nodes if available (only our own node)
          if (this.device.nodes && this.deviceInfo?.nodeNum) {
            const myNode = this.device.nodes.get(this.deviceInfo.nodeNum);
            if (myNode?.user) {
              // Only use actual macaddr field from device
              const macFromDevice = this._formatMacFromBytes(myNode.user.macaddr) || this._formatMacFromBytes(myNode.user.macAddr);
              const hwModelRaw = myNode.user.hwModel || this.deviceInfo?.hwModel;

              this._log(`Config complete - our node: shortName="${myNode.user.shortName}", longName="${myNode.user.longName}", mac="${macFromDevice}", model="${this._getHardwareModelName(hwModelRaw)}"`, 'success');
              this.deviceInfo = {
                ...this.deviceInfo,
                shortName: myNode.user.shortName || this.deviceInfo?.shortName,
                longName: myNode.user.longName || this.deviceInfo?.longName,
                macAddr: macFromDevice || this.deviceInfo?.macAddr,
                hwModel: hwModelRaw,
                model: this._getHardwareModelName(hwModelRaw) || this.deviceInfo?.model,
              };
            }
          }
        });
      }

      // Subscribe to channel events to collect channel data
      if (this.device.events.onChannelPacket) {
        this.device.events.onChannelPacket.subscribe((channelPacket) => {
          const channel = channelPacket.data || channelPacket;
          const index = channel.index ?? channelPacket.index;
          this._log(`Received channel ${index}: "${channel.settings?.name || channel.name || '(unnamed)'}"`, 'info');
          console.log(`[onChannelPacket] Channel ${index}:`, channel);
          this.collectedChannels.set(index, channel);
        });
      }

      // Subscribe to config events to collect device config
      if (this.device.events.onConfigPacket) {
        this.device.events.onConfigPacket.subscribe((configPacket) => {
          const config = configPacket.data || configPacket;
          console.log('[onConfigPacket] Config packet:', config);
          // Config comes in sections via payloadVariant
          if (config.payloadVariant) {
            const section = config.payloadVariant.case;
            const value = config.payloadVariant.value;
            this._log(`Received config: ${section}`, 'info');
            console.log(`[onConfigPacket] Section ${section}:`, value);
            this.collectedConfig[section] = value;
          }
        });
      }

      // Also try onLocalConfig if available
      if (this.device.events.onLocalConfig) {
        this.device.events.onLocalConfig.subscribe((localConfig) => {
          console.log('[onLocalConfig] Local config:', localConfig);
          // Merge into collectedConfig
          if (localConfig.device) this.collectedConfig.device = localConfig.device;
          if (localConfig.lora) this.collectedConfig.lora = localConfig.lora;
          if (localConfig.bluetooth) this.collectedConfig.bluetooth = localConfig.bluetooth;
          if (localConfig.position) this.collectedConfig.position = localConfig.position;
          if (localConfig.power) this.collectedConfig.power = localConfig.power;
          if (localConfig.network) this.collectedConfig.network = localConfig.network;
          if (localConfig.display) this.collectedConfig.display = localConfig.display;
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

      // Provide more helpful error message for common issues
      if (error.message.includes('Failed to open serial port')) {
        const helpfulError = new Error(
          'Failed to open serial port. Try: 1) Unplug and replug the radio, ' +
          '2) Close other apps using the port, 3) Refresh the page. ' +
          'Original error: ' + error.message
        );
        throw helpfulError;
      }

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
          const hwModelRaw = myNode.user.hwModel || this.deviceInfo.hwModel;
          this.deviceInfo = {
            ...this.deviceInfo,
            shortName: myNode.user.shortName || this.deviceInfo.shortName,
            longName: myNode.user.longName || this.deviceInfo.longName,
            macAddr: this._formatMacFromBytes(myNode.user.macaddr) || this._formatMacFromBytes(myNode.user.macAddr) || this.deviceInfo.macAddr,
            hwModel: hwModelRaw,
            model: this._getHardwareModelName(hwModelRaw) || this.deviceInfo.model,
          };
        }
      }

      // If we still don't have user info, try the first node in the map
      if (!this.deviceInfo?.shortName && !this.deviceInfo?.longName) {
        const firstNode = this.device.nodes.values().next().value;
        if (firstNode?.user) {
          console.log('Using first node from map:', firstNode);
          const hwModelRaw = firstNode.user.hwModel || this.deviceInfo?.hwModel;
          this.deviceInfo = {
            ...this.deviceInfo,
            shortName: firstNode.user.shortName || this.deviceInfo?.shortName,
            longName: firstNode.user.longName || this.deviceInfo?.longName,
            macAddr: this._formatMacFromBytes(firstNode.user.macaddr) || this._formatMacFromBytes(firstNode.user.macAddr) || this.deviceInfo?.macAddr,
            hwModel: hwModelRaw,
            model: this._getHardwareModelName(hwModelRaw) || this.deviceInfo?.model,
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
        macAddr: this._formatMacFromBytes(this.device.user.macaddr) || this._formatMacFromBytes(this.device.user.macAddr) || this.deviceInfo?.macAddr,
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

    // Save port reference before disconnecting transport
    let port = null;
    if (this.transport?.port) {
      port = this.transport.port;
      this.lastPort = port; // Keep reference for future cleanup attempts
    }

    // First try to close the transport
    if (this.transport) {
      try {
        await this.transport.disconnect();
      } catch (e) {
        // Locked stream errors are common and can be ignored
        if (!e.message?.includes('locked') && !e.message?.includes('stream')) {
          console.error('Error disconnecting transport:', e);
        }
      }
    }

    // Try to close the port directly if transport disconnect didn't work
    if (port) {
      try {
        // Check if port is still open and close it
        if (port.readable || port.writable) {
          await port.close().catch(() => {});
        }
      } catch (e) {
        // Port may already be closed
      }
      // Keep the port reference for potential cleanup, but clear lastPort
      // Don't call forget() - it revokes browser permission and causes issues
      this.lastPort = null;
    }

    // Clear all references
    this.device = null;
    this.transport = null;
    this.isConnected = false;
    this.deviceInfo = null;
    this.hasReceivedUserInfo = false;
    // Reset collected config data
    this.collectedChannels = new Map();
    this.collectedConfig = {};
    this.configComplete = false;

    // Brief delay to ensure OS releases the port
    await new Promise(resolve => setTimeout(resolve, 100));

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
   * Read the current configuration from the connected radio
   * Returns owner info, channels, and device config
   */
  async readCurrentConfig() {
    if (!this.isConnected || !this.device) {
      throw new Error('Not connected to radio');
    }

    this._log('Reading current configuration from radio...', 'info');

    const config = {
      owner: {
        shortName: this.deviceInfo?.shortName || '',
        longName: this.deviceInfo?.longName || '',
      },
      channels: [],
      deviceConfig: {},
    };

    try {
      // Wait for configure() to complete and for events to deliver data
      let waitTime = 0;
      const maxWait = 15000;
      const pollInterval = 500;

      // Wait for configComplete or for collected data to appear
      while (!this.configComplete && this.collectedChannels.size === 0 && waitTime < maxWait) {
        this._log(`Waiting for config data... (${waitTime}ms)`, 'info');
        await this._delay(pollInterval);
        waitTime += pollInterval;
      }

      // Give a bit more time for all config packets to arrive
      await this._delay(1000);

      // Debug: log collected data
      this._log(`Collected ${this.collectedChannels.size} channels, config keys: ${Object.keys(this.collectedConfig).join(', ') || '(none)'}`, 'info');
      console.log('[readCurrentConfig] collectedChannels:', this.collectedChannels);
      console.log('[readCurrentConfig] collectedConfig:', this.collectedConfig);

      // Build channels from collected data
      if (this.collectedChannels.size > 0) {
        this._log(`Processing ${this.collectedChannels.size} channels...`, 'info');
        this.collectedChannels.forEach((channel, index) => {
          console.log(`[readCurrentConfig] Processing channel ${index}:`, channel);

          let name = '';
          let role = index === 0 ? 'PRIMARY' : 'SECONDARY';
          let psk = '';

          // Try to get settings from various structures
          const settings = channel.settings || channel;
          if (settings) {
            name = settings.name || '';
            if (settings.psk) {
              psk = this._formatPskForDisplay(settings.psk);
            }
          }

          if (channel.role !== undefined) {
            role = this._getChannelRoleName(channel.role);
          }

          const channelInfo = {
            slot_number: index,
            name: name,
            role: role,
            psk: psk,
          };
          config.channels.push(channelInfo);
          this._log(`Channel ${index}: "${channelInfo.name}" (${channelInfo.role})`, 'info');
        });
      } else {
        this._log('No channels collected from device', 'warn');
      }

      // Sort channels by slot number
      config.channels.sort((a, b) => a.slot_number - b.slot_number);

      // Build device config from collected data
      if (Object.keys(this.collectedConfig).length > 0) {
        this._log('Processing collected device config...', 'info');

        if (this.collectedConfig.device) {
          const deviceSection = this.collectedConfig.device;
          config.deviceConfig.device = {
            role: this._getDeviceRoleName(deviceSection.role),
            serialEnabled: deviceSection.serialEnabled,
            debugLogEnabled: deviceSection.debugLogEnabled,
          };
          this._log(`Device role: ${config.deviceConfig.device.role}`, 'info');
        }

        if (this.collectedConfig.lora) {
          const loraSection = this.collectedConfig.lora;
          config.deviceConfig.lora = {
            region: this._getRegionName(loraSection.region),
            modemPreset: this._getModemPresetName(loraSection.modemPreset),
            txPower: loraSection.txPower,
            hopLimit: loraSection.hopLimit,
            txEnabled: loraSection.txEnabled,
            overrideDutyCycle: loraSection.overrideDutyCycle,
            configOkToMqtt: loraSection.configOkToMqtt,
          };
          this._log(`LoRa preset: ${config.deviceConfig.lora.modemPreset}, hopLimit: ${config.deviceConfig.lora.hopLimit}`, 'info');
        }

        if (this.collectedConfig.position) {
          const positionSection = this.collectedConfig.position;
          config.deviceConfig.position = {
            gpsEnabled: positionSection.gpsEnabled,
            fixedPosition: positionSection.fixedPosition,
            positionBroadcastSecs: positionSection.positionBroadcastSecs,
          };
        }

        if (this.collectedConfig.bluetooth) {
          const btSection = this.collectedConfig.bluetooth;
          config.deviceConfig.bluetooth = {
            enabled: btSection.enabled,
            mode: btSection.mode,
            fixedPin: btSection.fixedPin,
          };
          this._log(`Bluetooth enabled: ${config.deviceConfig.bluetooth.enabled}`, 'info');
        }

        if (this.collectedConfig.network) {
          const netSection = this.collectedConfig.network;
          config.deviceConfig.network = {
            wifiEnabled: netSection.wifiEnabled,
            wifiSsid: netSection.wifiSsid,
          };
        }

        if (this.collectedConfig.display) {
          const displaySection = this.collectedConfig.display;
          config.deviceConfig.display = {
            screenOnSecs: displaySection.screenOnSecs,
            gpsFormat: displaySection.gpsFormat,
          };
        }

        if (this.collectedConfig.power) {
          const powerSection = this.collectedConfig.power;
          config.deviceConfig.power = {
            isPowerSaving: powerSection.isPowerSaving,
            onBatteryShutdownAfterSecs: powerSection.onBatteryShutdownAfterSecs,
          };
        }
      } else {
        this._log('No device config collected', 'warn');
      }

      this._log('Configuration read complete', 'success');
      return config;
    } catch (error) {
      this._log(`Error reading config: ${error.message}`, 'error');
      throw new Error(`Failed to read configuration: ${error.message}`);
    }
  }

  /**
   * Get channel role name from enum value
   */
  _getChannelRoleName(role) {
    const roles = {
      0: 'DISABLED',
      1: 'PRIMARY',
      2: 'SECONDARY',
    };
    if (typeof role === 'string') return role;
    return roles[role] || `UNKNOWN(${role})`;
  }

  /**
   * Format PSK bytes for display (hex string)
   */
  _formatPskForDisplay(psk) {
    if (!psk || psk.length === 0) return '(none)';
    if (psk.length === 1 && psk[0] === 0) return '(none)';
    if (psk.length === 1 && psk[0] === 1) return '(default)';
    // Show first 4 and last 4 bytes for longer keys
    const bytes = Array.from(psk);
    if (bytes.length <= 8) {
      return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    const first = bytes.slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join('');
    const last = bytes.slice(-4).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${first}...${last}`;
  }

  /**
   * Get device role name from enum value
   */
  _getDeviceRoleName(role) {
    const roles = {
      0: 'CLIENT',
      1: 'CLIENT_MUTE',
      2: 'ROUTER',
      3: 'ROUTER_CLIENT',
      4: 'REPEATER',
      5: 'TRACKER',
      6: 'SENSOR',
      7: 'TAK',
      8: 'CLIENT_HIDDEN',
      9: 'LOST_AND_FOUND',
      10: 'TAK_TRACKER',
    };
    return roles[role] || `UNKNOWN(${role})`;
  }

  /**
   * Get region name from enum value
   */
  _getRegionName(region) {
    const regions = {
      0: 'UNSET',
      1: 'US',
      2: 'EU_433',
      3: 'EU_868',
      4: 'CN',
      5: 'JP',
      6: 'ANZ',
      7: 'KR',
      8: 'TW',
      9: 'RU',
      10: 'IN',
      11: 'NZ_865',
      12: 'TH',
      13: 'LORA_24',
      14: 'UA_433',
      15: 'UA_868',
      16: 'MY_433',
      17: 'MY_919',
      18: 'SG_923',
    };
    return regions[region] || `UNKNOWN(${region})`;
  }

  /**
   * Get modem preset name from enum value
   */
  _getModemPresetName(preset) {
    const presets = {
      0: 'LONG_FAST',
      1: 'LONG_SLOW',
      2: 'VERY_LONG_SLOW',
      3: 'MEDIUM_SLOW',
      4: 'MEDIUM_FAST',
      5: 'SHORT_SLOW',
      6: 'SHORT_FAST',
      7: 'LONG_MODERATE',
    };
    return presets[preset] || `UNKNOWN(${preset})`;
  }

  /**
   * Get hardware model name from enum value
   * Based on Meshtastic HardwareModel protobuf enum
   */
  _getHardwareModelName(hwModel) {
    const models = {
      0: 'UNSET',
      1: 'TLORA_V2',
      2: 'TLORA_V1',
      3: 'TLORA_V2_1_1P6',
      4: 'TBEAM',
      5: 'HELTEC_V2_0',
      6: 'TBEAM_V0P7',
      7: 'T_ECHO',
      8: 'TLORA_V1_1P3',
      9: 'RAK4631',
      10: 'HELTEC_V2_1',
      11: 'HELTEC_V1',
      12: 'LILYGO_TBEAM_S3_CORE',
      13: 'RAK11200',
      14: 'NANO_G1',
      15: 'TLORA_V2_1_1P8',
      16: 'TLORA_T3_S3',
      17: 'NANO_G1_EXPLORER',
      18: 'NANO_G2_ULTRA',
      19: 'LORA_TYPE',
      20: 'WIPHONE',
      21: 'WIO_WM1110',
      22: 'RAK2560',
      23: 'HELTEC_HRU_3601',
      25: 'STATION_G1',
      26: 'RAK11310',
      27: 'SENSELORA_RP2040',
      28: 'SENSELORA_S3',
      29: 'CANARYONE',
      30: 'RP2040_LORA',
      31: 'STATION_G2',
      32: 'LORA_RELAY_V1',
      33: 'NRF52840DK',
      34: 'PPR',
      35: 'GENIEBLOCKS',
      36: 'NRF52_UNKNOWN',
      37: 'PORTDUINO',
      38: 'ANDROID_SIM',
      39: 'DIY_V1',
      40: 'NRF52840_PCA10059',
      41: 'DR_DEV',
      42: 'M5STACK',
      43: 'HELTEC_V3',
      44: 'HELTEC_WSL_V3',
      45: 'BETAFPV_2400_TX',
      46: 'BETAFPV_900_NANO_TX',
      47: 'RPI_PICO',
      48: 'HELTEC_WIRELESS_TRACKER',
      49: 'HELTEC_WIRELESS_PAPER',
      50: 'T_DECK',
      51: 'T_WATCH_S3',
      52: 'PICOMPUTER_S3',
      53: 'HELTEC_HT62',
      54: 'EBYTE_ESP32_S3',
      55: 'ESP32_S3_PICO',
      56: 'CHATTER_2',
      57: 'HELTEC_WIRELESS_PAPER_V1_0',
      58: 'HELTEC_WIRELESS_TRACKER_V1_0',
      59: 'UNPHONE',
      60: 'TD_LORAC',
      61: 'CDEBYTE_EORA_S3',
      62: 'TWC_MESH_V4',
      63: 'NRF52_PROMICRO_DIY',
      64: 'RADIOMASTER_900_BANDIT_NANO',
      65: 'HELTEC_CAPSULE_SENSOR_V3',
      66: 'HELTEC_VISION_MASTER_T190',
      67: 'HELTEC_VISION_MASTER_E213',
      68: 'HELTEC_VISION_MASTER_E290',
      69: 'HELTEC_MESH_NODE_T114',
      70: 'SENSECAP_INDICATOR',
      71: 'TRACKER_T1000_E',
      72: 'RAK3172',
      73: 'WIO_E5',
      74: 'RADIOMASTER_900_BANDIT',
      75: 'ME25LS01_4Y10TD',
      76: 'RP2040_FEATHER_RFM95',
      77: 'M5STACK_COREBASIC',
      78: 'M5STACK_CORE2',
      79: 'RPI_PICO2',
      80: 'M5STACK_CORES3',
      81: 'SEEED_XIAO_S3',
      82: 'MS24SF1',
      83: 'TLORA_C6',
      84: 'WISMESH_TAP',
      85: 'ROUTASTIC',
      86: 'MESHLINK',
      87: 'MESHLINK_GSM',
      88: 'RAK_WISMESHTAP',
      89: 'HELTEC_ESP32C3',
      90: 'MESH_T_PHONE',
      91: 'HELTEC_HT62_V2',
      92: 'CROWPANEL_ESP32S3_LORA',
      93: 'ROUTASTIC_ROUTERV2',
      94: 'ROUTASTIC_ROUTERV3',
      95: 'HELTEC_MESH_NODE_T114_V2',
      96: 'HELTEC_CAPSULE_SENSOR_V3_2',
      97: 'WISMESH_POCKET',
      98: 'WISMESH_HUB',
      99: 'TRACKER_T1000_C',
      253: 'PRIVATE_HW',
    };
    if (typeof hwModel === 'string') return hwModel;
    return models[hwModel] || `UNKNOWN(${hwModel})`;
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
    const totalSteps = channels.length + (yamlConfig ? 1 : 0) + 3; // begin + channels + yaml + owner + commit
    let currentStep = 0;

    try {
      // Step 1: Open edit transaction BEFORE any changes.
      // This tells the firmware to defer all saves/reboots until commitEditSettings().
      // Without this, setChannel or setConfig may trigger an immediate reboot.
      this._updateProgress(++currentStep, totalSteps, 'Opening settings transaction...');
      this._log('Opening edit transaction (deferring reboots until commit)...', 'info');
      await this.device.beginEditSettings();
      await this._delay(1000); // Give firmware time to enter edit mode
      this._log('Edit transaction open, pendingSettingsChanges=' + this.device.pendingSettingsChanges, 'info');

      // Step 2: Set owner info
      this._updateProgress(++currentStep, totalSteps, 'Setting owner info...');
      this._log('Setting owner info...', 'info');
      await this._setOwnerInfo(radio);
      this._log('Owner info set', 'success');

      // Step 3+: Program channels
      for (const channel of channels) {
        this._updateProgress(++currentStep, totalSteps, `Programming channel ${channel.slot_number}: ${channel.name}...`);
        this._log(`Programming channel ${channel.slot_number}: ${channel.name}...`, 'info');
        await this._setChannel(channel);
        this._log(`Channel ${channel.slot_number} set`, 'success');
      }

      // Apply YAML config if provided
      if (yamlConfig) {
        this._updateProgress(++currentStep, totalSteps, 'Applying device configuration...');
        await this._applyYamlConfig(yamlConfig);
      }

      // FINAL STEP: Commit all pending settings and reboot.
      // This is the ONLY point where the device should reboot.
      this._updateProgress(++currentStep, totalSteps, 'Committing settings to flash (device will reboot)...');
      this._log('Committing all settings to flash (device will reboot)...', 'info');
      try {
        await this.device.commitEditSettings();
      } catch (e) {
        // Device may disconnect during commit reboot - that's expected
        this._log(`Commit completed (device rebooting): ${e.message || 'OK'}`, 'info');
      }

      // Wait for device to reboot and reconnect
      await this._waitAndReconnect();

      this._updateProgress(totalSteps, totalSteps, 'Programming complete!');
      this._updateStatus('success', 'Radio programmed successfully');

      return { success: true };
    } catch (error) {
      this._updateStatus('error', `Programming failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reboot the radio to apply configuration changes
   */
  async _rebootRadio() {
    try {
      this._log('Sending reboot command...', 'info');

      // The MeshDevice has a reboot method
      if (this.device.reboot) {
        await this.device.reboot(2); // 2 second delay before reboot
      } else if (this.device.sendCommand) {
        // Alternative: send admin command to reboot
        const adminMessage = create(Protobuf.Admin.AdminMessageSchema, {
          payloadVariant: {
            case: 'rebootSeconds',
            value: 2
          }
        });
        await this.device.sendPacket(
          adminMessage,
          Protobuf.Portnums.PortNum.ADMIN_APP,
          'self'
        );
      }

      this._log('Reboot command sent, radio will restart...', 'success');

      // Give some time for the command to be sent
      await this._delay(500);

    } catch (error) {
      this._log(`Reboot error (non-fatal): ${error.message}`, 'warn');
      // Don't throw - reboot failing shouldn't fail the whole operation
      // The user can manually reboot if needed
    }

    // Always do a full cleanup after reboot attempt to release the port
    try {
      this._log('Releasing serial port...', 'info');
      await this.disconnect();
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  /**
   * Wait for device to reboot after commitEditSettings, then reconnect.
   * After a reboot the serial port streams close, so we need to re-open the port
   * and create a fresh transport + device.
   */
  async _waitAndReconnect() {
    this._log('Waiting for device to reboot...', 'info');

    // Save the port reference before cleanup
    const port = this.transport?.connection || this.lastPort;

    if (!port) {
      this._log('No port reference available for reconnect', 'warn');
      try { await this.disconnect(); } catch (e) { /* ignore */ }
      return;
    }

    // Clean up old connection without releasing port
    try {
      if (this.transport) {
        this.transport.abortController?.abort();
        if (this.transport.pipePromise) await this.transport.pipePromise.catch(() => {});
      }
    } catch (e) { /* ignore */ }

    // Wait for the device to fully reboot
    await this._delay(3000);

    // Try to close and re-open the port
    let reconnected = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        this._log(`Reconnect attempt ${attempt}/5...`, 'info');

        // Close the port if it's still open
        try {
          if (port.readable || port.writable) {
            await port.close();
          }
        } catch (e) {
          // May already be closed
        }

        await this._delay(1000);

        // Re-open the port
        await port.open({ baudRate: 115200 });
        this._log('Serial port re-opened', 'success');

        // Create new transport from the re-opened port
        this.transport = new TransportWebSerial(port);
        this.lastPort = port;

        // Create new MeshDevice with new transport
        this.device = new MeshDevice(this.transport);

        // Re-subscribe to status events (minimal - just for tracking)
        this.device.events.onDeviceStatus.subscribe((status) => {
          let statusValue = status;
          if (typeof status === 'object' && status !== null) {
            statusValue = status.status !== undefined ? status.status : status;
          }
          const connectedValue = Types.DeviceStatusEnum?.DeviceConnected ?? 2;
          const disconnectedValue = Types.DeviceStatusEnum?.DeviceDisconnected ?? 0;
          if (statusValue === connectedValue) this.isConnected = true;
          else if (statusValue === disconnectedValue) this.isConnected = false;
        });

        // Configure the device (syncs state)
        this._log('Re-syncing device state...', 'info');
        await this.device.configure();
        await this._delay(2000);

        this.isConnected = true;
        reconnected = true;
        this._log('Device reconnected and synced successfully', 'success');
        break;
      } catch (e) {
        this._log(`Reconnect attempt ${attempt}/5 failed: ${e.message}`, 'warn');
        await this._delay(2000);
      }
    }

    if (!reconnected) {
      this._log('Could not reconnect after reboot - settings were saved to flash', 'warn');
      this._log('The radio will use the new settings on next power-on', 'info');
      // Clean up
      this.device = null;
      this.transport = null;
      this.isConnected = false;
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
   * The YAML config should be a Meshtastic-compatible device config.
   * Supports both flat format (lora: ...) and wrapped format (config: lora: ...).
   */
  async _applyYamlConfig(yamlConfig) {
    if (!yamlConfig || yamlConfig.trim() === '') {
      this._log('No YAML config to apply', 'warn');
      return;
    }

    try {
      const parsed = this._parseYamlConfig(yamlConfig);

      this._log(`Parsed YAML keys: ${Object.keys(parsed).join(', ')}`, 'info');

      // Unwrap config: wrapper if present (Meshtastic export format)
      let configSections = {};
      let moduleConfigSections = {};

      if (parsed.config && typeof parsed.config === 'object') {
        configSections = parsed.config;
      }
      if (parsed.module_config && typeof parsed.module_config === 'object') {
        moduleConfigSections = parsed.module_config;
      }

      // Also support flat format (sections at top level without config: wrapper)
      const knownConfigSections = ['device', 'position', 'power', 'network', 'display', 'lora', 'bluetooth', 'security'];
      const knownModuleSections = ['mqtt', 'serial', 'externalNotification', 'rangeTest', 'telemetry',
        'cannedMessage', 'ambientLighting', 'detectionSensor', 'audio', 'remoteHardware',
        'neighborInfo', 'storeForward', 'paxcounter'];
      for (const key of Object.keys(parsed)) {
        if (key === 'config' || key === 'module_config') continue;
        // Convert snake_case section names to camelCase for matching
        const camelKey = this._snakeToCamel(key);
        if (knownConfigSections.includes(camelKey) && typeof parsed[key] === 'object') configSections[camelKey] = parsed[key];
        else if (knownModuleSections.includes(camelKey) && typeof parsed[key] === 'object') moduleConfigSections[camelKey] = parsed[key];
      }

      // Convert any snake_case section names within config/module_config wrappers to camelCase
      // (e.g., external_notification → externalNotification, store_forward → storeForward)
      const convertedConfigSections = {};
      for (const [key, value] of Object.entries(configSections)) {
        convertedConfigSections[this._snakeToCamel(key)] = value;
      }
      configSections = convertedConfigSections;

      const convertedModuleSections = {};
      for (const [key, value] of Object.entries(moduleConfigSections)) {
        convertedModuleSections[this._snakeToCamel(key)] = value;
      }
      moduleConfigSections = convertedModuleSections;

      this._log(`Config sections: ${Object.keys(configSections).join(', ') || '(none)'}`, 'info');
      if (Object.keys(moduleConfigSections).length > 0) {
        this._log(`Module config sections: ${Object.keys(moduleConfigSections).join(', ')}`, 'info');
      }

      // Apply config sections via setConfig()
      // Send security last since it can be disruptive
      const configOrder = Object.keys(configSections).sort((a, b) => {
        if (a === 'security') return 1;
        if (b === 'security') return -1;
        return 0;
      });

      for (const section of configOrder) {
        const values = configSections[section];
        if (typeof values !== 'object' || values === null || Array.isArray(values)) {
          if (Array.isArray(values)) this._log(`Skipping config.${section}: unexpected array value`, 'warn');
          continue;
        }
        this._log(`Applying config.${section}...`, 'info');
        try {
          await this._setConfigSection(section, values);
        } catch (e) {
          this._log(`Error applying config.${section}: ${e.message}`, 'error');
        }
      }

      // Apply module config sections via setModuleConfig()
      for (const [section, values] of Object.entries(moduleConfigSections)) {
        if (typeof values !== 'object' || values === null || Array.isArray(values)) {
          if (Array.isArray(values)) this._log(`Skipping module_config.${section}: unexpected array value`, 'warn');
          continue;
        }
        this._log(`Applying module_config.${section}...`, 'info');
        try {
          await this._setModuleConfigSection(section, values);
        } catch (e) {
          this._log(`Error applying module_config.${section}: ${e.message}`, 'error');
        }
      }

      this._log('All config sections applied successfully', 'success');
    } catch (error) {
      this._log(`Error applying YAML config: ${error.message}`, 'error');
      throw new Error(`Failed to apply config: ${error.message}`);
    }
  }

  /**
   * Parse Meshtastic YAML config into a nested object.
   * Handles indentation-based nesting, arrays (- item), and base64: values.
   */
  _parseYamlConfig(yamlString) {
    const root = {};
    const stack = [{ indent: -1, obj: root }];

    for (const line of yamlString.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const indent = line.search(/\S/);

      // Handle array items (- value)
      if (trimmed.startsWith('- ')) {
        const itemValue = trimmed.slice(2).trim();
        // Use > (not >=) so we don't pop entries at the same indent level -
        // array items at the same indent as their parent key still belong to that key.
        while (stack.length > 1 && stack[stack.length - 1].indent > indent) stack.pop();
        const parent = stack[stack.length - 1];

        // Find the key this array belongs to
        if (parent.lastKey && parent.obj[parent.lastKey] !== undefined) {
          // Normal case: add to the last assigned key's value
          if (!Array.isArray(parent.obj[parent.lastKey])) parent.obj[parent.lastKey] = [];
          parent.obj[parent.lastKey].push(this._parseYamlValue(itemValue));
        } else if (parent.parentKey) {
          // Parent was a section header (e.g., admin_key:) with no value assignments yet.
          // The array items should become the value of that key in the grandparent.
          const grandparent = stack.length > 1 ? stack[stack.length - 2] : null;
          if (grandparent && grandparent.obj[parent.parentKey] !== undefined) {
            if (!Array.isArray(grandparent.obj[parent.parentKey])) {
              grandparent.obj[parent.parentKey] = [];
            }
            grandparent.obj[parent.parentKey].push(this._parseYamlValue(itemValue));
          }
        }
        continue;
      }

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;

      const key = trimmed.slice(0, colonIndex).trim();
      const rawValue = trimmed.slice(colonIndex + 1).trim();

      // Pop stack to correct nesting level
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();

      const parent = stack[stack.length - 1].obj;

      if (rawValue === '') {
        // Section header (could be an object or could become an array if followed by - items)
        const newObj = {};
        parent[key] = newObj;
        stack.push({ indent, obj: newObj, lastKey: null, parentKey: key });
      } else {
        parent[key] = this._parseYamlValue(rawValue);
        stack[stack.length - 1].lastKey = key;
      }
    }

    return root;
  }

  /**
   * Convert snake_case keys to camelCase (protobuf convention).
   * Meshtastic YAML exports use snake_case (e.g., hop_limit, tx_enabled)
   * but @bufbuild/protobuf v2 expects camelCase (hopLimit, txEnabled).
   */
  _snakeToCamel(str) {
    return str.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
  }

  /**
   * Convert all keys in an object from snake_case to camelCase (shallow).
   */
  _convertKeysToCamelCase(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || obj instanceof Uint8Array) {
      return obj;
    }
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = this._snakeToCamel(key);
      // Recursively convert nested objects (but not arrays or Uint8Array)
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Uint8Array)) {
        result[camelKey] = this._convertKeysToCamelCase(value);
      } else {
        result[camelKey] = value;
      }
    }
    return result;
  }

  /**
   * Parse a single YAML value into the appropriate JS type
   */
  _parseYamlValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null' || value === '~') return null;
    if (value.startsWith('base64:')) {
      try {
        const b64 = value.slice(7);
        return new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)));
      } catch (e) { return value; }
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    if (value !== '' && !isNaN(value)) return Number(value);
    return value;
  }

  /**
   * Resolve enum values from string names
   */
  _resolveEnumValue(enumObj, value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      if (enumObj[value] !== undefined) return enumObj[value];
      if (enumObj[value.toUpperCase()] !== undefined) return enumObj[value.toUpperCase()];
    }
    return value;
  }

  /**
   * Resolve known enum fields in a config object
   */
  _resolveEnums(section, configObj) {
    const enumMap = {
      'device.role': Protobuf.Config.Config_DeviceConfig_Role,
      'device.rebroadcastMode': Protobuf.Config.Config_DeviceConfig_RebroadcastMode,
      'position.gpsMode': Protobuf.Config.Config_PositionConfig_GpsMode,
      'lora.region': Protobuf.Config.Config_LoRaConfig_RegionCode,
      'lora.modemPreset': Protobuf.Config.Config_LoRaConfig_ModemPreset,
      'bluetooth.mode': Protobuf.Config.Config_BluetoothConfig_PairingMode,
      'detectionSensor.detectionTriggerType': Protobuf.ModuleConfig.ModuleConfig_DetectionSensorConfig_TriggerType,
    };
    for (const [key, val] of Object.entries(configObj)) {
      const enumKey = `${section}.${key}`;
      if (enumMap[enumKey] && typeof val === 'string') {
        configObj[key] = this._resolveEnumValue(enumMap[enumKey], val);
      }
    }
    return configObj;
  }

  /**
   * Apply a config section via device.setConfig()
   */
  async _setConfigSection(section, values) {
    const schemaMap = {
      device: Protobuf.Config.Config_DeviceConfigSchema,
      position: Protobuf.Config.Config_PositionConfigSchema,
      power: Protobuf.Config.Config_PowerConfigSchema,
      network: Protobuf.Config.Config_NetworkConfigSchema,
      display: Protobuf.Config.Config_DisplayConfigSchema,
      lora: Protobuf.Config.Config_LoRaConfigSchema,
      bluetooth: Protobuf.Config.Config_BluetoothConfigSchema,
      security: Protobuf.Config.Config_SecurityConfigSchema,
    };

    const schema = schemaMap[section];
    if (!schema) {
      this._log(`Unknown config section: ${section}, skipping`, 'warn');
      return;
    }

    // Convert snake_case keys from YAML to camelCase for protobuf
    const configObj = this._convertKeysToCamelCase(values);
    this._resolveEnums(section, configObj);

    // Security section: skip PKI keys (publicKey, privateKey, adminKey) -
    // these are per-device identity and shouldn't be overwritten from a template
    if (section === 'security') {
      const skippedKeys = [];
      for (const key of ['publicKey', 'privateKey', 'adminKey']) {
        if (key in configObj) {
          skippedKeys.push(key);
          delete configObj[key];
        }
      }
      if (skippedKeys.length > 0) {
        this._log(`  Skipping device-specific security fields: ${skippedKeys.join(', ')}`, 'info');
      }
    }

    // Remove empty objects (e.g., {} from empty YAML sections) that would cause protobuf issues
    for (const [key, val] of Object.entries(configObj)) {
      if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Uint8Array) && Object.keys(val).length === 0) {
        delete configObj[key];
      }
    }

    this._log(`  ${section} fields: ${JSON.stringify(configObj)}`, 'info');

    if (Object.keys(configObj).length > 0) {
      const config = create(Protobuf.Config.ConfigSchema, {
        payloadVariant: {
          case: section,
          value: create(schema, configObj)
        }
      });
      await this.device.setConfig(config);
      this._log(`  ${section} config sent successfully`, 'success');
      await this._delay(300);
    } else {
      this._log(`  ${section} has no fields to apply, skipping`, 'info');
    }
  }

  /**
   * Apply a module config section via device.setModuleConfig()
   */
  async _setModuleConfigSection(section, values) {
    const schemaMap = {
      mqtt: Protobuf.ModuleConfig.ModuleConfig_MQTTConfigSchema,
      serial: Protobuf.ModuleConfig.ModuleConfig_SerialConfigSchema,
      externalNotification: Protobuf.ModuleConfig.ModuleConfig_ExternalNotificationConfigSchema,
      rangeTest: Protobuf.ModuleConfig.ModuleConfig_RangeTestConfigSchema,
      telemetry: Protobuf.ModuleConfig.ModuleConfig_TelemetryConfigSchema,
      cannedMessage: Protobuf.ModuleConfig.ModuleConfig_CannedMessageConfigSchema,
      ambientLighting: Protobuf.ModuleConfig.ModuleConfig_AmbientLightingConfigSchema,
      detectionSensor: Protobuf.ModuleConfig.ModuleConfig_DetectionSensorConfigSchema,
      audio: Protobuf.ModuleConfig.ModuleConfig_AudioConfigSchema,
      remoteHardware: Protobuf.ModuleConfig.ModuleConfig_RemoteHardwareConfigSchema,
      neighborInfo: Protobuf.ModuleConfig.ModuleConfig_NeighborInfoConfigSchema,
      storeForward: Protobuf.ModuleConfig.ModuleConfig_StoreForwardConfigSchema,
      paxcounter: Protobuf.ModuleConfig.ModuleConfig_PaxcounterConfigSchema,
    };

    const schema = schemaMap[section];
    if (!schema) {
      this._log(`Unknown module config section: ${section}, skipping`, 'warn');
      return;
    }

    // Convert snake_case keys from YAML to camelCase for protobuf
    const configObj = this._convertKeysToCamelCase(values);
    this._resolveEnums(section, configObj);

    this._log(`  ${section} fields: ${JSON.stringify(configObj)}`, 'info');

    // Remove empty objects and handle nested sub-messages
    for (const [key, val] of Object.entries(configObj)) {
      if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Uint8Array)) {
        // Remove empty objects
        if (Object.keys(val).length === 0) {
          delete configObj[key];
          continue;
        }
        // Handle known nested sub-messages (e.g., mqtt.mapReportSettings)
        const nestedSchemas = {
          'mqtt.mapReportSettings': Protobuf.ModuleConfig.ModuleConfig_MapReportSettingsSchema,
        };
        const nestedKey = `${section}.${key}`;
        if (nestedSchemas[nestedKey]) {
          configObj[key] = create(nestedSchemas[nestedKey], val);
        }
      }
    }

    if (Object.keys(configObj).length > 0) {
      // setModuleConfig doesn't call beginEditSettings automatically (unlike setConfig),
      // so ensure the edit transaction is open
      if (!this.device.pendingSettingsChanges) {
        this._log('  Opening edit transaction for module config...', 'info');
        await this.device.beginEditSettings();
        await this._delay(200);
      }

      const moduleConfig = create(Protobuf.ModuleConfig.ModuleConfigSchema, {
        payloadVariant: {
          case: section,
          value: create(schema, configObj)
        }
      });
      await this.device.setModuleConfig(moduleConfig);
      this._log(`  ${section} module config sent successfully`, 'success');
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
   * Format MAC address from bytes object like { 0: 197, 1: 253, ... } or Uint8Array
   */
  _formatMacFromBytes(macaddr) {
    if (!macaddr) return null;

    // Already formatted string
    if (typeof macaddr === 'string') {
      // Already a proper MAC format like "E5:5D:13:9B:01:22"
      if (/^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/.test(macaddr.trim())) {
        return macaddr.trim().toUpperCase();
      }
      // Check if it looks like comma-separated numbers (raw bytes as string)
      // Handle optional whitespace around commas
      const cleaned = macaddr.replace(/\s+/g, '');
      if (/^\d+,\d+,\d+,\d+,\d+,\d+/.test(cleaned)) {
        const parts = cleaned.split(',').map(n => parseInt(n, 10));
        if (parts.length >= 6) {
          return parts.slice(0, 6).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
        }
      }
      return macaddr;
    }

    // Handle Uint8Array or regular array
    if (macaddr instanceof Uint8Array || Array.isArray(macaddr)) {
      const arr = Array.from(macaddr);
      if (arr.length >= 6) {
        return arr.slice(0, 6).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
      }
    }

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

    // Fallback: try Array.from if it's array-like (has length property)
    if (macaddr.length >= 6) {
      const arr = Array.from(macaddr);
      return arr.slice(0, 6).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
    }

    // Last resort: stringify and check for comma-separated numbers
    const str = String(macaddr).replace(/\s+/g, '');
    if (/^\d+,\d+,\d+,\d+,\d+,\d+/.test(str)) {
      const parts = str.split(',').map(n => parseInt(n, 10));
      if (parts.length >= 6) {
        return parts.slice(0, 6).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
      }
    }

    // Debug: log what we couldn't parse
    console.warn('[_formatMacFromBytes] Could not parse MAC:', macaddr, typeof macaddr);
    return null;
  }
}

// Export singleton instance
export const meshtasticSerial = new MeshtasticSerialService();

// Also export the class for testing
export { MeshtasticSerialService };
