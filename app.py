from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import sys

from langchain_ollama import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate

template = """
    Answer the question below.

    here is the conversation history: {context}

    Question: {question}

    Answer:

"""

model = OllamaLLM(model="llama3")
prompt = ChatPromptTemplate.from_template(template)
chain = prompt | model
contexts = {}

# Initialize Flask app
app = Flask(__name__)

# Configure SQLite database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///chat.db'  # Change to preferred DB if needed
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)


# Session Table Model
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
    message = db.Column(db.String(500), nullable=False)
    sender = db.Column(db.Boolean, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    session = db.relationship('Session', back_populates='chats')

    def __repr__(self):
        return f'<Chat {self.id}>'

# Initialize database
with app.app_context():
    db.create_all()


MAX_CONTEXT_SIZE = 500 * 1024 * 1024
MAX_ENTRIES = 10

import sys

MAX_CONTEXT_SIZE = 500 * 1024 * 1024  # 500 MB

def new_context(session_id, context=""):
    total_size = sys.getsizeof(context) + sum(sys.getsizeof(val) for val in contexts.values())

    if len(contexts) >= 10:
        total_size -= sys.getsizeof(contexts.popitem(last=False)[1])

    while total_size > MAX_CONTEXT_SIZE and len(contexts) > 0:
        total_size -= sys.getsizeof(contexts.popitem(last=False)[1])
        
    contexts[session_id] = context


@app.route('/')
def home():
    return render_template('index.html')

@app.route('/create_session', methods=['POST'])
def create_session():
    try:
        title = request.json.get('title', '').strip()
        
        if not title:
            title = 'Untitled Session'
        elif len(title) > 255:
            return {'error': 'Session title must be 255 characters or less'}, 400

        new_session = Session(title=title)
        db.session.add(new_session)
        db.session.flush()  # Flush to get the ID of the new session

        new_context(new_session.id)

        db.session.commit()

        return {'session_id': new_session.id, 'message': 'Session created successfully'}, 201

    except Exception as e:
        # Handle any exceptions that occur
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
    contexts.pop(session_id, None)
    return {'message': f'Session {session_id} and all its chats were deleted successfully'}, 200


@app.route('/send_message', methods=['POST'])
def send_message():
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

        result = chain.invoke({"context": contexts[session_id], "question": message})

        ai_chat = Chat(session_id=session_id, message=result, sender=AI)
        db.session.add(ai_chat)

        contexts[session_id] += f"\nUser: {message}\nAI: {result}"

        db.session.commit()

        return {'message': result}, 201

    except Exception as e:
        db.session.rollback()  # Rollback changes on failure
        return {'error': f'Failed to process message: {str(e)}'}, 500


@app.route('/get_chats/<int:session_id>', methods=['GET'])
def get_chats(session_id):

    session = Session.query.get(session_id)
    if not session:
        return {'error': 'Session not found'}, 404

    chats_ = Chat.query.filter_by(session_id=session_id).order_by(Chat.timestamp).all()

    chats = [
        {
            'id': chat.id,
            'message': chat.message,
            'sender': chat.sender,
            'timestamp': chat.timestamp
        }
        for chat in chats_
    ]

    context = ''
    for i in range(0, len(chats), 2):
        context += f"\nUser: {chats[i]['message']}\nAI: {chats[i+1]['message']}"
    new_context(session_id, context)

    return {
        'session_id': session_id,
        'chats': chats
    }, 200

@app.route('/get_sessions', methods=['GET'])
def get_sessions():
    sessions = Session.query.order_by(Session.created_at.desc()).all()

    session_list = [
        {
            'session_id': session.id,
            'title': session.title,
            'created_at': session.created_at
        }
        for session in sessions
    ]

    return {'sessions': session_list}, 200



if __name__ == '__main__':
    app.run(debug=True)