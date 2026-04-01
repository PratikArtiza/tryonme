import { VisionEngine } from './modules/vision.js';

// Inside your init() function:
await VisionEngine.init();

// app.js - The Orchestrator
import { ProfileStorage } from './modules/storage.js';
import { ColorEngine } from './modules/colors.js';

// Configuration for 2026 MediaPipe Tasks
const VISION_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

class VibeCheckApp {
    constructor() {
        this.nodes = {
            faceInput: document.getElementById('face-upload'),
            shirtInput: document.getElementById('shirt-upload'),
            status: document.getElementById('status-bar'),
            canvas: document.getElementById('output_canvas'),
            verdict: document.getElementById('verdict-badge')
        };
        
        this.ctx = this.nodes.canvas.getContext('2d');
        this.init();
    }

    async init() {
        this.updateStatus("Initializing AI Modules...");
        
        // 1. Check for existing Master Face in IndexedDB
        const savedProfile = await ProfileStorage.getMasterFace();
        if (savedProfile) {
            this.updateStatus("Master Face loaded from storage.");
            this.renderPreview(savedProfile.imageData);
        }

        // 2. Setup Event Listeners
        this.nodes.faceInput.addEventListener('change', (e) => this.handleFaceUpload(e));
        this.nodes.shirtInput.addEventListener('change', (e) => this.handleShirtScan(e));
    }

    updateStatus(msg) {
        this.nodes.status.innerText = msg;
        console.log(`[VibeCheck] ${msg}`);
    }

    async handleFaceUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.updateStatus("Analyzing Face & Skin Tone...");
        
        // In a real app, we'd run MediaPipe FaceLandmarker here
        // For now, we sample a central pixel for the skin tone
        const tempImage = await this.fileToImage(file);
        const skinHex = this.sampleCentralColor(tempImage);

        // Save to IndexedDB (Dexie)
        await ProfileStorage.saveMasterFace(file, skinHex);
        
        this.renderPreview(file);
        this.updateStatus("Master Face Saved!");
    }

    async handleShirtScan(event) {
        const file = event.target.files[0];
        const profile = await ProfileStorage.getMasterFace();
        if (!profile) return;
    
        this.updateStatus("Removing Background...");
        const rawShirtImg = await this.fileToImage(file);
        
        // NEW STEP: Extract only the sweater
        const cleanShirtImg = await VisionEngine.extractShirt(rawShirtImg);
    
        this.updateStatus("Mapping Texture...");
        const faceImg = await this.fileToImage(profile.imageData);
    
        // Render the CLEAN shirt onto your face
        await VisionEngine.renderOverlay(this.nodes.canvas, this.ctx, faceImg, cleanShirtImg);
        
        // Verdict logic remains the same
        const shirtHex = this.sampleCentralColor(cleanShirtImg);
        const result = ColorEngine.analyzeHarmony(profile.skinHex, shirtHex);
        this.showVerdict(result);
    }

    // Helper: Convert File to Image Object
    fileToImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // Simple Color Sampler (Placeholder for AI Segmentation)
    sampleCentralColor(img) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1; canvas.height = 1;
        // Draw the center of the image into a 1x1 pixel
        ctx.drawImage(img, img.width/2, img.height/2, 1, 1, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    renderPreview(fileBlob) {
        const url = URL.createObjectURL(fileBlob);
        const img = new Image();
        img.onload = () => {
            this.nodes.canvas.width = img.width;
            this.nodes.canvas.height = img.height;
            this.ctx.drawImage(img, 0, 0);
        };
        img.src = url;
    }

    showVerdict(result) {
        this.nodes.verdict.innerText = result.verdict;
        this.nodes.verdict.className = `visible ${result.class}`;
        this.updateStatus(`Analysis Complete: ${result.verdict}`);
    }
}

// Start the app
new VibeCheckApp();
