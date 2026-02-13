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

export class Logger {
  // Name used for logging
  static LOG_NAME;

  // Current log level
  static LOG_LEVEL;

  // Log levels
  static LOG_LEVELS = {
    NOTHING: 0,
    ERROR: 1,
    INFO: 2,
    DEBUG: 3,
    EVERYTHING: 4,
  };

  // Initlization function
  static init(logname, level) {
    this.LOG_NAME = logname;
    this.LOG_LEVEL = level;
  }

  static time(...args) {
    if (this.LOG_LEVEL > this.LOG_LEVELS.INFO)
      console.time(`[${this.LOG_NAME}] [TIME] ${args}`);
  }

  static timeEnd(...args) {
    if (this.LOG_LEVEL > this.LOG_LEVELS.INFO)
      console.timeEnd(`[${this.LOG_NAME}] [TIME] ${args}`);
  }

  static debug(...args) {
    if (this.LOG_LEVEL > this.LOG_LEVELS.INFO)
      console.log(`[${this.LOG_NAME}] [DEBUG]`, ...args);
  }

  static info(...args) {
    if (this.LOG_LEVEL > this.LOG_LEVELS.ERROR)
      console.log(`[${this.LOG_NAME}] [INFO]`, ...args);
  }

  static error(...args) {
    if (this.LOG_LEVEL > this.LOG_LEVELS.NOTHING)
      console.log(`[${this.LOG_NAME}] [ERROR]`, ...args);
  }

  static log(...args) {
    if (this.LOG_LEVEL > this.LOG_LEVELS.NOTHING)
      console.log(`[${this.LOG_NAME}] [LOG]`, ...args);
  }
}
