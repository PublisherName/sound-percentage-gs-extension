// sound-percentage@maestroschan.fr/extension.js
// GPL v3
// Copyright Romain F. T. 2018-2022
// Copyright Ignaz Kraft  2023-2024

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import GLib from 'gi://GLib';

const STREAM_UPDATED = 'stream-updated';
const STREAM_ADDED = 'stream-added';
const STREAM_REMOVED = 'stream-removed';

export default class SoundPercentageExtension {
	OUTPUT_SIGNAL_ID = undefined;
	INPUT_SIGNAL_ID = undefined;
	INPUT_STREAM_ADDED_SIGNAL_ID = undefined;
	INPUT_STREAM_REMOVED_SIGNAL_ID = undefined;
	_enableTimeoutId = undefined;

	/**
	 * Retrieves the volume input indicator from the GNOME Shell's quick settings panel.
	 * @returns {Object} The volume input indicator.
	 */
	getVolumeInput() {
		return Main.panel.statusArea.quickSettings._volumeInput;
	}


	/**
	 * Retrieves the volume output indicator from the GNOME Shell's quick settings panel.
	 * @returns {Object} The volume output indicator.
	 */
	getVolumeOutput() {
		return Main.panel.statusArea.quickSettings._volumeOutput;
	}


	/**
	 * Updates the volume percentage labels for both input and output indicators.
	 * Iterates over the indicators, retrieves the volume percentage, and updates the label.
	 * Handles errors and muted states by displaying appropriate values.
	 */
	updateVolume() {
		const output = this.getVolumeOutput();
		const input = this.getVolumeInput();

		if (!output || !input) return;

		for (const indicator of [output, input]) {
			let percent = '';
			let virtualMax = 0;
			let muted = false;
			let error = false;
			const IO = indicator._output || indicator._input;

			try {
				muted = IO._stream.is_muted;
			} catch (e) {
				error = true;
			}

			try {
				virtualMax = indicator._control.get_vol_max_norm();
			} catch (e) {
				error = true;
			}

			if (error) {
				percent = '?';
			} else {
				let volume = muted ? 0 : IO.stream.volume;
				percent = Math.round(volume / virtualMax * 100) + '%';
			}

			if (!indicator._indicator.visible) {
				percent = '';
			}

			indicator._percentageLabel.text = percent;
		}
	}

	/**
	 * Handles connecting or disconnecting event listeners for volume updates.
	 * @param {boolean} connect - If true, connects signals; if false, disconnects signals.
	 */
	handleConnections(connect) {
		const output = this.getVolumeOutput()._output;
		const input = this.getVolumeInput()._input;

		const connections = [
			{ source: output, signal: STREAM_UPDATED, idProperty: 'OUTPUT_SIGNAL_ID' },
			{ source: input, signal: STREAM_UPDATED, idProperty: 'INPUT_SIGNAL_ID' },
			{ source: input._control, signal: STREAM_ADDED, idProperty: 'INPUT_STREAM_ADDED_SIGNAL_ID' },
			{ source: input._control, signal: STREAM_REMOVED, idProperty: 'INPUT_STREAM_REMOVED_SIGNAL_ID' }
		];

		connections.forEach(conn => {
			if (connect) {
				this[conn.idProperty] = conn.source.connect(conn.signal, () => this.updateVolume());
			} else {
				conn.source.disconnect(this[conn.idProperty]);
			}
		});
	}


	/**
	 * Connects event listeners to update the volume percentage when the stream is updated, added, or removed.
	 * Stores the signal IDs for later disconnection.
	 */
	connect() {
		this.handleConnections(true);
	}


	/**
	 * Disconnects the previously connected event listeners using the stored signal IDs.
	 */
	disconnect() {
		this.handleConnections(false);
	}


	/**
	 * Adds a label to display the volume percentage for the given indicator.
	 * @param {Object} indicator - The volume indicator (input or output).
	 */
	addPercentageLabel(indicator) {
		indicator._percentageLabel = new St.Label({
			y_expand: true,
			y_align: Clutter.ActorAlign.CENTER
		});
		indicator.add_child(indicator._percentageLabel);
		indicator.add_style_class_name('power-status');
	}


	/**
	 * Removes the volume percentage label from the given indicator.
	 * @param {Object} indicator - The volume indicator (input or output).
	 */
	removePercentageLabel(indicator) {
		indicator._percentageLabel.destroy();
	}


	/**
	 * Enables the extension by adding percentage labels to both input and output indicators,
	 * updating the volume, and connecting the event listeners.
	 */
		enable() {
		let retries = 0;
		const MAX_RETRIES = 10;
		const RETRY_DELAY_MS = 100;

		const tryEnable = () => {
			const output = this.getVolumeOutput();
			const input = this.getVolumeInput();

			if (output && input) {
				if (this._enableTimeoutId) {
					GLib.Source.remove(this._enableTimeoutId);
					this._enableTimeoutId = undefined;
				}

				[output, input].forEach(indicator => {
					this.addPercentageLabel(indicator);
				});
				this.updateVolume();
				this.connect();
				return false;
			}

			if (retries < MAX_RETRIES) {
				retries++;
				this._enableTimeoutId = GLib.timeout_add(
					GLib.PRIORITY_DEFAULT,
					RETRY_DELAY_MS,
					tryEnable
				);
				return false;
			} else {
				console.warn('Sound Percentage: Could not find volume indicators after retries.');
				if (this._enableTimeoutId) {
					GLib.Source.remove(this._enableTimeoutId);
					this._enableTimeoutId = undefined;
				}
				return false;
			}
		};

		tryEnable();
	}


	/**
	 * Disables the extension by disconnecting the event listeners and removing the percentage labels
	 * from both input and output indicators.
	 */
	disable() {
		if (this._enableTimeoutId) {
			GLib.Source.remove(this._enableTimeoutId);
			this._enableTimeoutId = undefined;
		}

		this.disconnect();
		const output = this.getVolumeOutput();
		const input = this.getVolumeInput();

		[output, input].forEach(indicator => {
			if (indicator && indicator._percentageLabel) {
				this.removePercentageLabel(indicator);
			}
		});
	}
}