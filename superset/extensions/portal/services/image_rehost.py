# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Image rehosting service.

Provides a clean interface for uploading images to different storage backends
(GCP Cloud Storage, local filesystem, etc.) with automatic backend selection.

The service supports file uploads only (no URL downloads). All images are
rehosted to the configured storage backend, and the returned URL is used
directly in HTML for rendering.

Storage backends:
- GCP Cloud Storage: Returns public GCP URL (e.g., https://storage.googleapis.com/...)
- Local filesystem: Returns static file URL (e.g., /static/uploads/...)

Configure via DASHBOARD_LOGO_GCP_BUCKET in config.py to use GCP, or leave
unset to use local static files.
"""

import os
import uuid
from pathlib import Path
from typing import Optional, Tuple

from flask import current_app
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename


class ImageRehostService:
    """Service for rehosting images to secure storage backends."""

    @staticmethod
    def upload_image(
        file: FileStorage,
        filename: Optional[str] = None,
        subfolder: Optional[str] = None,
    ) -> Tuple[str, str]:
        """
        Upload an image file to the configured storage backend.

        The returned URL is ready to use directly in HTML img tags. The storage
        backend is automatically selected based on configuration:
        - If DASHBOARD_LOGO_GCP_BUCKET is set: uploads to GCP, returns GCP public URL
        - Otherwise: uploads to local static files, returns static file URL

        Args:
            file: The file to upload (file uploads only, no URLs)
            filename: Optional custom filename (will generate UUID-based name if not provided)
            subfolder: Optional subfolder path (defaults to config or empty for uploads root)

        Returns:
            Tuple of (public_url, storage_path)
            - public_url: URL to use in HTML (e.g., GCP URL or /static/uploads/...)
            - storage_path: Internal storage path for reference

        Raises:
            ValueError: If file validation fails
            RuntimeError: If upload fails
        """
        # Generate unique filename if not provided
        if not filename:
            unique_id = str(uuid.uuid4())
            safe_filename = secure_filename(file.filename)
            filename = f"{unique_id}_{safe_filename}"

        # Get subfolder from config or use provided/default to empty
        if subfolder is None:
            subfolder = current_app.config.get("DASHBOARD_LOGO_SUBFOLDER", "")

        # Determine which backend to use

        if gcp_bucket := current_app.config.get("DASHBOARD_LOGO_GCP_BUCKET"):
            return ImageRehostService._upload_to_gcp(
                file, filename, subfolder, gcp_bucket
            )
        else:
            return ImageRehostService._upload_to_local(file, filename, subfolder)

    @staticmethod
    def _upload_to_gcp(
        file: FileStorage, filename: str, subfolder: str, bucket_name: str
    ) -> Tuple[str, str]:
        """Upload image to GCP Cloud Storage."""
        try:
            from google.cloud import storage
        except ImportError:
            raise RuntimeError(
                "GCP bucket configured but google-cloud-storage not installed. "
                "Install with: pip install google-cloud-storage"
            )

        # Initialize GCP client

        if credentials_path := os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            client = storage.Client.from_service_account_json(credentials_path)
        else:
            client = storage.Client()  # fallback para ADC

        bucket = client.bucket(bucket_name)

        # Create blob path (handle empty subfolder)
        if subfolder:
            blob_path = f"{subfolder}/{filename}"
        else:
            blob_path = filename
        blob = bucket.blob(blob_path)

        # Set content type
        file_ext = Path(filename).suffix.lower()
        content_type_map = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".svg": "image/svg+xml",
            ".gif": "image/gif",
            ".webp": "image/webp",
        }
        content_type = content_type_map.get(file_ext, "image/png")
        blob.content_type = content_type

        # Upload file
        file.seek(0)
        blob.upload_from_file(file, content_type=content_type)

        # Generate public URL
        # Note: Public access is controlled by bucket IAM policy, not object ACLs
        # Ensure bucket has IAM policy: allUsers with role Storage Object Viewer
        public_url = f"https://storage.googleapis.com/{bucket_name}/{blob_path}"

        current_app.logger.info(f"Uploaded image to GCP: {blob_path} -> {public_url}")
        return public_url, blob_path

    @staticmethod
    def _upload_to_local(
        file: FileStorage, filename: str, subfolder: str
    ) -> Tuple[str, str]:
        """Upload image to local filesystem."""
        upload_dir = Path(current_app.config.get("UPLOAD_FOLDER", "uploads"))
        # Handle empty subfolder - upload directly to uploads root
        if subfolder:
            logo_dir = upload_dir / subfolder
        else:
            logo_dir = upload_dir
        logo_dir_str = str(logo_dir)

        # Create directory if it doesn't exist
        try:
            os.makedirs(logo_dir_str, mode=0o755, exist_ok=True)
        except PermissionError as e:
            raise RuntimeError(
                f"Permission denied creating upload directory: {logo_dir_str}. "
                f"Error: {str(e)}"
            )

        # Check write permissions
        if not os.access(logo_dir_str, os.W_OK):
            raise RuntimeError(
                f"Upload directory is not writable: {logo_dir_str}. "
                f"Please check directory permissions."
            )

        # Save file
        file_path = logo_dir / filename
        file.seek(0)
        file.save(str(file_path))

        # Generate URL (relative to static files)
        if subfolder:
            url = f"/static/uploads/{subfolder}/{filename}"
        else:
            url = f"/static/uploads/{filename}"
        storage_path = str(file_path)

        return url, storage_path
