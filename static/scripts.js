const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sessionList = document.getElementById("sessionList");
const sessionSearch = document.getElementById("sessionSearch");
const send_btn = document.getElementById("send-btn");

var current_session_id = -1;
var sessions = [];

function disable_Send() {
  send_btn.disabled = true;
  send_btn.classList.add("disabled");
}

function enable_Send() {
  send_btn.disabled = false;
  send_btn.classList.remove("disabled");
}

function copyText(text) {
  console.log(text);
  navigator.clipboard.writeText(text);
}

function populateSessions() {
  sessionList.innerHTML = "";
  fetch("/get_sessions", {
    method: "GET",
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.sessions) {
        sessions = data.sessions;
        data.sessions.forEach((session) => {
          const li = document.createElement("li");
          li.innerHTML = `
                    <div class="session-title">${session.title}</div>
                    <div class="session-timestamp">${session.created_at}<button onclick='deleteSession(${session.session_id})'><img src='../static/assets/delete.png'></img></button></div>

                `;
          li.onclick = () => loadSession(session.session_id);
          sessionList.appendChild(li);
        });
      } else {
        alert("Error: " + data.error);
      }
    })
    .catch((error) => console.error("Fetch Error:", error));
}

function getChats(sessionId) {
  fetch(`/get_chats/${sessionId}`, {
    method: "GET",
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.chats) {
        data.chats.forEach((chat) => {
          if (chat.message_type === "text")
            addMessage(chat.message, chat.sender);
          else if (chat.message_type === "file")
            addFileMessage(JSON.parse(chat.message));
        });
      } else {
        alert("Error:\n" + data.error);
      }
    })
    .catch((error) => console.error("Fetch Error:", error));
}

function loadSession(sessionId) {
  chatMessages.innerHTML = "";
  current_session_id = sessionId;
  showchat();
  getChats(sessionId);
}

function copy_btn(text, disp = "copy") {
  let btn = document.createElement("button");
  btn.classList.add("copy-btn");
  btn.innerHTML = disp;
  btn.addEventListener("click", () => copyText(text));
  return btn;
}

function addMessage(message, isUser) {
  const messageElement = document.createElement("md-block");
  messageElement.classList.add("message");
  messageElement.classList.add(isUser ? "user-message" : "bot-message");
  messageElement.textContent = message;
  messageElement.appendChild(copy_btn(message));
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addFileMessage(message) {
  const messageElement = document.createElement("md-block");
  messageElement.classList.add("message", "file-message");
  messageElement.innerHTML = `
    <h2>${message.file_name}</h2>
    <div>${message.content}</div>
  `;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage() {
  const files = fileInput.files;

  if (files && files.length > 0) {
    disable_Send();
    uploadFiles(files).then(sendMessage);
    enable_Send();
    return;
  }
  message = userInput.value;
  userInput.value = "";
  if (!message ||  !/[^ \n]+/.test(message)){
    enable_Send();
     return;
  }
  disable_Send();
  addMessage(message, true);
  fetch("/send_message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ session_id: current_session_id, message }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.message) {
        addMessage(data.message, false);
      } else {
        addMessage("Error:\n" + data.message, false);
      }
      enable_Send();
    })
    .catch((error) => {
      console.error("Fetch Error:", error);
      userInput.value = message;
      enable_Send();
    });
}

function createSession() {
  let title = document.getElementById("title-inp").value;
  if (!title) title = "Untitled";
  fetch("/create_session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.session_id) {
        populateSessions();
        loadSession(data.session_id);
      } else {
        alert("Error:" + data.error);
      }
    })
    .catch((error) => console.error("Fetch Error:", error));
}

function deleteSession(session_id = current_session_id) {
  if (session_id == -1) return;
  let confirmation = confirm("Are you sure you want to delete this session?");
  if (!confirmation) return;

  fetch(`/delete_session/${session_id}`, {
    method: "DELETE",
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.message) {
        populateSessions();
        hidechat();
        clearInputs();
      } else {
        alert("Error:" + data.error);
      }
    })
    .catch((error) => console.error("Fetch Error:", error));
}

function uploadFiles(files) {
  const url = "/upload_files";
  const formData = new FormData();

  formData.append("session_id", current_session_id);

  for (const file of files) {
    formData.append("files[]", file);
  }
  selectedFiles = [];
  fileInput.value = "";
  updatePreviews();
  return fetch(url, {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((error) => {
          throw new Error(error.error);
        });
      }
      return response.json();
    })
    .then((result) => {
      if (result?.message)
        result.message.forEach((message) => addFileMessage(message));
    })
    .catch((err) => {
      console.error("Error while uploading files:", err.message);
      enable_Send();
    });
}

sessionSearch.addEventListener("input", function () {
  const searchTerm = this.value.toLowerCase();
  const filteredSessions = sessions.filter((session) =>
    session.title.toLowerCase().includes(searchTerm)
  );
  sessionList.innerHTML = "";
  filteredSessions.forEach((session) => {
    const li = document.createElement("li");
    li.innerHTML = `
            <div class="session-title">${session.title}</div>
            <div class="session-timestamp">${session.timestamp}</div>
        `;
    li.onclick = () => loadSession(session.id);
    sessionList.appendChild(li);
  });
});

userInput.addEventListener("keypress", function (event) {
  if (event.key === "Enter") {
    sendMessage();
  }
});

var chat_container = document.getElementById("chat-container");
var new_session_prompt = document.getElementById("new-session-prompt");
function showchat() {
  chat_container.style.display = "flex";
  new_session_prompt.style.display = "None";
}

function hidechat() {
  chat_container.style.display = "None";
  new_session_prompt.style.display = "flex";
}

function clearInputs() {
  const inputs = document.querySelectorAll("input");

  inputs.forEach((input) => (input.value = ""));
}
clearInputs();
hidechat();
populateSessions();
