const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sessionList = document.getElementById("sessionList");
const sessionSearch = document.getElementById("sessionSearch");
const send_btn = document.getElementById("send-btn");
const model_selector = document.getElementById("model-selector");
const models_list = document.getElementById("model-selector-list");
const model_list_btn = document.getElementById("models-btn");
const model_name_label = document.getElementById("model-name-label");

var models = [];
update_models();

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

async function copyText(text) {
  console.log(text);
  await navigator.clipboard.writeText(text);
}

function escape(text){
  return text
  .replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r').replace(/\"/g, '\\"').replace(/'/g, "\\'");
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
          li.id = `session-${session.session_id}`;
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
  let prev = document.querySelector(".current-session");
  if (prev) prev.classList.remove("current-session");
  document
    .getElementById(`session-${sessionId}`)
    .classList.add("current-session");
}

function addMessage(message, isUser) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message");
  messageElement.classList.add(isUser ? "user-message" : "bot-message");
  let body = document.createElement("md-block");
  body.textContent = message
  messageElement.appendChild(body);
  div = document.createElement("div");
  div.innerHTML = `<button class="copy-btn" onclick="navigator.clipboard.writeText('${escape(message)}')">...</button>`;
  messageElement.appendChild(div);
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addFileMessage(message) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message", "file-message");
  let body = document.createElement("md-block");
  body.innerHTML = `
    <h2>${message.file_name}</h2>
    <div>${message.content}</div>
  `;
  messageElement.innerHTML+=`<button class="copy-btn" onclick="navigator.clipboard.writeText('${escape(message.content)}')">...</button>`;
  messageElement.appendChild(body);
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
  if (!message || !/[^ \n]+/.test(message)) {
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

function update_models() {
  sessionList.innerHTML = "";
  fetch("/models", {
    method: "GET",
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.models) {
        models = data.models;
        models_list.innerHTML = "";
        models.forEach(
          (model) =>
            (models_list.innerHTML += `<tr><td><button onclick="set_model('${model}')" id='model-${model}'>${model}</button></td></tr>`)
        );
        get_model();
      } else {
        alert("Error: " + data.error);
      }
    })
    .catch((error) => console.error("Fetch Error:", error));
}

function get_model() {
  fetch(`/get_model`, {
    method: "GET",
  })
    .then((response) => response.json())
    .then((data) => highlight_selected_model(data.model))
    .catch((error) => console.error("Fetch Error:", error));
}

function highlight_selected_model(model_name) {
  prev = document.querySelector(".selected-model");
  if (prev) prev.classList.remove("selected-model");

  let el = document.getElementById(`model-${model_name}`);
  model_name_label.innerHTML = model_name;
  console.log(model_name);
  el.classList.add("selected-model");
}


function set_model(model_name) {
  disable_Send();
  fetch(`/set_model/${model_name}`, {
    method: "GET",
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        model_selector.style.display = "none";
        highlight_selected_model(model_name);
      } else {
        alert("Error:\n" + data.error);
      }
      enable_Send();
    })
    .catch((error) => console.error("Fetch Error:", error));
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

model_list_btn.addEventListener("mouseenter", () => {
  model_name_label.classList.remove("model-label-hidden");
});

model_list_btn.addEventListener("mouseleave", () => {
  model_name_label.classList.add("model-label-hidden");
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

function toggleModelSelector() {
  if (model_selector.style.display == "none")
    model_selector.style.display = "block";
  else model_selector.style.display = "none";
}

clearInputs();
hidechat();
populateSessions();
