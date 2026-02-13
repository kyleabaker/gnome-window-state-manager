/*
 * GNOME Window State Manager for GNOME Shell
 *
 * Copyright (C) 2025
 *     Kishor Viswanathan <https://github.com/kishorviswanathan/window-state-manager>
 * Copyright (C) 2026
 *     Kyle Baker <https://github.com/kyleabaker/gnome-window-state-manager>
 *
 * This file is part of the gnome-shell extension GNOME Window State Manager.
 *
 * gnome-shell extension GNOME Window State Manager is free software: you can
 * redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * gnome-shell extension GNOME Window State Manager is distributed in the hope that it
 * will be useful, but WITHOUT ANY WARRANTY; without even the
 * implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
 * PURPOSE.  See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gnome-shell extension GNOME Window State Manager.  If not, see
 * <http://www.gnu.org/licenses/>.
 */
'use strict';

import Meta from 'gi://Meta';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import { Logger } from './logger.js';
import { Window } from './window.js';

export class WindowStates {
  constructor() {
    this.savePath = GLib.build_filenamev([
      GLib.get_user_config_dir(),
      'gnome-window-state-manager.json',
    ]);
    this._file = Gio.File.new_for_path(this.savePath);
    // windowStates structure: { "1920x1080": { "wm_class:index": WindowObject } }
    this.windowStates = this.loadFromFile();
  }

  _getWindows() {
    return global.display
      .get_tab_list(Meta.TabList.NORMAL_ALL, null)
      .filter((w) => !w.is_skip_taskbar());
  }

  getWindowSizeKey() {
    const size = global.display.get_size();
    return `${size[0]}x${size[1]}`;
  }

  saveWindowPositions() {
    Logger.debug(`Saving window positions to disk...`);
    const displaySizeKey = this.getWindowSizeKey();

    // Merge with existing data so we don't lose windows that are currently closed
    const currentLayout = this.windowStates[displaySizeKey] || {};
    const appCounts = {};

    // Get windows and SORT them by stable_sequence
    // This ensures Index #1 is ALWAYS the window created first.
    const windows = this._getWindows().sort((a, b) => {
      return a.get_stable_sequence() - b.get_stable_sequence();
    });

    for (const window of windows) {
      const wmClass = window.get_wm_class() || 'unknown';
      appCounts[wmClass] = (appCounts[wmClass] || 0) + 1;

      const persistentKey = `${wmClass}:${appCounts[wmClass]}`;

      // Convert the C-Object into our clean JS-Object
      // Ensure your Window class constructor handles a Meta.Window input
      currentLayout[persistentKey] = new Window(window);

      Logger.debug(
        `Saved ${persistentKey} at ${currentLayout[persistentKey]._rect.x},${currentLayout[persistentKey]._rect.y}`
      );
    }

    this.windowStates[displaySizeKey] = currentLayout;
    this.saveToFile();
  }

  restoreWindowPositions() {
    Logger.debug(`Attempting to restore window positions...`);
    const displaySizeKey = this.getWindowSizeKey();
    const savedLayout = this.windowStates[displaySizeKey];

    if (!savedLayout) {
      Logger.error(`No saved layout found for resolution ${displaySizeKey}`);
      return;
    }

    // Get all active windows once to avoid repeated filtering
    const allWindows = this._getWindows();

    // Group windows by class to avoid O(N^2) lookup in the loop
    const windowsByClass = {};
    for (const window of allWindows) {
      const wmClass = window.get_wm_class() || 'unknown';
      if (!windowsByClass[wmClass]) windowsByClass[wmClass] = [];
      windowsByClass[wmClass].push(window);
    }

    // Sort each group by stable sequence
    for (const wmClass in windowsByClass) {
      windowsByClass[wmClass].sort(
        (a, b) => a.get_stable_sequence() - b.get_stable_sequence()
      );
    }

    for (const window of allWindows) {
      const wmClass = window.get_wm_class() || 'unknown';

      // To handle multiple identical apps, find all windows of this class
      // and sort them by their session-unique stable sequence.
      const sameAppWindows = windowsByClass[wmClass] || [];

      // Determine which "instance number" this window is for this session
      const instanceIndex = sameAppWindows.indexOf(window) + 1;
      const persistentKey = `${wmClass}:${instanceIndex}`;

      // Match against the saved layout using the same keying logic
      if (savedLayout[persistentKey]) {
        const savedState = new Window(savedLayout[persistentKey]);

        // Only perform the expensive move/resize if the reality differs from the save
        if (!Window.isStateEqual(savedState, window)) {
          Logger.debug(`Restoring instance ${instanceIndex} of '${wmClass}'`);
          savedState.restore(window);
        }
      }
    }
  }

  saveToFile() {
    Logger.time('saveToFile');

    if (this._isSaving) {
      this._saveQueued = true;
      return;
    }
    this._isSaving = true;

    const contents = JSON.stringify(this.windowStates, null, 2);
    const bytes = new GLib.Bytes(contents);

    this._file.replace_contents_async(
      bytes.get_data(),
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null,
      (file, res) => {
        try {
          file.replace_contents_finish(res);
          Logger.debug(`Saved state to ${this.savePath}`);
        } catch (e) {
          Logger.error(`Failed to save state to disk: ${e.message}`);
        }
        this._isSaving = false;
        if (this._saveQueued) {
          this._saveQueued = false;
          this.saveToFile();
        }
      }
    );

    Logger.timeEnd('saveToFile');
  }

  loadFromFile() {
    Logger.time('loadFromFile');

    try {
      if (GLib.file_test(this.savePath, GLib.FileTest.EXISTS)) {
        const [success, contents] = GLib.file_get_contents(this.savePath);
        if (success) {
          // GLib returns a Uint8Array/Bytes in some environments, ensure it's a string
          const decoder = new TextDecoder(); // eslint-disable-line
          const parsedContents = JSON.parse(decoder.decode(contents));

          Logger.timeEnd('loadFromFile');
          return parsedContents;
        }
      }
    } catch (e) {
      Logger.error(`Failed to load state from disk: ${e.message}`);
      //TODO look for a backup file before falling back to an empty state.
    }

    Logger.timeEnd('loadFromFile');
    return {};
  }
}
