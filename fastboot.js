/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Wrapper around the fastboot utility.

"use strict";

// Whether or not this script is being loaded as a CommonJS module
// (from an add-on built using the Add-on SDK).  If it isn't a CommonJS Module,
// then it's a JavaScript Module.

const { Cu } = require("chrome");
const { Subprocess } = Cu.import("resource://gre/modules/Subprocess.jsm", {});
const { setInterval, clearInterval } = Cu.import("resource://gre/modules/Timer.jsm", {});
const { PromiseUtils } = Cu.import("resource://gre/modules/PromiseUtils.jsm", {});
const { getFileForBinary } = require("./binary-manager");
const { Devices } =
  require("./devtools-import")("resource://devtools/shared/apps/Devices.jsm");

let fastbootTimer = null;
let fastbootDevices = [];

const Fastboot = {
  get fastbootDevices() {
    return fastbootDevices;
  },
  set fastbootDevices(newVal) {
    fastbootDevices = newVal;
  },

  get fastbootFilePromise() {
    if (this._fastbootFilePromise) {
      return this._fastbootFilePromise;
    }
    this._fastbootFilePromise = getFileForBinary("fastboot");
    return this._fastbootFilePromise;
  },

  async do(args, serial) {
    let deferred = PromiseUtils.defer();
    let out_buffer = [];
    let err_buffer = [];

    if (serial && typeof(serial) === "string") {
      args.unshift("-s", serial);
    }

    let binary = await this.fastbootFilePromise;
    let callPayload = {
      command: binary,
      arguments: args,
      stdout(data) {
        out_buffer.push(data);
      },
      stderr(data) {
        err_buffer.push(data);
      },
      done() {
        deferred.resolve({ stdout: out_buffer, stderr: err_buffer });
      }
    };

    Subprocess.call(callPayload);

    return deferred.promise;
  },

  startPolling: function fastboot_startPolling() {
    console.debug("IN fastboot_startPolling");

    if (fastbootTimer !== null) {
      console.warn("Fastboot poll already running.");
      return;
    }

    let doPoll = (function() {
      this.devices().then((devices) => {
        let added = [];
        let removed = [];

        if (devices.sort() === this.fastbootDevices.sort()) {
          console.debug("No change.");
          return;
        }

        console.debug("Read devices from fastboot output", devices);

        for (let dev of devices) {
          if (!this.fastbootDevices.includes(dev)) {
            added.push(dev);
          }
        }

        console.debug("Fastboot devices added", added);

        for (let dev of this.fastbootDevices) {
          // listed in previous devices and not in the current one
          if (!devices.includes(dev)) {
            removed.push(dev);
          }
        }

        console.debug("Fastboot devices removed", removed);

        this.fastbootDevices = devices;

        for (let dev of added) {
          let fbdevice = new FastbootDevice(dev);
          Devices.register(dev, fbdevice);
        }

        for (let dev of removed) {
          Devices.unregister(dev);
        }
      });
    }).bind(this);

    console.log("fastboot_polling starting");
    fastbootTimer = setInterval(doPoll, 2000);
  },

  stopPolling: function fastboot_stopPolling() {
    console.debug("IN fastboot_stopPolling");
    console.log("fastboot_polling stopping");
    clearInterval(fastbootTimer);
    fastbootTimer = null;
  },

  // Sends back an array of device names.
  devices: function fastboot_devices() {
    return this.do(["devices"]).then(
      function onSuccess(data) {
        let devices = [];
        for (let line of data.stdout) {
          let [ sn, mode ] = line.trim().split("\t");
          if (mode === "fastboot") {
            devices.push(sn);
          }
        }
        return devices;
      }, function onError(error) {
        return [];
      });
  },

  getvar: function fastboot_getvar(varname, serial) {
    return this.do(["getvar", varname], serial).then(
      function onSuccess(data) {
        console.debug("getvar", data);
        // product: D6603finished. total time: 0.003s
        for (let line of data.stderr.join("\n").split("\n")) {
          if (line.includes(":")) {
            return line.split(":")[1].trim();
          }
        }
        return "";
      }, function onError(error) {
        console.debug("error getvar", error);
        return "";
      }
    );
  },

  flash: function fastboot_flash(partition, image, serial) {
    return this.do(["flash", partition, image], serial).then(
      function onSuccess(data) {
        console.debug("flash", partition, image);
        // sending 'recovery' (5334 KB)...
        // OKAY [  0.545s]
        // writing 'recovery'...
        // OKAY [  0.891s]
        // finished. total time: 1.436s

        let flashProgress = {
          sending:   false,
          sendingOk: false,
          writing:   false,
          writingOk: false,
          finished:  false
        };

        console.debug("fastboot flash reported:", data);
        let fullOutput = data.stderr.join("\n").split("\n");

        console.debug("Will look into", fullOutput);
        for (let line of fullOutput) {
          console.debug("Read:", line);
          if (!line || !line.includes(" ")) {
            console.debug("No space ...");
            continue;
          }

          let first = line.split(" ")[0];
          console.debug("Checking with:", first);
          switch (first) {
            case "sending": flashProgress.sending = true; break;
            case "writing": flashProgress.writing = true; break;
            case "finished.": flashProgress.finished = true; break;
            case "OKAY":
              if (flashProgress.sending && !flashProgress.writing) {
                flashProgress.sendingOk = true;
              } else if (flashProgress.sending && flashProgress.writing) {
                flashProgress.writingOk = true;
              }
              break;
            default:
              console.debug("Unknown state: ", first);
          }
        }

        return flashProgress;
      }, function onError(error) {
        console.debug("error flash", error);
        return "";
      }
    );
  },

  reboot: function fastboot_reboot(serial) {
    return this.do(["reboot"], serial);
  }
};

// Fastboot object
function FastbootDevice(id) {
  this.id = id;
}

FastbootDevice.prototype = {

  type:    "fastboot",
  devices: Fastboot.devices.bind(Fastboot),
  flash:   Fastboot.flash.bind(Fastboot),
  getvar:  Fastboot.getvar.bind(Fastboot),
  reboot:  Fastboot.reboot.bind(Fastboot),

  startPolling: Fastboot.startPolling.bind(Fastboot),
  stopPolling:  Fastboot.stopPolling.bind(Fastboot)

};

module.exports = Fastboot;
