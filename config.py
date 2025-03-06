import json
import os
import psutil

config_path = "config.json"

DEFAULT_MODEL_CONFIG = {
    'temperature': None,
    'max_tokens': None,

    'top_k': None,
    'top_p': None,

    'repeat_last_n': None,
    'repeat_penalty': None,

    'num_gpu': None,
    'num_thread': None,
}

if not os.path.exists(config_path):
    with open(config_path, 'w') as f:
        json.dump(DEFAULT_MODEL_CONFIG, f, indent=4)

def get_model_config():
    with open(config_path, 'r') as f:
        config = json.load(f)
        return config
    
def update_model_config(config):
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=4)

def reset_model_config():
    update_model_config(DEFAULT_MODEL_CONFIG)
    return DEFAULT_MODEL_CONFIG


def get_max_threads():
    return os.cpu_count()

import subprocess

def count_nvidia_gpus():
    try:
        result = subprocess.run(["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"], 
                                stdout=subprocess.PIPE, text=True)
        gpus = result.stdout.strip().split("\n")
        return len(gpus) if gpus[0] else 0
    except FileNotFoundError:
        print("nvidia-smi not found. Ensure NVIDIA drivers are installed.")
        return 0
