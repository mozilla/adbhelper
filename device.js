/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { ConnectionManager } =
  require("./devtools-require")("devtools/shared/client/connection-manager");
const adb = require("./adb");

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
  connect(remotePort) {
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

  isRoot() {
    return adb.shell("id").then(stdout => {
      if (stdout) {
        let uid = stdout.match(/uid=(\d+)/)[1];
        return uid == "0";
      }
      return false;
    });
  },

  summonRoot() {
    return adb.root();
  },

  getModel() {
    if (this._modelPromise) {
      return this._modelPromise;
    }
    this._modelPromise = this.shell("getprop ro.product.model")
                             .then(model => model.trim());
    return this._modelPromise;
  }
};

module.exports = Device;
