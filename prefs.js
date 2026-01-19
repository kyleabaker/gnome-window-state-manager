/*
 * GNOME Window State Manager for GNOME Shell
 *
 * Copyright (C) 2020
 *     Mauro Pepe <https://github.com/hermes83/compiz-windows-effect>
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

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { createSettingsData } from './src/settings/data.js';

/**
 * Preferences window
 *
 * @name Prefs
 * @description Preferences window implementation for GNOME Window State Manager
 */
export default class Prefs extends ExtensionPreferences {
  /**
   * Fill preferences window
   *
   * @param {Gtk.Window} window
   */
  fillPreferencesWindow(window) {
    const settingsData = createSettingsData(this.getSettings());

    const width = 750;
    const height = 580;
    window.set_default_size(width, height);

    const page = Adw.PreferencesPage.new();
    page.set_title('GNOME Window State Manager');

    // Settings group 1: Window Created Refresh Delay, Window Resize Signals Delay
    const group1 = Adw.PreferencesGroup.new();
    this.delayWindowCreatedRefreshSlider = this.addSlider(
      group1,
      'Window Created Refresh Delay',
      settingsData.DELAY_WINDOW_CREATED_REFRESH,
      50,
      1000,
      10,
      0
    );
    this.windowResizeSignalsDelaySlider = this.addSlider(
      group1,
      'Window Resize Signals Delay',
      settingsData.DELAY_WINDOW_RESIZE_SIGNALS,
      50,
      2000,
      10,
      0
    );
    page.add(group1);

    // Settings group 2: Enable Logging
    const group2 = Adw.PreferencesGroup.new();
    this.enableLoggingSwitch = this.addBooleanSwitch(
      group2,
      'Enable Logging',
      settingsData.ENABLE_LOGGING
    );
    page.add(group2);

    // Reset button
    this.addResetButton(window, settingsData);

    window.add(page);
  }

  /**
   * Add reset button
   *
   * @param {Gtk.Window} window
   * @param {Object} settingsData
   */
  addResetButton(window, settingsData) {
    const button = new Gtk.Button({ vexpand: true, valign: Gtk.Align.END });
    button.set_icon_name('edit-clear');

    button.connect('clicked', () => {
      settingsData.DELAY_WINDOW_CREATED_REFRESH.set(200);
      settingsData.DELAY_WINDOW_RESIZE_SIGNALS.set(500);
      settingsData.ENABLE_LOGGING.set(false);

      this.delayWindowCreatedRefreshSlider.set_value(
        settingsData.DELAY_WINDOW_CREATED_REFRESH.get()
      );
      this.windowResizeSignalsDelaySlider.set_value(
        settingsData.DELAY_WINDOW_RESIZE_SIGNALS.get()
      );
      this.enableLoggingSwitch.set_value(settingsData.ENABLE_LOGGING.get());
    });

    const header = this.findWidgetByType(window.get_content(), Adw.HeaderBar);
    if (header) header.pack_start(button);

    return button;
  }

  /**
   * Add slider
   *
   * @param {Adw.PreferencesGroup} group
   * @param {string} labelText
   * @param {Object} settingsData
   * @param {number} lower
   * @param {number} upper
   * @param {number} decimalDigits
   */
  addSlider(group, labelText, settingsData, lower, upper, step, decimalDigits) {
    const scale = new Gtk.Scale({
      adjustment: new Gtk.Adjustment({
        lower: lower,
        upper: upper,
        step_increment: step,
        page_increment: step,
      }),
      digits: decimalDigits,
      value_pos: Gtk.PositionType.RIGHT,
      hexpand: true,
      halign: Gtk.Align.END,
    });
    scale.set_draw_value(true);
    scale.set_value(settingsData.get());
    scale.set_size_request(400, 15);

    scale.connect('value-changed', () => {
      const newval = scale.get_value();
      const rounded = Math.round(newval / step) * step;
      if (newval != rounded) {
        scale.set(rounded);
      }
    });

    const row = Adw.ActionRow.new();
    row.set_title(labelText);
    row.add_suffix(scale);
    group.add(row);

    return scale;
  }

  /**
   * Add boolean switch
   *
   * @param {Adw.PreferencesGroup} group
   * @param {string} labelText
   * @param {Object} settingsData
   */
  addBooleanSwitch(group, labelText, settingsData) {
    const gtkSwitch = new Gtk.Switch({ hexpand: true, halign: Gtk.Align.END });
    gtkSwitch.set_active(settingsData.get());
    gtkSwitch.set_valign(Gtk.Align.CENTER);

    gtkSwitch.connect('state-set', (sw) => {
      const newval = sw.get_active();
      if (newval != settingsData.get()) {
        settingsData.set(newval);
      }
    });

    const row = Adw.ActionRow.new();
    row.set_title(labelText);
    row.add_suffix(gtkSwitch);
    group.add(row);

    return gtkSwitch;
  }

  /**
   * Find widget by type
   *
   * @param {object} parent
   * @param {object} type
   */
  findWidgetByType(parent, type) {
    for (const child of [...parent]) {
      if (child instanceof type) return child;

      const match = this.findWidgetByType(child, type);
      if (match) return match;
    }
    return null;
  }
}
