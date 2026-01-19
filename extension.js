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

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { createSettingsData } from './src/settings/data.js';
import { Logger } from './src/helpers/logger.js';
import { WindowStates } from './src/helpers/windowStates.js';

const EXTENSION_LOG_NAME = 'GNOME Window State Manager';
const LOG_LEVEL_DEFAULT = Logger.LOG_LEVELS.INFO;
const LOG_LEVEL_EVERYTHING = Logger.LOG_LEVELS.EVERYTHING;

export default class WindowStateManager extends Extension {
  enable() {
    this.settingsData = createSettingsData(this.getSettings());
    const enableLogging = this.settingsData.ENABLE_LOGGING.get();
    const LOG_LEVEL = enableLogging ? LOG_LEVEL_EVERYTHING : LOG_LEVEL_DEFAULT;

    Logger.init(EXTENSION_LOG_NAME, LOG_LEVEL);
    Logger.info('Extension enabled.');

    this.windowStates = new WindowStates();
    this._windowSignals = new Map();
    this._creationTimeouts = new Set();
    this.lastRefreshedSize = this.windowStates.getWindowSizeKey();

    this._connectSignals();

    // Attach signals to existing windows
    global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null).forEach((w) => {
      this._monitorWindow(w);
    });

    // Initial restore for windows already open
    this._scheduleRefresh('Initial Load');
  }

  disable() {
    this._disconnectSignals();
    this._disconnectWindowSignals();
    this._clearTimeouts();

    this.windowStates = null;
    this._windowSignals = null;
    this._creationTimeouts = null;
    Logger.info('Extension disabled.');
  }

  _connectSignals() {
    const delayWindowCreatedRefresh = parseInt(
      Number(this.settingsData.DELAY_WINDOW_CREATED_REFRESH.get() || 200)
    );
    const delayWindowResizeSignals = parseInt(
      Number(this.settingsData.DELAY_WINDOW_RESIZE_SIGNALS.get() || 500)
    );

    Logger.info('DELAY_WINDOW_CREATED_REFRESH: ' + delayWindowCreatedRefresh);
    Logger.info(
      'Skip DELAY_WINDOW_RESIZE_SIGNALS: ' + delayWindowResizeSignals
    );

    this._signals = [];

    // Watch for new windows being opened to restore their specific positions
    this._signals.push(
      global.display.connect('window-created', (display, window) => {
        if (!this._isValidWindow(window)) return;

        // Restore position immediately (200ms delay for stability)
        this._scheduleRefresh('Window Created', delayWindowCreatedRefresh);

        // Use GObject property notifications instead of window-state-changed
        const timeoutId = GLib.timeout_add(
          GLib.PRIORITY_DEFAULT,
          delayWindowResizeSignals,
          () => {
            this._creationTimeouts.delete(timeoutId);
            this._monitorWindow(window);
            return GLib.SOURCE_REMOVE;
          }
        );
        this._creationTimeouts.add(timeoutId);
      })
    );

    // Watch for windows being moved/resized to save state
    this._signals.push(
      global.display.connect('grab-op-end', () => {
        this._scheduleSave();
      })
    );
  }

  _disconnectSignals() {
    if (this._signals) {
      for (const signalId of this._signals) {
        global.display.disconnect(signalId);
      }
      this._signals = [];
    }
  }

  _disconnectWindowSignals() {
    if (this._windowSignals) {
      for (const [window, signals] of this._windowSignals) {
        signals.forEach((id) => window.disconnect(id));
      }
      this._windowSignals.clear();
    }
  }

  _isValidWindow(window) {
    if (!window || typeof window.get_window_type !== 'function') return false;
    if (window.get_window_type() !== Meta.WindowType.NORMAL) return false;
    if (window.is_skip_taskbar?.()) return false;
    if (window.get_transient_for?.()) return false;
    return true;
  }

  _monitorWindow(window) {
    if (!this._isValidWindow(window)) return;
    if (this._windowSignals.has(window)) return;

    const signals = [];

    // Clean up our tracking if the window is destroyed
    const destroyId = window.connect('unmanaged', () => {
      this._windowSignals.delete(window);
    });
    signals.push(destroyId);

    // Watch for state changes
    const stateSignals = [
      'notify::maximized-horizontally',
      'notify::maximized-vertically',
      'notify::minimized',
    ];

    stateSignals.forEach((signal) => {
      signals.push(
        window.connect(signal, () => {
          this._scheduleSave();
        })
      );
    });

    this._windowSignals.set(window, signals);
  }

  _clearTimeouts() {
    if (this._refreshPending) {
      GLib.source_remove(this._refreshPending);
      this._refreshPending = null;
    }
    if (this._savePending) {
      GLib.source_remove(this._savePending);
      this._savePending = null;
    }
    if (this._creationTimeouts) {
      this._creationTimeouts.forEach((id) => GLib.source_remove(id));
      this._creationTimeouts.clear();
    }
  }

  _scheduleRefresh(reason, delay = 2000) {
    Logger.debug('Reason: ' + reason);
    if (this._refreshPending) GLib.source_remove(this._refreshPending);

    this._refreshPending = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      delay,
      () => {
        this._refreshPending = null;
        this._refreshState();
        return GLib.SOURCE_REMOVE;
      }
    );
  }

  _scheduleSave() {
    // If a save is already queued, cancel it and restart the timer
    if (this._savePending) GLib.source_remove(this._savePending);

    this._savePending = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
      this._savePending = null;
      this.windowStates.saveWindowPositions();
      return GLib.SOURCE_REMOVE;
    });
  }

  _refreshState() {
    if (!this.windowStates) return;

    const currentSize = this.windowStates.getWindowSizeKey();

    // Always attempt restore when triggered by window creation or startup
    this.windowStates.restoreWindowPositions();
    this.lastRefreshedSize = currentSize;
  }
}
