// Simple web server

const port = 80;
const wifi = require("Wifi");
const http = require('http');
const storage = require('Storage');

// wifi connect function
var wifiConnect = function(callback) {
  const wificfg = storage.readJSON('.wificfg');
  wifi.connect(wificfg.ssid, {password: wificfg.password}, function(err) {
    if (err) {
      console.log('Wifi setup failed.');
      // errror, reboot after 60s
      setTimeout(function() {
        reset();
      }, "60000");
    } else {
      // ok, call callback
      console.log('Wifi connection is up.');
      callback();
    }
  });
};

var onInit = function() {
  wifiConnect(startWebserver);
};

var startWebserver = function() {
  http.createServer(onPageRequest).listen(port);
  console.log("Server created at http://"+wifi.getIP().ip + ':' + port + '/');
};

var onPageRequest = function(req, res) {
  var url = req.url;
  switch (req.url) {
    case '/':
    case '/index.htm':
    case '/index.html':
      routeStorage('/index.html', req, res);
      break;
    case '/js/knockout-3.5.1.js':
    case '/js/javascript.js':
    case '/img01.jpg':
      routeStorage(url, req, res);
      break;
    case '/api/v1/process.env':
      routeProcessEnv(url, req, res);
      break;
    case '/api/v1/process.memory':
      routeProcessMemory(url, req, res);
      break;
    case '/favicon.ico':
    default:
      routeDefault(url, req, res);
  }
};

var routeStorage = function(url, req, res) {
  var filesize;
  // check if the file exists
  try {
    filesize = storage.read(url).length;
  } catch (e) {
    routeDefault(url, req, res);
  }
  if (typeof(filesize) == 'undefined') {
    routeDefault(url, req, res);
  }
  var header = { 'Content-Length': filesize };
  var fileExtension = url.split('.').pop();
  switch (fileExtension) {
    case 'html':
      header['Content-Type'] = 'text/html';
      header['Content-Encoding'] = 'gzip';
      break;
    case 'js':
      header['Content-Type'] = 'application/javascript';
      header['Content-Encoding'] = 'gzip';
      break;
    case 'css':
      header['Content-Type'] = 'text/css';
      header['Content-Encoding'] = 'gzip';
      break;
    case 'png':
      header['Content-Type'] = 'image/png';
      break;
    case 'jpeg':
    case 'jpg':
      header['Content-Type'] = 'image/jpeg';
      break;
    case 'gif':
      header['Content-Type'] = 'image/gif';
      break;
  }
  console.log('Sending file ' + url + '...');
  res.writeHead(200, header);
  var f = E.openFile(url);
  if (f == null) {
    console.log('Storage crashed. File sent aborted. Resetting.');
    reset();
    /*
      Note: When using a chunkSize bigger than 100 the
      filesystem might crash after a few transfers. A reset
      is needed to recover.
    */
  }
  var callbackSendData = function() {
    console.log('...sent.');
  };
  E.pipe(f, res, {'chunkSize': 100, complete: callbackSendData } );
  /*
    Note: A higher chunkSize will limit the amount of parallel
    transfers before crashing due to Low Memory. The duration
    needed to transfer the data will be smaller.
    Approx: 10x chunkSize => 2x faster transfer
    A value of 100 (one hundred) is working fine, also for
    repeated transfers.
    The callback-function is optional.
  */
};

var routeProcessEnv = function(url, req, res) {
  var data = JSON.stringify(process.env, null, 2);
  res.writeHead(200, {'Content-Type': 'text/json'});
  res.write(data);
  res.end();
};

var routeProcessMemory = function(url, req, res) {
  var data = JSON.stringify(process.memory(), null, 2);
  res.writeHead(200, {'Content-Type': 'text/json'});
  res.write(data);
  res.end();
};

var routeDefault = function(url, req, res) {
  var info = {'info': 'not found', 'url': url };
  var data = JSON.stringify(info, null, 2);
  res.writeHead(403, {'Content-Type': 'text/json'});
  res.write(data);
  res.end();
};

//onInit();
