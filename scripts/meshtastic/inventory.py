import time
from serial.tools import list_ports
import meshtastic
import meshtastic.serial_interface

def get_serial_devices():
    """Get a list of connected serial devices."""
    return {port.device for port in list_ports.comports()}

def get_meshtastic_info(port):
    """Get Meshtastic device info using the Meshtastic Python library."""
    try:
        interface = meshtastic.serial_interface.SerialInterface(port)
        device_info = interface.getMyNodeInfo()
        interface.close()
        return device_info
    except Exception as e:
        print(f"Error accessing Meshtastic device on port {port}: {e}")
        return None

def main():
    print("Monitoring for new serial devices...")
    known_devices = get_serial_devices()

    while True:
        time.sleep(1)  # Poll every 2 seconds
        print("Checking for new devices...")
        current_devices = get_serial_devices()
        new_devices = current_devices - known_devices

        if new_devices:
            for device in new_devices:
                print(f"New serial device detected: {device}")
                info = get_meshtastic_info(device)
                if info:
                    print(f"Meshtastic info for {device}:")
                    for key, value in info.items():
                        print(f"{key} = {value}")

                    print(f'macaddr = {info["user"]["macaddr"]}')
        
        known_devices = current_devices
        
if __name__ == "__main__":
    main()
