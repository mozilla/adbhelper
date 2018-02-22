/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * A module to track device changes
 * Mostly from original `adb.js`
 */

"use strict";

const { Cu } = require("chrome");
const { AdbSocket } = require("./adb-socket");

// Starting with FF57, jsm share the same global and this require pulling it from it.
const { TextEncoder, TextDecoder } =
  Cu.getGlobalForObject(Cu.import("resource://gre/modules/Services.jsm", {}));

const OKAY = 0x59414b4f;
const FAIL = 0x4c494146;

let _sockets = [ ];

// Return buffer, which differs between Gecko versions
function getBuffer(aPacket) {
  return aPacket.buffer ? aPacket.buffer : aPacket;
}

// @param aPacket         The packet to get the length from.
// @param aIgnoreResponse True if this packet has no OKAY/FAIL.
// @return                A js object { length:...; data:... }
function unpackPacket(aPacket, aIgnoreResponse) {
  let buffer = getBuffer(aPacket);
  console.debug("Len buffer: " + buffer.byteLength);
  if (buffer.byteLength === 4 && !aIgnoreResponse) {
    console.debug("Packet empty");
    return { length: 0, data: "" };
  }
  let lengthView = new Uint8Array(buffer, aIgnoreResponse ? 0 : 4, 4);
  let decoder = new TextDecoder();
  let length = parseInt(decoder.decode(lengthView), 16);
  let text = new Uint8Array(buffer, aIgnoreResponse ? 4 : 8, length);
  return { length, data: decoder.decode(text) };
}

// Checks if the response is expected (defaults to OKAY).
// @return true if response equals expected.
function checkResponse(aPacket, aExpected = OKAY) {
  let buffer = getBuffer(aPacket);
  let view = new Uint32Array(buffer, 0, 1);
  if (view[0] == FAIL) {
    console.debug("Response: FAIL");
  }
  console.debug("view[0] = " + view[0]);
  return view[0] == aExpected;
}

// @param aCommand A protocol-level command as described in
//  http://androidxref.com/4.0.4/xref/system/core/adb/OVERVIEW.TXT and
//  http://androidxref.com/4.0.4/xref/system/core/adb/SERVICES.TXT
// @return A 8 bit typed array.
function createRequest(aCommand) {
  let length = aCommand.length.toString(16).toUpperCase();
  while (length.length < 4) {
    length = "0" + length;
  }

  let encoder = new TextEncoder();
  console.debug("Created request: " + length + aCommand);
  return encoder.encode(length + aCommand);
}

function close() {
  _sockets.forEach(function(s) {
    s.close();
  });
}

function connect() {
  let tmp = new AdbSocket();
  _sockets.push(tmp);
  return tmp;
}

let client = {
  getBuffer,
  unpackPacket,
  checkResponse,
  createRequest,
  connect,
  close
};

module.exports = client;
