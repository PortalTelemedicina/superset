"""
Image rehosting service.

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
from typing import Tuple, Optional
from flask import current_app
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename


class ImageRehostService:
    """Service for rehosting images to secure storage backends."""
    
    @staticmethod
    def upload_image(
        file: FileStorage,
        filename: Optional[str] = None,
        subfolder: Optional[str] = None
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
        gcp_bucket = current_app.config.get("DASHBOARD_LOGO_GCP_BUCKET")
        
        if gcp_bucket:
            return ImageRehostService._upload_to_gcp(file, filename, subfolder, gcp_bucket)
        else:
            return ImageRehostService._upload_to_local(file, filename, subfolder)
    
    @staticmethod
    def _upload_to_gcp(
        file: FileStorage,
        filename: str,
        subfolder: str,
        bucket_name: str
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
        client = storage.Client()
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
        
        # Try to make publicly readable (for legacy buckets without uniform bucket-level access)
        # If uniform bucket-level access is enabled, this will fail but that's OK
        # as long as the bucket has IAM policy allowing public read access
        try:
            blob.make_public()
            current_app.logger.info(f"Made blob public via ACL: {blob_path}")
        except Exception as e:
            # Uniform bucket-level access enabled - rely on bucket IAM policy instead
            error_msg = str(e).lower()
            if "uniform bucket-level access" in error_msg:
                current_app.logger.info(
                    f"Bucket uses uniform bucket-level access. "
                    f"Relying on bucket IAM policy for public access: {blob_path}"
                )
            else:
                # Unexpected error - log but continue (bucket IAM might still allow access)
                current_app.logger.warning(
                    f"Could not make blob public via ACL: {error_msg}. "
                    f"Ensure bucket IAM allows public read access."
                )
        
        # Generate public URL (works if bucket has public IAM policy)
        public_url = f"https://storage.googleapis.com/{bucket_name}/{blob_path}"
        
        current_app.logger.info(f"Uploaded image to GCP: {blob_path} -> {public_url}")
        return public_url, blob_path
    
    @staticmethod
    def _upload_to_local(
        file: FileStorage,
        filename: str,
        subfolder: str
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