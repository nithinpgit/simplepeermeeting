
/*
 * author @nithin prasad
 * website https://nithinprasad.com
 * This is a simple webrtc peer to peer video conferencing app. This application is only for understanding 
 * Basic flow of webrtc based conference call.
 * Android and IOS developer can reuse the signaling server and create native code by following the logic in javascript file
 */

/**
 * For setting layout of video
 * */
 var layoutEl = document.getElementById("layout");
var layout;

function updateLayoutValues() {
    layout = initLayoutContainer(layoutEl, {
        maxRatio: 3 / 4, // The narrowest ratio that will be used (default 2x3)
        minRatio: 9 / 16, // The widest ratio that will be used (default 16x9)
        /*
        fixedRatio: 3/4,         // If this is true then the aspect ratio of the video is maintained and minRatio and maxRatio are ignored (default false)
        */
        scaleLastRow: true, // If there are less elements on the last row then we can scale them up to take up more space
        alignItems: 'center', // Can be 'start', 'center' or 'end'. Determines where to place items when on a row or column that is not full
        bigClass: "OT_big", // The class to add to elements that should be sized bigger
        bigPercentage: 0.8, // The maximum percentage of space the big ones should take up
        bigFixedRatio: false, // fixedRatio for the big ones
        bigScaleLastRow: true, // scale last row for the big elements
        bigAlignItems: 'center', // How to align the big items
        smallAlignItems: 'center', // How to align the small row or column of items if there is a big one
        maxWidth: Infinity, // The maximum width of the elements
        maxHeight: Infinity, // The maximum height of the elements
        smallMaxWidth: Infinity, // The maximum width of the small elements
        smallMaxHeight: Infinity, // The maximum height of the small elements
        bigMaxWidth: Infinity, // The maximum width of the big elements
        bigMaxHeight: Infinity, // The maximum height of the big elements
        bigMaxRatio: 3 / 2, // The narrowest ratio to use for the big elements (default 2x3)
        bigMinRatio: 9 / 16, // The widest ratio to use for the big elements (default 16x9)
        bigFirst: true, // Whether to place the big one in the top left (true) or bottom right (false).
        // You can also pass 'column' or 'row' to change whether big is first when you are in a row (bottom) or a column (right) layout
        animate: true, // Whether you want to animate the transitions using jQuery (not recommended, use CSS transitions instead)
        window: window, // Lets you pass in your own window object which should be the same window that the element is in
        ignoreClass: 'OT_ignore', // Elements with this class will be ignored and not positioned. This lets you do things like picture-in-picture
        onLayout: null,
    }).layout;
    layout();
}
updateLayoutValues();
var resizeTimeout;
window.onresize = function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
        layout();
    }, 20);
};
/*
 * Please follow all the following logic to implement a peer to peer webrtc call 
 * in any programing language
 */
var name = (Math.floor(Math.random() * 100000000000) + 100000000000).toString().substring(1);
// you can make the following room id dyanamic
var room = '100';
var localVideo = document.querySelector('#localVideo');
var participants = {};
var stream;
var configuration = {
    "iceServers": [{
        urls: 'turn:turn.goto-rtc.com:5060?transport=udp',
        credential: 'citrixturnuser',
        username: 'turnpassword'
    }]
};
var socket = io.connect(signalingUrl);
socket.on('connect', function() {
    send({
        type: "login",
        name: name,
        room: room,
        isGuest: true
    });
    // messages from signaling server
    socket.on('message', function(data) {
        //alert(data)
        var data = JSON.parse(data);
        switch (data.type) {
            case "login":
                handleLogin(data);
                break;
            case "newUser":
                createPeerConnection(data.userData.name);
                break;
                //when somebody wants to call us 
            case "offer":
                handleOffer(data.offer, data.name);
                break;
            case "answer":
                handleAnswer(data.answer, data.name);
                break;
                //when a remote peer sends an ice candidate to us 
            case "candidate":
                //console.log('candidate received from '+name)
                handleCandidate(data.candidate, data.name);
                break;
            case "userLeft":
                onUserLeft(data.name);
                break;
            case "leave":
                //handleLeave(); 
                break;
            default:
                break;
        }
    });

});

function send(message) {
    message.room = room;
    socket.emit('message', JSON.stringify(message));
};

//****** 
//UI selectors block 
//******
function handleLogin(data) {
    if (data.success === false) {
        alert("Ooops...try a different username");
    } else {


        //********************** 
        //Starting a peer connection 
        //********************** 


        //getting local video stream 
        navigator.webkitGetUserMedia({
            video: true,
            audio: true
        }, function(myStream) {
            stream = myStream;
            localVideo.srcObject = stream;
        }, function(error) {
            console.log(error);
        });
        setTimeout((data) => {
            onCallExistingUsers(data.users)
        }, 3000, data);

    }
};
// method invoke on user lef from session
onUserLeft = (user) => {
    if (participants[user]) {
        participants[user].close();
        participants[user].onicecandidate = null;
        participants[user].onaddstream = null;
        document.getElementById(user).src = null;
        delete participants[user];
        document.getElementById(user).remove()
        document.getElementById(user+'parent').remove()
        layout();
    }
}
// creating peerconnection object
createPeerConnection = (user) => {
    console.log('create peer connection ' + user);
    participants[user] = new webkitRTCPeerConnection(configuration);
    participants[user].addStream(stream);
    participants[user].onaddstream = function(e) {
        let video = document.createElement("video");
        let videoWrap = document.createElement("div");
        videoWrap.id = user+'parent';
        video.id = user;
        video.controls = false;
        video.autoplay = true;
        videoWrap.appendChild(video)
        document.getElementById('layout').appendChild(videoWrap);
        videoWrap.addEventListener('dblclick', function() {
            if (videoWrap.classList.contains('OT_big')) {
                videoWrap.classList.remove('OT_big');
            } else {
                videoWrap.classList.add('OT_big');
            }
            layout();
        });
        video.srcObject = e.stream;
        layout();
    };

    // Setup ice handling 
    participants[user].onicecandidate = function(event) {

        if (event.candidate) {
            console.log('candidate send to  ' + user + ' myname=' + name);
            send({
                type: "candidate",
                candidate: event.candidate,
                name: user,
                myName: name
            });
        }
    };
}
// call all users existing on the session
onCallExistingUsers = (users) => {
    for (let key in users) {
        let user = users[key];
        if (user != name) {
            createPeerConnection(user)
            setTimeout(createOffer, 1000, user)
        }

    }
}
// creating offer
createOffer = (user) => {
    participants[user].createOffer(function(offer) {
        console.log('OFFER : ' + JSON.stringify(offer))
        send({
            type: "offer",
            offer: offer,
            name: user
        });

        participants[user].setLocalDescription(offer);
    }, function(error) {
        console.log("====== Error when creating an offer");
    });
}

//when somebody sends us an offer 
handleOffer = (offer, senderName) => {
    if (participants[senderName]) {
        participants[senderName].setRemoteDescription(new RTCSessionDescription(offer));

        //create an answer to an offer 
        participants[senderName].createAnswer(function(answer) {
            participants[senderName].setLocalDescription(answer);

            send({
                type: "answer",
                answer: answer,
                name: senderName,
                myName: name
            });

        }, function(error) {
            console.log("====== Error when creating an answer");
        });
    }
};

//when we got an answer from a remote user
handleAnswer = (answer, senderName) => {
    if (participants[senderName]) {
        participants[senderName].setRemoteDescription(new RTCSessionDescription(answer));
    } else {
        console.log('pc not found answer' + senderName)
    }
};

//when we got an ice candidate from a remote user 
handleCandidate = (candidate, senderName) => {
    if (participants[senderName]) {
        participants[senderName].addIceCandidate(new RTCIceCandidate(candidate));
    } else {
        console.log('pc not found ice' + senderName)
    }
};