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
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import GLib from 'gi://GLib';

import { Logger } from './src/helpers/logger.js';
import { WindowStates } from './src/helpers/windowStates.js';

const EXTENSION_LOG_NAME = 'GNOME Window State Manager';
const LOG_LEVEL = Logger.LOG_LEVELS.EVERYTHING;

export default class WindowStateManager extends Extension {
  enable() {
    Logger.init(EXTENSION_LOG_NAME, LOG_LEVEL);
    Logger.info('Extension enabled.');

    this.windowStates = new WindowStates();
    this.lastRefreshedSize = this.windowStates.getWindowSizeKey();

    this._connectSignals();

    // Initial restore for windows already open
    this._scheduleRefresh('Initial Load');
  }

  disable() {
    this._disconnectSignals();
    this.windowStates = null;
    Logger.info('Extension disabled.');
  }

  _connectSignals() {
    this._signals = [];

    // Watch for new windows being opened to restore their specific positions
    this._signals.push(
      global.display.connect('window-created', () => {
        this._scheduleRefresh('Window Created', 50);
      })
    );

    // Watch for windows being moved/resized to save state
    this._signals.push(
      global.display.connect('grab-op-end', () => {
        this.windowStates.saveWindowPositions();
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

  _scheduleRefresh(reason, delay = 2000) {
    Logger.debug('Reason: ' + reason);
    if (this._refreshPending) GLib.source_remove(this._refreshPending);

    this._refreshPending = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      delay,
      () => {
        this._refreshState();
        this._refreshPending = null;
        return GLib.SOURCE_REMOVE;
      }
    );
  }

  _refreshState() {
    const currentSize = this.windowStates.getWindowSizeKey();

    // Always attempt restore when triggered by window creation or startup
    this.windowStates.restoreWindowPositions();
    this.lastRefreshedSize = currentSize;
  }
}
