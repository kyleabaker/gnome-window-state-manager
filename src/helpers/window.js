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

function getMaximizedFlags(win) {
  let flags = 0;
  if (win.maximized_horizontally) flags |= Meta.MaximizeFlags.HORIZONTAL;
  if (win.maximized_vertically) flags |= Meta.MaximizeFlags.VERTICAL;
  return flags;
}

export class Window {
  constructor(windowData) {
    // If we passed a MetaWindow object
    if (windowData.get_frame_rect) {
      const rect = windowData.get_frame_rect();

      // FIX: Manually map properties so JSON.stringify can see them
      this._rect = {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };

      this._maximized = getMaximizedFlags(windowData);
      this._minimized = windowData.minimized;
      this._workspace = windowData.get_workspace().index();
      this._wm_class =
        typeof windowData.get_wm_class === 'function'
          ? windowData.get_wm_class()
          : windowData.wm_class || 'unknown';
      this._title = windowData.get_title();
      this._fullscreen = windowData.fullscreen;
    } else {
      // If we passed a plain object (loaded from JSON)
      Object.assign(this, windowData);
    }
  }

  restore(currentWindow) {
    // Workspace check must come before movement/resize
    this._configureWorkspace(currentWindow, this._workspace);

    if (!this._equalRect(currentWindow)) {
      if (getMaximizedFlags(currentWindow)) currentWindow.unmaximize();

      this._moveResizeFrame(currentWindow);
    }

    this._setMaximized(currentWindow);
    this._setMinimized(currentWindow);
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
    window.move_resize_frame(
      true,
      this._rect.x,
      this._rect.y,
      this._rect.width,
      this._rect.height
    );
  }

  _setMaximized(window) {
    const current = getMaximizedFlags(window);
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

  _configureWorkspace(window, workspaceIndex) {
    // FIX: Access n_workspaces via workspace_manager
    const wsCount = global.workspace_manager.n_workspaces;

    if (
      workspaceIndex < wsCount &&
      workspaceIndex !== window.get_workspace().index()
    ) {
      window.change_workspace_by_index(workspaceIndex, true);
    }
  }
}
