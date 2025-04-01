import time
import meshtastic
import meshtastic.serial_interface
from meshtastic.util import (
    active_ports_on_supported_devices,
    detect_supported_devices,
    get_unique_vendor_ids,
    pskToString,
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
                meshtastic_node = meshtastic_interface.getNode('^local')
                print(f"Meshtastic localConfig for {device}:")
                print(meshtastic_node.localConfig)
                print("-----------------------")
                print(f"Meshtastic moduleConfig for {device}:")
                print(meshtastic_node.moduleConfig)
                print("-----------------------")
                print(f"Meshtastic channels for {device}:")
                print(meshtastic_node.channels)
                print("-----------------------")

                print(meshtastic_node.localConfig.security)
                print(f"Parsed PSK: {pskToString(meshtastic_node.localConfig.security.private_key)}")
                
                print(f"Parsed Channel PSK: {pskToString(meshtastic_node.channels[0].settings.psk)}")
                meshtastic_interface.close()

        known_devices = current_devices
        
if __name__ == "__main__":
    main()
