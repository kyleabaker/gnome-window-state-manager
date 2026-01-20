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
'use strict';

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
    this.delayWindowCreatedRefresh =
      this.settingsData.DELAY_WINDOW_CREATED_REFRESH.get();
    this.delayWindowResizeSignals =
      this.settingsData.DELAY_WINDOW_RESIZE_SIGNALS.get();
    this.delaySaveToFile = this.settingsData.DELAY_SAVE_TO_FILE.get();

    const LOG_LEVEL = this.settingsData.ENABLE_LOGGING.get()
      ? LOG_LEVEL_EVERYTHING
      : LOG_LEVEL_DEFAULT;

    Logger.init(EXTENSION_LOG_NAME, LOG_LEVEL);
    Logger.info('Extension enabled.');

    this.windowStates = new WindowStates();
    this._windowSignals = new Map();
    this._creationTimeouts = new Set();
    this._creationSignalIds = new Map();
    this.lastRefreshedSize = this.windowStates.getWindowSizeKey();

    // Bind handlers to avoid repeated closure creation
    this._onWindowCreated = this._handleWindowCreated.bind(this);
    this._onGrabOpEnd = this._scheduleSave.bind(this);
    this._onWindowDestroy = this._handleWindowDestroy.bind(this);
    this._onWindowStateChange = this._scheduleSave.bind(this);
    this._onWorkspaceChanged = this._handleWorkspaceChanged.bind(this);
    this._onSaveTimeout = this._handleSaveTimeout.bind(this);
    this._onRefreshTimeout = this._handleRefreshTimeout.bind(this);

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
    this._clearCreationSignals();

    this.windowStates = null;
    this._windowSignals = null;
    this._creationTimeouts = null;
    this._creationSignalIds = null;
    Logger.info('Extension disabled.');
  }

  _connectSignals() {
    this._signals = [];

    // Watch for new windows being opened to restore their specific positions
    this._signals.push(
      global.display.connect('window-created', this._onWindowCreated)
    );

    // Watch for windows being moved/resized to save state
    this._signals.push(
      global.display.connect('grab-op-end', this._onGrabOpEnd)
    );
  }

  _handleWindowCreated(display, window) {
    if (!this._isValidWindow(window)) return;

    Logger.time('_handleWindowCreated');

    const actor = window.get_compositor_private();
    if (actor) {
      const signalId = actor.connect('first-frame', () => {
        this._creationSignalIds.delete(actor);
        actor.disconnect(signalId);
        this._onWindowReady(window);
      });
      this._creationSignalIds.set(actor, signalId);
    } else {
      Logger.debug(
        'Window first-frame signal not available, using fallback instead.'
      );
      this._onWindowReady(window);
    }

    Logger.timeEnd('_handleWindowCreated');
  }

  _handleWorkspaceChanged(window) {
    const workspace = window.get_workspace();
    if (workspace) {
      workspace.activate(global.get_current_time());
    }
    this._scheduleSave();
  }

  _onWindowReady(window) {
    if (!this.windowStates) return;

    Logger.time('_onWindowReady');

    // Restore position immediately (200ms delay for stability)
    this._scheduleRefresh('Window Created', this.delayWindowCreatedRefresh);

    // Use GObject property notifications instead of window-state-changed
    const timeoutId = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      this.delayWindowResizeSignals,
      () => {
        this._creationTimeouts.delete(timeoutId);
        this._monitorWindow(window);
        return GLib.SOURCE_REMOVE;
      }
    );
    this._creationTimeouts.add(timeoutId);

    Logger.timeEnd('_onWindowReady');
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
    const destroyId = window.connect('unmanaged', this._onWindowDestroy);
    signals.push(destroyId);

    // Watch for state changes
    const stateSignals = [
      // Direct signals
      'position-changed',
      'size-changed',

      // Notify Signals
      'notify::above',
      'notify::fullscreen',
      'notify::maximized-horizontally',
      'notify::maximized-vertically',
      'notify::minimized',
      'notify::monitor-changed',
      'notify::on-all-workspaces',
      'notify::rect',
    ];

    stateSignals.forEach((signal) => {
      signals.push(window.connect(signal, this._onWindowStateChange));
    });

    signals.push(window.connect('workspace-changed', this._onWorkspaceChanged));

    this._windowSignals.set(window, signals);
  }

  _handleWindowDestroy(window) {
    this._windowSignals.delete(window);
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

  _clearCreationSignals() {
    if (this._creationSignalIds) {
      for (const [actor, id] of this._creationSignalIds) {
        actor.disconnect(id);
      }
      this._creationSignalIds.clear();
    }
  }

  _scheduleRefresh(reason, delay = 2000) {
    Logger.debug('Reason: ' + reason);
    if (this._refreshPending) GLib.source_remove(this._refreshPending);

    this._refreshPending = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      delay,
      this._onRefreshTimeout
    );
  }

  _handleRefreshTimeout() {
    this._refreshPending = null;
    this._refreshState();
    return GLib.SOURCE_REMOVE;
  }

  _scheduleSave() {
    Logger.time('_scheduleSave');

    // If a save is already queued, cancel it and restart the timer
    if (this._savePending) GLib.source_remove(this._savePending);

    this._savePending = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      this.delaySaveToFile,
      this._onSaveTimeout
    );

    Logger.timeEnd('_scheduleSave');
  }

  _handleSaveTimeout() {
    this._savePending = null;
    this.windowStates.saveWindowPositions();
    return GLib.SOURCE_REMOVE;
  }

  _refreshState() {
    Logger.time('_refreshState');

    if (!this.windowStates) return;

    const currentSize = this.windowStates.getWindowSizeKey();

    // Always attempt restore when triggered by window creation or startup
    this.windowStates.restoreWindowPositions();
    this.lastRefreshedSize = currentSize;

    Logger.timeEnd('_refreshState');
  }
}
