/**
 * loader
 */
window.onload = function () {
    setTimeout(function () {
        $(".overlay").fadeOut(400);
        $(".loader-spin").fadeOut(200);
    }, 400);
};

/**
 * user left the chat
 */
window.onunload = function () {
    leaveChat();
}


$('#action_menu_btn').click(function () {
    $('.action_menu').toggle();
});


/// element selection
let divSelectRoom = document.getElementById("selectRoom");
let divConsultingRoom = document.getElementById("consultingRoom");
let inputRoomNumber = document.getElementById("roomNumber");
let btnGoRoom = document.getElementById("goRoom");
let localVideo = document.getElementById("localVideo");
let remoteVideo = document.getElementById("remoteVideo");
let chartArea = document.getElementById("chat");
let hangUp = document.getElementById("hangUpButton");
let openModal = document.getElementById("openHangUpModal");
let closeModal = document.getElementById("closeHangUpModal");
let modal = document.getElementById("modal");
let modalOverlay = document.getElementById("modal-overlay");

/**
 * toggle modal
 */
openModal.onclick = function () {
    modalOverlay.classList.toggle('active');
    modal.classList.toggle('active');
};

/**
 * close modal
 */
closeModal.onclick = function () {
    modalOverlay.classList.remove('active');
    modal.classList.remove('active');
};

/// chat elements
const textArea = document.getElementById("textArea");
const messages = document.getElementById("messages");

/**
 * textArea => send on enter
 */
textArea.addEventListener('keypress', event => {
    if (event.keyCode === 13 && !event.shiftKey) {
        if (textArea.value !== `\n` && textArea.value.length !== 1) {
            messages.innerHTML += `<div class="d-flex justify-content-end mb-4">
                            <div class="msg_cotainer_send">
                                ${textArea.value.trim()}
                                <span class="msg_time_send"></span>
                            </div>
                            <div class="img_cont_msg">
                                <img src="/images/avatar-1.png"
                                     class="rounded-circle user_img_msg">
                            </div>
                        </div>`;
            messages.scrollTop = messages.scrollHeight
            if (isCaller) {
                dataChannel.send(textArea.value.trim())
            } else {
                receiveChannel.send(textArea.value.trim())
            }
        }
        textArea.selectionStart = 0;
        textArea.selectionEnd = 0;
        textArea.value = ''
    }
})

/**
 * input room number 
 */

function selectRoom() {
        if (inputRoomNumber.value === '') {
            alert("Please type a room number")
        } else {
            roomNumber = inputRoomNumber.value;
            socket.emit('create or join', roomNumber);
            divSelectRoom.style = "display: none;";
            divConsultingRoom.style = "display: block;";
            chartArea.style = "display: flex";
        }
}

inputRoomNumber.addEventListener('keypress', event => {
    if (event.keyCode === 13) {
        selectRoom();
    }
})

btnGoRoom.onclick = function () {
    selectRoom();
};

/// connection variables
let roomNumber;
let localStream;
let remoteStream;
let rtcPeerConnection, dataChannel, receiveChannel;

/// ice server config; public google and mozillas 
const iceServers = {
    'iceServers': [
        {'urls': 'stun:stun.services.mozilla.com'},
        {'urls': 'stun:stun.l.google.com:19302'}
    ]
}

/// stream constraints
const streamConstraints = {
    audio: true,
    video: {
        width: {max: 640},
        height: {max: 320},
        facingMode: 'user'
    }
};

/// who called who?!
let isCaller;

// Let's do this
let socket = io();


/**
 * leave the chat - connection
 */
function leaveChat() {
    if (!rtcPeerConnection) {
        window.location.reload();
    }
    rtcPeerConnection.close();
    rtcPeerConnection = null;
    socket.emit('leave', roomNumber);
    window.location.reload();
}

hangUp.onclick = function () {
    leaveChat();
};

socket.on('created', function (room) {
    navigator.mediaDevices.getUserMedia(streamConstraints).then(function (stream) {
        localStream = stream;
        localVideo.srcObject = stream;
        isCaller = true;
    }).catch(function (err) {
        console.log('An error ocurred when accessing media devices', err);
    });
});

socket.on('joined', function (room) {
    navigator.mediaDevices.getUserMedia(streamConstraints).then(function (stream) {
        localStream = stream;
        localVideo.srcObject = stream;
        socket.emit('ready', roomNumber);
    }).catch(function (err) {
        console.log('An error ocurred when accessing media devices', err);
    });
});

socket.on('candidate', function (event) {
    const candidate = new RTCIceCandidate({
        sdpMLineIndex: event.label,
        candidate: event.candidate
    });
    rtcPeerConnection.addIceCandidate(candidate);
});

socket.on('ready', function () {
    if (isCaller) {
        rtcPeerConnection = new RTCPeerConnection(iceServers);
        dataChannel = rtcPeerConnection.createDataChannel("channel");
        dataChannel.onopen = handleSendChannelStatusChange;
        dataChannel.onclose = handleSendChannelStatusChange;
        dataChannel.onmessage = handleReceiveMessage;
        sendFileChannel = rtcPeerConnection.createDataChannel("sendDataChannel")
        sendFileChannel.onopen = handleSendChannelStatusChange;
        sendFileChannel.onclose = handleSendChannelStatusChange;
        sendFileChannel.onmessage = handleReceiveMessage;
        rtcPeerConnection.onicecandidate = onIceCandidate;
        rtcPeerConnection.ontrack = onAddStream;
        rtcPeerConnection.addTrack(localStream.getTracks()[0], localStream);
        rtcPeerConnection.addTrack(localStream.getTracks()[1], localStream);
        rtcPeerConnection.createOffer()
            .then(sessionDescription => {
                rtcPeerConnection.setLocalDescription(sessionDescription);
                socket.emit('offer', {
                    type: 'offer',
                    sdp: sessionDescription,
                    room: roomNumber
                });
            })
            .catch(error => {
                console.log(error)
            })
    }
});

socket.on('offer', function (event) {
    if (!isCaller) {
        rtcPeerConnection = new RTCPeerConnection(iceServers);
        rtcPeerConnection.onicecandidate = onIceCandidate;
        rtcPeerConnection.ontrack = onAddStream;
        rtcPeerConnection.ondatachannel = receiveChannelCallback;
        rtcPeerConnection.addTrack(localStream.getTracks()[0], localStream);
        rtcPeerConnection.addTrack(localStream.getTracks()[1], localStream);
        rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
        rtcPeerConnection.createAnswer()
            .then(sessionDescription => {
                rtcPeerConnection.setLocalDescription(sessionDescription);
                socket.emit('answer', {
                    type: 'answer',
                    sdp: sessionDescription,
                    room: roomNumber
                });
            })
            .catch(error => {
                console.log(error)
            })
    }
});

socket.on('answer', function (event) {
    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
})

socket.on('full', function (event) {
    divSelectRoom.style = "display: block;";
    divConsultingRoom.style = "display: none;";
    chartArea.style = "display: none";
    alert(`Room is full. Please enter another room id.`)
})

socket.on('left', function (event) {
    rtcPeerConnection.close();
    rtcPeerConnection = null;
    alert(`Peer left the room. You will be redirected to landing page!`)
    window.location.reload();
})

socket.on('file', function (event) {
    fileSize = event.fileSize;
    name = event.name;
});

// handler functions
function onIceCandidate(event) {
    if (event.candidate) {
        console.log('sending ice candidate');
        socket.emit('candidate', {
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate,
            room: roomNumber
        })
    }
}

function onAddStream(event) {
    remoteVideo.srcObject = event.streams[0];
    remoteStream = event.stream;
}

function handleSendChannelStatusChange(event) {
    if (dataChannel) {
        const state = dataChannel.readyState;

        if (state === "open") {
            console.log('data channel opened')
        } else {
            console.log('data channel something went wrong :O')
        }
    }
}

function receiveChannelCallback(event) {
    if (event.channel.label === 'sendDataChannel') {
        receiveFileChannelCallback(event);
    } else {
        receiveChannel = event.channel;
        receiveChannel.onmessage = handleReceiveMessage;
        receiveChannel.onopen = handleReceiveChannelStatusChange;
        receiveChannel.onclose = handleReceiveChannelStatusChange;
    }
}

function handleReceiveMessage(event) {
    if (event.target.label === 'sendDataChannel') {
        onReceiveFileMessageCallback(event)
    } else {
        console.log(`message received: `, event.data)
        messages.innerHTML += `<div class="d-flex justify-content-start mb-4">
                            <div class="img_cont_msg">
                                <img src="/images/avatar-2.png"
                                     class="rounded-circle user_img_msg">
                            </div>
                            <div class="msg_cotainer">
                               ${event.data}
                                <span class="msg_time"></span>
                            </div>
                        </div>`;
        textArea.value = '';
        messages.scrollTop = messages.scrollHeight
    }
}

function handleReceiveChannelStatusChange(event) {
    if (receiveChannel) {
        console.log("Receive channel's status has changed to " +
            receiveChannel.readyState);
    }
}


///file transfer
const fileInput = document.querySelector('#fileInput');
const sendFileButton = document.getElementById('sendFile');

let sendFileChannel;
let receiveFileChannel;
let fileReader;
const downloadAnchor = document.querySelector('a#download');
let receiveBuffer = [];
let receivedSize = 0;
let fileSize = 0;
let name = '';

sendFileButton.addEventListener('click', () => createConnection());
fileInput.addEventListener('change', handleFileInputChange, false);


async function handleFileInputChange() {
    let file = fileInput.files[0];
    if (!file) {
        console.log('No file chosen');
    } else {
        socket.emit('expected', {
            room: roomNumber,
            fileSize: file.size,
            name: file.name
        });
    }
    sendFileButton.style.display = 'block';
}


async function createConnection() {
    console.log(`Sending file data.`)
    sendData();
    fileInput.disabled = true;
}

function sendData() {
    if (isCaller) {
        sendChannelData(sendFileChannel);
    } else {
        sendChannelData(receiveFileChannel);
    }
}

function sendChannelData(channel) {
    const file = fileInput.files[0];
    console.log(`File is ${[file.name, file.size, file.type, file.lastModified].join(' ')}`);

    // Handle 0 size files.
    downloadAnchor.textContent = '';
    if (file.size === 0) {
        alert(`Please select a file before sending.`)
        return;
    }
    const chunkSize = 16384;
    fileReader = new FileReader();
    let offset = 0;
    fileReader.addEventListener('error', error => console.error('Error reading file:', error));
    fileReader.addEventListener('abort', event => console.log('File reading aborted:', event));
    fileReader.addEventListener('load', e => {
        console.log('FileRead.onload ', e);
        channel.send(e.target.result);
        offset += e.target.result.byteLength;
        if (offset < file.size) {
            readSlice(offset);
        } else {
            fileInput.disabled = false;
            sendFileButton.style.display = 'none';
        }
    });
    const readSlice = o => {
        console.log('readSlice ', o);
        const slice = file.slice(offset, o + chunkSize);
        fileReader.readAsArrayBuffer(slice);
    };
    readSlice(0);
}


function receiveFileChannelCallback(event) {
    console.log('Receive Channel Callback');
    receiveFileChannel = event.channel;
    receiveFileChannel.binaryType = 'arraybuffer';
    receiveFileChannel.onmessage = handleReceiveMessage;
    receiveFileChannel.onopen = onReceiveFileChannelStateChange;
    receiveFileChannel.onclose = onReceiveFileChannelStateChange;

    downloadAnchor.textContent = '';
    downloadAnchor.removeAttribute('download');
    if (downloadAnchor.href) {
        URL.revokeObjectURL(downloadAnchor.href);
        downloadAnchor.removeAttribute('href');
    }
}

function onReceiveFileMessageCallback(event) {
    console.log(`Received Message ${event.data.byteLength}`);
    receiveBuffer.push(event.data);
    receivedSize += event.data.byteLength;

    // we are assuming that we recieved expected file size and file name through signalig server
    if (receivedSize === fileSize) {
        const received = new Blob(receiveBuffer);
        receiveBuffer = [];
        receivedSize = 0;

        downloadAnchor.href = URL.createObjectURL(received);
        downloadAnchor.download = name;
        downloadAnchor.textContent =
            `Click to download '${name}' (${fileSize} bytes)`;
        downloadAnchor.style.display = 'block';
        fileSize = 0;

        messages.innerHTML += `<div class="d-flex justify-content-start mb-4">
                            <div class="img_cont_msg">
                                <img src="/images/avatar-2.png"
                                     class="rounded-circle user_img_msg">
                            </div>
                            <div class="msg_cotainer">
                               <a href="${downloadAnchor}" download>${name}</a>
                                <span class="msg_time"></span>
                            </div>
                        </div>`;
        messages.scrollTop = messages.scrollHeight

    }
}

function onSendFileChannelStateChange() {
    const readyState = sendFileChannel.readyState;
    console.log(`Send channel state is: ${readyState}`);
    if (readyState === 'open') {
        sendData();
    }
}

async function onReceiveFileChannelStateChange() {
    const readyState = receiveFileChannel.readyState;
    console.log(`Receive channel state is: ${readyState}`);
}