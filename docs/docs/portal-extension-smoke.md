<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Portal Extension Smoke Checklist

## Enable/disable toggle

Set the feature flag in `superset_config.py`:

```
FEATURE_FLAGS = {
    "PORTAL_EXTENSION_ENABLED": True,
}
```

Restart Superset after changing the flag.

## Smoke steps

Run the checks with the extension ON and OFF:

1. Load a dashboard with native filters
2. Toggle the filter bar, apply a filter, and clear it
3. Open a chart menu (slice header controls)
4. Open the dashboard header menu and edit the title

Expected:

- Extension OFF: default Superset header, filter bar, and slice controls
- Extension ON: portal overrides are visible and functional (header, filter bar, PTM menu)

## Console confirmation

When enabled in development mode, the browser console logs:

- `[Setup Extensions] Portal extension loaded`
