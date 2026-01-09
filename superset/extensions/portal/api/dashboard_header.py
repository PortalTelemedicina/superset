"""
Portal dashboard header API endpoints.

Isolated endpoint logic for dashboard header customization.
This allows the logic to be separated from core API while still
using Superset's authentication and permission system.
"""

import os
import uuid
from pathlib import Path
from flask import request, current_app
from werkzeug.utils import secure_filename


def upload_header_image_handler():
    """
    Handle header image upload.
    
    This function contains the business logic for uploading header images.
    It can be called from core API endpoint or extension endpoint.
    
    Returns:
        tuple: (status_code, response_dict, message) or Response object
    """
    # Get uploaded file
    if "file" not in request.files:
        return 400, None, "No file provided"

    file = request.files["file"]
    if file.filename == "":
        return 400, None, "No file selected"

    # Validate file extension
    allowed_extensions = {".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp"}
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in allowed_extensions:
        return 400, None, f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}"

    # Validate file size (max 2MB)
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    max_size = 2 * 1024 * 1024  # 2MB
    if file_size > max_size:
        return 400, None, f"File too large. Maximum size: 2MB. Current size: {file_size / 1024 / 1024:.2f}MB"

    try:
        # Create upload directory if it doesn't exist
        upload_dir = Path(current_app.config.get("UPLOAD_FOLDER", "uploads"))
        logo_dir = upload_dir / "dashboard_logos"
        logo_dir.mkdir(parents=True, exist_ok=True)

        # Generate unique filename
        unique_id = str(uuid.uuid4())
        safe_filename = secure_filename(file.filename)
        filename = f"{unique_id}_{safe_filename}"
        file_path = logo_dir / filename

        # Save file
        file.save(str(file_path))

        # Generate URL (relative to static files)
        # In production, this should be served via static file handler
        url = f"/static/uploads/dashboard_logos/{filename}"

        return 200, {"url": url}, "Image uploaded successfully"
    except Exception as e:
        current_app.logger.error(f"Error uploading header image: {str(e)}")
        return 500, None, f"Error uploading image: {str(e)}"

