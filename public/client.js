const socket = io()
let name;
let textarea = document.querySelector('#textarea');
let messageArea = document.querySelector('.message__area')
let feedback = document.querySelector('#feedback');

var timeout;

function timeoutFunction() {
    typing = false;
    socket.emit("typing", false);
}

do{
    name = prompt('Please enter your name');
}while(!name)

textarea.addEventListener('keyup', (e) => {
    if(e.key ==='Enter'){
        sendMessage(e.target.value);
    }
    
})

textarea.addEventListener('keyup', () => {
    typing = true;
    socket.emit('typing', 'typing...');
})

function sendMessage(message){

    let msg = {
        user : name,
        message : message.trim()
    }

    // Append
    appendMessage(msg, 'outgoing')
    textarea.value = ''
    scrollTopBottom()
    
    // Send to server
    socket.emit('message', msg)
    clearTimeout(timeout);
    timeout = setTimeout(timeoutFunction, 0);

}


function appendMessage(msg, type){
    let mainDiv = document.createElement('div')
    let className = type 
    mainDiv.classList.add(className, 'message')

    let markup = `
        <h4>${msg.user}</h4>
        <p>${msg.message}</p>
    `;

    mainDiv.innerHTML = markup
    messageArea.appendChild(mainDiv)
}

// Receive message

socket.on('message', (msg)=>{
    console.log(msg);
    appendMessage(msg, 'incoming')
    scrollTopBottom()
    
})

socket.on('typing', (data) =>{
    if (data) {
      feedback.innerHTML = '<p><em>Typing...</em></p>';
    //   feedback.innerHTML = '<p> is typing...</p>';
    } else {
      feedback.innerHTML = ''
    }
});

function scrollTopBottom(){
    messageArea.scrollTop = messageArea.scrollHeight
}