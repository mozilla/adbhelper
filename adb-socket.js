/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cu } = require("chrome");
const { Services } = Cu.import("resource://gre/modules/Services.jsm", {});

// Starting with FF57, jsm share the same global and this require pulling it from it.
const { TextDecoder } =
  Cu.getGlobalForObject(Cu.import("resource://gre/modules/Services.jsm", {}));

function createTCPSocket(location, port, options) {
  // Starting with FF57, jsm share the same global and requires some special code
  const { TCPSocket } = Cu.getGlobalForObject(Cu.import("resource://gre/modules/Services.jsm", {}));

  // Starting with FF43, TCPSocket is now exposed via WebIDL
  if (TCPSocket) {
    return new TCPSocket(location, port, options);
  }

  // For FF42 and previous
  let scope = Cu.Sandbox(Services.scriptSecurityManager.getSystemPrincipal());
  scope.DOMError = Cu.import("resource://gre/modules/Services.jsm", {}).DOMError;
  Services.scriptloader.loadSubScript("resource://gre/components/TCPSocket.js", scope);
  scope.TCPSocket.prototype.initWindowless = function() {
    return true;
  };
  let socket = new scope.TCPSocket();
  return socket.open(location, port, options);
}
exports.createTCPSocket = createTCPSocket;

// Creates a socket connected to the adb instance.
// This instantiation is sync, and returns before we know if opening the
// connection succeeds. Callers must attach handlers to the s field.
class AdbSocket {
  constructor() {
    this.s = createTCPSocket("127.0.0.1", 5037, { binaryType: "arraybuffer" });
  }

  /**
   * Dump the first few bytes of the given array to the console.
   *
   * @param {TypedArray} aArray
   *        the array to dump
   */
  _hexdump(aArray) {
    let decoder = new TextDecoder("windows-1252");
    let array = new Uint8Array(aArray.buffer);
    let s = decoder.decode(array);
    let len = array.length;
    let dbg = "len=" + len + " ";
    let l = len > 20 ? 20 : len;

    for (let i = 0; i < l; i++) {
      let c = array[i].toString(16);
      if (c.length == 1)
        c = "0" + c;
      dbg += c;
    }
    dbg += " ";
    for (let i = 0; i < l; i++) {
      let c = array[i];
      if (c < 32 || c > 127) {
        dbg += ".";
      } else {
        dbg += s[i];
      }
    }
    console.debug(dbg);
  }

  // debugging version of tcpsocket.send()
  send(aArray) {
    this._hexdump(aArray);

    this.s.send(aArray.buffer, aArray.byteOffset, aArray.byteLength);
  }

  close() {
    if (this.s.readyState === "open" ||
        this.s.readyState === "connecting") {
      this.s.close();
    }
  }
}

exports.AdbSocket = AdbSocket;
