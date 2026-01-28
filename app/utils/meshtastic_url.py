"""
Meshtastic URL utility functions for combining channel URLs.
"""

import base64
import logging
from urllib.parse import unquote

logger = logging.getLogger(__name__)


def parse_meshtastic_url(url):
    """
    Parse a Meshtastic URL and extract the base64-encoded channel data.

    URL format: https://meshtastic.org/e/#base64_data

    Returns the base64 data string or None if invalid.
    """
    if not url:
        return None

    try:
        # Handle both meshtastic.org/e/# and meshtastic.org/d/# formats
        if '#' in url:
            return url.split('#')[1]
        return None
    except Exception as e:
        logger.error(f"Error parsing meshtastic URL: {e}")
        return None


def generate_combined_url(channels):
    """
    Generate a combined Meshtastic URL from multiple channel configurations.

    Each channel should have a 'url' and 'slot_number' attribute.
    The channels' URLs contain individual channel configs that need to be
    combined into a single multi-channel URL.

    For now, uses the primary channel (slot 0) URL as the base since
    proper URL combining requires protobuf manipulation.

    Args:
        channels: List of channel objects with url and slot_number attributes

    Returns:
        Combined URL string or None if no valid channels
    """
    if not channels:
        return None

    # Sort channels by slot number
    sorted_channels = sorted(
        [c for c in channels if c.url and c.slot_number is not None],
        key=lambda x: x.slot_number
    )

    if not sorted_channels:
        return None

    # Try to use the meshtastic library for proper URL combining
    try:
        from meshtastic.protobuf import channel_pb2, apponly_pb2

        combined_set = apponly_pb2.ChannelSet()
        lora_config = None

        for channel in sorted_channels:
            base64_data = parse_meshtastic_url(channel.url)
            if not base64_data:
                continue

            try:
                # Decode the URL data
                padded = base64_data + '=' * (4 - len(base64_data) % 4) if len(base64_data) % 4 else base64_data
                decoded = base64.urlsafe_b64decode(padded)

                # Parse as ChannelSet
                channel_set = apponly_pb2.ChannelSet()
                channel_set.ParseFromString(decoded)

                # Get LoRa config from first channel (they should all be the same)
                if lora_config is None and channel_set.HasField('lora_config'):
                    lora_config = channel_set.lora_config

                # Add each channel from this URL
                for i, ch_settings in enumerate(channel_set.settings):
                    # Create a new channel with the correct slot number
                    new_channel = combined_set.settings.add()
                    new_channel.CopyFrom(ch_settings)

            except Exception as e:
                logger.warning(f"Error parsing channel URL for slot {channel.slot_number}: {e}")
                continue

        # Apply LoRa config if we found one
        if lora_config:
            combined_set.lora_config.CopyFrom(lora_config)

        if combined_set.settings:
            # Serialize and encode
            serialized = combined_set.SerializeToString()
            encoded = base64.urlsafe_b64encode(serialized).decode('utf-8').rstrip('=')
            return f"https://meshtastic.org/e/#{encoded}"

    except ImportError:
        logger.warning("meshtastic library not available, using fallback URL generation")
    except Exception as e:
        logger.error(f"Error generating combined URL with meshtastic library: {e}")

    # Fallback: return the primary channel URL if we can't combine properly
    primary = next((c for c in sorted_channels if c.slot_number == 0), None)
    if primary:
        return primary.url

    # If no slot 0, return the first available channel URL
    return sorted_channels[0].url if sorted_channels else None


class ChannelWrapper:
    """Simple wrapper to provide url and slot_number from a membership"""
    def __init__(self, membership):
        self.url = membership.channel.url
        self.slot_number = membership.slot_number


def update_group_combined_url(group):
    """
    Update a MeshtasticChannelGroup's combined_url based on its channel memberships.

    Args:
        group: MeshtasticChannelGroup model instance

    Returns:
        The generated combined URL or None
    """
    if not group.channel_memberships:
        group.combined_url = None
        return None

    # Wrap memberships to provide url and slot_number attributes
    wrapped_channels = [ChannelWrapper(m) for m in group.channel_memberships]
    combined_url = generate_combined_url(wrapped_channels)
    group.combined_url = combined_url
    return combined_url
