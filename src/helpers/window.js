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

import { Logger } from './logger.js';

export class Window {
  constructor(windowData) {
    // If we passed a MetaWindow object
    if (windowData.get_frame_rect) {
      const rect = windowData.get_frame_rect();

      this._above = windowData.is_above();
      this._fullscreen = windowData.fullscreen;
      this._maximized = Window.getMaximizedFlags(windowData);
      this._minimized = windowData.minimized;
      this._on_all_workspaces = windowData.is_on_all_workspaces();
      // Manually map rect properties so JSON.stringify can see them
      this._rect = {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
      this._stable_sequence =
        typeof windowData.get_stable_sequence === 'function'
          ? windowData.get_stable_sequence()
          : null;
      this._title = windowData.get_title();
      this._wm_class =
        typeof windowData.get_wm_class === 'function'
          ? windowData.get_wm_class()
          : windowData.wm_class || 'unknown';
      this._workspace = windowData.get_workspace?.()?.index?.() ?? 0;
    } else {
      // If we passed a plain object (loaded from JSON)
      Object.assign(this, windowData);
    }
  }

  static isStateEqual(savedState, metaWindow) {
    const rect = metaWindow.get_frame_rect();
    if (
      savedState._rect.x !== rect.x ||
      savedState._rect.y !== rect.y ||
      savedState._rect.width !== rect.width ||
      savedState._rect.height !== rect.height
    )
      return false;

    if (savedState._maximized !== Window.getMaximizedFlags(metaWindow))
      return false;

    const currentWorkspace = metaWindow.get_workspace();
    if (
      savedState._workspace !==
      (currentWorkspace ? currentWorkspace.index() : 0)
    )
      return false;

    if (
      savedState._minimized !== undefined &&
      savedState._minimized !== metaWindow.minimized
    )
      return false;

    if (
      savedState._fullscreen !== undefined &&
      savedState._fullscreen !== metaWindow.fullscreen
    )
      return false;

    if (
      savedState._above !== undefined &&
      savedState._above !== metaWindow.is_above()
    )
      return false;

    if (
      savedState._on_all_workspaces !== undefined &&
      savedState._on_all_workspaces !== metaWindow.is_on_all_workspaces()
    )
      return false;

    return true;
  }

  restore(currentWindow) {
    // Workspace check must come before movement/resize
    this._configureWorkspace(currentWindow, this._workspace);

    if (!this._equalRect(currentWindow)) {
      if (Window.getMaximizedFlags(currentWindow)) currentWindow.unmaximize();

      this._moveResizeFrame(currentWindow);
    }

    this._setMaximized(currentWindow);
    this._setMinimized(currentWindow);

    this._setFullscreen(currentWindow);
    this._setIsAbove(currentWindow);
    this._setIsOnAllWorkspaces(currentWindow);

    // Focus the restored window, necessary for multi-workspace support
    if (!this._minimized) {
      const workspace = currentWindow.get_workspace();
      const currentTime = global.get_current_time();
      if (workspace) workspace.activate(currentTime);

      currentWindow.activate(currentTime);
    }
  }

  _equalRect(window) {
    const r = window.get_frame_rect();
    return (
      this._rect.x === r.x &&
      this._rect.y === r.y &&
      this._rect.width === r.width &&
      this._rect.height === r.height
    );
  }

  _moveResizeFrame(window) {
    Logger.debug(`Resizing window: ${this._rect.x},${this._rect.y}`);

    // Call move_frame first to prime the window position. This fixes issue
    // where move_resize_frame is ignored in GNOME 45-49 during load.
    window.move_frame(true, this._rect.x, this._rect.y);

    // Now apply the full move and resize
    window.move_resize_frame(
      true,
      this._rect.x,
      this._rect.y,
      this._rect.width,
      this._rect.height
    );
  }

  _setMaximized(window) {
    const current = Window.getMaximizedFlags(window);
    if (current !== this._maximized) {
      if (this._maximized) window.maximize();
      else window.unmaximize();
    }
  }

  _setMinimized(window) {
    if (window.minimized !== this._minimized) {
      if (this._minimized) window.minimize();
      else window.unminimize();
    }
  }

  static getMaximizedFlags(window) {
    let flags = 0;
    if (window.maximized_horizontally) flags |= Meta.MaximizeFlags.HORIZONTAL;
    if (window.maximized_vertically) flags |= Meta.MaximizeFlags.VERTICAL;
    return flags;
  }

  _setFullscreen(window) {
    if (window.fullscreen !== this._fullscreen) {
      if (this._fullscreen) window.make_fullscreen();
      else window.unmake_fullscreen();
    }
  }

  _setIsAbove(window) {
    if (window.is_above() !== this._above) {
      if (this._above) window.make_above();
      else window.unmake_above();
    }
  }

  _setIsOnAllWorkspaces(window) {
    if (window.is_on_all_workspaces() !== this._on_all_workspaces) {
      if (this._on_all_workspaces) window.stick();
      else window.unstick();
    }
  }

  _configureWorkspace(window, workspaceIndex) {
    // FIX: Access n_workspaces via workspace_manager
    const wsCount = global.workspace_manager.n_workspaces;

    const currentWorkspace = window.get_workspace();
    if (
      workspaceIndex < wsCount &&
      (!currentWorkspace || workspaceIndex !== currentWorkspace.index())
    ) {
      window.change_workspace_by_index(workspaceIndex, true);
    }
  }
}
