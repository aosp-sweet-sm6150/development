/*
 * Copyright 2017, The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Vue from 'vue'
import Vuex from 'vuex'
import VueMaterial from 'vue-material'

import App from './App.vue'
import { DATA_TYPES } from './decode.js'
import { mixin as FileType } from './mixins/FileType.js'
import { findLastMatchingSorted, stableIdCompatibilityFixup } from './utils/utils.js'

import 'style-loader!css-loader!vue-material/dist/vue-material.css'
import 'style-loader!css-loader!vue-material/dist/theme/default.css'

Vue.use(Vuex)
Vue.use(VueMaterial)

const store = new Vuex.Store({
  state: {
    currentTimestamp: 0,
    files: [],
    activeFile: null,
    video: null,
    excludeFromTimeline: [
      DATA_TYPES.PROTO_LOG
    ],
    mergedTimeline: null,
    // obj -> bool, identifies whether or not an item is collapsed in a treeView
    collapsedStateStore: {},
  },
  getters: {
    collapsedStateStoreFor: (state) => (item) => {
      if (item.stableId === undefined || item.stableId === null) {
        throw new Error("Failed to get collapse state of item — missing a stableId");
      }

      return state.collapsedStateStore[stableIdCompatibilityFixup(item)];
    }
  },
  mutations: {
    setCurrentTimestamp(state, { timestamp }) {
      state.currentTimestamp = timestamp;
    },
    setFileEntryIndex(state, { fileIndex, entryIndex }) {
      state.files[fileIndex].selectedIndex = entryIndex;
    },
    addFiles(state, files) {
      if (!state.activeFile && files.length > 0) {
        state.activeFile = files[0];
      }

      const startIndex = state.files.length;
      for (const [i, file] of files.entries()) {
        file.index = startIndex + i;

        if (FileType.isVideo(file)) {
          state.video = file;
        }

        state.files.push(file);
      }
    },
    clearFiles(state) {
      for (const file of state.files) {
        file.destroy();
      }

      state.files = [];
      state.activeFile = null;
      state.video = null;
    },
    setActiveFile(state, file) {
      state.activeFile = file;
    },
    setMergedTimeline(state, timeline) {
      state.mergedTimeline = timeline;
    },
    removeMergedTimeline(state, timeline) {
      state.mergedTimeline = null;
    },
    setMergedTimelineIndex(state, newIndex) {
      state.mergedTimeline.selectedIndex = newIndex;
    },
    setCollapsedState(state, { item, isCollapsed }) {
      if (item.stableId === undefined || item.stableId === null) {
        return;
      }

      Vue.set(
        state.collapsedStateStore,
        stableIdCompatibilityFixup(item),
        isCollapsed
      );
    }
  },
  actions: {
    setFiles(context, files) {
      context.commit('clearFiles');
      context.commit('addFiles', files);
    },
    updateTimelineTime(context, timestamp) {
      for (const file of context.state.files) {
        const fileIndex = file.index;
        const entryIndex = findLastMatchingSorted(
          file.timeline,
          (array, idx) => parseInt(array[idx]) <= timestamp,
        );

        context.commit('setFileEntryIndex', { fileIndex, entryIndex });
      }

      if (context.state.mergedTimeline) {
        const newIndex = findLastMatchingSorted(
          context.state.mergedTimeline.timeline,
          (array, idx) => parseInt(array[idx]) <= timestamp,
        );

        context.commit('setMergedTimelineIndex', newIndex);
      }

      context.commit('setCurrentTimestamp', { timestamp });
    },
    advanceTimeline(context, direction, excludedFileTypes) {
      // NOTE: MergedTimeline is never considered to find the next closest index
      // MergedTimeline only represented the timelines overlapped together and
      // isn't considered an actual timeline.

      excludedFileTypes = new Set(excludedFileTypes);
      let closestTimeline = -1;
      let timeDiff = Infinity;
      const consideredFiles = context.state.files
        .filter(file => !excludedFileTypes.has(file.type));

      for (let idx = 0; idx < consideredFiles.length; idx++) {
        const file = consideredFiles[idx];
        const cur = file.selectedIndex;
        if (cur + direction < 0 || cur + direction >= consideredFiles[idx].timeline.length) {
          continue;
        }
        var d = Math.abs(parseInt(file.timeline[cur + direction]) - context.state.currentTimestamp);
        if (timeDiff > d) {
          timeDiff = d;
          closestTimeline = idx;
        }
      }
      if (closestTimeline >= 0) {
        consideredFiles[closestTimeline].selectedIndex += direction;
        const timestamp = parseInt(
          consideredFiles[closestTimeline]
            .timeline[consideredFiles[closestTimeline].selectedIndex]);
        context.dispatch('updateTimelineTime', timestamp);
      }
    }
  }
})

new Vue({
  el: '#app',
  store, // inject the Vuex store into all components
  render: h => h(App)
})
