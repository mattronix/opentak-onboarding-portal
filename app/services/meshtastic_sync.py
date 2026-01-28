"""
Meshtastic OTS Sync Service

This service handles synchronization of Meshtastic configurations between
the local database and OpenTAK Server (OTS).

OTS API: /api/meshtastic/channel
- GET: List channels (filter by name, url)
- POST: Create channel (requires url, optional name)
- DELETE: Delete channel by url

Fields synced with OTS:
- url (meshtastic:// channel URL)
- name

Fields kept locally only:
- description
- yamlConfig
- isPublic
- defaultRadioConfig
- showOnHomepage
- roles
- users
"""

from datetime import datetime
from app.models import MeshtasticModel, db
from app.ots import otsClient


class MeshtasticSyncService:
    """Service for syncing Meshtastic configs with OTS"""

    @staticmethod
    def sync_from_ots():
        """
        Fetch all Meshtastic channels from OTS and sync to local database.
        Creates new records or updates existing ones based on URL.
        Returns tuple of (created_count, updated_count, errors)
        """
        created = 0
        updated = 0
        errors = []

        try:
            response = otsClient.get_meshtastic_channels()
            if response is None:
                errors.append("OTS returned no response - meshtastic endpoint may not be available")
                return created, updated, errors

            # OTS responses are double-nested: {"response": {"response": {...}}}
            inner_response = response.get('response', {})
            if isinstance(inner_response, dict):
                inner_response = inner_response.get('response', inner_response)

            # OTS returns paginated results with 'results' key
            ots_channels = inner_response.get('results', []) if isinstance(inner_response, dict) else []

            for ots_channel in ots_channels:
                try:
                    channel_url = ots_channel.get('url')
                    name = ots_channel.get('name')
                    ots_id = ots_channel.get('id')

                    if not channel_url:
                        continue

                    # Check if we already have this config by URL
                    local_config = MeshtasticModel.query.filter_by(url=channel_url).first()

                    if local_config:
                        # Update existing - only update name if OTS has one
                        if name and name != local_config.name:
                            local_config.name = name
                        local_config.ots_id = ots_id
                        local_config.synced_at = datetime.utcnow()
                        db.session.commit()
                        updated += 1
                    else:
                        # Create new
                        new_config = MeshtasticModel(
                            ots_id=ots_id,
                            name=name or f"Channel {ots_id}",
                            url=channel_url,
                            synced_at=datetime.utcnow(),
                            isPublic=False,
                            showOnHomepage=False
                        )
                        db.session.add(new_config)
                        db.session.commit()
                        created += 1

                except Exception as e:
                    errors.append(f"Error syncing channel {ots_channel.get('name', 'unknown')}: {str(e)}")
                    db.session.rollback()

        except AttributeError as e:
            # This happens when OTS returns non-JSON response (e.g., 404 page)
            errors.append("OTS does not support Meshtastic sync (endpoint not available)")
        except Exception as e:
            error_msg = str(e)
            if "'NoneType'" in error_msg or "404" in error_msg:
                errors.append("OTS does not support Meshtastic sync (endpoint not available)")
            else:
                errors.append(f"Error fetching from OTS: {error_msg}")

        return created, updated, errors

    @staticmethod
    def is_valid_meshtastic_url(url):
        """
        Validate that a URL is a valid meshtastic:// channel configuration URL.
        Valid URLs start with 'meshtastic://' or 'https://meshtastic.org/e/#'
        """
        if not url:
            return False
        url_lower = url.lower().strip()
        return (url_lower.startswith('meshtastic://') or
                url_lower.startswith('https://meshtastic.org/e/#'))

    @staticmethod
    def push_to_ots(local_config):
        """
        Push a local Meshtastic config to OTS.
        Creates new channel in OTS using the meshtastic:// URL.
        Returns (success, error_message)
        """
        if not local_config.url:
            return False, "Cannot sync to OTS without a channel URL"

        if not MeshtasticSyncService.is_valid_meshtastic_url(local_config.url):
            return False, "Invalid URL format. Must be a meshtastic:// or https://meshtastic.org/e/# URL from the Meshtastic app"

        try:
            # OTS creates channels by URL - it doesn't support update, only create/delete
            response = otsClient.create_meshtastic_channel(
                url=local_config.url,
                name=local_config.name
            )
            if response is None:
                return False, "OTS does not support Meshtastic sync (endpoint not available)"

            # Get the response
            inner_response = response.get('response', {})
            if isinstance(inner_response, dict):
                inner_response = inner_response.get('response', inner_response)

            # Check for success
            if inner_response.get('success'):
                # Update name from OTS response if available
                ots_name = inner_response.get('name')
                if ots_name and ots_name != local_config.name:
                    local_config.name = ots_name
                # Update ots_id if returned
                ots_id = inner_response.get('id')
                if ots_id:
                    local_config.ots_id = ots_id
                local_config.synced_at = datetime.utcnow()
                db.session.commit()
                return True, None
            else:
                return False, inner_response.get('error', 'Unknown error from OTS')

        except AttributeError as e:
            # This happens when OTS returns non-JSON response (e.g., 404 page)
            db.session.rollback()
            return False, "OTS does not support Meshtastic sync (endpoint not available)"
        except Exception as e:
            db.session.rollback()
            error_msg = str(e)
            # Check for common OTS errors
            if "'NoneType'" in error_msg or "404" in error_msg:
                return False, "OTS does not support Meshtastic sync (endpoint not available)"
            # Try to extract error from OTS response dict
            if "'error':" in error_msg and "'success': False" in error_msg:
                # Parse OTS error response
                import re
                match = re.search(r"'error':\s*['\"]([^'\"]+)['\"]", error_msg)
                if match:
                    return False, f"OTS error: {match.group(1)}"
            return False, error_msg

    @staticmethod
    def delete_from_ots(channel_url):
        """
        Delete a Meshtastic channel from OTS by URL.
        Returns (success, error_message)
        """
        if not channel_url:
            return False, "No URL to delete from OTS"

        try:
            otsClient.delete_meshtastic_channel(channel_url)
            return True, None
        except AttributeError:
            return False, "OTS does not support Meshtastic sync (endpoint not available)"
        except Exception as e:
            error_msg = str(e)
            if "'NoneType'" in error_msg or "404" in error_msg:
                return False, "OTS does not support Meshtastic sync (endpoint not available)"
            return False, error_msg

    @staticmethod
    def create_config(name, url, description=None, yaml_config=None, is_public=True,
                      default_radio_config=False, show_on_homepage=True, roles=None,
                      users=None, sync_to_ots=True):
        """
        Create a new Meshtastic config locally and optionally sync to OTS.
        Returns (config, error_message)
        """
        try:
            # Create locally first
            config = MeshtasticModel(
                name=name,
                description=description,
                url=url,
                yamlConfig=yaml_config,
                isPublic=is_public,
                defaultRadioConfig=default_radio_config,
                showOnHomepage=show_on_homepage,
                roles=roles or [],
                users=users or []
            )
            db.session.add(config)
            db.session.commit()

            # Sync to OTS if requested and url is provided
            if sync_to_ots and url:
                success, error = MeshtasticSyncService.push_to_ots(config)
                if not success:
                    # Config created locally but OTS sync failed
                    return config, f"Created locally but OTS sync failed: {error}"

            return config, None

        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def update_config(config_id, name=None, url=None, description=None, yaml_config=None,
                      is_public=None, default_radio_config=None, show_on_homepage=None,
                      roles=None, users=None, sync_to_ots=True):
        """
        Update an existing Meshtastic config and optionally sync to OTS.
        Returns (config, error_message)
        """
        config = MeshtasticModel.get_by_id(config_id)
        if not config:
            return None, "Config not found"

        try:
            # Track if OTS-synced fields changed
            ots_fields_changed = False

            if name is not None and name != config.name:
                config.name = name
                ots_fields_changed = True
            if url is not None and url != config.url:
                config.url = url
                ots_fields_changed = True
            if description is not None and description != config.description:
                config.description = description
                ots_fields_changed = True

            # Local-only fields
            if yaml_config is not None:
                config.yamlConfig = yaml_config
            if is_public is not None:
                config.isPublic = is_public
            if default_radio_config is not None:
                config.defaultRadioConfig = default_radio_config
            if show_on_homepage is not None:
                config.showOnHomepage = show_on_homepage
            if roles is not None:
                config.roles = roles
            if users is not None:
                config.users = users

            db.session.commit()

            # Sync to OTS if OTS-synced fields changed and url exists
            if sync_to_ots and ots_fields_changed and config.url:
                success, error = MeshtasticSyncService.push_to_ots(config)
                if not success:
                    return config, f"Updated locally but OTS sync failed: {error}"

            return config, None

        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def delete_config(config_id, delete_from_ots=True):
        """
        Delete a Meshtastic config locally and optionally from OTS.
        Returns (success, error_message)
        """
        config = MeshtasticModel.get_by_id(config_id)
        if not config:
            return False, "Config not found"

        try:
            channel_url = config.url
            was_synced = config.synced_at is not None

            # Delete locally
            db.session.delete(config)
            db.session.commit()

            # Delete from OTS if it was synced and has a URL
            if delete_from_ots and was_synced and channel_url:
                success, error = MeshtasticSyncService.delete_from_ots(channel_url)
                if not success:
                    return True, f"Deleted locally but OTS deletion failed: {error}"

            return True, None

        except Exception as e:
            db.session.rollback()
            return False, str(e)


# Convenience instance
meshtastic_sync = MeshtasticSyncService()
