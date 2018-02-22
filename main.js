/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/* global adb, fastboot, Device */

const { Cu } = require("chrome");

const { defineLazyGetter } =
  require("./devtools-require")("devtools/shared/DevToolsUtils");

const events = require("./events");
const unload = require("./unload");

const { Devices } =
  require("./devtools-import")("resource://devtools/shared/apps/Devices.jsm");
const { gDevToolsBrowser } =
  require("./devtools-import")("resource://devtools/client/framework/gDevTools.jsm");
defineLazyGetter(this, "adb", () => {
  return require("./adb");
});
defineLazyGetter(this, "fastboot", () => {
  return require("./fastboot");
});
defineLazyGetter(this, "Device", () => {
  return require("./device");
});

Cu.import("resource://gre/modules/Services.jsm");

// Set this right away on startup
Devices.helperAddonInstalled = true;
unload(() => Devices.helperAddonInstalled = false);

function onADBStart() {
  // As of Firefox 36, WebIDE exposes an API to register new runtimes.
  let Runtimes =
    require("./devtools-require")("devtools/client/webide/modules/runtimes");
  if (Runtimes && Runtimes.RuntimeScanners) {
    let scanner = require("./scanner");
    scanner.register();
  }

  adb.start().then(function() {
    adb.trackDevices();
  });
}
Devices.on("adb-start-polling", onADBStart);
unload(() => Devices.off("adb-start-polling", onADBStart));

/**
 * For Firefox 41 and earlier, WebIDE does not emit "adb-start-polling" to
 * enable this add-on lazily.  So, we check for WebIDE startup using a promise
 * added in Firefox 39.
 * For Firefox 38 and earlier, we don't have the WebIDE promise either, so we
 * fallback to starting ADB at startup as we did before.
 */
let version = Number.parseInt(Services.appinfo.version.split(".")[0]);
if (Services.appinfo.ID == "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}" && version < 42) {
  if (gDevToolsBrowser.isWebIDEInitialized) {
    gDevToolsBrowser.isWebIDEInitialized.promise.then(onADBStart);
  } else {
    onADBStart();
  }
}

function onADBStop() {
  adb.stop(true);
}
Devices.on("adb-stop-polling", onADBStop);
unload(() => Devices.off("adb-stop-polling", onADBStop));
unload(() => onADBStop());

function onFastbootStart() {
  fastboot.startPolling();
}
Devices.on("fastboot-start-polling", onFastbootStart);
unload(() => Devices.off("fastboot-start-polling", onFastbootStart));

function onFastbootStop() {
  fastboot.stopPolling();
}
Devices.on("fastboot-stop-polling", onFastbootStop);
unload(() => Devices.off("fastboot-stop-polling", onFastbootStop));
unload(() => onFastbootStop());

/**
 * It may seem at first that registering devices with Device.jsm is no longer
 * needed, since they are now consumed in this same add-on in scanner.js (at
 * least for Firefox 36+ with new WebIDE API).  However, there are still use
 * cases for the Devices.jsm registry, as other add-ons can make use of these
 * low-level ADB devices if they know about other new runtimes to support on
 * the device.  This the approach used in the Valence add-on to find Chrome on
 * Android, for example.
 */
function onConnected(deviceId) {
  console.log("CONNECTED: " + deviceId);
  let device = new Device(deviceId);
  Devices.register(deviceId, device);
}
events.on(adb, "device-connected", onConnected);
unload(() => events.off(adb, "device-connected", onConnected));

function onDisconnected(deviceId) {
  console.log("DISCONNECTED: " + deviceId);
  Devices.unregister(deviceId);
}
events.on(adb, "device-disconnected", onDisconnected);
unload(() => events.off(adb, "device-disconnected", onDisconnected));
