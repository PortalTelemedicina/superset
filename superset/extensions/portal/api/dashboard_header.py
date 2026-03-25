"""
Portal dashboard header API endpoints.

Isolated endpoint logic for dashboard header customization.
This allows the logic to be separated from core API while still
using Superset's authentication and permission system.
"""

import os
from pathlib import Path

from flask import current_app, request

from superset.extensions.portal.services.image_rehost import ImageRehostService


def upload_header_image_handler():
    """
    Handle header image upload (file uploads only, no URLs).

    This function contains the business logic for uploading header images.
    It can be called from core API endpoint or extension endpoint.

    The uploaded image is rehosted to the configured storage backend (GCP or
    local static files), and the returned URL is used directly in the dashboard
    header HTML for rendering.

    Returns:
        tuple: (status_code, response_dict, message) or Response object
        Response dict contains: {"url": "<url_to_use_in_html>"}
    """
    if "file" not in request.files:
        return 400, None, "No file provided"

    file = request.files["file"]
    if file.filename == "":
        return 400, None, "No file selected"

    allowed_extensions = {".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp"}
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in allowed_extensions:
        return (
            400,
            None,
            f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}",
        )

    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    max_size = 2 * 1024 * 1024  # 2MB
    if file_size > max_size:
        return (
            400,
            None,
            f"File too large. Maximum size: 2MB. Current size: {file_size / 1024 / 1024:.2f}MB",
        )

    try:
        # Use rehost service to upload image
        url, storage_path = ImageRehostService.upload_image(file)

        return 200, {"url": url}, "Image uploaded successfully"
    except (PermissionError, RuntimeError) as err:
        current_app.logger.error(f"Error uploading header image: {str(err)}")
        return 500, None, f"Error uploading image: {str(err)}"
    except ValueError as err:
        # Validation errors (file type, size, etc.)
        current_app.logger.warning(f"Image upload validation failed: {str(err)}")
        return 400, None, str(err)
    except Exception as e:
        current_app.logger.error(f"Unexpected error uploading header image: {str(e)}")
        return 500, None, f"Error uploading image: {str(e)}"
