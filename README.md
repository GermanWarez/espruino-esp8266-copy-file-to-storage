## espruino/esp8266/copy-file-to-storage
Here's a JavaScript 'files2flash.js' to help storing large files on any microcontroller running Esprunio. It uses gzip compression for html, js and css files. All other file types aren't compressed. The Espruino IDE can transfer files to Storage, but wouldn't work for large files.

### Description
The script was developed to serving of large, static files with a web server on an ESP8266-12F (4MB flash) running Espruino. The offical firmware releases for ESP8266 don't include the __Filesystem__ module. This module is needed to serve large files, therefore you'll have to compile a custom firmware for the ESP8266.\
Notes: 
- ESP8266 can transfer only one file at a time, parallel transfers will crash the Filesystem module (Tested on Espruino 2v13).
- ESP8266 is extremely slow serving web sites. Therefore, you must compress all web pages as much as you can, including images.
- The Filesystem storage is limited to 1 MB. That is more than enough given the low bandwidth.
- Esprunino doesn't support https on ESP8266.

### Github Actions: Build a custom firmware with "FlashFS" and "Filesystem" support
Use .github/workflows/Build_ESP8266_and_ESP32_webserver_firmware.yml to build a custom firmware for ESP8266 (and ESP32) with the modules FlashFS and Filesystem. As a webserver doesn't need the module Graphics, this is excluded from the build. The custom firmware build for ESP32 doesn't include the module BLUETOOTH. And OTA is excluded, too.\
The module TELNET is included in the custom firmware. (With TELNET you can connect to the ESP8266 via TCP/IP which allows a faster and more reliable data tansfer th, and it also allows to update the code for development purposes. It's in every Espruino firmware by default. It's not secure, there's no authentication at all. But useful during development.) The module NEOPIXEL is included, too. It might come in handy to control some RGB LEDS using the web server.

### Flashing
Flashing works fine with https://github.com/nodemcu/nodemcu-flasher or https://github.com/espressif/esptool on both Windows and Linux. The flash mode 'dio' works on every flash module, and is more reliable in my experience.

### How to copy a file to an ESP8266
Execute the script 'file2flash.js' with nodejs and pass the input file as the first argument and the desired name on the Espruino storage as second argument. E.g.\
`node file2flash.js ../../foo/bar/index.html /index.html` or `node file2flash.js ../../foo/bar/kitten.jpg /images/kitten.jpg`\
This example assumes that you have nodejs installed and in your path, that the source file is 'index.html' (or 'kitten.jpg') somewhere in your filesystem and you want the target filename 'index.html' to be located in root of the file system, and 'kitten.jpg' to be located in the folder 'images'.\
The script 'file2flash.js' will create two text files, with the same name as the input file name and the extensions '.1of2.txt' and '.2of2.txt' (overwrite any exisiting files with the same name). They will be located in the same folder as the input file. These files will create the target file in the Espruino Filesystem storage: Open these files with a text editor, connect to the ESP8266 with the Espruino IDE using the TCP/IP connection (The serial connection is known for bit-errors, just don't use it, not for this usecase with large and/or binary files). And then, just copy-and-paste the contents of the first file directly into the left side of the Espruino IDE, it'll be executed line by line and write the contents of the input file into the Flash. storage. Next, reset the ESP8266, do a hard reset via reset button or power cycle. Finally, repeat the first step with the second file, copy-and-paste it to the left side of the Espruino IDE and it'll copy the file from the Flash to the Filesystem storage.\
Note: 
- This three-step approach is necessary for larger files. Smaller files can be transferred without reset.
- The transferred files will be in both flash (require('Storage')) and Filesystem storage (require('fs')). You can da manual cleanup of the flash if you wouldy need more space.

### How to serve a file with a web server
HTML, JavaScript and CSS are compressed with gzip, for these file types the web server must send an extra header field with 'Content-Encoding: gzip'. Then, to send a file (fname) to an http response (res) within a http request handler:\
```
var fileDescriptor = E.openFile(fname)
E.pipe(fileDescriptor, res, {chunkSize: 100})
```
The bigger the chunk size, the faster the transfer, and the higher the risk of running out of memory. Espruino will not automatically pick the optimal chunk size.\
The file 'simplewebserver.js' in this repository can be used as a start. It assumes that the Wifi credentials for an Wifi access point are stored on the ESP8266 (require('Wifi').connect(...) and require('Wifi).save() were executed beforehand), and the ESP8266 will automatically connect to that Wifi access point, there's no Wifi setup and no error handling in this script. The script has support for a few different file types, just enough to test html, js, css and images. Execute onInit() to start the web server. It has a page loading time of around 90 seconds.

### How to reduce page loading times
To get the optimal page loading times you must reduce file size as much as possible. Use minification tools to reduce the size of HTML, JavaScript and CSS files (e.g. https://kangax.github.io/html-minifier/ or https://skalman.github.io/UglifyJS-online/ or google for alternatives). These minifiers remove extra spaces, comments and more - and they make to code unreadable. This shouldn't really be an issue, as you should have developed and tested the web page before transfering to the ESP8266, because the transfer is really complicated.\
Another option to reduce loading times would be to load extra content from a content delivery networks or another faster web-server. This will work in many scenarios, but it'll introduce extra dependencies to deal with.

### Other notes
I did try the following approaches to transfer files:
- Store the file in the source code. The transferable file size is limited to the RAM and TX buffer, you can't transfer large files.
- Store the file into flash, and then manually read and send chunks in a loop. This works up to a certain size, not sure if it's due to the TX buffer filling up or something else. 
- Store the file into flash, and then manually read and send chunks in a callback function called by setInterval(). This doesn't work, the garbage collection cleans up the socket as well.
- Store the file into flash, and then manually read and send chunks in a loop. Add an async function with sleep. This doesn't work, the garbage collection cleans up the socket as well.
- Store the files directly into the Filesystem storage. This works over the Espruino WEB for up to 20 consecutive writes, the following writes jail. There's no other way to recover than a hard reset.
- Store the files first into flash and then into the Filesystem storage. Writing to the Filesystem storage fails, unless you do a hard reset after writing to flash (except for smaller files, they can be written without hard reset).
- Sending a single file with E.pipe() from Storage works for a single file, repeatedly. Sending two or more files in parallel with E.pipe() crashes the Storage, a hard reset is needed to recover.

### To-Do
Make a script to copy files and sourecode directly over the serial or TCP/IP connection, with error checking. Or add these features to the espruino command line tools (https://github.com/espruino/EspruinoTools).

### Disclaimer
You're not allowed to use any code unless you have a working backup and restore solution in place, and can recover from any errors and lost data this code may produce.

### License
This is a public domain.
