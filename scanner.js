/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Cu } = require("chrome");
const EventEmitter =
  require("./devtools-require")("devtools/shared/event-emitter");
const { Task } = Cu.import("resource://gre/modules/Task.jsm", {});
const { when: unload } = require("sdk/system/unload");
const { ConnectionManager } =
  require("./devtools-require")("devtools/shared/client/connection-manager");
const { Devices } =
  require("./devtools-import")("resource://devtools/shared/apps/Devices.jsm");
const Runtimes =
  require("./devtools-require")("devtools/client/webide/modules/runtimes");

let promise;
try {
  promise = Cu.import("resource://gre/modules/commonjs/promise/core.js").Promise;
} catch (e) {
  promise = Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js").Promise;
}

let Scanner = {

  _runtimes: [],

  enable: function() {
    this._updateRuntimes = this._updateRuntimes.bind(this);
    Devices.on("register", this._updateRuntimes);
    Devices.on("unregister", this._updateRuntimes);
    Devices.on("addon-status-updated", this._updateRuntimes);
    this._updateRuntimes();
  },

  disable: function() {
    Devices.off("register", this._updateRuntimes);
    Devices.off("unregister", this._updateRuntimes);
    Devices.off("addon-status-updated", this._updateRuntimes);
  },

  _emitUpdated: function() {
    this.emit("runtime-list-updated");
  },

  _updateRuntimes: function() {
    if (this._updatingPromise) {
      return this._updatingPromise;
    }
    this._runtimes = [];
    let promises = [];
    for (let id of Devices.available()) {
      let device = Devices.getByName(id);
      promises.push(this._detectRuntimes(device));
    }
    this._updatingPromise = promise.all(promises);
    this._updatingPromise.then(() => {
      this._emitUpdated();
      this._updatingPromise = null;
    }, () => {
      this._updatingPromise = null;
    });
    return this._updatingPromise;
  },

  _detectRuntimes: Task.async(function*(device) {
    let model = yield device.getModel();
    let detectedRuntimes = yield FirefoxOSRuntime.detect(device, model);
    this._runtimes.push(...detectedRuntimes);
    detectedRuntimes = yield FirefoxOnAndroidRuntime.detect(device, model);
    this._runtimes.push(...detectedRuntimes);
  }),

  scan: function() {
    return this._updateRuntimes();
  },

  listRuntimes: function() {
    return this._runtimes;
  }

};

EventEmitter.decorate(Scanner);

function Runtime(device, model, socketPath) {
  this.device = device;
  this._model = model;
  this._socketPath = socketPath;
}

Runtime.prototype = {
  type: Runtimes.RuntimeTypes.USB,
  connect: function(connection) {
    let port = ConnectionManager.getFreeTCPPort();
    let local = "tcp:" + port;
    let remote = "localfilesystem:" + this._socketPath;
    return this.device.forwardPort(local, remote).then(() => {
      connection.host = "localhost";
      connection.port = port;
      connection.connect();
    });
  },
  get id() {
    return this.device.id + "|" + this._socketPath;
  },
};

function FirefoxOSRuntime(device, model) {
  Runtime.call(this, device, model, "/data/local/debugger-socket");
}

FirefoxOSRuntime.detect = Task.async(function*(device, model) {
  let runtimes = [];
  let query = "test -f /system/b2g/b2g; echo $?";
  let b2gExists = yield device.shell(query);
  // XXX: Sometimes we get an empty response back.  Likely a bug in our shell
  // code in this add-on.
  // There are also some Android devices that do not have `test` installed.
  for (let attempts = 3; attempts > 0; attempts--) {
    b2gExists = yield device.shell(query);
    if (b2gExists.length == 3) {
      break;
    }
  }
  if (b2gExists === "0\r\n") {
    let runtime = new FirefoxOSRuntime(device, model);
    console.log("Found " + runtime.name);
    runtimes.push(runtime);
  }
  return runtimes;
});

FirefoxOSRuntime.prototype = Object.create(Runtime.prototype);

Object.defineProperty(FirefoxOSRuntime.prototype, "name", {
  get: function() {
    return this._model || this.device.id;
  }
});

function FirefoxOnAndroidRuntime(device, model, socketPath) {
  Runtime.call(this, device, model, socketPath);
}

// This requires Unix socket support from Firefox for Android (35+)
FirefoxOnAndroidRuntime.detect = Task.async(function*(device, model) {
  let runtimes = [];
  // A matching entry looks like:
  // 00000000: 00000002 00000000 00010000 0001 01 6551588 /data/data/org.mozilla.fennec/firefox-debugger-socket
  let query = "cat /proc/net/unix";
  let rawSocketInfo = yield device.shell(query);
  let socketInfos = rawSocketInfo.split(/\r?\n/);
  // Filter to lines with "firefox-debugger-socket"
  socketInfos = socketInfos.filter(l => l.includes("firefox-debugger-socket"));
  // It's possible to have multiple lines with the same path, so de-dupe them
  let socketPaths = new Set();
  for (let socketInfo of socketInfos) {
    let socketPath = socketInfo.split(" ").pop();
    socketPaths.add(socketPath);
  }
  for (let socketPath of socketPaths) {
    let runtime = new FirefoxOnAndroidRuntime(device, model, socketPath);
    console.log("Found " + runtime.name);
    runtimes.push(runtime);
  }
  return runtimes;
});

FirefoxOnAndroidRuntime.prototype = Object.create(Runtime.prototype);

Object.defineProperty(FirefoxOnAndroidRuntime.prototype, "name", {
  get: function() {
    let packageName = this._socketPath.split("/")[3];
    let channel;
    switch (packageName) {
      case "org.mozilla.firefox":
        channel = "";
        break;
      case "org.mozilla.firefox_beta":
        channel = " Beta";
        break;
      case "org.mozilla.fennec_aurora":
        channel = " Aurora";
        break;
      case "org.mozilla.fennec":
        channel = " Nightly";
        break;
      default:
        channel = " Custom";
    }
    return "Firefox" + channel + " on Android (" +
           (this._model || this.device.id) + ")";
  }
});

exports.register = function() {
  // Only register our |Scanner| if the API exists
  if (Runtimes && Runtimes.RuntimeScanners) {
    // There may be an older ADB scanner registered by default
    // If so, we must disable it to avoid duplicate runtimes
    if (Runtimes.DeprecatedAdbScanner) {
      Runtimes.RuntimeScanners.remove(Runtimes.DeprecatedAdbScanner);
      unload(() => {
        Runtimes.RuntimeScanners.add(Runtimes.DeprecatedAdbScanner);
      });
    }
    // Add our scanner
    Runtimes.RuntimeScanners.add(Scanner);
    unload(() => {
      Runtimes.RuntimeScanners.remove(Scanner);
    });
  }
};
