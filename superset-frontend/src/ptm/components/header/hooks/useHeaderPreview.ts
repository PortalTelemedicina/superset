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
import { useState, useCallback } from 'react';

/**
 * Hook to manage header preview mode state.
 * 
 * Provides state for previewing custom header
 * in non-standalone mode (normal view).
 * 
 * @returns Object with preview state and handlers
 */
export const useHeaderPreview = () => {
  const [previewMode, setPreviewMode] = useState(false);

  const togglePreview = useCallback(() => {
    setPreviewMode(prev => !prev);
  }, []);

  const resetPreview = useCallback(() => {
    setPreviewMode(false);
  }, []);

  const setPreview = useCallback((value: boolean) => {
    setPreviewMode(value);
  }, []);

  return {
    previewMode,
    setPreviewMode: setPreview,
    togglePreview,
    resetPreview,
  };
};
