let {Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");
let adb = require("./adb");
let fastboot = require("./fastboot");
const events = require("sdk/event/core");

const {devtools} = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const devtoolsRequire = devtools.require;
const {ConnectionManager} = devtoolsRequire("devtools/client/connection-manager");
let {Devices} = Cu.import("resource://gre/modules/devtools/Devices.jsm");
const {when: unload} = require("sdk/system/unload");

let promise;
try {
  promise = Cu.import("resource://gre/modules/commonjs/promise/core.js").Promise;
} catch (e) {
  promise = Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js").Promise;
}

// As of Firefox 36, WebIDE exposes an API to register new runtimes.
try {
  let Runtimes = devtoolsRequire("devtools/webide/runtimes");
  if (Runtimes && Runtimes.RuntimeScanners) {
    let scanner = require("./scanner");
    scanner.register();
  }
} catch (e) {}

Devices.helperAddonInstalled = true;
exports.shutdown = function() {
  Devices.helperAddonInstalled = false;
  adb.stop(true);
};

adb.start().then(function () {
  adb.trackDevices();
});

/**
 * A Device instance is created and registered with the Devices module whenever
 * ADB notices a new device is connected.
 *
 * Any changes here should be examined carefully for backwards compatibility
 * issues.  Other add-ons, like the Tools Adapter, make use of these low-level
 * device objects too.
 */
function Device(id) {
  this.id = id;
}

Device.prototype = {
  /**
   * DEPRECATED: This is specific to how we connect to Firefox OS.  Use cases
   * that interact with other kinds of devices should likely use the more
   * general |forwardPort| method directly.
   */
  connect: function (remotePort) {
    let port = ConnectionManager.getFreeTCPPort();
    let local = "tcp:" + port;
    let remote = "localfilesystem:/data/local/debugger-socket";
    if (remotePort) {
      remote = "tcp:" + remotePort;
    }
    return adb.forwardPort(local, remote)
              .then(() => port);
  },

  type: "adb",

  shell: adb.shell.bind(adb),
  forwardPort: adb.forwardPort.bind(adb),
  push: adb.push.bind(adb),
  pull: adb.pull.bind(adb),
  reboot: adb.reboot.bind(adb),
  rebootRecovery: adb.rebootRecovery.bind(adb),
  rebootBootloader: adb.rebootBootloader.bind(adb),

  isRoot: function() {
    return adb.shell("id").then(stdout => {
      if (stdout) {
        let uid = stdout.match(/uid=(\d+)/)[1];
        return uid == "0";
      } else {
        return false;
      }
    });
  },

  summonRoot: function() {
    return adb.root();
  },

  getModel: function() {
    if (this._modelPromise) {
      return this._modelPromise;
    }
    this._modelPromise = this.shell("getprop ro.product.model")
                             .then(model => model.trim());
    return this._modelPromise;
  }
};

/**
 * It may seem at first that registering devices with Device.jsm is no longer
 * needed, since they are now consumed in this same add-on in scanner.js (at
 * least for Firefox 36+ with new WebIDE API).  However, there are still use
 * cases for the Devices.jsm registry, as other add-ons can make use of these
 * low-level ADB devices if they know about other new runtimes to support on the
 * device.  This the approach used in the Fever Dream / Valence add-on to find
 * Chrome on Android, for example.
 */

Devices.on("fastboot-start-polling", fastboot.startPolling.bind(fastboot));
Devices.on("fastboot-stop-polling", fastboot.stopPolling.bind(fastboot));

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
