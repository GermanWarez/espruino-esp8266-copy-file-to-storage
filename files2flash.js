const usage = `
Usage:
node.exe files2flash.js <filename> <target_filename>

Intended use: Store static files for a web server on Espruino ESP8266 or ESP32.
The program reads the file <filename> and writes the file <filename>1of2.txt
<filename> and .2of.txt. These two files write the contents of file <filename>
as <target_filename> to the flash storage of the device:
Copy the contents of <filename>.1of2.txt into the terminal (default: left pane)
of the Espruino IDE, and the code will be executed line-by-line. Don't copy it
into the code editor, don't send and save it. Then reset the device, and repeat
with <filename>.2of2.txt.
  <target_filename> must be not longer than 28 characters (including extension).

html, css and js files are compressed with gzip.

      Transfer the files via TCP/IP if possible. Or use a short and good RS232 cable, limit
      the transfer speed and expect bit errors over RS232.
`;
const chunkSize = 128;
const fs = require('fs');
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
const readAndZipFile = function(fnameIn) {
  const fileExtension = fnameIn.split('.').pop();
  console.log(fileExtension)
  switch (fileExtension) {
    case 'html':
    case 'js':
    case 'css':
      const dataIn = fs.readFileSync(fnameIn, 'utf8' );
      console.log('dataIn.length:' + dataIn.length);
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
const dataOut = readAndZipFile(fnameIn);
console.log('dataOut.length:' + dataOut.length);
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

/*
  
  //kills the res variable
  var sendData = function(res) {
    console.log(chunkIndex, process.memory());
    res.write(storage.read(url, chunkIndex, chunkSize));
    chunkIndex = chunkIndex + chunkSize;
    if (chunkIndex > filesize) {
      clearInterval(sendDataInterval);
    }
  };
  //var sendDataInterval = setInterval(sendData, 100);

  // while true with sleep => memory==0
  while (false) {
    console.log(chunkIndex, process.memory());
    console.log(E.getSizeOf(global,2));
    res.write(storage.read(url, chunkIndex, chunkSize));
    chunkIndex = chunkIndex + chunkSize;
    if (chunkIndex > filesize) {
      break;
    }
    if (process.memory().free < 500) {
      sleep(3000);
    }
  }
  */

// Save to fs -> blocks after 10 tries
/*
appendToFile('// helper function to format the flash filesystem');
appendToFile('// https://www.espruino.com/Reference#t_l_E_flashFatFS');
appendToFile('try {');
appendToFile('  require("fs").readdirSync();');
appendToFile('} catch (e) {');
appendToFile('  E.flashFatFS({ format: true });');
appendToFile('}');
appendToFile('');
*/
 /*
 appendToFile('// create the path');
appendToFile('var folderNames = fname.split("/")');
appendToFile('var currentFolder = "/";');
appendToFile('for (i=0; i<folderNames.length-1; i++) {');
appendToFile('  currentFolder = currentFolder + folderNames[i]');
appendToFile('  if (currentFolder === "/") {');
appendToFile('    continue;');
appendToFile('  }');
appendToFile('  try {');
appendToFile('    require("fs").mkdirSync(currentFolder);');
appendToFile('    console.log("Folder " + currentFolder + " created");');
appendToFile('  } catch (e) {');
appendToFile('    console.log("Folder " + currentFolder + " could not be created");');
appendToFile('    console.log(e);');
appendToFile('  }');
appendToFile('}');
appendToFile('');
 */
/*
appendToFile('require("fs").appendFileSync(fname, hex2str("' +  hexData + '"));');
*/
