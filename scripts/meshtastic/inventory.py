import time
import meshtastic
import requests
import sys
import meshtastic.serial_interface
import json
from meshtastic.util import (
    active_ports_on_supported_devices,
    detect_supported_devices,
    get_unique_vendor_ids,
)

def get_serial_devices():
    """Get a list of connected serial devices."""

    vids = get_unique_vendor_ids()
    print(f"Searching for all devices with these vendor ids {vids}")

    sds = detect_supported_devices()
    if len(sds) > 0:
        print("Detected possible devices:")
    for d in sds:
        print(f" name:{d.name}{d.version} firmware:{d.for_firmware}")

    ports = active_ports_on_supported_devices(sds)
    return ports



def create_meshtastic_interface(port):
    """Get Meshtastic device info using the Meshtastic Python library."""
    try:
        interface = meshtastic.serial_interface.SerialInterface(port)
        return interface
    
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
    first_run = True
    while True:
        time.sleep(1)  # Poll every 2 seconds
        print("Checking for new devices...")
        if first_run:
            current_devices = set()
            first_run = False
        else:
            current_devices = get_serial_devices()
     
        new_devices = current_devices - known_devices

        if new_devices:
            for device in new_devices:
                print(f"New serial device detected: {device}")
                meshtastic_interface = create_meshtastic_interface(device)
                info = meshtastic_interface.getMyNodeInfo()

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
                    
                meshtastic_interface.close()
                
        known_devices = current_devices
        
if __name__ == "__main__":
    main()
