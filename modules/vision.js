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
    }
    
    async renderOverlay(canvas, ctx, faceImg, shirtColor) {
        const result = this.faceLandmarker.detect(faceImg);
        
        if (result.faceLandmarks.length > 0) {
            const landmarks = result.faceLandmarks[0];
            
            // 1. Clear and draw the original face photo
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(faceImg, 0, 0, canvas.width, canvas.height);

            // 2. Define the 'Neckline' Points
            // MediaPipe Landmark 152 is the chin.
            // Landmarks 132 and 361 are the left and right jaw joints.
            const leftJaw = landmarks[132];
            const chin = landmarks[152];
            const rightJaw = landmarks[361];

            // 3. Draw the Virtual Collar
            ctx.beginPath();
            ctx.moveTo(leftJaw.x * canvas.width, leftJaw.y * canvas.height);
            
            // Create a 'V-neck' shape below the chin
            const vDepth = 0.15; // How deep the shirt collar goes
            ctx.lineTo(chin.x * canvas.width, (chin.y + vDepth) * canvas.height);
            ctx.lineTo(rightJaw.x * canvas.width, rightJaw.y * canvas.height);
            
            // 4. Style the Shirt Overlay
            ctx.fillStyle = shirtColor;
            ctx.globalAlpha = 0.8; // Make it slightly transparent to show skin texture
            ctx.fill();

            // 5. Add a shadow for realism
            ctx.shadowBlur = 15;
            ctx.shadowColor = "rgba(0,0,0,0.3)";
            ctx.stroke();
            
            ctx.globalAlpha = 1.0;
        }
    }
};
