from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import subprocess

from werkzeug.utils import secure_filename

import os
from io import BytesIO
from json import dumps

from langchain_ollama import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate


from file_readers import *
from config import *


def list_models():
    try:
        result = subprocess.run(["ollama", "list"], capture_output=True, text=True, check=True)
        lines = result.stdout.strip().split("\n")
        firsts = [line.split()[0] for line in lines]
        return firsts[firsts.index("NAME")+1:]
    except subprocess.CalledProcessError as e:
        print("Error: " + e.stderr)
        return []

template = """
    You are Nexus my personal chatbot. Answer the question. Use Markdown format whenever you can.

    here is the conversation history: {context}

    Question: {question}

    Answer:

"""
model_list = list_models()
DEFAULT_MODEL = "mistral:latest" 



current_model = DEFAULT_MODEL if DEFAULT_MODEL in model_list else model_list[0]


def load_model():
    model_config = get_model_config()
    return OllamaLLM(
        model=current_model,
        temperature=model_config['temperature'],
        max_tokens=model_config['max_tokens'],
        top_k= model_config['top_k'],
        top_p=model_config['top_p'],
        num_gpu=model_config['num_gpu'],
        repeat_last_n=model_config['repeat_last_n'],
        repeat_penalty=model_config['repeat_penalty'],
        num_thread=model_config['num_thread']
    )

model = load_model()
prompt = ChatPromptTemplate.from_template(template)
chain = prompt | model
context = ''



app = Flask(__name__)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///chat.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class Session(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    chats = db.relationship('Chat', back_populates='session', lazy=True)

USER = True
AI = False
class Chat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('session.id'), nullable=False)
    message = db.Column(db.String(5000), nullable=False)  
    sender = db.Column(db.Boolean, nullable=False)
    message_type = db.Column(db.String(50), default='text') 
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    session = db.relationship('Session', back_populates='chats')

    def __repr__(self):
        return f'<Chat {self.id}>'

with app.app_context():
    db.create_all()



@app.route('/')
def home():
    return render_template('index.html')


@app.route('/create_session', methods=['POST'])
def create_session():
    global context
    try:
        title = request.json.get('title', '').strip()
        
        if not title:
            title = 'Untitled Session'
        elif len(title) > 255:
            return {'error': 'Session title must be 255 characters or less'}, 400

        new_session = Session(title=title)
        db.session.add(new_session)
        db.session.flush()

        context = ""

        db.session.commit()

        return {'session_id': new_session.id, 'message': 'Session created successfully'}, 201

    except Exception as e:
        db.session.rollback()
        return {'error': f'Failed to create session: {str(e)}'}, 500


@app.route('/delete_session/<int:session_id>', methods=['DELETE'])
def delete_session(session_id):
    session = Session.query.get(session_id)
    if not session:
        return {'error': 'Session not found'}, 404

    Chat.query.filter_by(session_id=session_id).delete()
    db.session.delete(session)
    db.session.commit()
    return {'message': f'Session {session_id} and all its chats were deleted successfully'}, 200


@app.route('/send_message', methods=['POST'])
def send_message():
    global context
    session_id = request.json.get('session_id')
    message = request.json.get('message')

    if not session_id or not message:
        return {'error': 'Missing session_id or message'}, 400

    session = Session.query.get(session_id)
    if not session:
        return {'error': 'Session not found'}, 404

    try:
        user_chat = Chat(session_id=session_id, message=message, sender=USER)
        db.session.add(user_chat)

        result = chain.invoke({"context": context, "question": message})
        ai_chat = Chat(session_id=session_id, message=result, sender=AI)
        db.session.add(ai_chat)

        context += f"\nUser: {message}\nAI: {result}"

        db.session.commit()

        return {'message': result}, 201

    except Exception as e:
        db.session.rollback()
        return {'error': f'Failed to process message: {str(e)}'}, 500


@app.route('/upload_files', methods=['POST'])
def upload_files():
    global context
    session_id = request.form.get('session_id')
    if not session_id:
        return {'error': 'Missing session_id'}, 400

    session = Session.query.get(session_id)
    if not session:
        return {'error': 'Session not found'}, 404

    if 'files[]' not in request.files:
        return {'error': 'No files part in the request'}, 400

    files = request.files.getlist('files[]')

    if not files or all(file.filename == '' for file in files):
        return {'error': 'No files selected'}, 400

    try:
        res = []
        for file in files:
            if file and allowed_file(file.filename):
                file_content = read_file(file)
                message = {
                    'file_name': file.filename,
                    'content': file_content,
                }

                file_chat = Chat(session_id=session_id, message=dumps(message), sender=USER, message_type='file')
                db.session.add(file_chat)
                res.append(message)
                context += f"\n[File]: {dumps(message)}\n"

        db.session.commit()
        return {'message': res}, 201

    except Exception as e:
        db.session.rollback()
        return {'error': f'Failed to process files: {str(e)}'}, 500

@app.route('/get_chats/<int:session_id>', methods=['GET'])
def get_chats(session_id):
    global context
    session = Session.query.get(session_id)
    if not session:
        return {'error': 'Session not found'}, 404

    chats_ = Chat.query.filter_by(session_id=session_id).order_by(Chat.timestamp).all()
    context = "";
    chats = []

    for chat in chats_:
        if chat.message_type in ['text', 'file']:
            context += f"\n{'User' if chat.sender else 'AI'}: {chat.message}"
            chats.append({
                'id': chat.id,
                'message': chat.message,
                'sender': chat.sender,
                'message_type': chat.message_type,
                'timestamp': chat.timestamp
        })

    return {
        'session_id': session_id,
        'chats': chats
    }, 200

TITLE_PROMPT = """Read the Conversation between a user and a chat bot and provide exactly one title not more that 3 words. dont't use Markdown for this naming task."""
def new_title(session_id):
    print("callde")
    chats = Chat.query.filter_by(session_id=session_id).order_by(Chat.timestamp).all()
    if len(chats) == 0:
        return "Untitled"
    temp = ""
    for chat in chats:
        temp += f"\n{'User' if chat.sender else 'AI'}: {chat.message}"
    ans = chain.invoke({"context": temp, "question": TITLE_PROMPT})
    Session.query.filter_by(id=session_id).update({Session.title: ans})
    db.session.commit()
    return ans


@app.route('/get_sessions', methods=['GET'])
def get_sessions():
    sessions = Session.query.order_by(Session.created_at.desc()).all()
    session_list = []
    for  session in sessions:
        session_list.append({
            'session_id': session.id,
            'title': new_title(session.id) if session.title == "Untitled" else session.title ,
            'created_at': session.created_at
        })

    return {'sessions': session_list}, 200


@app.route('/models', methods=['GET'])
def get_models():
    try:
        return {'models': list_models()}
    except Exception as e:
        return {'error': str(e)}


@app.route('/config', methods=['GET'])
def get_config():
    model_config = get_model_config()
    return {
        'config': model_config, 
        'max_threads': get_max_threads(),
        'gpus': count_nvidia_gpus()
    }

@app.route('/reset_config', methods=['POST'])
def reset_config():
    reset_model_config()
    try:
        _set_model(current_model, force=True)
        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@app.route('/update_config', methods=['POST'])
def update_config():
    data = request.get_json()
    try:
        update_model_config(data)
        _set_model(current_model, force=True)
    except Exception as e:
        reset_config()
        return {'success': False, 'error': str(e)}
    return {"success": True}

def _set_model(model_name, force=False):
    global model, chain, current_model
    try:
        if force or current_model != model_name:
            model = load_model()
            chain = prompt | model
            current_model = model_name
        return True
    except Exception as e:
        return False

@app.route('/set_model/<string:model_name>', methods=['GET'])
def set_model(model_name):
    global model, chain, current_model
    try:
        if current_model != model_name:
            model = load_model()
            chain = prompt | model
            current_model = model_name
        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}



@app.route('/get_model', methods=['GET'])
def get_model():
    return {'model': current_model}


if __name__ == '__main__':
    app.run(debug=True)

"""
TODO: add copy code 
TODO: improve the model.
TODO: Vector storage.
TODO: Code running functionality.
TODO: Browsing functionality.
"""