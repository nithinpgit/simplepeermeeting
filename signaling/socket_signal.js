module.exports = {
   init: function(app, io, config, signalCallback) {
       let rooms = {};
       let userList = {};
       let instantRooms = {};
       let validTokens = {};
       let userIdToCreatedRoomMap = {};
       let userListMeeting = {};
       io.on('connection', function(socket) {
           /**
            * Trigger when connected user disconnected from socket
            */
           socket.on('message', function(message) {
               var data;
               try {
                   data = JSON.parse(message);
               } catch (e) {
                   console.log("Invalid JSON");
                   data = {};
               }
               console.log(data.type+':'+JSON.stringify(data))
               switch (data.type) {
                   case "login":
                       socket.join(data.room)
                       let users = {};
                       if (rooms[data.room]) {
                           users = rooms[data.room];
                           if (Object.keys(users).length >= 3) {
                               sendTo(socket, {
                                   type: "reject",
                                   reoson: 'full',
                                   message: 'This room can accomodate maximum of 4 users, if more than 4 quality will reduce.'
                               });
                               //return;
                           }
                       }

                       users[data.name] = {
                           userName: data.userName,
                           name: data.name,
                           room: data.room,
                           windowId:data.windowId,
                           cam: false,
                           screen: false,
                           mic: true,
                           socket: socket
                       };
                       rooms[data.room] = users;
                       socket.name = data.name;
                       socket.room = data.room;
                       let list = {};
                       for (let k in rooms[data.room]) {
                           list[k] = {
                               userName: rooms[data.room][k].userName,
                               name: rooms[data.room][k].name,
                               cam: rooms[data.room][k].cam,
                               screen: rooms[data.room][k].screen,
                               mic: rooms[data.room][k].mic,
                               windowId: rooms[data.room][k].windowId
                           };
                       }
                       sendTo(socket, {
                           type: "login",
                           success: true,
                           users: Object.keys(rooms[data.room]),
                           existingList: list

                       });
                       socket.broadcast.to(data.room).emit('message', JSON.stringify({
                           type: "newUser",
                           userData: {
                               name: data.name,
                               userName: data.userName,
                               windowId: data.windowId,
                               cam: false,
                               mic: true
                           }
                       }));
                       break;

                   case "requestStream":
                       if (rooms[data.room]) {
                           if (rooms[data.room][data.name.replace('_screen', '')]) {
                               var conn = rooms[data.room][data.name.replace('_screen', '')].socket;
                               if (conn != null) {
                                   sendTo(conn, {
                                       type: "requestStream",
                                       name: socket.name,
                                       sender: data.name
                                   });
                               }
                           }
                       }
                       break;
                   case "offer":
                       if (rooms[data.room]) {
                           if (rooms[data.room][data.name.replace('_screen', '')]) {
                               var conn = rooms[data.room][data.name.replace('_screen', '')].socket;
                               if (conn != null) {
                                   sendTo(conn, {
                                       type: "offer",
                                       offer: data.offer,
                                       name: socket.name,
                                       sender: data.name
                                   });
                               }
                           }
                       }
                       break;

                   case "answer":
                       if (rooms[data.room]) {
                           if (rooms[data.room][data.name.replace('_screen', '')]) {
                               var conn = rooms[data.room][data.name.replace('_screen', '')].socket;
                               if (conn != null) {
                                   sendTo(conn, {
                                       type: "answer",
                                       answer: data.answer,
                                       name: data.myName,
                                       sender: data.name
                                   });
                               }
                           }
                       }
                       break;

                   case "candidate":
                       if (rooms[data.room]) {
                           if (rooms[data.room][data.name.replace('_screen', '')]) {
                               var conn = rooms[data.room][data.name.replace('_screen', '')].socket;
                               if (conn != null) {
                                   console.log('candidate received from ' + data.myName + ' and send to ' + data.name);
                                   sendTo(conn, {
                                       type: "candidate",
                                       candidate: data.candidate,
                                       name: data.myName,
                                       sender: data.name
                                   });
                               }
                           }
                       }
                       break;

                   case "leave":
                       if (rooms[data.room]) {
                           if (rooms[data.room][data.name]) {
                               socket.broadcast.to(data.room).emit('message', JSON.stringify({
                                   type: "userLeft",
                                   name: data.name
                               }));
                               delete rooms[data.room][data.name];
                           }
                       }
                       if (socket.createdRoom) {
                           if (instantRooms[socket.createdRoom]) {
                               delete instantRooms[socket.createdRoom];
                               disposeRoom(socket, socket.createdRoom);
                               delete userIdToCreatedRoomMap[socket.name]

                           }
                       }
                       if (validTokens[socket.name]) {
                           delete validTokens[socket.name];
                       }
                       break;

                   default:
                       sendTo(socket, {
                           type: "error",
                           message: "Command not found: " + data.type
                       });
                       break;
               }

           });
           socket.on('disconnect', function() {
               if (socket.name && socket.room) {
                   if (rooms[socket.room]) {
                       socket.broadcast.to(socket.room).emit('message', JSON.stringify({
                           type: "userLeft",
                           name: socket.name
                       }));
                       delete rooms[socket.room][socket.name];
                       if (Object.keys(rooms[socket.room]).length == 0) {
                           delete rooms[socket.room];
                       }
                   }
               }

               if (userList[socket.id]) {
                   delete userList[socket.id];
                   socket.broadcast.to('room').emit('onUserList', JSON.stringify(userList));
               }
               if (validTokens[socket.name]) {
                   setTimeout((socket, room) => {
                       let useravailable = false;
                       if (rooms[room]) {
                           if (rooms[room][socket.name]) {
                               useravailable = true;
                           }
                       }
                       if (!useravailable) {
                           delete validTokens[socket.name];
                       }
                   }, 20000, socket, userIdToCreatedRoomMap[socket.name]);
               }

               if (userIdToCreatedRoomMap[socket.name]) {
                   if (instantRooms[userIdToCreatedRoomMap[socket.name]]) {
                       setTimeout((socket, room) => {
                           let useravailable = false;
                           if (rooms[room]) {
                               console.log('1')
                               if (rooms[room][socket.name]) {
                                   console.log('2')
                                   useravailable = true;
                               }
                           }
                           if (!useravailable) {
                               delete instantRooms[room];
                               socket.broadcast.to(room).emit('message', JSON.stringify({
                                   type: 'leave'
                               }));
                               delete userIdToCreatedRoomMap[socket.name];
                           }
                       }, 20000, socket, userIdToCreatedRoomMap[socket.name]);

                   }
               }

               if (userListMeeting.hasOwnProperty(socket.room)) {
                   let userList = userListMeeting[socket.room];
                   socket.broadcast.to(socket.room).emit('userLeftMeeting', JSON.stringify(userList[socket.userId]))
                   delete userList[socket.userId];
                   userListMeeting[socket.room] = userList;

                   socket.broadcast.to(socket.room).emit('onUserListMeeting', JSON.stringify(userListMeeting[socket.room]));
               }

               socket.broadcast.to(socket.room).emit('onUserDisconnected', JSON.stringify({
                   windowId: socket.windowId
               }));



           });


       });
       sendTo = (socket, message) => {
           socket.emit('message', JSON.stringify(message));
       }
       disposeRoom = (socket, room) => {
           socket.broadcast.to(room).emit('message', JSON.stringify({
               type: 'leave'
           }));
       }
       generateUID = () => {
           return (Math.floor(Math.random() * 100000000000) + 100000000000).toString().substring(1);
       }

   }

}