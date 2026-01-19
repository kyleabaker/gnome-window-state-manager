/*
 * GNOME Window State Manager for GNOME Shell
 *
 * Copyright (C) 2025
 *     Kishor Viswanathan <https://github.com/kishorviswanathan/window-state-manager>
 * Copyright (C) 2026
 *     Kyle Baker <https://github.com/kyleabaker/gnome-wobbly-windows>
 *
 * This file is part of the gnome-shell extension GNOME Wobbly Windows.
 *
 * gnome-shell extension GNOME Wobbly Windows is free software: you can
 * redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * gnome-shell extension GNOME Wobbly Windows is distributed in the hope that it
 * will be useful, but WITHOUT ANY WARRANTY; without even the
 * implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
 * PURPOSE.  See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gnome-shell extension GNOME Wobbly Windows.  If not, see
 * <http://www.gnu.org/licenses/>.
 */
import Meta from 'gi://Meta';
import GLib from 'gi://GLib';

import { Logger } from './logger.js';
import { Window } from './window.js';

export class WindowStates {
  constructor() {
    this.savePath = GLib.build_filenamev([
      GLib.get_user_config_dir(),
      'gnome-window-state-manager.json',
    ]);
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

    // Start with the existing saved data instead of an empty object
    const currentLayout = this.windowStates[displaySizeKey] || {};
    const appCounts = {};

    for (const window of this._getWindows()) {
      const wmClass = window.get_wm_class() || 'unknown';
      appCounts[wmClass] = (appCounts[wmClass] || 0) + 1;

      const persistentKey = `${wmClass}:${appCounts[wmClass]}`;

      // Update the layout with the new position
      currentLayout[persistentKey] = new Window(window);
    }

    // Save the merged object back to the main state
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

    const appCounts = {};
    for (const window of this._getWindows()) {
      const wmClass = window.get_wm_class() || 'unknown';
      appCounts[wmClass] = (appCounts[wmClass] || 0) + 1;
      const persistentKey = `${wmClass}:${appCounts[wmClass]}`;

      if (savedLayout[persistentKey]) {
        const savedState = new Window(savedLayout[persistentKey]);
        const currentState = new Window(window); // Capture current position/state

        // Only restore if the saved state is different from the current reality
        if (!this._isAlreadyPositioned(savedState, currentState)) {
          Logger.debug(
            `Restoring '${currentState._title}' at x,y: ${currentState._rect.x},${currentState._rect.y}`
          );
          savedState.restore(window);
        }
      }
    }
  }

  // Helper to compare current vs saved
  _isAlreadyPositioned(saved, current) {
    return (
      saved._rect.x === current._rect.x &&
      saved._rect.y === current._rect.y &&
      saved._rect.width === current._rect.width &&
      saved._rect.height === current._rect.height &&
      saved._maximized === current._maximized &&
      saved._workspace === current._workspace
    );
  }

  saveToFile() {
    try {
      const contents = JSON.stringify(this.windowStates, null, 2);
      GLib.file_set_contents(this.savePath, contents);
      // Logger.debug(`Saved state to ${this.savePath}`);
    } catch (e) {
      Logger.error(`Failed to save state to disk: ${e.message}`);
    }
  }

  loadFromFile() {
    try {
      if (GLib.file_test(this.savePath, GLib.FileTest.EXISTS)) {
        const [success, contents] = GLib.file_get_contents(this.savePath);
        if (success) {
          // GLib returns a Uint8Array/Bytes in some environments, ensure it's a string
          const decoder = new TextDecoder(); // eslint-disable-line
          return JSON.parse(decoder.decode(contents));
        }
      }
    } catch (e) {
      Logger.error(`Failed to load state from disk: ${e.message}`);
    }
    return {};
  }
}
