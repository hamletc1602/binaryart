var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');

var fs = require('fs');
var PNG = require('pngjs').PNG;

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

/** */
function leftPad(source, radix) {
  if (2 == radix) {
    return ('0000000000000000'+source).substring(source.length);
  } else if (16 == radix) {
    return ('0000'+source).substring(source.length);
  } else {
    throw "Radix not supported for left pad";
  }
}

/** Generate the poem text in the requsted radix (likely hex or binary) */
function produceText(imageFileName, message, radix, res) {
  var channels = -1;
  var scanLength = -1;
  var messageIndex = 0;
  var imageDesc = "";
  var emptyChar = leftPad((0xFEFF).toString(radix), radix);
  var spaceChar = leftPad(" ".charCodeAt(0).toString(radix), radix);

  fs.createReadStream(imageFileName)
      .pipe(new PNG({
          filterType: 4
      }))
      .on('metadata', function(meta) {
          channels = (meta.color ? 3 : 1) + (meta.alpha ? 1 : 0);
          scanLength  = meta.width * channels;
          imageDesc = "Width: " + meta.width + " height: " + meta.height + " Bits: 8 " +  
            " Channels: " + channels;
      })
      .on('parsed', function(data) {

          //Pixels is a 1D array containing pixel data
          var alphaCh;
          var textData = "", binStr;

          imageDesc += " Pixels: " + data.length;
          res.write("<head>");
          res.write("<style>");
          res.write('body { font-family: Courier,Monospace; font-size: 4pt; }');
          res.write("</style>");
          res.write("</head><body><p>");
          console.log(imageDesc);

          for (rowIndex = 0; rowIndex < this.height; rowIndex += 1) {
            textData = "";
            rowOffset = rowIndex * scanLength;
            console.log("Process image row: " + rowIndex);

            for (colIndex = 0; colIndex < scanLength; colIndex += channels) {
              // All we care about is the alpha channel (4th value)
              alphaCh = data[rowOffset + colIndex + 3];
              //console.log("Alpha channel: " + alphaCh);
              if (alphaCh > 0) {
                // Write binary representation of the message char
                char = message[messageIndex++];
                //console.log("Add message char: " + char);
                // Get binary string rep. of char.
                if (char) {
                  binStr = char.charCodeAt(0).toString(radix);
                  textData += leftPad(binStr, radix);
                } else {
                  // Insert space char if we've run out of message.
                  textData += spaceChar;
                }
              } else {
                textData += emptyChar;
              }

            } // Each Col

            res.write(textData + "<br>");
          } // Each Row

          res.write("</p></body>");
          console.log("Used " + messageIndex + " chars from message.");
          res.end();
      });  
}

// Get a chached problem set
app.get('/imagetext/:name/:radix', function(req, res) {
  var imgName = req.params.name;
  var radixStr = req.params.radix;
  var rowIndex, colIndex;

  var radix = Number(radixStr);
  var imageFileName = imgName + '.png';
  var messageFileName = imgName + '.txt';

  if ( ! fs.statSync(imageFileName).isFile()) { 
    throw "Missing image file: " + imageFileName;
  }
  if ( ! fs.statSync(messageFileName).isFile()) { 
    throw "Missing message file: " + messageFileName;
  }

  var message = fs.readFileSync(messageFileName, { encoding: 'utf8' });
  //console.log("Message Text: " + message);

  produceText(imageFileName, message, radix, res);
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;

var server_port = process.env.OPENSHIFT_NODEJS_PORT || 3000
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0'

app.listen(server_port, server_ip_address, function(){
  console.log("Listening on " + server_ip_address + ", server_port " + server_port)
});
