const usage = `
Usage:
node.exe filesflash.js <filename> <target_filename>

Intended use: Store static files for a web server on Espruino ESP8266 or ESP32.            

The program reads the file <filename> and writes the file <filename>.txt. The file <filename>.txt
writes the file <filename> as <target_filename> to the flash storage of the device:
Copy the contents of <filename>.txt into the terminal (default: left pane) of the Espruino IDE,
and the code will be executed line-by-line. Don't copy it into the code editor, don't send and
save it.
  <target_filename> must be not longer than 28 characters (including extension).
  <target_filename> can start with a slash, and contain more slashes (e.g. /img/welcome.png)
  <target_filename> containing the string '.boot' is not compressed with gzip (for .boot0, .bootcde etc.)

The program doesn't change the input file.

Note: Minify the files as much as you can, as the Esprunio has very limted RAM and can't
      serve the files in one chunk, but multiple small chuncks. Making page loads slower.
       (for running a web server).

      Transfer the files via TCP/IP if possible. Or use a short and good RS232 cable, limit
      the transfer speed don't blame me for slow transfers with errors over RS232.

Minification can reduce the file size by over 90%. Do this for every file, some Online-Tools:
html: https://kangax.github.io/html-minifier/ or https://www.willpeavy.com/tools/minifier/
js: https://www.toptal.com/developers/javascript-minifier
css: https://www.cleancss.com/css-minify/
jpeg: http://jpeg-optimizer.com/

Disclaimer:
Usage is forbidden for anyone without a working backup, restore and recovery solution.
To fix every error just call 'Computer: Fix. Authorization: Master-1-3-3-7-Omega'.
`;
const chunkSize = 128;
const fs = require('fs');
const { exit } = require('process');
const zlib = require('zlib');

// check args
const fnameIn = process.argv[2];
const fnameTarget = process.argv[3];
const fnameOut1 = fnameIn + '.1of2.txt';
const fnameOut2 = fnameIn + '.2of2.txt';

if ((typeof(fnameIn) === 'undefined') | (typeof(fnameTarget) === 'undefined')) {
  console.log(usage);
  process.exit();
}
if (fnameTarget.length > 28) {
  console.log(usage);
  process.exit();
}

// helper
const readAndZipFile = function(fnameIn, fnameTarget) {
  var fileExtension = fnameIn.split('.').pop();
  if (fnameTarget.indexOf('.boot') != -1 ) {
    fileExtension = fileExtension + ' (do no compress boot code)';
  }
  console.log('fileExtension: ' + fileExtension);
  switch (fileExtension) {
    case 'html':
    case 'js':
    case 'css':
      const dataIn = fs.readFileSync(fnameIn, 'utf8' );
      console.log('dataIn.length: ' + dataIn.length);
      return zlib.gzipSync(Buffer.from(dataIn), {level: 9, memLevel: 9})
      break;
    default:
      return fs.readFileSync(fnameIn);
  }
}

const writeToFile = function(fname, text) {
  fs.writeFileSync(fname, text, 'utf8');
}

const appendToFile = function(fname, line) {
  fs.appendFileSync(fname, line + '\n', 'utf8');
  //console.log(line);
}

// read the zip file
const dataOut = readAndZipFile(fnameIn, fnameTarget);
console.log('dataOut.length: ' + dataOut.length);
const fsize = dataOut.length; 

// write the compressed data
var chunkIndex = 0;

writeToFile(fnameOut1, `// Execute this JavaScript code on Espruino
// to write '` + fnameTarget + `' to flash.

var fname       = '` + fnameTarget + `';
var fsize       = ` + fsize + `;
var chunkIndex  = 0;
var chunkSize   = ` + chunkSize + `;

// helper function to convert a hex buffer to a string
var hex2str = function(hex) {
  var str = '';
  for (hex_index=0; hex_index<hex.length; hex_index += 2) {
    str += String.fromCharCode(parseInt(hex.substr(hex_index, 2), 16));
  }
  return str;
}

// Write the file to the flash

require('Storage').erase(fname);
require('Storage').write(fname, 0, 0, fsize);
`);

while (true) {
  var chunkLength = chunkIndex + chunkSize;
  if (chunkLength > fsize) {
    chunkLength = fsize;
  }
  const hexData = Buffer.from(dataOut).slice(chunkIndex, chunkLength).toString('hex');
  appendToFile(fnameOut1, `require('Storage').write(fname, hex2str('` +  hexData + `'), chunkIndex, fsize);`);
  chunkIndex = chunkIndex + chunkSize;  
  if (chunkIndex > fsize) {
    break;
  }
  appendToFile(fnameOut1, `chunkIndex = chunkIndex + chunkSize;`);
}
appendToFile(fnameOut1, `
console.log('File ' + fname + ' written to storage.');
require('Storage').read(fname).length;

//
// Here you might take a break and check if all writes returned true.
// And then do a hard reset to the device, i.e. reset button or power cycle.
//
`);

if (fnameTarget.indexOf('.boot') != -1 ) {
  console.log('Exit: Boot code goes to flash only, do not copy to filesystem. Skipping file 2of2.txt');
  exit();
}

writeToFile(fnameOut2, `// If you didn't reset the device, do it now before proceeding.

// This code will copy the file from flash to filesystem storage
// Well, writing directly to filesystem storage always failed on my device.

var fname       = '` + fnameTarget + `';
var fsize       = ` + fsize + `;
var chunkIndex  = 0;
var chunkSize   = 1000;

var createFilesystem = function() {
  // format the flash filesystem (if it's not there)
  // https://www.espruino.com/Reference#t_l_E_flashFatFS
  try {
    require('fs').readdirSync();
    console.log('Filesystem detected, ok.');
  } catch (e) {
    console.log('Filesystem not detected, formatting.');
    E.flashFatFS({ format: true });
    console.log('Filesystem Ok.');
  }
};

var createFolders = function() {
  // create the path (it'll throw an error if it's already)
  var folderNames = fname.split("/")
  var currentFolderName = "/";
  for (i=0; i<folderNames.length-1; i++) {
    currentFolderName = currentFolderName + folderNames[i]
    if (currentFolderName === "/") {
      continue;
    }
    try {
      require("fs").mkdirSync(currentFolderName);
      console.log("Folder " + currentFolderName + " created");
    } catch (e) {
      console.log("Folder " + currentFolderName + " could not be created");
      console.log(e);
    }
  }
};

var deleteExistingFile = function() {
  require("fs").unlinkSync(fname);
};

// Copy chunk by chunk
var copy = function() {
  data = require("Storage").read(fname, chunkIndex, chunkSize)
  r = require("fs").appendFileSync(fname, data)
  if (r == false) {
    clearInterval(copyInterval);
    console.log('Failed to write to Storage. Reset the device to fix it.');
  } else {
    console.log('Written chunk ' + chunkIndex);
  }
  chunkIndex = chunkIndex + chunkSize;
  
  if (chunkIndex > fsize) {
    clearInterval(copyInterval);
    console.log('Done');
  }
};

var callback = function() {
  // show the written file
  var folderNames = fname.split("/");
  var currentFolderName = "/";
  for (i=0; i<folderNames.length-1; i++) {
    currentFolderName = currentFolderName + folderNames[i];
    console.log('>require("fs").readdirSync(' + currentFolderName + ')');
    console.log(require("fs").readdirSync(currentFolderName));
  }
  console.log('Copy file done.')
};

createFilesystem();
createFolders();
deleteExistingFile();
console.log('Copy file starts')
var copyInterval = setInterval(copy, 100);

`);
