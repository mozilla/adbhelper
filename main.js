
let {Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");
let adb = require("./adb");
const events = require("sdk/event/core");

const {devtools} = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const devtoolsRequire = devtools.require;
const {ConnectionManager} = devtoolsRequire("devtools/client/connection-manager");
let {Devices} = Cu.import("resource://gre/modules/devtools/Devices.jsm");

let promise;
try {
  promise = Cu.import("resource://gre/modules/commonjs/promise/core.js").Promise;
} catch (e) {
  promise = Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js").Promise;
}

Devices.helperAddonInstalled = true;
exports.shutdown = function() {
  Devices.helperAddonInstalled = false;
  adb.stop(true);
}

adb.start().then(function () {
  adb.trackDevices();
});

function onDeviceConnected(device) {
  console.log("CONNECTED: " + device);
  Devices.register(device, {
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
    shell: function(cmd) {
      return adb.shell(cmd);
    },
    forwardPort: function(local, remote) {
      return adb.forwardPort(local, remote);
    },
    isRoot: function() {
      let deferred = promise.defer();
      adb.shell("id").then(stdout => {
        let uid = stdout.match(/uid=(\d+)/)[1];
        if (uid == "0") {
          deferred.resolve(true);
        } else {
          deferred.resolve(false);
        }
      }, deferred.reject);
      return deferred.promise;
    },
    summonRoot: function() {
      return adb.root();
    },
  });
}

events.on(adb, "device-connected", onDeviceConnected);

events.on(adb, "device-disconnected", function (device) {
  console.log("DISCONNECTED: " + device);
  Devices.unregister(device);
});
