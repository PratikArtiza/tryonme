// modules/vision.js - The AI Vision Module
import { FilesetResolver, FaceLandmarker, ImageSegmenter } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

export const VisionEngine = {
    faceLandmarker: null,
    imageSegmenter: null,

    async init() {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        // Initialize Face Landmarker (for the Master Face)
        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: "IMAGE"
        });

        // Initialize Image Segmenter (to cut out the shirt)
        this.imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite`,
                delegate: "GPU"
            },
            runningMode: "IMAGE"
        });
    },

    async getSkinTone(imageElement) {
        const result = this.faceLandmarker.detect(imageElement);
        if (result.faceLandmarks.length > 0) {
            // Landmark 1 (Tip of nose) or 4 (Chin) are good reference points
            // For skin tone, we sample a point near the cheek (Landmark 234)
            const cheek = result.faceLandmarks[0][234];
            return { x: cheek.x, y: cheek.y };
        }
        return null;
    },

    async extractShirtColor(imageElement) {
        // This runs the "Selfie Segmenter" to find the person/clothing
        // and ignore the background store shelves.
        const result = await this.imageSegmenter.segment(imageElement);
        const mask = result.confidenceMasks[0]; 
        // Logic to sample only the pixels within the 'clothing' mask...
        return "#7B3F00"; // Placeholder for the extracted dominant shirt hex
    },
    
    async renderOverlay(canvas, ctx, faceImg, shirtColor) {
        canvas.width = faceImg.width;
        canvas.height = faceImg.height;
    
        const result = this.faceLandmarker.detect(faceImg);
        
        if (result.faceLandmarks && result.faceLandmarks.length > 0) {
            const landmarks = result.faceLandmarks[0];
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(faceImg, 0, 0);
    
            ctx.save(); 
    
            // LANDMARK KEY:
            // 132: Left Jaw | 361: Right Jaw | 152: Bottom of Chin
            const leftJaw = landmarks[132];
            const rightJaw = landmarks[361];
            const chin = landmarks[152];
    
            ctx.beginPath();
            
            // Start the collar slightly BELOW the jaw joints
            const offset = 0.05; 
            ctx.moveTo(leftJaw.x * canvas.width, (leftJaw.y + offset) * canvas.height);
            
            // The V-Point: We move it significantly DOWN from the chin
            // Change 0.25 to 0.40 if you want a deeper V-neck
            const vDepth = 0.30; 
            ctx.lineTo(chin.x * canvas.width, (chin.y + vDepth) * canvas.height);
            
            // Close the triangle at the right jaw
            ctx.lineTo(rightJaw.x * canvas.width, (rightJaw.y + offset) * canvas.height);
            
            // Close the path back to the start
            ctx.closePath();
    
            // Style
            ctx.fillStyle = shirtColor;
            ctx.globalAlpha = 0.7; // Transparency helps it look like fabric
            ctx.fill();
            
            // Add a soft edge so it doesn't look like a sharp triangle
            ctx.strokeStyle = "rgba(255,255,255,0.2)";
            ctx.lineWidth = 2;
            ctx.stroke();
    
            ctx.restore();
        }
    }
};
