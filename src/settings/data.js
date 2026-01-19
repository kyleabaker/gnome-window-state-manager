/*
 * GNOME Window State Manager for GNOME Shell
 *
 * Copyright (C) 2020
 *     Mauro Pepe <https://github.com/hermes83/compiz-windows-effect>
 * Copyright (C) 2025
 *     Kyle Baker <https://github.com/kyleabaker/gnome-window-state-manager>
 *
 * This file is part of the gnome-shell extension gnome-window-state-manager.
 *
 * gnome-shell extension gnome-window-state-manager is free software: you can
 * redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * gnome-shell extension gnome-window-state-manager is distributed in the hope that it
 * will be useful, but WITHOUT ANY WARRANTY; without even the
 * implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
 * PURPOSE.  See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gnome-shell extension gnome-window-state-manager.  If not, see
 * <http://www.gnu.org/licenses/>.
 */
'use strict';

/**
 * Create the settings data object for the extension preferences window
 *
 * @param {*} settings
 * @returns settings data object
 */
export function createSettingsData(settings) {
  const doubleKeys = [
    ['DELAY_WINDOW_CREATED_REFRESH', 'delay-window-created-refresh'],
    ['DELAY_WINDOW_RESIZE_SIGNALS', 'delay-window-resize-signals'],
  ];

  const booleanKeys = [['ENABLE_LOGGING', 'enable-logging']];

  const data = {};

  for (const [prop, key] of doubleKeys) {
    data[prop] = {
      get: () => settings.get_double(key),
      set: (v) => settings.set_double(key, v),
    };
  }

  for (const [prop, key] of booleanKeys) {
    data[prop] = {
      get: () => settings.get_boolean(key),
      set: (v) => settings.set_boolean(key, v),
    };
  }

  return data;
}
