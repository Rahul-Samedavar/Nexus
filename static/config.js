var settings = {};

function toggleCustomizationPanel() {
    const panel = document.getElementById('customization-panel');
    const modelSelector = document.getElementById('model-selector');
    
    if (modelSelector.style.display === 'block') modelSelector.style.display = 'none';
    
    if (panel.style.display === 'block') panel.style.display = 'none';
    else {
      panel.style.display = 'block';
      loadSettings();
    }
  }
  

  function loadSettings(){  
    fetch("/config", {
        method: "GET",
    })
        .then((response) => response.json())
        .then((data) => {loadCustomizationSettings(data)})
        .catch((error) => console.error("Fetch Error:", error));
  }

  function loadCustomizationSettings(data) {
    settings = data.config;
    document.getElementById('temperature').value = settings.temperature;
    document.getElementById('max_tokens').value = settings.max_tokens;
    document.getElementById('top_k').value = settings.top_k;
    document.getElementById('top_p').value = settings.top_p;
    document.getElementById('repeat_last_penalty').value = settings.repeat_last_penalty;
    document.getElementById('repeat_last_n').value = settings.repeat_last_;
    document.getElementById('num_gpu').value = settings.num_gpu;
    document.getElementById('num_gpu').max = data.gpus;
    document.getElementById('num_thread').value = settings.num_thread;
    document.getElementById('num_thread').max = data.max_threads;
  }
  

  function resetCustomization(){    
    fetch("/reset_config", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) alert("Reset configuration to default");
      else alert("Failed to reset configuration\n" + data.error);
    })

  }

  function saveCustomization() {
    const settings = {
      temperature: parseFloat(document.getElementById('temperature').value),
      max_tokens: parseInt(document.getElementById('max_tokens').value),
      top_k: parseInt(document.getElementById('top_k').value),
      top_p: parseFloat(document.getElementById('top_p').value),
      repeat_penalty: parseFloat(document.getElementById('repeat_last_penalty').value),
      repeat_last_n: parseInt(document.getElementById('repeat_last_n').value),
      num_gpu: parseInt(document.getElementById('num_gpu').value),
      num_thread: parseInt(document.getElementById('num_thread').value)
    };
    
    fetch("/update_config", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    })
     .then((response) => response.json())
     .then((data) => {
        if (data.success) alert("Saved configuration");
        else alert("Failed to save configuration\n" + data.error);
      })
     .catch((error) => console.error("Fetch Error:", error));  
      
    document.getElementById('customization-panel').style.display = 'none';
    
  }
  
  document.addEventListener('click', function(event) {
    const customizationPanel = document.getElementById('customization-panel');
    const customizeBtn = document.getElementById('customize-btn');
    
    if (customizationPanel.style.display === 'block' && 
        !customizationPanel.contains(event.target) && 
        !customizeBtn.contains(event.target)) {
      customizationPanel.style.display = 'none';
    }
  });
  