import time
import meshtastic

import meshtastic.serial_interface
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
        meshtastic_node = interface.getNode('^local')
        return meshtastic_node
    except Exception as e:
        print(f"Error accessing Meshtastic device on port {port}: {e}")
        return None



def main():
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
               # info = get_meshtastic_info(device)
              # user = get_meshtastic_user(device)
                meshtastic_node = create_meshtastic_interface(device)

              #  if info['position']:
              #      print("Deleting Position Info")
              #      del info['position']
              #  if info:
              #      print(f"Meshtastic info for {device}:")
              #      print(info)
              #  if user:
              #      print(f"Meshtastic user for {device}:")
              #      print(user)

                print(f"Meshtastic config for {device}:")
                print(meshtastic_node.localConfig)
        known_devices = current_devices
        
if __name__ == "__main__":
    main()
