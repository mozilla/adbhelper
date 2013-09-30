
let {Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");
let adb = require("./adb");
const events = require("sdk/event/core");

const {devtools} = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const devtoolsRequire = devtools.require;
const {ConnectionManager} = devtoolsRequire("devtools/client/connection-manager");
let {Devices} = Cu.import("resource://gre/modules/devtools/Devices.jsm");

Devices.helperAddonInstalled = true;

let trackSocket;
exports.shutdown = function() {
  Devices.helperAddonInstalled = false;
  if (trackSocket)
    trackSocket.close();
  adb.kill(true);
}

adb.start().then(function () {
  trackSocket = adb.trackDevices();
});

events.on(adb, "needs-reboot", function () {
  adb.kill(false)
     .then(() => adb.start())
     .then(() => {
       trackSocket = adb.trackDevices();
     });
});

function onDeviceConnected(device) {
  console.log("ADBHELPER - CONNECTED: " + device);
  Devices.register(device, {
    connect: function () {
      let port = ConnectionManager.getFreeTCPPort();
      let local = "tcp:" + port;
      let remote = "localfilesystem:/data/local/debugger-socket";
      return adb.forwardPort(local, remote)
                .then(() => port);
    }
  });
}

events.on(adb, "device-connected", onDeviceConnected);

events.on(adb, "device-disconnected", function (device) {
  console.log("ADBHELPER - DISCONNECTED: " + device);
  Devices.unregister(device);
});
