/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing limitations under the License.
 */

// Export components
export * from './components';

// Export types
export * from './types';
// Export getDefaultHeaderLayout helper
export { getDefaultHeaderLayout } from './types';

// Export hooks
export { useStandaloneMode } from './hooks/useStandaloneMode';
export { useHeaderPreview } from './hooks/useHeaderPreview';

// Export adapter (will be created in Phase 2)
export { HeaderAdapter } from './adapters/HeaderAdapter';

