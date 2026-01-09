"""
Portal-specific extensions to dashboard metadata schema.

This module provides extension fields that can be merged into
the base dashboard metadata schema without modifying core code.
"""

from marshmallow import fields, Schema, validate, EXCLUDE
from typing import Dict, Any, Optional


class HeaderLayoutSlotSchema(Schema):
    """Schema for individual header slot configuration.
    
    This schema accepts all possible fields for all slot types.
    Fields are validated based on the slot type at application level.
    """
    # Base fields (required for all slot types)
    id = fields.Str(required=True)
    type = fields.Str(
        required=True,
        validate=validate.OneOf(['logo', 'title', 'text', 'date', 'badge', 'spacer', 'divider'])
    )
    position = fields.Str(
        required=True,
        validate=validate.OneOf(['left', 'center', 'right'])
    )
    order = fields.Int(required=False, missing=0)
    visible = fields.Bool(required=False, missing=True)
    config = fields.Dict(required=False, missing={})
    style = fields.Dict(required=False, allow_none=True)
    
    # LogoSlot fields
    url = fields.Str(required=False, allow_none=True)
    alt = fields.Str(required=False, allow_none=True)
    link = fields.Str(required=False, allow_none=True)
    size = fields.Dict(required=False, allow_none=True)  # {width, height, maxWidth, maxHeight}
    openInNewTab = fields.Bool(required=False, missing=False)
    
    # TitleSlot fields
    content = fields.Str(required=False, allow_none=True)
    editable = fields.Bool(required=False, missing=True)
    fontSize = fields.Int(required=False, allow_none=True)
    
    # TextSlot fields (content already defined above)
    
    # DateSlot fields
    format = fields.Str(required=False, allow_none=True)
    showTime = fields.Bool(required=False, missing=False)
    locale = fields.Str(required=False, allow_none=True)
    
    # BadgeSlot fields
    label = fields.Str(required=False, allow_none=True)
    value = fields.Str(required=False, allow_none=True)
    icon = fields.Str(required=False, allow_none=True)
    badgeType = fields.Str(
        required=False,
        allow_none=True,
        validate=validate.OneOf(['default', 'success', 'warning', 'error', 'info', None])
    )
    
    # SpacerSlot fields
    width = fields.Int(required=False, allow_none=True)
    
    # DividerSlot fields
    orientation = fields.Str(
        required=False,
        allow_none=True,
        validate=validate.OneOf(['vertical', 'horizontal', None])
    )
    height = fields.Int(required=False, allow_none=True)
    
    # Custom position (for absolute positioning)
    customPosition = fields.Dict(required=False, allow_none=True)  # {x, y}
    
    class Meta:
        # Allow unknown fields to accommodate future slot types or additional config
        unknown = EXCLUDE  # Ignore unknown fields instead of raising error


class HeaderLayoutGlobalStyleSchema(Schema):
    """Schema for global header layout styles."""
    backgroundColor = fields.Str(required=False, allow_none=True)
    height = fields.Int(required=False, allow_none=True)
    padding = fields.Str(required=False, allow_none=True)
    borderBottom = fields.Str(required=False, allow_none=True)


class HeaderLayoutSchema(Schema):
    """Schema for custom header layout configuration."""
    enabled = fields.Bool(required=False, missing=False)
    slots = fields.List(fields.Nested(HeaderLayoutSlotSchema), missing=[])
    globalStyle = fields.Nested(HeaderLayoutGlobalStyleSchema, required=False, allow_none=True)


class PortalDashboardMetadataExtension:
    """Extension for portal-specific dashboard metadata."""
    
    @staticmethod
    def get_extension_fields() -> Dict[str, fields.Field]:
        """
        Returns additional fields to be merged into DashboardJSONMetadataSchema.
        
        Returns:
            Dict mapping field names to Marshmallow Field instances
        """
        return {
            'headerLayout': fields.Nested(
                HeaderLayoutSchema,
                allow_none=True,
                missing=None,
                metadata={
                    'description': 'Custom header layout configuration for portal branding'
                }
            ),
        }
    
    @classmethod
    def merge_into_base_schema(cls, base_schema_class: type) -> None:
        """
        Dynamically merges extension fields into the base schema class.
        
        This method enhances the base schema by replacing generic Dict fields
        with properly validated nested schemas when available.
        
        Args:
            base_schema_class: The base schema class to extend (e.g., DashboardJSONMetadataSchema)
        """
        extension_fields = cls.get_extension_fields()
        
        for field_name, field_instance in extension_fields.items():
            # If field already exists (e.g., as a generic Dict), replace it with validated version
            # If field doesn't exist, add it
            if hasattr(base_schema_class, field_name):
                # Field exists, replace with validated version
                setattr(base_schema_class, field_name, field_instance)
                # Update _declared_fields if it exists
                if hasattr(base_schema_class, '_declared_fields') and base_schema_class._declared_fields:
                    base_schema_class._declared_fields[field_name] = field_instance
            else:
                # Field doesn't exist, add it
                setattr(base_schema_class, field_name, field_instance)
                # Ensure _declared_fields exists and add field to it
                if not hasattr(base_schema_class, '_declared_fields'):
                    base_schema_class._declared_fields = {}
                elif base_schema_class._declared_fields is None:
                    base_schema_class._declared_fields = {}
                base_schema_class._declared_fields[field_name] = field_instance

