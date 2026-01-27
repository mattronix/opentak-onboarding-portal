import time
import json
import requests
import sys
import argparse

import yaml
from typing import List
import logging
from google.protobuf.json_format import MessageToDict
import meshtastic
import meshtastic.serial_interface
from meshtastic import mt_config
import platform

def splitCompoundName(comp_name: str) -> List[str]:
    """Split compound (dot separated) preference name into parts"""
    name: List[str] = comp_name.split(".")
    if len(name) < 2:
        name[0] = comp_name
        name.append(comp_name)
    return name

import serial.tools.list_ports

def get_serial_devices():
    """Get a list of connected serial devices on macOS, Windows, or Linux."""

    print("Scanning for connected serial devices...")
    ports = serial.tools.list_ports.comports()
    devices = set()

    for port in ports:
        if platform.system() == "Windows":
            if "COM" in port.device:
                devices.add(port.device)
                print(f"Detected Windows device: {port.device} - {port.description}")
        else:  # macOS and Linux
            if "/dev/" in port.device:
                devices.add(port.device)
                print(f"Detected Unix-based device: {port.device} - {port.description}")

    return devices

def setPref(config, comp_name, raw_val) -> bool:
    """Set a channel or preferences value"""

    name = splitCompoundName(comp_name)

    snake_name = meshtastic.util.camel_to_snake(name[-1])
    camel_name = meshtastic.util.snake_to_camel(name[-1])
    uni_name = camel_name if mt_config.camel_case else snake_name
    logging.debug(f"snake_name:{snake_name}")
    logging.debug(f"camel_name:{camel_name}")

    objDesc = config.DESCRIPTOR
    config_part = config
    config_type = objDesc.fields_by_name.get(name[0])
    if config_type and config_type.message_type is not None:
        for name_part in name[1:-1]:
            part_snake_name = meshtastic.util.camel_to_snake((name_part))
            config_part = getattr(config, config_type.name)
            config_type = config_type.message_type.fields_by_name.get(part_snake_name)
    pref = None
    if config_type and config_type.message_type is not None:
        pref = config_type.message_type.fields_by_name.get(snake_name)
    # Others like ChannelSettings are standalone
    elif config_type:
        pref = config_type

    if (not pref) or (not config_type):
        return False

    if isinstance(raw_val, str):
        val = meshtastic.util.fromStr(raw_val)
    else:
        val = raw_val
    logging.debug(f"valStr:{raw_val} val:{val}")

    if snake_name == "wifi_psk" and len(str(raw_val)) < 8:
        print("Warning: network.wifi_psk must be 8 or more characters.")
        return False

    enumType = pref.enum_type
    # pylint: disable=C0123
    if enumType and type(val) == str:
        # We've failed so far to convert this string into an enum, try to find it by reflection
        e = enumType.values_by_name.get(val)
        if e:
            val = e.number
        else:
            print(
                f"{name[0]}.{uni_name} does not have an enum called {val}, so you can not set it."
            )
            print(f"Choices in sorted order are:")
            names = []
            for f in enumType.values:
                # Note: We must use the value of the enum (regardless if camel or snake case)
                names.append(f"{f.name}")
            for temp_name in sorted(names):
                print(f"    {temp_name}")
            return False

    # repeating fields need to be handled with append, not setattr
    if pref.label != pref.LABEL_REPEATED:
        try:
            if config_type.message_type is not None:
                config_values = getattr(config_part, config_type.name)
                setattr(config_values, pref.name, val)
            else:
                setattr(config_part, snake_name, val)
        except TypeError:
            # The setter didn't like our arg type guess try again as a string
            config_values = getattr(config_part, config_type.name)
            setattr(config_values, pref.name, str(val))
    elif type(val) == list:
        new_vals = [meshtastic.util.fromStr(x) for x in val]
        config_values = getattr(config, config_type.name)
        getattr(config_values, pref.name)[:] = new_vals
    else:
        config_values = getattr(config, config_type.name)
        if val == 0:
            # clear values
            print(f"Clearing {pref.name} list")
            del getattr(config_values, pref.name)[:]
        else:
            print(f"Adding '{raw_val}' to the {pref.name} list")
            cur_vals = [x for x in getattr(config_values, pref.name) if x not in [0, "", b""]]
            cur_vals.append(val)
            getattr(config_values, pref.name)[:] = cur_vals
        return True

    prefix = f"{'.'.join(name[0:-1])}." if config_type.message_type is not None else ""
    print(f"Set {prefix}{uni_name} to {raw_val}")

    return True



def traverseConfig(config_root, config, interface_config) -> bool:
    """Iterate through current config level preferences and either traverse deeper if preference is a dict or set preference"""
    snake_name = meshtastic.util.camel_to_snake(config_root)
    for pref in config:
        pref_name = f"{snake_name}.{pref}"
        if isinstance(config[pref], dict):
            traverseConfig(pref_name, config[pref], interface_config)
        else:
            setPref(interface_config, pref_name, config[pref])

    return True


def flash_yaml(interface, file):
    configuration = yaml.safe_load(file)
    closeNow = True

    interface.getNode('^local', False).beginSettingsTransaction()

    if "owner" in configuration:
        print(f"Setting device owner to {configuration['owner']}")
        waitForAckNak = True
        interface.getNode('^local', False).setOwner(configuration["owner"])

    if "owner_short" in configuration:
        print(
            f"Setting device owner short to {configuration['owner_short']}"
        )
        waitForAckNak = True
        interface.getNode('^local', False).setOwner(
            long_name=None, short_name=configuration["owner_short"]
        )

    if "ownerShort" in configuration:
        print(
            f"Setting device owner short to {configuration['ownerShort']}"
        )
        waitForAckNak = True
        interface.getNode('^local', False).setOwner(
            long_name=None, short_name=configuration["ownerShort"]
        )

    if "channel_url" in configuration:
        print("Setting channel url to", configuration["channel_url"])
        interface.getNode('^local').setURL(configuration["channel_url"])

    if "channelUrl" in configuration:
        print("Setting channel url to", configuration["channelUrl"])
        interface.getNode('^local').setURL(configuration["channelUrl"])

    if "location" in configuration:
        alt = 0
        lat = 0.0
        lon = 0.0
        localConfig = interface.localNode.localConfig

        if "alt" in configuration["location"]:
            alt = int(configuration["location"]["alt"] or 0)
            print(f"Fixing altitude at {alt} meters")
        if "lat" in configuration["location"]:
            lat = float(configuration["location"]["lat"] or 0)
            print(f"Fixing latitude at {lat} degrees")
        if "lon" in configuration["location"]:
            lon = float(configuration["location"]["lon"] or 0)
            print(f"Fixing longitude at {lon} degrees")
        print("Setting device position")
        interface.localNode.setFixedPosition(lat, lon, alt)

    if "config" in configuration:
        localConfig = interface.getNode('^local').localConfig
        for section in configuration["config"]:
            traverseConfig(
                section, configuration["config"][section], localConfig
            )
            interface.getNode('^local').writeConfig(
                meshtastic.util.camel_to_snake(section)
            )

    if "module_config" in configuration:
        moduleConfig = interface.getNode('^local').moduleConfig
        for section in configuration["module_config"]:
            traverseConfig(
                section,
                configuration["module_config"][section],
                moduleConfig,
            )
            interface.getNode('^local').writeConfig(
                meshtastic.util.camel_to_snake(section)
            )

    interface.getNode('^local', False).commitSettingsTransaction()
    print("Writing modified configuration to device")



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



def configure(base_url, api_key):

    print("Monitoring for new serial devices...")
    known_devices = get_serial_devices()
    first_run = True
    
    while True:
        time.sleep(1)  # Poll every 2 seconds
        print("Checking for new devices...")
        if first_run:
            current_devices = known_devices
            first_run = False
        else:
            current_devices = get_serial_devices()
     
        new_devices = current_devices - known_devices


        if new_devices:
            for device in new_devices:
                print(f"New serial device detected: {device}")


                meshtastic_interface = create_meshtastic_interface(device)
                info = meshtastic_interface.getMyNodeInfo()
                
                api_endpoint = base_url + f"/api/meshtastic/config/default/{info['user']['id']}"

                headers = {
                    "X-API-KEY": api_key,
                    "Content-Type": "application/json"
                }
                try:
                    # Prepare the JSON payload
                    response = requests.get(api_endpoint, headers=headers)
                    if response.status_code == 200:
                        print(f"Config Downloaded")
                    else:
                        print(f"Failed to Download config. Status code: {response.status_code}, Response: {response.text}")
                except requests.RequestException as e:
                    print(f"Error making POST request: {e}")

                
                flash_yaml(meshtastic_interface, response.content)
                
                
                meshtastic_interface.close()

        known_devices = current_devices



def inventory(base_url, api_key):
    # HTTP Request to add the device to the database
    if len(sys.argv) < 3:
        print("Usage: python inventory.py <API_ENDPOINT> <API_KEY>")
        sys.exit(1)

    api_endpoint = base_url + "/api/radio"

    print("Monitoring for new serial devices...")
    known_devices = get_serial_devices()
    first_run = True
    while True:
        time.sleep(1)  # Poll every 2 seconds
        print("Checking for new devices...")
        if first_run:
            current_devices = known_devices
            first_run = False
        else:
            current_devices = get_serial_devices()
     
        new_devices = current_devices - known_devices

        if new_devices:
            for device in new_devices:
                print(f"New serial device detected: {device}")
                meshtastic_interface = create_meshtastic_interface(device)
                localConfig = parse_config(meshtastic_interface)
                info = meshtastic_interface.getMyNodeInfo()
                if localConfig and info:
                    print(f"Meshtastic config for {device}:")
                    headers = {
                        "X-API-KEY": api_key,
                        "Content-Type": "application/json"
                    }
                    payload = json.dumps({"localConfig": localConfig, "info" : info})
                    print(f"Payload:")
                    print(payload)
                    print("-----------------------")
                    try:
                        # Prepare the JSON payload
                        response = requests.post(api_endpoint, json=payload, headers=headers)
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
        


def debug():
    print("Monitoring for new serial devices...")
    known_devices = get_serial_devices()
    first_run = True
    while True:
        time.sleep(1)  # Poll every 2 seconds
        print("Checking for new devices...")
        if first_run:
            current_devices = known_devices
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


def main():
    parser = argparse.ArgumentParser(description="Meshtastic API Flasher and Inventory Tool")
    parser.add_argument(
        "action",
        choices=["configure", "inventory", "debug"],
        help="Choose an action to perform: 'configure' or 'inventory'."
    )
    parser.add_argument(
        "--url",
        required=True,
        help="Specify the API URL. eg: https://localhost:8000"
    )
    parser.add_argument(
        "--apikey",
        required=True,
        help="Specify the API key."
    )
    args = parser.parse_args()
    match args.action:
        case "configure":
            configure(args.url, args.apikey)
        case "inventory":
            inventory(args.url, args.apikey)
        case "debug":
            debug()

if __name__ == "__main__":
    main()
