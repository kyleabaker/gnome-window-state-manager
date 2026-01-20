# GNOME Window State Manager for GNOME Shell

GNOME Window State Manager for GNOME Shell. This extension restores window positions for single and multi-screen configurations.

Window State Manager is a GNOME Shell extension to monitor window states (position on monitor, location, size, etc.) and restore them automatically to their previous positions when a change in layout occurs. It was created to solve an issue with GNOME on wayland where some programs won't remember their positions when device is docked and undocked.

This implementation introduces optimizations and bugfixes to the original implementation by [Kishor Viswanathan](https://github.com/kishorviswanathan/window-state-manager).

## Limitations

- Restore does not manage which windows are on top. However, in testing to date the correct windows have always been shown on top.
- State is saved in memory and is not preserved across restarts.

## Configuration

There is nothing to configure.

## Prerequisite

Note: This extension does not require any additional or external libraries for functionality.

## Installation

To install this extension you can either

- use http://extensions.gnome.org (caution: it may not contain the most recent versions)
- use the GNOME Shell Extension Manager
- copy it under ~/.local/share/gnome-shell/extensions/gnome-window-state-manager@kyleabaker.github.com/ in your home directory
- use the install.sh script to install automatically

Note: you may have to explicitly enable the extension using the GNOME Shell Extension Manager after installation.

You can install this extension by visiting [the GNOME Shell Extensions page](https://extensions.gnome.org/extension/) for this extension.

[<img src="assets/get-it-on-ego.png" height="100">](https://extensions.gnome.org/extension/)

## Troubleshooting

In case of update error please restart GNOME Shell via:

1. Xorg: press ALT+F2 then write r and press enter.
2. Wayland: end the session by logging out and log in again.

## License

This extension is released under the GNU Public License version 2.
