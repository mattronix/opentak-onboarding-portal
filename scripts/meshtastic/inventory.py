import time
from serial.tools import list_ports
import meshtastic
import requests
import sys
import meshtastic.serial_interface
import json

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

    # HTTP Request to add the device to the database
    if len(sys.argv) < 3:
        print("Usage: python inventory.py <API_ENDPOINT> <API_KEY>")
        sys.exit(1)

    api_endpoint = sys.argv[1]
    api_key = sys.argv[2]

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

                if info['position']:
                    print("Deleting Position Info")
                    del info['position']
                if info:
                    print(f"Meshtastic info for {device}:")
                    print(info)
                    headers = {
                        "X-API-KEY": api_key,
                        "Content-Type": "application/json"
                    }

                    try:
                        # Prepare the JSON payload
                        response = requests.post(api_endpoint, json=json.dumps(info), headers=headers)
                        if response.status_code == 201:
                            print(f"Successfully added device to the database: {response.json()}")
                        if response.status_code == 200:
                            print(f"Device updated in the database: {response.json()}")
                        else:
                            print(f"Failed to add device to the database. Status code: {response.status_code}, Response: {response.text}")
                    except requests.RequestException as e:
                        print(f"Error making POST request: {e}")
                    
            
        known_devices = current_devices
        
if __name__ == "__main__":
    main()
