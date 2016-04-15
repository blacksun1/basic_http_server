"use strict";

/*******************************************************************************
The MIT License (MIT)

Copyright (c) 2016 Simon Bruce

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*******************************************************************************/

const http = require("http");
const fs = require("fs");
const path = require("path");

const port = 1337;

/**
 * Sends to the response the results of an error.
 *
 * @method   simpleBoom
 * @param    {response} response        - The response object to send the
 *                                        message on
 * @param    {int}      httpStatusCode  - The HTTP status code to be sent
 * @return   {}
 */
function simpleBoom(response, httpStatusCode) {
  response.writeHead(httpStatusCode, {'Content-Type': 'text/plain'});
  return response.end(`Error: ${httpStatusCode}\n`);
}

/**
 * An array of regular expressions and mimetypes. These are used by the
 * simpleMimeType function to return the correct mimetype for a file
 *
 * @type     {Array}
 */
const mimeTypes = [
  [/.css$/, "text/css"],
  [/.gif$/, "image/gif"],
  [/.htm$/, "text/html"],
  [/.html$/, "text/html"],
  [/.jpeg$/, "image/jpeg"],
  [/.jpg$/, "image/jpeg"],
  [/.png$/, "image/png"],
  [/.txt$/, "text/plain"],
];

/**
 * From the filePath return an appropriate mime type.
 *
 * @method     simpleMimeType
 * @param      {string}  filePath - The path of the file to return the mime type for
 * @return     {string}  The mime type. Defaults to text/plain
 */
function simpleMimeType(filePath) {
  for (let i = 0; i < mimeTypes.length; i++ ) {
    if (mimeTypes[i][0].test(filePath)) {
      return mimeTypes[i][1];
    }
  }

  return "text/plain";
}

/**
 * Event fired on every request. Handles returning the file to the user.
 * @param    {request} req - The HTTP request object
 * @param    {response} res - The HTTP response object
 * @return   {}
 */
function onServerRequest(req, res) {
  req.setEncoding("utf8");
  let body = "";
  let errorMessage = "";

  res.on("finish", () => console.log(`${new Date()}, ${req.method}, ${req.url}, ${res.statusCode}, ${errorMessage}`));

  if(req.method !== "GET") {
    errorMessage = "Request method not GET"
    return simpleBoom(400);
  }

  if(!req.url || req.url.length > 1000) {
    errorMessage = "Request URL length not inside expected bounds.";
    return simpleBoom(res, 500);
  }

  // If it is a folder then try to open a default page
  let filePath = path.join("files/", req.url);
  const filePathParsed = path.parse(filePath);
  if (filePathParsed.dir === "" && filePathParsed.base.length > 0) {
    filePath = path.join(filePath, "index.html");
  }

  const readStream = fs.createReadStream(filePath);

  readStream.on("error", error => {
    let httpStatusCode = 500;

    // Error NO ENTry - File not found
    if (error.code === "ENOENT") {
      httpStatusCode = 404;
    }

    errorMessage = `Error when opening '${filePath}': ${error.message}`;
    simpleBoom(res, httpStatusCode);
  });

  req.on("error", error => {
    errorMessage = `An error occurred in the response: ${error.message}\n`;
  });

  res.writeHead(200, {
    "Content-Type": simpleMimeType(filePath),
    "Transfer-Encoding": "chunked"
  });

  readStream
    .pipe(res);
}

/**
 * Event fired when the server is up and listening to new requests
 * @return   {}
 */
function onServerListening() {
  console.log("The server is now listening");
}

/**
 * Event fired when the server is closed and no longer taking requests.
 * @return   {}
 */
function onServerClose() {
  console.log("Server closed");
  // This is just to please node-e-mon
  try {
    process.kill(process.pid, "SIGUSR2");
  } catch(error) {
    // Windows doesn't know what a SIGUSR2 is
    if (error.message === "Unknown signal: SIGUSR2") {
      return;
    }
    return console.log(`Unknown Error: ${error.message}`);
  }
}

/**
 * Event fired when a client error occurs on the server object
 * @param    {error} exception - The client error that occurred
 * @param    {net.Socket} socket - The net.Socket object that the error originated from.
 * @return   {}
 */
function onServerClientError(exception, socket) {
  console.error("Client Error occurred");
  console.error(`Exception: ${exception.message}`);
}

/**
 * Event fired on SIGINT (CTRL+c) and SIGUSR2
 * @return   {}
 */
function onProcessClose() {
  console.log();
  console.log("Closing web server");
  server.close();
}

/**
 * Wire up events on the process object to let the application close down clean.
 */

// This is handled to let the application close down clean.
process.once("SIGINT", onProcessClose);

// SIGUSR2 is fired from node-e-mon and allows closing down clean.
// Also see process.kill in onServerClose
process.once('SIGUSR2', onProcessClose);

/**
 * Start up the server and wire up our events.
 */

const server = http.createServer(onServerRequest);
server.on("listening", onServerListening);
server.on("close", onServerClose);
server.on("clientError", onServerClientError);
server.listen(port);
