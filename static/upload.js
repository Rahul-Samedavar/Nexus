var selectedFiles = [];
const fileInput = document.getElementById('fileInput');
const previewContainer = document.getElementById('preview-container');
function updatePreviews() {
    // Clear the preview container
    previewContainer.innerHTML = '';

    selectedFiles.forEach((file, index) => {
        const fileType = getFileType(file);
        if (fileType === 'image') {
            const reader = new FileReader();
            reader.onload = function (e) {
                const preview = createFilePreview(e.target.result, file.name, 'image', index);
                previewContainer.appendChild(preview);
            };
            reader.readAsDataURL(file);
        } else {
            const preview = createFilePreview(null, file.name, fileType, index);
            previewContainer.appendChild(preview);
        }
    });
}

function getFileType(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    if (file.type.startsWith('image/')) return 'image';
    if (extension === 'pdf') return 'pdf';
    if (extension === 'py') return 'py';
    if (extension === 'txt') return 'txt';
    if (extension === 'doc' || extension === 'docx') return 'docx';
    if (extension === 'xlsx' || extension === 'xls') return 'xlsx';
    if (extension === 'ppt' || extension === 'pptx') return 'pptx';
    if (extension === 'csv') return csv
    if (extension === 'js') return 'js';
    if (extension === 'log') return 'log';
    if (extension === 'java') return 'java';
    if (extension === 'json') return 'json';
    if (extension === 'css') return 'css';
    if (extension === 'html') return 'html';
    return 'file';
}


function handleFileUpload(event) {
    const files = Array.from(event.target.files); // Convert FileList to an array
    selectedFiles = [...selectedFiles, ...files]; // Add new files to the array
    updatePreviews();
    resetFileInput(); // Clear the file input to allow re-adding the same files
}


function createFilePreview(src, fileName, fileType, index) {
    const preview = document.createElement('div');
    preview.className = 'file-preview';

    if (fileType === 'image') {
        const img = document.createElement('img');
        img.src = src;
        img.alt = fileName;
        preview.appendChild(img);
    } else {
        const img = document.createElement('img');
        img.src = `./static/assets/${fileType}.png`;
        img.alt = fileName;
        img.className = "file-icon";
        preview.appendChild(img);

        const name = document.createElement('div');
        name.className = 'file-name';
        name.textContent = fileName;
        preview.appendChild(name);
    }

    const removeButton = document.createElement('button');
    removeButton.className = 'remove-button';
    removeButton.innerHTML = '&times;';
    removeButton.addEventListener('click', () => {
        removeFile(index); // Remove file when button is clicked
    });

    preview.appendChild(removeButton);

    return preview;
}

function removeFile(index) {
    selectedFiles.splice(index, 1); // Remove the file from the array
    updatePreviews(); // Recreate previews
    resetFileInput(); // Update the file input to match the current selection
}

function resetFileInput() {
    const dataTransfer = new DataTransfer(); // Create a new DataTransfer object
    selectedFiles.forEach(file => dataTransfer.items.add(file)); // Add remaining files
    fileInput.files = dataTransfer.files; // Assign the updated file list to the input
}


document.addEventListener('DOMContentLoaded', () => {
    fileInput.addEventListener('change', handleFileUpload);
});
