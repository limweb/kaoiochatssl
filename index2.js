var staticCache = require('koa-static-cache');
var koa = require('koa.io');

var path = require('path');
var fs = require('fs');
var http = require('http');
var https = require('https');
var fs = require('fs');
var forceSSL = require('koa-force-ssl');

var app = koa();
// Force SSL on all page
app.use(forceSSL());

// var port = process.env.PORT || 3000;

// Routing
app.use(staticCache(path.join(__dirname, 'public')));
app.use(function*() {
  this.body = fs.createReadStream(path.join(__dirname, 'public/index.html'));
  this.type = 'html';
});


// SSL options
var options = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt')
}

// start the server
var h = http.createServer(app.callback()).listen(80);
var hs = https.createServer(options, app.callback()).listen(443);

// app.listen(port, function () {
//   console.log('Server listening at port %d', port);
// });

// Chatroom

// usernames which are currently connected to the chat
var usernames = {};
var numUsers = 0;
app.io.use(forceSSL());
app.io.attach(h);
app.io.attach(hs);

// middleware for connect and disconnect
app.io.use(function* userLeft(next) {
  // on connect
  console.log('somebody connected');
  console.log(this.headers)
  yield* next;
  // on disconnect
  if (this.addedUser) {
    delete usernames[this.username];
    --numUsers;

    // echo globally that this client has left
    this.broadcast.emit('user left', {
      username: this.username,
      numUsers: numUsers
    });
  }
});


/**
 * router for socket event
 */

app.io.route('add user', function* (next, username) {
  // we store the username in the socket session for this client
  this.username = username;
  // add the client's username to the global list
  usernames[username] = username;
  ++numUsers;
  this.addedUser = true;
  this.emit('login', {
    numUsers: numUsers
  });

  // echo globally (all clients) that a person has connected
  this.broadcast.emit('user joined', {
    username: this.username,
    numUsers: numUsers
  });
});

// when the client emits 'new message', this listens and executes
app.io.route('new message', function* (next, message) {
  // we tell the client to execute 'new message'
  this.broadcast.emit('new message', {
    username: this.username,
    message: message
  });
});

// when the client emits 'typing', we broadcast it to others
app.io.route('typing', function* () {
  console.log('%s is typing', this.username);
  this.broadcast.emit('typing', {
    username: this.username
  });
});

// when the client emits 'stop typing', we broadcast it to others
app.io.route('stop typing', function* () {
  console.log('%s is stop typing', this.username);
  this.broadcast.emit('stop typing', {
    username: this.username
  });
});

h.listen(80);
h.listen(443);
