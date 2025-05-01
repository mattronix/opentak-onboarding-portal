# Meshtastic Admin


## YAML Config

Using the Admin you can upload YAML config some placeholders are supported to dymaincily generate values currently we support: 

longName = Radio Long Name
shortName = Radio Short Name

Example
```
owner: ${longName}
owner_short: ${shortName}
```

Set Default to Yes for now as we dont support multiple profiles yet. 



# Meshtastic API CLi 
Make sure the following is set in the ENV File
```
ENABLE_API=True
API_KEY="udi1liepuRearuyahquoo9looj0teegh" < Make sure to generate a 32 char password of your own
```
# Inventory Radio (Meshtastic)
Will inventory Radio and add to Radios Section of Portal.

Example:
```
python meshtastic-api-cli.py --url http://localhost:5000/ --apikey udi1liepuRearuyahquoo9looj0teegh  inventory
```

# Configure Radio (Meshtastic)
Will download config profile from server and flash radio.

Example
```
python meshtastic-api-cli.py --url http://localhost:5000/ --apikey udi1liepuRearuyahquoo9looj0teegh  configure
```