import time
import meshtastic
import meshtastic.serial_interface
from meshtastic.util import (
    active_ports_on_supported_devices,
    detect_supported_devices,
    get_unique_vendor_ids,
)
from google.protobuf.json_format import MessageToDict
from meshtastic import mt_config
import json

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

def parse_config(interface) -> str:
    """used in --export-config"""
    configObj = {}

    owner = interface.getLongName()
    owner_short = interface.getShortName()
    channel_url = interface.localNode.getURL()
    myinfo = interface.getMyNodeInfo()
    pos = myinfo.get("position")
    lat = None
    lon = None
    alt = None
    if pos:
        lat = pos.get("latitude")
        lon = pos.get("longitude")
        alt = pos.get("altitude")

    if owner:
        configObj["owner"] = owner
    if owner_short:
        configObj["owner_short"] = owner_short
    if channel_url:
        if mt_config.camel_case:
            configObj["channelUrl"] = channel_url
        else:
            configObj["channel_url"] = channel_url
    # lat and lon don't make much sense without the other (so fill with 0s), and alt isn't meaningful without both
    if lat or lon:
        configObj["location"] = {"lat": lat or float(0), "lon": lon or float(0)}
        if alt:
            configObj["location"]["alt"] = alt

    config = MessageToDict(interface.localNode.localConfig)	#checkme - Used as a dictionary here and a string below
    if config:
        # Convert inner keys to correct snake/camelCase
        prefs = {}
        for pref in config:
            if mt_config.camel_case:
                prefs[meshtastic.util.snake_to_camel(pref)] = config[pref]
            else:
                prefs[pref] = config[pref]
        if mt_config.camel_case:
            configObj["config"] = config		#Identical command here and 2 lines below?
        else:
            configObj["config"] = config

    module_config = MessageToDict(interface.localNode.moduleConfig)
    if module_config:
        # Convert inner keys to correct snake/camelCase
        prefs = {}
        for pref in module_config:
            if len(module_config[pref]) > 0:
                prefs[pref] = module_config[pref]
        if mt_config.camel_case:
            configObj["module_config"] = prefs
        else:
            configObj["module_config"] = prefs


    json.dumps(configObj)
    return configObj


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
                config = parse_config(meshtastic_interface)
                if config:
                    print(f"Device config for {device}:")
                    print(config)
                    print("-----------------------")
                    print("Device info:")
                    print(meshtastic_interface.getMyNodeInfo())
                    print("-----------------------")
                meshtastic_interface.close()

        known_devices = current_devices
        
if __name__ == "__main__":
    main()
